"""
Thin HTTP client wrapper around the three backend services. The dashboard
is a viewer + operator console -- it never touches SQLite/Redis/MinIO
directly, only these HTTP APIs, per the blueprint's "Dashboard knows about:
metrics, Registry API" boundary rule.
"""
import os
import requests

REGISTRY_URL = os.getenv("REGISTRY_URL", "http://registry:8001")
INFERENCE_URL = os.getenv("INFERENCE_URL", "http://inference:8002")
RESEARCH_URL = os.getenv("RESEARCH_URL", "http://research:8003")
MODEL_NAME = os.getenv("MODEL_NAME", "translation")

_TIMEOUT = 30


def _get(url, **kwargs):
    try:
        resp = requests.get(url, timeout=_TIMEOUT, **kwargs)
        resp.raise_for_status()
        return resp.json(), None
    except requests.RequestException as e:
        return None, str(e)


def _post(url, json=None, **kwargs):
    try:
        resp = requests.post(url, json=json, timeout=_TIMEOUT, **kwargs)
        resp.raise_for_status()
        return resp.json(), None
    except requests.RequestException as e:
        detail = str(e)
        try:
            detail = e.response.json().get("detail", detail)  # type: ignore
        except Exception:
            pass
        return None, detail


# ---- Inference ----------------------------------------------------------
def translate(source_lang: str, target_lang: str, text: str,
              compare_with_baseline: bool = True, analyze_poetic_features: bool = True):
    return _post(f"{INFERENCE_URL}/translate", json={
        "source_lang": source_lang, "target_lang": target_lang, "text": text,
        "compare_with_baseline": compare_with_baseline,
        "analyze_poetic_features": analyze_poetic_features,
    })


# ---- Research -------------------------------------------------------------
def save_translation(payload: dict):
    return _post(f"{RESEARCH_URL}/translations", json=payload)


def list_translations(limit: int = 100):
    return _get(f"{RESEARCH_URL}/translations", params={"limit": limit})


def save_rating(payload: dict):
    return _post(f"{RESEARCH_URL}/ratings", json=payload)


def list_ratings(limit: int = 200):
    return _get(f"{RESEARCH_URL}/ratings", params={"limit": limit})


def analytics_summary():
    return _get(f"{RESEARCH_URL}/analytics/summary")


def post_discussion(project: str, user_id: str, message: str):
    return _post(f"{RESEARCH_URL}/discussions", json={
        "project": project, "user_id": user_id, "message": message
    })


def get_discussion(project: str):
    return _get(f"{RESEARCH_URL}/discussions/{project}")


# ---- Registry -------------------------------------------------------------
def get_active_deployment(model_name: str = MODEL_NAME):
    return _get(f"{REGISTRY_URL}/models/{model_name}/active")


def list_model_versions(model_name: str = MODEL_NAME):
    return _get(f"{REGISTRY_URL}/models/{model_name}")


def register_model(name: str, version: str, artifact_uri: str, metadata: dict = None):
    return _post(f"{REGISTRY_URL}/models/register", json={
        "name": name, "version": version, "artifact_uri": artifact_uri, "metadata": metadata or {}
    })


def deploy_canary(name: str, version: str, canary_percentage: int = None):
    payload = {"canary_percentage": canary_percentage} if canary_percentage else {}
    return _post(f"{REGISTRY_URL}/models/{name}/{version}/deploy-canary", json=payload)


def promote(name: str, version: str):
    return _post(f"{REGISTRY_URL}/models/{name}/{version}/promote")


def rollback(name: str, reason: str = "manual operator rollback"):
    return _post(f"{REGISTRY_URL}/models/{name}/rollback", params={"reason": reason})


def get_audit_log(name: str = MODEL_NAME, limit: int = 50):
    return _get(f"{REGISTRY_URL}/models/{name}/audit", params={"limit": limit})
