"""
Research service -- owns storage and analysis of translations, human
ratings, and the collaboration discussion board. Separate from the Registry
(model state) and Inference (serving) per the platform's boundary rules.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException

from .database import (
    init_db, save_translation, list_translations, get_translation,
    save_rating, list_ratings, save_discussion_message, list_discussion, summary_stats,
)
from .schemas import TranslationIn, TranslationOut, RatingIn, RatingOut, DiscussionMessageIn, AnalyticsSummary
from .logging_conf import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("Research service starting up; database initialized")
    yield
    logger.info("Research service shutting down")


app = FastAPI(title="Research Service", version="1.0.0", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok", "service": "research"}


@app.post("/translations", response_model=TranslationOut, status_code=201)
def create_translation(t: TranslationIn):
    translation_id = save_translation(t.model_dump())
    saved = get_translation(translation_id)
    if not saved:
        raise HTTPException(status_code=500, detail="Failed to persist translation")
    return saved


@app.get("/translations", response_model=list[TranslationOut])
def get_translations(limit: int = 200):
    return list_translations(limit=limit)


@app.get("/translations/{translation_id}", response_model=TranslationOut)
def get_translation_by_id(translation_id: str):
    t = get_translation(translation_id)
    if not t:
        raise HTTPException(status_code=404, detail=f"Translation '{translation_id}' not found")
    return t


@app.post("/ratings", response_model=RatingOut, status_code=201)
def create_rating(r: RatingIn):
    if not get_translation(r.translation_id):
        raise HTTPException(status_code=404,
                             detail=f"Cannot rate unknown translation '{r.translation_id}'")
    rating_id = save_rating(r.model_dump())
    ratings = list_ratings(limit=1)
    return {**r.model_dump(), "rating_id": rating_id, "timestamp": ratings[0]["timestamp"] if ratings else ""}


@app.get("/ratings", response_model=list[RatingOut])
def get_ratings(limit: int = 200):
    return list_ratings(limit=limit)


@app.post("/discussions", status_code=201)
def post_discussion_message(msg: DiscussionMessageIn):
    msg_id = save_discussion_message(msg.project, msg.user_id, msg.message)
    return {"id": msg_id, "status": "posted"}


@app.get("/discussions/{project}")
def get_discussion(project: str, limit: int = 100):
    return list_discussion(project, limit=limit)


@app.get("/analytics/summary", response_model=AnalyticsSummary)
def analytics_summary():
    stats = summary_stats()
    stats.pop("poetic_scores", None)
    return stats
