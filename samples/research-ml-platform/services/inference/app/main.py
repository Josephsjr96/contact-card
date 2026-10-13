"""
Inference service -- serves translations. It reads routing decisions from
Redis (populated from the Registry) but never decides deployment state
itself; it never promotes, never rolls back, never judges quality. It only
translates, tags the result with which model/version/traffic-group produced
it, and records metrics.
"""
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from .config import MODEL_NAME
from .schemas import TranslateRequest, TranslateResponse
from .translator import translate_nllb, translate_m2m, LANGUAGES
from . import routing
from . import analyzer as poetic_analyzer
from .metrics import translation_requests_total, translation_errors_total, translation_latency_seconds
from .logging_conf import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    routing.refresh_from_registry()
    routing.start_background_refresh(interval_seconds=15)
    logger.info("Inference service starting up")
    yield
    logger.info("Inference service shutting down")


app = FastAPI(title="Inference Service", version="1.0.0", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok", "service": "inference"}


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post("/translate", response_model=TranslateResponse)
def translate(req: TranslateRequest):
    if req.source_lang not in LANGUAGES or req.target_lang not in LANGUAGES:
        raise HTTPException(status_code=400,
                             detail=f"Unsupported language. Supported: {list(LANGUAGES)}")
    if req.source_lang == req.target_lang:
        raise HTTPException(status_code=400, detail="source_lang and target_lang must differ")

    traffic_group, version = routing.decide_traffic_group(MODEL_NAME)
    language_pair = f"{req.source_lang}-{req.target_lang}"

    if not version:
        translation_errors_total.labels(model_version="none", traffic_group=traffic_group,
                                         language_pair=language_pair).inc()
        raise HTTPException(status_code=503,
                             detail="No stable model version is currently deployed for translation")

    artifact_uri = routing.get_artifact_uri(version)
    start = time.perf_counter()
    try:
        nllb_result = translate_nllb(req.text, req.source_lang, req.target_lang,
                                      version=version, artifact_uri=artifact_uri)
        m2m_result = None
        if req.compare_with_baseline:
            m2m_result = translate_m2m(req.text, req.source_lang, req.target_lang)

        poetic_features = None
        if req.analyze_poetic_features:
            poetic_features = {
                "source": poetic_analyzer.analyze(req.text, req.source_lang),
                "nllb_output": poetic_analyzer.analyze(nllb_result, req.target_lang),
            }
            if m2m_result:
                poetic_features["m2m_output"] = poetic_analyzer.analyze(m2m_result, req.target_lang)

        latency = time.perf_counter() - start
        translation_latency_seconds.labels(
            model_version=version, traffic_group=traffic_group, language_pair=language_pair
        ).observe(latency)
        translation_requests_total.labels(
            model_version=version, traffic_group=traffic_group,
            language_pair=language_pair, status="success"
        ).inc()

        logger.info(f"Translated {language_pair} using {version} ({traffic_group}) in {latency*1000:.0f}ms")

        return TranslateResponse(
            nllb_translation=nllb_result,
            m2m_translation=m2m_result,
            model_version=version,
            traffic_group=traffic_group,
            source_lang=req.source_lang,
            target_lang=req.target_lang,
            poetic_features=poetic_features,
            latency_ms=round(latency * 1000, 2),
        )
    except HTTPException:
        raise
    except Exception as e:
        translation_errors_total.labels(model_version=version, traffic_group=traffic_group,
                                         language_pair=language_pair).inc()
        translation_requests_total.labels(
            model_version=version, traffic_group=traffic_group,
            language_pair=language_pair, status="error"
        ).inc()
        logger.error(f"Translation failed ({language_pair}, {version}): {e}")
        raise HTTPException(status_code=500, detail="Translation failed") from e
