"""
Registry service -- the control plane / source of truth for model versions
and deployment state. It does not perform inference, train models, or judge
translation quality; it only tracks what exists and what is currently active.
"""
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from .config import DEFAULT_CANARY_PERCENTAGE
from .database import init_db
from .schemas import (
    RegisterRequest, ModelOut, DeploymentStateOut, DeployCanaryRequest, AuditEventOut
)
from . import lifecycle
from .logging_conf import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("Registry service starting up; database initialized")
    yield
    logger.info("Registry service shutting down")


app = FastAPI(title="Model Registry", version="1.0.0", lifespan=lifespan)


@app.exception_handler(lifecycle.NotFoundError)
async def not_found_handler(request, exc: lifecycle.NotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(lifecycle.LifecycleError)
async def lifecycle_error_handler(request, exc: lifecycle.LifecycleError):
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.get("/health")
def health():
    return {"status": "ok", "service": "registry"}


@app.post("/models/register", response_model=ModelOut, status_code=201)
def register_model(req: RegisterRequest):
    return lifecycle.register_model(
        name=req.name, version=req.version, artifact_uri=req.artifact_uri,
        training_run_id=req.training_run_id, mlflow_run_id=req.mlflow_run_id,
        metadata=req.metadata, parent_version=req.parent_version,
    )


@app.get("/models/{name}", response_model=list[ModelOut])
def list_versions(name: str):
    versions = lifecycle.list_versions(name)
    if not versions:
        raise HTTPException(status_code=404, detail=f"No versions found for model '{name}'")
    return versions


@app.get("/models/{name}/active", response_model=DeploymentStateOut)
def get_active(name: str):
    return lifecycle.get_deployment_state(name)


@app.get("/models/{name}/audit", response_model=list[AuditEventOut])
def audit_log(name: str, limit: int = 100):
    return lifecycle.get_audit_log(name, limit)


@app.post("/models/{name}/rollback", response_model=DeploymentStateOut)
def rollback(name: str, reason: str | None = None):
    return lifecycle.rollback(name, reason)


# NOTE: the generic /{version} routes below must come AFTER the fixed
# sub-paths above (active, audit, rollback) -- otherwise FastAPI's
# first-match routing would treat "active"/"audit" as a version string
# and route requests like GET /models/translation/audit into get_model()
# instead. Route order matters here, not just path shape.
@app.get("/models/{name}/{version}", response_model=ModelOut)
def get_model(name: str, version: str):
    return lifecycle.get_model(name, version)


@app.post("/models/{name}/{version}/deploy-canary", response_model=DeploymentStateOut)
def deploy_canary(name: str, version: str, req: DeployCanaryRequest = DeployCanaryRequest()):
    pct = req.canary_percentage if req.canary_percentage is not None else DEFAULT_CANARY_PERCENTAGE
    return lifecycle.deploy_canary(name, version, pct)


@app.post("/models/{name}/{version}/promote", response_model=DeploymentStateOut)
def promote(name: str, version: str):
    return lifecycle.promote(name, version)
