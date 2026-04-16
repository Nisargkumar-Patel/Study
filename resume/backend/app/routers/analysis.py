from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
import logging

from app.services.keyword_extractor import get_keyword_extractor
from app.services.ats_scorer import get_ats_scorer
from app.services.resume_optimizer import get_resume_optimizer

logger = logging.getLogger(__name__)

router = APIRouter()


class AnalyzeJobRequest(BaseModel):
    """Request to analyze job description"""
    job_description: str


class CalculateScoreRequest(BaseModel):
    """Request to calculate ATS score"""
    resume_data: Dict
    job_data: Dict


class OptimizeRequest(BaseModel):
    """Request to generate optimization suggestions"""
    resume_data: Dict
    job_data: Dict
    focus_areas: Optional[List[str]] = None


class LiveScoreRequest(BaseModel):
    """Request for real-time score calculation"""
    resume_data: Dict
    job_data: Dict


@router.post("/analyze-job")
async def analyze_job_description(request: AnalyzeJobRequest):
    """
    Analyze job description and extract requirements

    Returns:
        - Required skills
        - Preferred skills
        - Keywords with TF-IDF scores
        - Years of experience
        - Education requirements
        - Job title and company (if present)
    """
    try:
        extractor = get_keyword_extractor()
        analysis = extractor.extract_from_job_description(request.job_description)

        return {
            "success": True,
            "data": {
                "title": analysis.get("title"),
                "company": analysis.get("company"),
                "required_skills": analysis.get("required_skills", []),
                "preferred_skills": analysis.get("preferred_skills", []),
                "technologies": analysis.get("technologies", []),
                "keywords": analysis.get("keywords", []),
                "years_experience": analysis.get("years_experience", 0),
                "education_requirements": analysis.get("education_requirements", []),
                "all_skills": analysis.get("all_skills", []),
                "raw_text": request.job_description
            }
        }

    except Exception as e:
        logger.error(f"Error analyzing job description: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/score")
async def calculate_ats_score(request: CalculateScoreRequest):
    """
    Calculate comprehensive ATS compatibility score

    Returns:
        - Overall score (0-100)
        - Breakdown by category (keywords, skills, experience, education, formatting)
        - Missing keywords and skills
        - Matched keywords and skills
        - Actionable suggestions
    """
    try:
        scorer = get_ats_scorer()
        score = scorer.calculate_score(request.resume_data, request.job_data)

        return {
            "success": True,
            "data": {
                "overall_score": score.overall_score,
                "keyword_match": {
                    "score": score.keyword_match.score,
                    "percentage": score.keyword_match.percentage,
                    "details": score.keyword_match.details
                },
                "skills_match": {
                    "score": score.skills_match.score,
                    "percentage": score.skills_match.percentage,
                    "details": score.skills_match.details
                },
                "experience_match": {
                    "score": score.experience_match.score,
                    "percentage": score.experience_match.percentage,
                    "details": score.experience_match.details
                },
                "education_match": {
                    "score": score.education_match.score,
                    "percentage": score.education_match.percentage,
                    "details": score.education_match.details
                },
                "formatting_score": {
                    "score": score.formatting_score.score,
                    "percentage": score.formatting_score.percentage,
                    "details": score.formatting_score.details
                },
                "missing_keywords": score.missing_keywords,
                "matched_keywords": score.matched_keywords,
                "missing_skills": score.missing_skills,
                "matched_skills": score.matched_skills,
                "formatting_issues": score.formatting_issues,
                "suggestions_summary": score.suggestions_summary,
                "calculated_at": score.calculated_at
            }
        }

    except Exception as e:
        logger.error(f"Error calculating ATS score: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/optimize")
async def generate_optimization_suggestions(request: OptimizeRequest):
    """
    Generate AI-powered optimization suggestions

    Uses NLP and template-based approaches (no paid APIs)

    Returns:
        - List of suggestions with original/suggested text
        - Impact scores
        - Reasons for each suggestion
        - Keywords being added
    """
    try:
        optimizer = get_resume_optimizer()
        suggestions = optimizer.generate_suggestions(
            request.resume_data,
            request.job_data
        )

        # Convert to dict
        suggestions_data = [
            {
                "id": s.id,
                "type": s.type.value,
                "section": s.section,
                "original_text": s.original_text,
                "suggested_text": s.suggested_text,
                "reason": s.reason,
                "impact": s.impact,
                "keywords_added": s.keywords_added,
                "location": s.location,
                "accepted": s.accepted
            }
            for s in suggestions
        ]

        # Calculate potential score increase
        high_impact = len([s for s in suggestions if s.impact >= 4])
        potential_increase = min(high_impact * 3, 20)  # Up to 20 points

        return {
            "success": True,
            "data": {
                "suggestions": suggestions_data,
                "total_suggestions": len(suggestions),
                "high_impact_count": high_impact,
                "potential_score_increase": potential_increase
            }
        }

    except Exception as e:
        logger.error(f"Error generating suggestions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/score-live")
async def calculate_live_score(request: LiveScoreRequest):
    """
    Fast ATS score calculation for real-time updates

    Optimized for speed with caching
    """
    try:
        # Use same scoring but optimized
        scorer = get_ats_scorer()
        score = scorer.calculate_score(request.resume_data, request.job_data)

        # Return simplified response for speed
        return {
            "success": True,
            "data": {
                "overall_score": score.overall_score,
                "keyword_match_percentage": score.keyword_match.percentage,
                "skills_match_percentage": score.skills_match.percentage,
                "missing_keywords_count": len(score.missing_keywords),
                "missing_skills_count": len(score.missing_skills)
            }
        }

    except Exception as e:
        logger.error(f"Error calculating live score: {e}")
        raise HTTPException(status_code=500, detail=str(e))
