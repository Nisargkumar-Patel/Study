from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Dict, Literal
import logging

from app.services.export_service import get_export_service

logger = logging.getLogger(__name__)

router = APIRouter()


class ExportRequest(BaseModel):
    """Request to export resume"""
    resume_data: Dict
    template: Literal["classic", "modern", "technical", "executive", "minimal"] = "classic"


@router.post("/pdf")
async def export_to_pdf(request: ExportRequest):
    """
    Export resume to ATS-friendly PDF

    Templates:
    - classic: Traditional single-column
    - modern: Clean with subtle color accents
    - technical: Optimized for engineering/dev roles
    - executive: For senior/leadership roles
    - minimal: Maximum readability

    Returns PDF file
    """
    try:
        export_service = get_export_service()
        pdf_bytes = export_service.export_to_pdf(
            request.resume_data,
            request.template
        )

        # Return PDF file
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=resume_{request.template}.pdf"
            }
        )

    except Exception as e:
        logger.error(f"Error exporting to PDF: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/docx")
async def export_to_docx(request: ExportRequest):
    """
    Export resume to DOCX format

    Returns DOCX file
    """
    try:
        export_service = get_export_service()
        docx_bytes = export_service.export_to_docx(
            request.resume_data,
            request.template
        )

        # Return DOCX file
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f"attachment; filename=resume_{request.template}.docx"
            }
        )

    except Exception as e:
        logger.error(f"Error exporting to DOCX: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/text")
async def export_to_text(request: ExportRequest):
    """
    Export resume to plain text format

    Returns text file
    """
    try:
        export_service = get_export_service()
        text_content = export_service.export_to_text(request.resume_data)

        # Return text file
        return Response(
            content=text_content,
            media_type="text/plain",
            headers={
                "Content-Disposition": "attachment; filename=resume.txt"
            }
        )

    except Exception as e:
        logger.error(f"Error exporting to text: {e}")
        raise HTTPException(status_code=500, detail=str(e))
