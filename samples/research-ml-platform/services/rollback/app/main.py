"""
Entry point for the rollback worker container. Runs as a small FastAPI app
purely so it has a `/health` endpoint Docker Compose can check (per the
blueprint's health-check requirement for every service); the actual work
happens in a background thread running `worker.run_forever()`.
"""
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI

from .worker import run_forever
from .logging_conf import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    thread = threading.Thread(target=run_forever, daemon=True)
    thread.start()
    logger.info("Rollback worker background thread started")
    yield
    logger.info("Rollback worker shutting down")


app = FastAPI(title="Rollback Worker", version="1.0.0", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok", "service": "rollback-worker"}
