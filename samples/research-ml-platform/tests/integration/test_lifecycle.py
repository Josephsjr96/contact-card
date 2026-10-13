"""
Golden integration test (blueprint section 39): exercises the full model
lifecycle against the Registry's actual FastAPI app + SQLite, using
FastAPI's TestClient so no Docker stack is required to run this in CI.

Two scenarios, matching the blueprint exactly:
  1. register -> deploy -> canary(95/5) -> promote
  2. register -> deploy -> canary -> bad metrics -> rollback
"""
import os
import sys
import uuid
import pytest

sys.path.insert(0, os.path.dirname(__file__) + "/..")
from service_import import import_service_app


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = str(tmp_path / "integration_registry.db")
    monkeypatch.setenv("REGISTRY_DB_PATH", db_path)

    import_service_app("registry")
    from app import main as main_module

    from fastapi.testclient import TestClient
    with TestClient(main_module.app) as c:
        yield c


def _model_name():
    return f"translation_{uuid.uuid4().hex[:8]}"


def test_register_deploy_canary_promote(client):
    name = _model_name()

    r = client.post("/models/register", json={"name": name, "version": "v1", "artifact_uri": "s3://m/v1"})
    assert r.status_code == 201

    r = client.post("/models/register", json={"name": name, "version": "v2", "artifact_uri": "s3://m/v2"})
    assert r.status_code == 201

    # v1 becomes the first production version.
    r = client.post(f"/models/{name}/v1/deploy-canary", json={"canary_percentage": 100})
    assert r.status_code == 200
    r = client.post(f"/models/{name}/v1/promote")
    assert r.status_code == 200
    assert r.json()["stable_version"] == "v1"

    # v2 is deployed as a real 5% canary.
    r = client.post(f"/models/{name}/v2/deploy-canary", json={"canary_percentage": 5})
    assert r.status_code == 200
    state = r.json()
    assert state["stable_version"] == "v1"
    assert state["candidate_version"] == "v2"
    assert state["canary_percentage"] == 5

    active = client.get(f"/models/{name}/active").json()
    assert active == state

    # v2 performs well -> promote.
    r = client.post(f"/models/{name}/v2/promote")
    assert r.status_code == 200
    final_state = r.json()
    assert final_state["stable_version"] == "v2"
    assert final_state["candidate_version"] is None

    v1 = client.get(f"/models/{name}/v1").json()
    assert v1["stage"] == "ARCHIVED"

    audit = client.get(f"/models/{name}/audit").json()
    actions = [e["action"] for e in audit]
    assert actions.count("REGISTER") == 2
    assert "PROMOTE" in actions
    assert "DEPLOY_CANARY" in actions


def test_register_deploy_canary_bad_metrics_rollback(client):
    name = _model_name()

    client.post("/models/register", json={"name": name, "version": "v1", "artifact_uri": "s3://m/v1"})
    client.post(f"/models/{name}/v1/deploy-canary", json={"canary_percentage": 100})
    client.post(f"/models/{name}/v1/promote")

    client.post("/models/register", json={"name": name, "version": "v2", "artifact_uri": "s3://m/v2"})
    r = client.post(f"/models/{name}/v2/deploy-canary", json={"canary_percentage": 5})
    assert r.json()["candidate_version"] == "v2"

    # Simulate the rollback worker detecting bad canary metrics.
    r = client.post(f"/models/{name}/rollback", params={"reason": "canary error_rate exceeded threshold"})
    assert r.status_code == 200
    state = r.json()
    assert state["stable_version"] == "v1"  # traffic returned 100% to stable
    assert state["candidate_version"] is None

    v2 = client.get(f"/models/{name}/v2").json()
    assert v2["stage"] == "ROLLED_BACK"

    # Rollback loop prevention: a second rollback attempt with no active
    # candidate should fail cleanly rather than repeating the action.
    r2 = client.post(f"/models/{name}/rollback", params={"reason": "worker polls again"})
    assert r2.status_code == 409


def test_cannot_register_duplicate_version(client):
    name = _model_name()
    client.post("/models/register", json={"name": name, "version": "v1", "artifact_uri": "s3://m/v1"})
    r = client.post("/models/register", json={"name": name, "version": "v1", "artifact_uri": "s3://m/v1-b"})
    assert r.status_code == 409


def test_cannot_promote_without_being_the_candidate(client):
    name = _model_name()
    client.post("/models/register", json={"name": name, "version": "v1", "artifact_uri": "s3://m/v1"})
    r = client.post(f"/models/{name}/v1/promote")
    assert r.status_code == 409
