"""
Model lifecycle rules, kept independent of FastAPI so they're unit-testable
without spinning up an HTTP server (see tests/unit/test_registry_logic.py).

States: REGISTERED -> CANARY -> PRODUCTION -> ARCHIVED, with CANARY able to
move to ROLLED_BACK instead of PRODUCTION. This module is the only place
that is allowed to decide state transitions; the FastAPI routes just
translate HTTP <-> these functions, and nothing outside the Registry
service is allowed to bypass it and write to `models`/`deployment_state`
directly.
"""
import json
from typing import Optional
from .database import get_connection, now_iso, record_audit
from .logging_conf import logger

STAGE_REGISTERED = "REGISTERED"
STAGE_CANARY = "CANARY"
STAGE_PRODUCTION = "PRODUCTION"
STAGE_ARCHIVED = "ARCHIVED"
STAGE_ROLLED_BACK = "ROLLED_BACK"


class LifecycleError(Exception):
    """Raised for invalid state transitions; mapped to HTTP 409 by the API layer."""


class NotFoundError(Exception):
    """Raised when a model/version/deployment doesn't exist; mapped to HTTP 404."""


def register_model(name: str, version: str, artifact_uri: str,
                    training_run_id: Optional[str], mlflow_run_id: Optional[str],
                    metadata: Optional[dict], parent_version: Optional[str]) -> dict:
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT id FROM models WHERE name = ? AND version = ?", (name, version)
        ).fetchone()
        if existing:
            # Versions are immutable: re-registering the same name+version is
            # a client bug (or a retry), never an update.
            raise LifecycleError(f"Model '{name}' version '{version}' is already registered "
                                  f"(versions are immutable; register a new version instead)")

        created_at = now_iso()
        conn.execute(
            "INSERT INTO models (name, version, artifact_uri, stage, training_run_id, "
            "mlflow_run_id, metadata_json, parent_version, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (name, version, artifact_uri, STAGE_REGISTERED, training_run_id,
             mlflow_run_id, json.dumps(metadata or {}), parent_version, created_at),
        )
        record_audit(conn, name, version, "REGISTER", None, STAGE_REGISTERED)
        logger.info(f"Registered model {name}:{version}")
        return get_model(name, version)


def get_model(name: str, version: str) -> dict:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM models WHERE name = ? AND version = ?", (name, version)
        ).fetchone()
        if not row:
            raise NotFoundError(f"Model '{name}' version '{version}' not found")
        return _row_to_model(row)


def list_versions(name: str) -> list:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM models WHERE name = ? ORDER BY created_at DESC", (name,)
        ).fetchall()
        return [_row_to_model(r) for r in rows]


def get_deployment_state(name: str) -> dict:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM deployment_state WHERE model_name = ?", (name,)
        ).fetchone()
        if not row:
            return {"model_name": name, "stable_version": None,
                    "candidate_version": None, "canary_percentage": 0,
                    "updated_at": None}
        return dict(row)


def deploy_canary(name: str, version: str, canary_percentage: int) -> dict:
    """Deploy a registered version as the canary candidate."""
    with get_connection() as conn:
        model_row = conn.execute(
            "SELECT * FROM models WHERE name = ? AND version = ?", (name, version)
        ).fetchone()
        if not model_row:
            raise NotFoundError(f"Model '{name}' version '{version}' not found; "
                                 f"cannot deploy an unregistered version")

        state_row = conn.execute(
            "SELECT * FROM deployment_state WHERE model_name = ?", (name,)
        ).fetchone()
        if state_row and state_row["candidate_version"]:
            raise LifecycleError(
                f"Model '{name}' already has an active candidate "
                f"'{state_row['candidate_version']}'. Only one canary candidate "
                f"is allowed per model in the MVP."
            )

        previous_state = dict(state_row) if state_row else None
        updated_at = now_iso()

        if state_row:
            conn.execute(
                "UPDATE deployment_state SET candidate_version = ?, canary_percentage = ?, "
                "updated_at = ? WHERE model_name = ?",
                (version, canary_percentage, updated_at, name),
            )
        else:
            conn.execute(
                "INSERT INTO deployment_state (model_name, stable_version, candidate_version, "
                "canary_percentage, updated_at) VALUES (?, NULL, ?, ?, ?)",
                (name, version, canary_percentage, updated_at),
            )

        conn.execute(
            "UPDATE models SET stage = ? WHERE name = ? AND version = ?",
            (STAGE_CANARY, name, version),
        )
        new_state = get_deployment_state(name)
        record_audit(conn, name, version, "DEPLOY_CANARY",
                     json.dumps(previous_state), json.dumps(new_state))
        logger.info(f"Deployed {name}:{version} as canary at {canary_percentage}%")
        return new_state


