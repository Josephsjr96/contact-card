import os

SERVICE_NAME = "inference"
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

REGISTRY_URL = os.getenv("REGISTRY_URL", "http://registry:8001")
REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))

MODEL_NAME = os.getenv("MODEL_NAME", "translation")  # registry model name under canary control

# Base HF checkpoints. The Registry tracks fine-tuned *versions* of the NLLB
# model (LoRA adapters on top of this base); M2M-100 is used as a fixed
# comparison baseline and is not itself versioned/canaried.
NLLB_BASE_MODEL = os.getenv("NLLB_BASE_MODEL", "facebook/nllb-200-distilled-600M")
M2M_BASE_MODEL = os.getenv("M2M_BASE_MODEL", "facebook/m2m100_418M")

# Hardware constraint (Ryzen 5 5500U / 16GB RAM, no GPU): load in float16
# where supported and keep only what's actually been requested in memory.
TORCH_DTYPE = os.getenv("TORCH_DTYPE", "float16")
DEVICE = os.getenv("DEVICE", "cpu")

MODEL_CACHE_DIR = os.getenv("MODEL_CACHE_DIR", "/data/model_cache")

S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://minio:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
S3_BUCKET = os.getenv("S3_BUCKET", "models")
