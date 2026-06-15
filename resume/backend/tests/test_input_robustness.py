"""Malformed-input robustness tests.

Router handlers accept arbitrary `Dict` bodies (resume_data / job_data), so the
services receive untrusted data where any field can be missing, None, or a
non-string. These tests post deliberately nasty data and assert the services
degrade gracefully instead of raising (which would 500 the request).
"""

import pytest

from app.services.ats_scorer import get_ats_scorer
from app.services.resume_optimizer import get_resume_optimizer
from app.services.export_service import get_export_service
from app.utils.text_normalizer import canonicalize


# A resume with null dates, non-string skills/bullets, and XML-ish text that
# would crash reportlab's Paragraph parser if not escaped.
NASTY_RESUME = {
    "name": None,
    "email": None,
    "summary": "Built A/B testing <b>framework</b> with <unclosed and 5 < 10 logic",
    "experience": [{
        "title": "Engineer <script>", "company": None,
        "start_date": None, "end_date": None,
        "bullets": ["Did x & y", None, 42, "Used C++ <template>"],
    }],
    "education": [{"degree": None, "institution": "X & Y University"}],
    "skills": ["Python", None, 123, "C++", "AWS <prod>"],
    "certifications": [None, "AWS Certified"],
    "raw_text": "blah",
}

NASTY_JOB = {
    "raw_text": "Looking for Python, AWS, Kubernetes. 5+ years.",
    "description": "Looking for Python, AWS, Kubernetes.",
    "keywords": {"required_skills": ["python", "aws", "kubernetes"],
                 "all_skills": ["python", "aws"]},
    "years_experience": 5,
    "education_requirements": [],
}


def test_canonicalize_tolerates_none_and_nonstring():
    assert canonicalize(None) == ""
    assert canonicalize(123) == "123"


def test_ats_scorer_survives_null_dates_and_nonstring_skills():
    score = get_ats_scorer().calculate_score(NASTY_RESUME, NASTY_JOB)
    assert 0 <= score.overall_score <= 100


def test_auto_optimize_survives_nasty_resume():
    optimized, changes = get_resume_optimizer().build_optimized_resume(
        NASTY_RESUME, NASTY_JOB
    )
    assert isinstance(optimized, dict)
    assert isinstance(changes, dict)


def test_generate_suggestions_survives_nasty_resume():
    suggestions = get_resume_optimizer().generate_suggestions(NASTY_RESUME, NASTY_JOB)
    assert isinstance(suggestions, list)


def test_text_export_survives_null_name_and_nonstring_skills():
    out = get_export_service().export_to_text(NASTY_RESUME)
    assert isinstance(out, str) and "SKILLS" in out


def test_pdf_export_survives_xml_injection_in_user_text():
    out = get_export_service().export_to_pdf(NASTY_RESUME, "classic")
    assert isinstance(out, (bytes, bytearray)) and out[:4] == b"%PDF"


def test_docx_export_survives_none_bullets_and_nonstring_skills():
    out = get_export_service().export_to_docx(NASTY_RESUME, "classic")
    assert isinstance(out, (bytes, bytearray)) and len(out) > 1000


@pytest.mark.parametrize("empty", [{}, {"skills": [], "experience": [], "education": []}])
def test_services_survive_empty_resume(empty):
    get_ats_scorer().calculate_score(empty, NASTY_JOB)
    get_resume_optimizer().build_optimized_resume(empty, NASTY_JOB)
    get_export_service().export_to_text(empty)
