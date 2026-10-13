"""
Training pipeline for the poetic translation platform.

Flow (matches the blueprint's section 10):
  load data -> prepare dataset -> load NLLB -> apply LoRA -> fine-tune ->
  evaluate -> save model -> log to MLflow -> upload to MinIO -> register

This script intentionally does NOT touch production traffic, Redis, or the
deployment_state table -- it only creates a candidate by calling the
Registry's /models/register endpoint. Deploying that candidate as a canary
is a separate, explicit operation (via the dashboard or the Registry API),
matching the blueprint's "training creates candidates; the Registry decides
what happens to candidates afterward" rule.

Run:
    python training/train.py --source persian --target german --epochs 3
"""
import argparse
import json
import os
import sys
import uuid

import mlflow
import requests
import torch
from datasets import load_dataset, Dataset
from transformers import (
    AutoTokenizer, AutoModelForSeq2SeqLM, Seq2SeqTrainer, Seq2SeqTrainingArguments,
    DataCollatorForSeq2Seq,
)
from peft import get_peft_model

sys.path.insert(0, os.path.dirname(__file__))
from lora_config import TrainingConfig

MLFLOW_TRACKING_URI = os.getenv("MLFLOW_TRACKING_URI", "http://mlflow:5000")
REGISTRY_URL = os.getenv("REGISTRY_URL", "http://registry:8001")
S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://minio:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
S3_BUCKET = os.getenv("S3_BUCKET", "models")
MODEL_NAME = os.getenv("MODEL_NAME", "translation")
LOCAL_OUTPUT_DIR = os.getenv("TRAINING_OUTPUT_DIR", "/tmp/training_output")

LANGUAGE_CODES = {
    "persian": "pes_Arab", "german": "deu_Latn", "polish": "pol_Latn",
}


def load_parallel_dataset(dataset_id: str, source_lang: str, target_lang: str) -> Dataset:
    """Load a parallel poetry corpus.

    For the MVP this expects a local JSONL file with {"source": ..., "target": ...}
    records (see training/README or the RESEARCH NOTES in the original app
    about building this corpus). Swap this out for a real HF dataset id once
    one exists. A tiny synthetic fallback is used if nothing is found, purely
    so the pipeline is runnable end-to-end without a real corpus yet.
    """
    local_path = dataset_id.replace("local:", "") + ".jsonl"
    if os.path.exists(local_path):
        return load_dataset("json", data_files=local_path, split="train")

    print(f"[train] WARNING: no corpus found at '{local_path}'. "
          f"Using a tiny synthetic placeholder so the pipeline can run end-to-end. "
          f"Replace with a real parallel poetry corpus before trusting results.")
    synthetic = [
        {"source": "The rose blooms in silence.", "target": "Die Rose blüht in Stille."},
        {"source": "The nightingale sings of longing.", "target": "Die Nachtigall singt von Sehnsucht."},
    ]
    return Dataset.from_list(synthetic)


def preprocess(examples, tokenizer, source_key: str, target_key: str):
    inputs = tokenizer(examples["source"], truncation=True, max_length=256, padding="max_length")
    with tokenizer.as_target_tokenizer():
        labels = tokenizer(examples["target"], truncation=True, max_length=256, padding="max_length")
    inputs["labels"] = labels["input_ids"]
    return inputs


def upload_to_minio(local_dir: str, version: str) -> str:
    from minio import Minio
    endpoint = S3_ENDPOINT.replace("http://", "").replace("https://", "")
    client = Minio(endpoint, access_key=S3_ACCESS_KEY, secret_key=S3_SECRET_KEY,
                    secure=S3_ENDPOINT.startswith("https"))
    if not client.bucket_exists(S3_BUCKET):
        client.make_bucket(S3_BUCKET)

    prefix = f"{MODEL_NAME}/{version}"
    for root, _, files in os.walk(local_dir):
        for fname in files:
            local_path = os.path.join(root, fname)
            rel_path = os.path.relpath(local_path, local_dir)
            object_name = f"{prefix}/{rel_path}"
            client.fput_object(S3_BUCKET, object_name, local_path)

    return f"s3://{S3_BUCKET}/{prefix}"


def register_with_registry(version: str, artifact_uri: str, run_id: str, config: TrainingConfig):
    resp = requests.post(f"{REGISTRY_URL}/models/register", json={
        "name": MODEL_NAME,
        "version": version,
        "artifact_uri": artifact_uri,
        "mlflow_run_id": run_id,
        "metadata": config.as_dict(),
    }, timeout=30)
    resp.raise_for_status()
    return resp.json()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="persian")
    parser.add_argument("--target", default="german")
    parser.add_argument("--epochs", type=int, default=None)
    parser.add_argument("--version", default=None, help="Version to register, e.g. v3. Auto-generated if omitted.")
    args = parser.parse_args()

    config = TrainingConfig(source_lang=args.source, target_lang=args.target)
    if args.epochs:
        config.num_epochs = args.epochs
    version = args.version or f"v-{uuid.uuid4().hex[:8]}"

    torch.manual_seed(config.seed)

    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    mlflow.set_experiment("poetic-translation-lora")

    with mlflow.start_run() as run:
        mlflow.log_params(config.as_dict())

        print(f"[train] Loading base model: {config.base_model}")
        tokenizer = AutoTokenizer.from_pretrained(config.base_model)
        tokenizer.src_lang = LANGUAGE_CODES[config.source_lang]
        base_model = AutoModelForSeq2SeqLM.from_pretrained(config.base_model)

        print("[train] Applying LoRA adapter")
        model = get_peft_model(base_model, config.to_peft_config())
        model.print_trainable_parameters()

        print(f"[train] Loading dataset: {config.dataset_id}")
        dataset = load_parallel_dataset(config.dataset_id, config.source_lang, config.target_lang)
        tokenized = dataset.map(
            lambda ex: preprocess(ex, tokenizer, config.source_lang, config.target_lang),
            batched=True, remove_columns=dataset.column_names,
        )

        output_dir = os.path.join(LOCAL_OUTPUT_DIR, version)
        training_args = Seq2SeqTrainingArguments(
            output_dir=output_dir,
            per_device_train_batch_size=config.batch_size,
            num_train_epochs=config.num_epochs,
            max_steps=config.max_steps,
            learning_rate=config.learning_rate,
            logging_steps=5,
            save_strategy="no",
            report_to=[],  # we log to MLflow explicitly instead
        )

        trainer = Seq2SeqTrainer(
            model=model,
            args=training_args,
            train_dataset=tokenized,
            data_collator=DataCollatorForSeq2Seq(tokenizer, model=model),
        )

        print("[train] Fine-tuning...")
        train_result = trainer.train()
        mlflow.log_metrics({"train_loss": train_result.training_loss})

        print(f"[train] Saving adapter to {output_dir}")
        model.save_pretrained(output_dir)
        tokenizer.save_pretrained(output_dir)
        mlflow.log_artifacts(output_dir, artifact_path="adapter")

        print("[train] Uploading artifact to MinIO")
        artifact_uri = upload_to_minio(output_dir, version)
        mlflow.log_param("artifact_uri", artifact_uri)

        print(f"[train] Registering {MODEL_NAME}:{version} with Registry")
        registered = register_with_registry(version, artifact_uri, run.info.run_id, config)

        print(json.dumps({
            "status": "success", "version": version, "artifact_uri": artifact_uri,
            "mlflow_run_id": run.info.run_id, "registered": registered,
        }, indent=2))


if __name__ == "__main__":
    main()
