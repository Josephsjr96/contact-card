"""
Unit tests for the Registry's lifecycle rules, independent of HTTP -- these
call the `lifecycle` module functions directly against a temp SQLite file.
"""
import os
import sys
import uuid
import pytest

sys.path.insert(0, os.path.dirname(__file__) + "/..")
from service_import import import_service_app


@pytest.fixture()
def lifecycle_module(tmp_path, monkeypatch):
    db_path = str(tmp_path / "test_registry.db")
    monkeypatch.setenv("REGISTRY_DB_PATH", db_path)
    import_service_app("registry")
    from app import database as db_module
    from app import lifecycle as lifecycle_module
    db_module.init_db()
    return lifecycle_module


def _name():
    return f"model_{uuid.uuid4().hex[:8]}"


def test_register_and_get(lifecycle_module):
    name = _name()
    m = lifecycle_module.register_model(name, "v1", "s3://x/v1", None, None, None, None)
    assert m["stage"] == "REGISTERED"
    fetched = lifecycle_module.get_model(name, "v1")
    assert fetched["version"] == "v1"


def test_duplicate_version_rejected(lifecycle_module):
    name = _name()
    lifecycle_module.register_model(name, "v1", "s3://x/v1", None, None, None, None)
    with pytest.raises(lifecycle_module.LifecycleError):
        lifecycle_module.register_model(name, "v1", "s3://x/v1-again", None, None, None, None)


def test_get_missing_model_raises_not_found(lifecycle_module):
    with pytest.raises(lifecycle_module.NotFoundError):
        lifecycle_module.get_model("does-not-exist", "v1")


def test_only_one_active_candidate(lifecycle_module):
    name = _name()
    lifecycle_module.register_model(name, "v1", "s3://x/v1", None, None, None, None)
    lifecycle_module.register_model(name, "v2", "s3://x/v2", None, None, None, None)
    lifecycle_module.deploy_canary(name, "v1", 5)
    with pytest.raises(lifecycle_module.LifecycleError):
        lifecycle_module.deploy_canary(name, "v2", 5)


def test_promote_requires_active_candidate(lifecycle_module):
    name = _name()
    lifecycle_module.register_model(name, "v1", "s3://x/v1", None, None, None, None)
    with pytest.raises(lifecycle_module.LifecycleError):
        lifecycle_module.promote(name, "v1")


def test_promote_moves_candidate_to_stable_and_archives_old(lifecycle_module):
    name = _name()
    lifecycle_module.register_model(name, "v1", "s3://x/v1", None, None, None, None)
    lifecycle_module.register_model(name, "v2", "s3://x/v2", None, None, None, None)
    lifecycle_module.deploy_canary(name, "v1", 5)
    lifecycle_module.promote(name, "v1")

    lifecycle_module.deploy_canary(name, "v2", 5)
    state = lifecycle_module.promote(name, "v2")

    assert state["stable_version"] == "v2"
    assert state["candidate_version"] is None
    v1 = lifecycle_module.get_model(name, "v1")
    assert v1["stage"] == "ARCHIVED"


def test_rollback_requires_stable_target(lifecycle_module):
    name = _name()
    lifecycle_module.register_model(name, "v1", "s3://x/v1", None, None, None, None)
    lifecycle_module.deploy_canary(name, "v1", 5)
    with pytest.raises(lifecycle_module.LifecycleError):
        lifecycle_module.rollback(name, "no stable target yet")


def test_rollback_returns_traffic_to_stable(lifecycle_module):
    name = _name()
    lifecycle_module.register_model(name, "v1", "s3://x/v1", None, None, None, None)
    lifecycle_module.deploy_canary(name, "v1", 5)
    lifecycle_module.promote(name, "v1")

    lifecycle_module.register_model(name, "v2", "s3://x/v2", None, None, None, None)
    lifecycle_module.deploy_canary(name, "v2", 5)
    state = lifecycle_module.rollback(name, "bad metrics")

    assert state["stable_version"] == "v1"
    assert state["candidate_version"] is None
    v2 = lifecycle_module.get_model(name, "v2")
    assert v2["stage"] == "ROLLED_BACK"


def test_rollback_without_candidate_raises(lifecycle_module):
    name = _name()
    lifecycle_module.register_model(name, "v1", "s3://x/v1", None, None, None, None)
    lifecycle_module.deploy_canary(name, "v1", 5)
    lifecycle_module.promote(name, "v1")
    with pytest.raises(lifecycle_module.LifecycleError):
        lifecycle_module.rollback(name, "nothing to roll back")
