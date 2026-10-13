import os

SERVICE_NAME = "rollback-worker"
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

REGISTRY_URL = os.getenv("REGISTRY_URL", "http://registry:8001")
PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://prometheus:9090")
MODEL_NAME = os.getenv("MODEL_NAME", "translation")

# Rollback if the canary's error rate exceeds this fraction (0-1) of requests
# over the observation window, AND is meaningfully worse than stable's.
ROLLBACK_THRESHOLD = float(os.getenv("ROLLBACK_THRESHOLD", "0.1"))
OBSERVATION_WINDOW = os.getenv("OBSERVATION_WINDOW", "5m")  # Prometheus range duration
POLL_INTERVAL_SECONDS = int(os.getenv("POLL_INTERVAL_SECONDS", "30"))
# Minimum canary sample size before trusting its error rate at all -- avoids
# rolling back a candidate that has only served 2 requests.
MIN_CANARY_SAMPLES = int(os.getenv("MIN_CANARY_SAMPLES", "10"))
