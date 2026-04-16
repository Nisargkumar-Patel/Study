from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class SuggestionType(str, Enum):
    """Types of suggestions"""
    WEAK_VERB = "weak_verb"
    MISSING_KEYWORD = "missing_keyword"
    ADD_METRIC = "add_metric"
    TONE_ADJUSTMENT = "tone_adjustment"
    FORMATTING = "formatting"
    SKILL_HIGHLIGHT = "skill_highlight"


class Suggestion(BaseModel):
    """Resume improvement suggestion"""
    id: str
    type: SuggestionType
    section: str  # e.g., "experience", "summary", "skills"
    original_text: str
    suggested_text: str
    reason: str
    impact: int = Field(ge=1, le=5, description="Impact score 1-5, where 5 is highest")
    keywords_added: list[str] = Field(default_factory=list)
    location: Optional[dict] = None  # For pinpointing where in the resume
    accepted: bool = False


class OptimizeRequest(BaseModel):
    """Request to generate optimization suggestions"""
    resume_data: dict
    job_data: dict
    focus_areas: Optional[list[str]] = None  # Specific areas to focus on


class OptimizeResponse(BaseModel):
    """Response with optimization suggestions"""
    suggestions: list[Suggestion]
    total_suggestions: int
    high_impact_count: int
    potential_score_increase: float
