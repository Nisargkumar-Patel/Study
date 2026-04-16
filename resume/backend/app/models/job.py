from pydantic import BaseModel, Field
from typing import List, Optional, Dict


class JobKeywords(BaseModel):
    """Extracted keywords from job description"""
    required_skills: List[str] = Field(default_factory=list)
    preferred_skills: List[str] = Field(default_factory=list)
    technologies: List[str] = Field(default_factory=list)
    keywords: List[str] = Field(default_factory=list)
    keyword_scores: Dict[str, float] = Field(default_factory=dict)


class JobData(BaseModel):
    """Job description data"""
    title: Optional[str] = None
    company: Optional[str] = None
    description: str
    years_experience: Optional[int] = None
    education_requirements: List[str] = Field(default_factory=list)
    keywords: JobKeywords = Field(default_factory=JobKeywords)
    raw_text: str
