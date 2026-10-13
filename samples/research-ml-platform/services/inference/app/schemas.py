from typing import Optional, Dict, List
from pydantic import BaseModel, Field


class TranslateRequest(BaseModel):
    source_lang: str = Field(..., description="One of: persian, german, polish")
    target_lang: str = Field(..., description="One of: persian, german, polish")
    text: str = Field(..., min_length=1, max_length=5000)
    compare_with_baseline: bool = Field(
        default=True, description="Also translate with the fixed M2M-100 baseline for comparison"
    )
    analyze_poetic_features: bool = Field(default=True)


class TranslateResponse(BaseModel):
    nllb_translation: str
    m2m_translation: Optional[str] = None
    model_version: str
    traffic_group: str
    source_lang: str
    target_lang: str
    poetic_features: Optional[Dict] = None
    latency_ms: float
