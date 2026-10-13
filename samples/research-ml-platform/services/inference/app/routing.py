"""
Traffic routing via Redis.

Redis holds a *cache* of the Registry's deployment state (stable_version,
candidate_version, canary_percentage) for fast per-request lookups; the
Registry's SQLite table remains the source of truth. Inference reads Redis,
never decides deployment state itself, and never writes to the Registry
directly -- see the "Deployment State" section of the platform blueprint.

The sync loop (`refresh_from_registry`) is intentionally simple: poll the
Registry's `/models/{name}/active` endpoint on an interval and mirror it
into Redis. This keeps Inference decoupled from the Registry being
temporarily unavailable (routing keeps working off the last-known state).
"""
import random
import json
import threading
import time
from typing import Optional, Tuple

import redis
import httpx

from .config import REDIS_HOST, REDIS_PORT, REGISTRY_URL, MODEL_NAME
from .logging_conf import logger

_redis_client: Optional[redis.Redis] = None
_ROUTING_KEY = f"routing:{MODEL_NAME}"
_ARTIFACT_KEY_PREFIX = f"artifact_uri:{MODEL_NAME}:"


def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    return _redis_client


def refresh_from_registry(model_name: str = MODEL_NAME):
    """Pull current deployment state from the Registry and cache it in Redis."""
    r = get_redis()
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(f"{REGISTRY_URL}/models/{model_name}/active")
            resp.raise_for_status()
            state = resp.json()
            r.set(_ROUTING_KEY, json.dumps(state))

            # Cache artifact URIs for stable/candidate so inference doesn't
            # need a Registry round-trip on every single translate call.
            for version in filter(None, [state.get("stable_version"), state.get("candidate_version")]):
                model_resp = client.get(f"{REGISTRY_URL}/models/{model_name}/{version}")
                if model_resp.status_code == 200:
                    r.set(_ARTIFACT_KEY_PREFIX + version, model_resp.json().get("artifact_uri", ""))
            logger.debug(f"Refreshed routing state from registry: {state}")
    except Exception as e:
        logger.warning(f"Could not refresh routing state from registry (using cached state): {e}")


def start_background_refresh(interval_seconds: int = 15):
    def _loop():
        while True:
            refresh_from_registry()
            time.sleep(interval_seconds)
    thread = threading.Thread(target=_loop, daemon=True)
    thread.start()
    logger.info(f"Started background registry-sync loop (every {interval_seconds}s)")


def get_routing_state(model_name: str = MODEL_NAME) -> dict:
    r = get_redis()
    raw = r.get(_ROUTING_KEY)
    if not raw:
        return {"model_name": model_name, "stable_version": None,
                "candidate_version": None, "canary_percentage": 0}
    return json.loads(raw)


def get_artifact_uri(version: str) -> Optional[str]:
    r = get_redis()
    return r.get(_ARTIFACT_KEY_PREFIX + version)


def decide_traffic_group(model_name: str = MODEL_NAME) -> Tuple[str, Optional[str]]:
    """Decide 'stable' or 'canary' for this request, and return (group, version).

    Random splitting is sufficient for the MVP (no sophisticated user
    segmentation per the blueprint's non-goals).
    """
    state = get_routing_state(model_name)
    stable = state.get("stable_version")
    candidate = state.get("candidate_version")
    pct = state.get("canary_percentage") or 0

    if not candidate or pct <= 0:
        return "stable", stable

    if random.uniform(0, 100) < pct:
        return "canary", candidate
    return "stable", stable
