"""
Model loading and inference.

Design for the stated hardware (Ryzen 5 5500U, 16GB RAM, no GPU):
- Lazy loading: nothing is loaded until the first request needs it, so
  container startup is fast and idle memory stays low.
- Models are cached in-process after first load (`_cache` dict) so repeat
  requests don't reload from disk.
- float16 + low_cpu_mem_usage trades a little numerical precision for a
  meaningfully smaller memory footprint, which matters more than raw speed
  on this hardware.
- NLLB versions are fetched from MinIO as LoRA adapters and applied on top
  of the shared base model, so we're not keeping N full model copies in
  memory -- only the (larger) base plus small per-version adapters.
- M2M-100 is a fixed comparison baseline, loaded once, never versioned.
"""
import os
import threading
from typing import Optional

import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

from .config import (
    NLLB_BASE_MODEL, M2M_BASE_MODEL, TORCH_DTYPE, DEVICE, MODEL_CACHE_DIR,
    S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET,
)
from .logging_conf import logger

_DTYPE_MAP = {"float16": torch.float16, "float32": torch.float32, "bfloat16": torch.bfloat16}

# Registry of NLLB/M2M-supported language codes. Kept in sync with the
# original Tkinter research app's LANGUAGES table.
LANGUAGES = {
    "persian": {"nllb_code": "pes_Arab", "m2m_code": "fa"},
    "german": {"nllb_code": "deu_Latn", "m2m_code": "de"},
    "polish": {"nllb_code": "pol_Latn", "m2m_code": "pl"},
}


class ModelManager:
    """Thread-safe, lazy, cached loader for the NLLB (versioned) and M2M (fixed) models."""

    def __init__(self):
        self._lock = threading.Lock()
        self._m2m_tokenizer = None
        self._m2m_model = None
        self._nllb_base_tokenizer = None
        self._nllb_base_model = None
        # version -> (tokenizer, model-with-adapter-applied)
        self._nllb_version_cache: dict[str, tuple] = {}

    # ---- M2M-100 (fixed baseline) -------------------------------------
    def get_m2m(self):
        if self._m2m_model is None:
            with self._lock:
                if self._m2m_model is None:
                    logger.info(f"Lazily loading M2M baseline model: {M2M_BASE_MODEL}")
                    self._m2m_tokenizer = AutoTokenizer.from_pretrained(M2M_BASE_MODEL)
                    self._m2m_model = AutoModelForSeq2SeqLM.from_pretrained(
                        M2M_BASE_MODEL,
                        torch_dtype=_DTYPE_MAP.get(TORCH_DTYPE, torch.float16),
                        low_cpu_mem_usage=True,
                    ).to(DEVICE)
                    self._m2m_model.eval()
        return self._m2m_tokenizer, self._m2m_model

    # ---- NLLB base (shared across versions) ----------------------------
    def _get_nllb_base(self):
        if self._nllb_base_model is None:
            with self._lock:
                if self._nllb_base_model is None:
                    logger.info(f"Lazily loading NLLB base model: {NLLB_BASE_MODEL}")
                    self._nllb_base_tokenizer = AutoTokenizer.from_pretrained(NLLB_BASE_MODEL)
                    self._nllb_base_model = AutoModelForSeq2SeqLM.from_pretrained(
                        NLLB_BASE_MODEL,
                        torch_dtype=_DTYPE_MAP.get(TORCH_DTYPE, torch.float16),
                        low_cpu_mem_usage=True,
                    ).to(DEVICE)
                    self._nllb_base_model.eval()
        return self._nllb_base_tokenizer, self._nllb_base_model

    def get_nllb(self, version: str, artifact_uri: Optional[str] = None):
        """Return (tokenizer, model) for a given registered NLLB version.

        If `artifact_uri` points to a LoRA adapter in MinIO, it is downloaded
        once and applied on top of the shared base model; the result is
        cached per-version so repeat requests are fast. If no adapter is
        available (e.g. during local dev without MinIO), falls back to the
        bare base model so the service still works end-to-end.
        """
        if version in self._nllb_version_cache:
            return self._nllb_version_cache[version]

        with self._lock:
            if version in self._nllb_version_cache:
                return self._nllb_version_cache[version]

            tokenizer, base_model = self._get_nllb_base()
            model = base_model

            if artifact_uri:
                adapter_dir = self._download_adapter(artifact_uri, version)
                if adapter_dir:
                    try:
                        from peft import PeftModel
                        logger.info(f"Applying LoRA adapter for version {version} from {adapter_dir}")
                        model = PeftModel.from_pretrained(base_model, adapter_dir)
                        model.eval()
                    except Exception as e:
                        logger.warning(f"Could not apply LoRA adapter for {version}, "
                                        f"falling back to base model: {e}")
                        model = base_model

            self._nllb_version_cache[version] = (tokenizer, model)
            return tokenizer, model

    def _download_adapter(self, artifact_uri: str, version: str) -> Optional[str]:
        """Download a LoRA adapter directory from MinIO/S3, if reachable."""
        local_dir = os.path.join(MODEL_CACHE_DIR, "adapters", version)
        if os.path.isdir(local_dir) and os.listdir(local_dir):
            return local_dir

        try:
            from minio import Minio
            from urllib.parse import urlparse

            parsed = urlparse(artifact_uri)
            bucket = parsed.netloc or S3_BUCKET
            prefix = parsed.path.lstrip("/")

            endpoint = S3_ENDPOINT.replace("http://", "").replace("https://", "")
            client = Minio(endpoint, access_key=S3_ACCESS_KEY, secret_key=S3_SECRET_KEY,
                            secure=S3_ENDPOINT.startswith("https"))

            os.makedirs(local_dir, exist_ok=True)
            objects = list(client.list_objects(bucket, prefix=prefix, recursive=True))
            if not objects:
                logger.warning(f"No artifact objects found at {artifact_uri}")
                return None
            for obj in objects:
                rel_path = obj.object_name[len(prefix):].lstrip("/")
                dest = os.path.join(local_dir, rel_path or os.path.basename(obj.object_name))
                os.makedirs(os.path.dirname(dest) or local_dir, exist_ok=True)
                client.fget_object(bucket, obj.object_name, dest)
            return local_dir
        except Exception as e:
            logger.warning(f"Could not download adapter artifact {artifact_uri}: {e}")
            return None


model_manager = ModelManager()


def translate_nllb(text: str, source_key: str, target_key: str, version: str,
                    artifact_uri: Optional[str] = None) -> str:
    tokenizer, model = model_manager.get_nllb(version, artifact_uri)
    tokenizer.src_lang = LANGUAGES[source_key]["nllb_code"]
    forced_id = tokenizer.convert_tokens_to_ids(LANGUAGES[target_key]["nllb_code"])
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        generated = model.generate(
            **inputs, forced_bos_token_id=forced_id, max_length=512,
            num_beams=5, no_repeat_ngram_size=3, early_stopping=True,
        )
    return tokenizer.decode(generated[0], skip_special_tokens=True)


def translate_m2m(text: str, source_key: str, target_key: str) -> str:
    tokenizer, model = model_manager.get_m2m()
    tokenizer.src_lang = LANGUAGES[source_key]["m2m_code"]
    forced_id = tokenizer.get_lang_id(LANGUAGES[target_key]["m2m_code"])
    encoded = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        generated = model.generate(
            **encoded, forced_bos_token_id=forced_id, max_length=512,
            num_beams=5, early_stopping=True,
        )
    return tokenizer.decode(generated[0], skip_special_tokens=True)
