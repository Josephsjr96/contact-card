"""Environment-driven configuration for the Registry service."""
import os

DB_PATH = os.getenv("REGISTRY_DB_PATH", "/data/registry.db")
DEFAULT_CANARY_PERCENTAGE = int(os.getenv("CANARY_PERCENTAGE", "5"))
SERVICE_NAME = "registry"
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
