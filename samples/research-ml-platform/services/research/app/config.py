import os

SERVICE_NAME = "research"
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
DB_PATH = os.getenv("RESEARCH_DB_PATH", "/data/research.db")