def promote(name: str, version: str) -> dict:
    """Move the candidate into production; archive the previous stable version."""
    with get_connection() as conn:
        state_row = conn.execute(
            "SELECT * FROM deployment_state WHERE model_name = ?", (name,)
        ).fetchone()
        if not state_row or state_row["candidate_version"] != version:
            raise LifecycleError(
                f"'{version}' is not the active canary candidate for '{name}'; "
                f"cannot promote a version that isn't deployed as a candidate"
            )

        previous_state = dict(state_row)
        old_stable = state_row["stable_version"]
        updated_at = now_iso()

        if old_stable:
            conn.execute(
                "UPDATE models SET stage = ?, archived_at = ? WHERE name = ? AND version = ?",
                (STAGE_ARCHIVED, updated_at, name, old_stable),
            )

        conn.execute(
            "UPDATE models SET stage = ?, promoted_at = ? WHERE name = ? AND version = ?",
            (STAGE_PRODUCTION, updated_at, name, version),
        )
        conn.execute(
            "UPDATE deployment_state SET stable_version = ?, candidate_version = NULL, "
            "canary_percentage = 0, updated_at = ? WHERE model_name = ?",
            (version, updated_at, name),
        )
        new_state = get_deployment_state(name)
        record_audit(conn, name, version, "PROMOTE",
                     json.dumps(previous_state), json.dumps(new_state))
        logger.info(f"Promoted {name}:{version} to production (previous stable: {old_stable})")
        return new_state


def rollback(name: str, reason: Optional[str] = None) -> dict:
    """Roll the candidate back; traffic returns fully to the current stable version.

    This is an explicit operation (never a silent delete) so there's always
    an audit trail of why a candidate stopped receiving traffic, and the
    candidate is marked ROLLED_BACK so a poller (the rollback worker) that
    checks again later won't re-trigger a rollback against the same
    deployment -- see `services/rollback/app/worker.py`.
    """
    with get_connection() as conn:
        state_row = conn.execute(
            "SELECT * FROM deployment_state WHERE model_name = ?", (name,)
        ).fetchone()
        if not state_row or not state_row["candidate_version"]:
            raise LifecycleError(f"Model '{name}' has no active candidate to roll back")
        if not state_row["stable_version"]:
            raise LifecycleError(
                f"Model '{name}' has no known stable target to roll back to; "
                f"refusing to leave the system without a serving version"
            )

        previous_state = dict(state_row)
        candidate_version = state_row["candidate_version"]
        updated_at = now_iso()

        conn.execute(
            "UPDATE models SET stage = ?, rolled_back_at = ? WHERE name = ? AND version = ?",
            (STAGE_ROLLED_BACK, updated_at, name, candidate_version),
        )
        conn.execute(
            "UPDATE deployment_state SET candidate_version = NULL, canary_percentage = 0, "
            "updated_at = ? WHERE model_name = ?",
            (updated_at, name),
        )
        new_state = get_deployment_state(name)
        record_audit(conn, name, candidate_version, "ROLLBACK",
                     json.dumps(previous_state), json.dumps(new_state))
        logger.warning(f"Rolled back {name}:{candidate_version} (reason: {reason or 'unspecified'}). "
                        f"Traffic returned 100% to stable '{state_row['stable_version']}'")
        return new_state


def get_audit_log(name: str, limit: int = 100) -> list:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM audit_log WHERE model_name = ? ORDER BY timestamp DESC LIMIT ?",
            (name, limit),
        ).fetchall()
        return [dict(r) for r in rows]


def _row_to_model(row) -> dict:
    d = dict(row)
    try:
        d["metadata"] = json.loads(d.pop("metadata_json") or "{}")
    except (TypeError, ValueError):
        d["metadata"] = {}
        d.pop("metadata_json", None)
    return d
