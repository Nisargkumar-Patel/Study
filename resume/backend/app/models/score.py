from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any


class ScoreBreakdown(BaseModel):
    """Detailed score breakdown for a category"""
    score: float = Field(ge=0, le=100)
    max_score: float
    percentage: float = Field(ge=0, le=100)
    details: Dict[str, Any] = Field(default_factory=dict)


class ATSScore(BaseModel):
    """ATS compatibility score with detailed breakdown"""
    overall_score: float = Field(ge=0, le=100, description="Overall ATS compatibility score 0-100")

    # Component scores
    keyword_match: ScoreBreakdown
    skills_match: ScoreBreakdown
    experience_match: ScoreBreakdown
    education_match: ScoreBreakdown
    formatting_score: ScoreBreakdown

    # Additional details
    missing_keywords: List[str] = Field(default_factory=list)
    matched_keywords: List[str] = Field(default_factory=list)
    missing_skills: List[str] = Field(default_factory=list)
    matched_skills: List[str] = Field(default_factory=list)
    formatting_issues: List[str] = Field(default_factory=list)
    suggestions_summary: List[str] = Field(default_factory=list)

    # Metadata
    calculated_at: Optional[str] = None
