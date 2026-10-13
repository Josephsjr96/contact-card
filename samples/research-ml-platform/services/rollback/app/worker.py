"""
Rollback worker -- the only service allowed to *react* to bad canary
metrics by calling the Registry's rollback endpoint. It never talks to
Inference and never writes to Redis directly; it only reads Prometheus and
calls the Registry, matching the blueprint's "Rollback reacts" boundary.

Loop-prevention: once a candidate version has been rolled back, the
Registry clears `candidate_version` from deployment state (see
lifecycle.rollback()). The next poll of `/models/{name}/active` will
therefore show no active candidate, so this worker naturally stops
evaluating that version -- no separate "already handled" set is needed,
because the source of truth (Registry) itself reflects the terminal state.
We additionally keep an in-memory set of versions rolled back *this
process* purely as a fast-path guard against redundant Registry calls
within the same poll cycle.
"""
import time
from typing import Optional

import httpx

from .config import (
    REGISTRY_URL, PROMETHEUS_URL, MODEL_NAME, ROLLBACK_THRESHOLD,
    OBSERVATION_WINDOW, POLL_INTERVAL_SECONDS, MIN_CANARY_SAMPLES,
)
from .logging_conf import logger

_already_rolled_back_this_process: set[str] = set()


def _prom_query(query: str) -> Optional[float]:
    try:
        resp = httpx.get(f"{PROMETHEUS_URL}/api/v1/query", params={"query": query}, timeout=10.0)
        resp.raise_for_status()
        result = resp.json().get("data", {}).get("result", [])
        if not result:
            return None
        return float(result[0]["value"][1])
    except Exception as e:
        logger.warning(f"Prometheus query failed ({query}): {e}")
        return None


def _error_rate(version: str) -> Optional[float]:
    """Fraction of failed requests for a model version over OBSERVATION_WINDOW."""
    errors = _prom_query(
        f'sum(increase(translation_errors_total{{model_version="{version}"}}[{OBSERVATION_WINDOW}]))'
    ) or 0.0
    total = _prom_query(
        f'sum(increase(translation_requests_total{{model_version="{version}"}}[{OBSERVATION_WINDOW}]))'
    ) or 0.0
    if total < MIN_CANARY_SAMPLES:
        return None  # not enough traffic yet to make a decision
    return errors / total if total > 0 else 0.0


def _get_deployment_state() -> Optional[dict]:
    try:
        resp = httpx.get(f"{REGISTRY_URL}/models/{MODEL_NAME}/active", timeout=10.0)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning(f"Could not fetch deployment state from registry: {e}")
        return None


def _trigger_rollback(reason: str):
    try:
        resp = httpx.post(f"{REGISTRY_URL}/models/{MODEL_NAME}/rollback",
                           params={"reason": reason}, timeout=10.0)
        resp.raise_for_status()
        logger.warning(f"Rollback triggered for '{MODEL_NAME}': {reason}")
        return resp.json()
    except Exception as e:
        logger.error(f"Failed to trigger rollback: {e}")
        return None


def evaluate_once():
    state = _get_deployment_state()
    if not state:
        return

    candidate = state.get("candidate_version")
    stable = state.get("stable_version")

    if not candidate:
        return  # nothing to evaluate

    if candidate in _already_rolled_back_this_process:
        return

    canary_error_rate = _error_rate(candidate)
    if canary_error_rate is None:
        logger.info(f"Candidate '{candidate}' has insufficient traffic yet "
                     f"(< {MIN_CANARY_SAMPLES} requests); skipping evaluation")
        return

    stable_error_rate = _error_rate(stable) if stable else 0.0
    stable_error_rate = stable_error_rate if stable_error_rate is not None else 0.0

    logger.info(f"Canary '{candidate}' error_rate={canary_error_rate:.3f}, "
                f"stable '{stable}' error_rate={stable_error_rate:.3f}, "
                f"threshold={ROLLBACK_THRESHOLD}")

    is_unhealthy = canary_error_rate > ROLLBACK_THRESHOLD or \
        canary_error_rate > (stable_error_rate + ROLLBACK_THRESHOLD)

    if is_unhealthy:
        reason = (f"canary error_rate={canary_error_rate:.3f} exceeded threshold "
                  f"{ROLLBACK_THRESHOLD} (stable={stable_error_rate:.3f})")
        result = _trigger_rollback(reason)
        if result is not None:
            _already_rolled_back_this_process.add(candidate)
    else:
        logger.info(f"Candidate '{candidate}' is healthy; no action taken")


def run_forever():
    logger.info(f"Rollback worker started: polling every {POLL_INTERVAL_SECONDS}s, "
                f"threshold={ROLLBACK_THRESHOLD}, window={OBSERVATION_WINDOW}")
    while True:
        try:
            evaluate_once()
        except Exception as e:
            logger.error(f"Unexpected error in rollback evaluation loop: {e}")
        time.sleep(POLL_INTERVAL_SECONDS)
