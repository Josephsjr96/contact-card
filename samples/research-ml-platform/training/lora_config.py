"""LoRA configuration, kept reproducible and environment-driven per the
platform's requirement to record training config as part of model lineage.
"""
import os
from dataclasses import dataclass, asdict
from peft import LoraConfig, TaskType


@dataclass
class TrainingConfig:
    base_model: str = os.getenv("NLLB_BASE_MODEL", "facebook/nllb-200-distilled-600M")
    dataset_id: str = os.getenv("DATASET_ID", "local:poetry_corpus_v1")
    source_lang: str = os.getenv("SOURCE_LANG", "persian")
    target_lang: str = os.getenv("TARGET_LANG", "german")
    learning_rate: float = float(os.getenv("LEARNING_RATE", "2e-4"))
    batch_size: int = int(os.getenv("BATCH_SIZE", "4"))
    num_epochs: int = int(os.getenv("NUM_EPOCHS", "3"))
    max_steps: int = int(os.getenv("MAX_STEPS", "-1"))  # -1 = use num_epochs instead
    seed: int = int(os.getenv("SEED", "42"))

    # LoRA-specific
    lora_r: int = int(os.getenv("LORA_R", "8"))
    lora_alpha: int = int(os.getenv("LORA_ALPHA", "16"))
    lora_dropout: float = float(os.getenv("LORA_DROPOUT", "0.05"))
    lora_target_modules: tuple = ("q_proj", "v_proj")

    def as_dict(self) -> dict:
        d = asdict(self)
        d["lora_target_modules"] = list(self.lora_target_modules)
        return d

    def to_peft_config(self) -> LoraConfig:
        return LoraConfig(
            r=self.lora_r,
            lora_alpha=self.lora_alpha,
            lora_dropout=self.lora_dropout,
            target_modules=list(self.lora_target_modules),
            task_type=TaskType.SEQ_2_SEQ_LM,
        )
