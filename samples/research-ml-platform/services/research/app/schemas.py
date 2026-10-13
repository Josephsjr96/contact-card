from typing import Optional, Dict
from pydantic import BaseModel, Field


class TranslationIn(BaseModel):
    source_text: str
    source_lang: str
    target_lang: str
    nllb_translation: Optional[str] = None
    m2m_translation: Optional[str] = None
    model_version: Optional[str] = None
    traffic_group: Optional[str] = None
    metrics: Optional[Dict] = None
    poetic_features: Optional[Dict] = None


class TranslationOut(TranslationIn):
    id: str
    timestamp: str


class RatingIn(BaseModel):
    translation_id: str
    user_id: str
    model_preference: Optional[str] = Field(None, description="nllb | m2m | equal | neither")
    fluency_score: Optional[int] = Field(None, ge=1, le=5)
    poetic_preservation_score: Optional[int] = Field(None, ge=1, le=5)
    cultural_accuracy_score: Optional[int] = Field(None, ge=1, le=5)
    comments: Optional[str] = None


class RatingOut(RatingIn):
    rating_id: str
    timestamp: str


class DiscussionMessageIn(BaseModel):
    project: str
    user_id: str
    message: str


class AnalyticsSummary(BaseModel):
    total_translations: int
    total_ratings: int
    avg_poetic_score: float
    nllb_preferred_pct: float
    m2m_preferred_pct: float
    equal_pct: float
    neither_pct: float
    avg_cultural_accuracy: float
