"""Public API contracts for the Registry service.

Kept deliberately separate from the internal SQLite row shape (`database.py`)
so the HTTP surface doesn't leak implementation details -- e.g. we can
change the underlying table without breaking the schema clients depend on.
"""
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    name: str = Field(..., description="Logical model name, e.g. 'translation'")
    version: str = Field(..., description="Immutable version identifier, e.g. 'v1'")
    artifact_uri: str = Field(..., description="MinIO/S3 URI of the model artifact")
    training_run_id: Optional[str] = None
    mlflow_run_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    parent_version: Optional[str] = None


class ModelOut(BaseModel):
    id: int
    name: str
    version: str
    artifact_uri: str
    stage: str
    training_run_id: Optional[str]
    mlflow_run_id: Optional[str]
    metadata: Optional[Dict[str, Any]]
    parent_version: Optional[str]
    created_at: str
    promoted_at: Optional[str]
    rolled_back_at: Optional[str]
    archived_at: Optional[str]


class DeploymentStateOut(BaseModel):
    model_name: str
    stable_version: Optional[str]
    candidate_version: Optional[str]
    canary_percentage: int
    updated_at: Optional[str]


class DeployCanaryRequest(BaseModel):
    canary_percentage: Optional[int] = None


class AuditEventOut(BaseModel):
    id: int
    model_name: str
    version: Optional[str]
    action: str
    previous_state: Optional[str]
    new_state: Optional[str]
    timestamp: str


class ErrorResponse(BaseModel):
    detail: str
