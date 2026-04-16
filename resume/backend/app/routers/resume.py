from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging

from app.services.pdf_parser import get_pdf_parser
from app.services.keyword_extractor import get_keyword_extractor

logger = logging.getLogger(__name__)

router = APIRouter()


class ParseTextRequest(BaseModel):
    """Request to parse text resume"""
    text: str


@router.post("/upload")
async def upload_resume(file: UploadFile = File(...)):
    """
    Upload and parse resume PDF

    Returns structured resume data with formatting analysis
    """
    try:
        # Validate file type
        if not file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")

        # Read file
        pdf_bytes = await file.read()

        # Parse PDF
        parser = get_pdf_parser()
        parsed_resume = parser.parse_resume(pdf_bytes)

        # Extract keywords from resume
        extractor = get_keyword_extractor()
        resume_keywords = extractor.extract_from_resume(
            parsed_resume.data.raw_text or ""
        )

        # Convert to dict and add keywords
        result = {
            "name": parsed_resume.data.name,
            "email": parsed_resume.data.email,
            "phone": parsed_resume.data.phone,
            "location": parsed_resume.data.location,
            "linkedin": parsed_resume.data.linkedin,
            "summary": parsed_resume.data.summary,
            "experience": [
                {
                    "title": exp.title,
                    "company": exp.company,
                    "location": exp.location,
                    "start_date": exp.start_date,
                    "end_date": exp.end_date,
                    "bullets": exp.bullets,
                    "description": exp.description
                }
                for exp in parsed_resume.data.experience
            ],
            "education": [
                {
                    "degree": edu.degree,
                    "institution": edu.institution,
                    "location": edu.location,
                    "graduation_date": edu.graduation_date,
                    "gpa": edu.gpa,
                    "honors": edu.honors
                }
                for edu in parsed_resume.data.education
            ],
            "skills": parsed_resume.data.skills,
            "certifications": parsed_resume.data.certifications,
            "projects": parsed_resume.data.projects,
            "raw_text": parsed_resume.data.raw_text,
            "formatting_issues": parsed_resume.formatting_issues,
            "sections_found": parsed_resume.sections_found,
            "confidence": parsed_resume.confidence,
            "keywords": resume_keywords.get("keywords", [])
        }

        return {
            "success": True,
            "data": result
        }

    except Exception as e:
        logger.error(f"Error processing resume upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/parse-text")
async def parse_text_resume(request: ParseTextRequest):
    """
    Parse resume from plain text

    Useful for copy-paste input
    """
    try:
        # Extract keywords
        extractor = get_keyword_extractor()
        resume_keywords = extractor.extract_from_resume(request.text)

        # Simple parsing (sections not available without PDF structure)
        return {
            "success": True,
            "data": {
                "raw_text": request.text,
                "keywords": resume_keywords.get("keywords", []),
                "skills": resume_keywords.get("skills", []),
                "technologies": resume_keywords.get("technologies", []),
                "certifications": resume_keywords.get("certifications", []),
                "note": "Text parsing provides limited structure. Upload PDF for full parsing."
            }
        }

    except Exception as e:
        logger.error(f"Error parsing text resume: {e}")
        raise HTTPException(status_code=500, detail=str(e))
