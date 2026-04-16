from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import date


class ExperienceItem(BaseModel):
    """Work experience entry"""
    title: str
    company: str
    location: Optional[str] = None
    start_date: str
    end_date: str
    bullets: List[str] = Field(default_factory=list)
    description: Optional[str] = None


class EducationItem(BaseModel):
    """Education entry"""
    degree: str
    institution: str
    location: Optional[str] = None
    graduation_date: str
    gpa: Optional[str] = None
    honors: Optional[str] = None


class ResumeData(BaseModel):
    """Complete resume data structure"""
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin: Optional[str] = None
    website: Optional[str] = None
    summary: Optional[str] = None
    experience: List[ExperienceItem] = Field(default_factory=list)
    education: List[EducationItem] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)
    certifications: List[str] = Field(default_factory=list)
    projects: List[Dict[str, Any]] = Field(default_factory=list)
    raw_text: Optional[str] = None


class ParsedResume(BaseModel):
    """Resume with parsing metadata"""
    data: ResumeData
    formatting_issues: List[str] = Field(default_factory=list)
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    sections_found: List[str] = Field(default_factory=list)
