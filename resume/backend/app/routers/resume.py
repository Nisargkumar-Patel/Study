from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging

from app.services.pdf_parser import get_pdf_parser
from app.services.latex_parser import get_latex_parser
from app.services.keyword_extractor import get_keyword_extractor

logger = logging.getLogger(__name__)

router = APIRouter()


class ParseTextRequest(BaseModel):
    """Request to parse text resume"""
    text: str


class UploadLatexRequest(BaseModel):
    """Request to upload a resume as LaTeX source (pasted or read from a file)."""
    latex: str


@router.post("/upload")
async def upload_resume(file: UploadFile = File(...)):
    """
    Upload and parse resume PDF

    Returns structured resume data with formatting analysis
    """
    try:
        # Validate file type (filename can be None for nameless multipart parts).
        if not (file.filename or "").lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")

        # Read file
        pdf_bytes = await file.read()

        # Reject empty or oversized uploads (protects memory and the parser).
        MAX_PDF_BYTES = 10 * 1024 * 1024  # 10 MB
        if not pdf_bytes:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        if len(pdf_bytes) > MAX_PDF_BYTES:
            raise HTTPException(status_code=413, detail="PDF is too large (max 10 MB)")
        # Sanity-check the PDF magic bytes so a renamed non-PDF fails cleanly.
        if not pdf_bytes.lstrip()[:5].startswith(b"%PDF"):
            raise HTTPException(status_code=400, detail="File does not look like a valid PDF")

        # Parse PDF
        parser = get_pdf_parser()
        parsed_resume = parser.parse_resume(pdf_bytes)

        # Extract keywords from resume
        extractor = get_keyword_extractor()
        resume_keywords = extractor.extract_from_resume(
            parsed_resume.data.raw_text or ""
        )

        result = _serialize_parsed(parsed_resume, resume_keywords)
        result["source_format"] = "pdf"
        return {"success": True, "data": result}

    except HTTPException:
        # Client errors (bad type/size) must pass through, not become a 500.
        raise
    except Exception as e:
        logger.error(f"Error processing resume upload: {e}")
        raise HTTPException(status_code=500, detail="Failed to process the uploaded resume")


def _serialize_parsed(parsed_resume, resume_keywords) -> dict:
    return {
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
                "description": exp.description,
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
                "honors": edu.honors,
            }
            for edu in parsed_resume.data.education
        ],
        "skills": parsed_resume.data.skills,
        "certifications": parsed_resume.data.certifications,
        "projects": parsed_resume.data.projects,
        "raw_text": parsed_resume.data.raw_text,
        "latex_source": parsed_resume.data.latex_source,
        "source_format": parsed_resume.data.source_format,
        "formatting_issues": parsed_resume.formatting_issues,
        "sections_found": parsed_resume.sections_found,
        "confidence": parsed_resume.confidence,
        "keywords": resume_keywords.get("keywords", []),
    }


@router.post("/upload-latex")
async def upload_latex_resume(request: UploadLatexRequest):
    """
    Accept a pasted LaTeX (.tex) source as the resume input.

    Returns the same structured shape as /upload, plus ``source_format``
    ("latex") and ``latex_source`` so the original styling can be preserved
    on export.
    """
    try:
        if not request.latex or not request.latex.strip():
            raise HTTPException(status_code=400, detail="LaTeX source is empty")

        parser = get_latex_parser()
        parsed_resume = parser.parse(request.latex)

        extractor = get_keyword_extractor()
        resume_keywords = extractor.extract_from_resume(parsed_resume.data.raw_text or "")

        result = _serialize_parsed(parsed_resume, resume_keywords)
        return {"success": True, "data": result}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing LaTeX upload: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse the LaTeX resume")


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
