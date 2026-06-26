"""PDF parser failure-mode tests.

Regression for the silent-fail bug: bad/encrypted/image-only PDFs used to
return ParsedResume(name='Unknown', confidence=0.0) with the exception text
stuffed into raw_text, so the UI showed it as a successful parse.
"""

import fitz
import pytest

from app.services.pdf_parser import PDFParser, PDFParseError


def test_non_pdf_bytes_raise_parse_error():
    with pytest.raises(PDFParseError):
        PDFParser().parse_resume(b"this is not a pdf")


def test_empty_bytes_raise_parse_error():
    with pytest.raises(PDFParseError):
        PDFParser().parse_resume(b"")


def test_image_only_pdf_raises_parse_error():
    """A real PDF with no text (scanned/image-only) should fail loudly so the
    user sees an actionable message instead of an 'Unknown' empty resume."""
    doc = fitz.open()
    doc.new_page()  # blank page, no text
    pdf_bytes = doc.tobytes()
    doc.close()
    with pytest.raises(PDFParseError):
        PDFParser().parse_resume(pdf_bytes)


def test_text_pdf_still_parses_successfully():
    """The happy path must still work after the failure-mode changes."""
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Summary\nBackend engineer.")
    pdf_bytes = doc.tobytes()
    doc.close()

    parsed = PDFParser().parse_resume(pdf_bytes)
    assert parsed.confidence > 0
    assert parsed.data.raw_text and "Backend engineer" in parsed.data.raw_text
