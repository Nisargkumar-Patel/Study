"""Regression tests for the PDF resume parser — focused on the data-loss bugs
reported on a real resume that used U+25CF (●) bullets and a category-grouped
skills layout.

The parser takes PDF bytes, so these tests exercise the text-level parsing
helpers directly against reconstructed resume text (the same `full_text` that
PyMuPDF produces from the PDF).
"""

import pytest

from app.services.pdf_parser import PDFParser


@pytest.fixture(scope="module")
def parser():
    return PDFParser()


# Reconstructed from the user's actual resume (● = U+25CF BLACK CIRCLE).
RESUME_TEXT = """SMIT SHAH
smit@example.com | 416-555-0100 | linkedin.com/in/smitshah

SUMMARY
● Results-driven Full Stack Developer with over 3 years of experience designing, developing, and optimizing scalable web applications using React.js, Python, GraphQL, and AWS. ● Proven ability to work effectively in remote and agile environments. ● Strong background in CI/CD automation, API integration, and frontend-backend synchronization.

EXPERIENCE
UI/UX & Frontend Developer — NovaForge – Etobicoke, Ontario (Remote)
August 2025 – Present
● Built responsive React.js interfaces improving user engagement by 35%.
● Implemented WCAG accessibility standards across 12 production pages.
● Collaborated with backend team on GraphQL API integration.

Software Developer — TechCorp – Toronto, Ontario
December 2021 – March 2023
● Developed Python microservices handling 2M requests daily.
● Reduced AWS Lambda cold-start latency by 40% in 2022.

Junior Developer — StartupXYZ – Remote
June 2021 – November 2021
● Maintained Node.js and Express.js REST APIs.

SKILLS
● Languages: Python, JavaScript, TypeScript, C, Bash ● Frontend: HTML, React.js, Next.js, Apollo GraphQL Client, Tailwind CSS, Material UI ● Backend: Node.js, Express.js, RESTful APIs ● Cloud & DevOps: AWS Lambda, AWS DynamoDB, ECS, S3, CI/CD, GitHub Actions ● Tools: Git, JIRA, Confluence, Docker, Linux CLI

EDUCATION
Bachelor of Science in Computer Science
University of Toronto
2021
"""


def _sections(parser):
    return parser._detect_sections(RESUME_TEXT)


def test_experience_entries_are_all_kept(parser):
    sections = _sections(parser)
    exp = parser._parse_experience(sections.get("experience"), RESUME_TEXT)
    # Three real jobs — none dropped, none fragmented into empty date rows.
    assert len(exp) == 3, [(e.title, e.company, e.start_date, e.end_date) for e in exp]


def test_experience_bullets_are_not_erased(parser):
    """The core reported bug: ● bullets were silently dropped."""
    sections = _sections(parser)
    exp = parser._parse_experience(sections.get("experience"), RESUME_TEXT)

    first = exp[0]
    assert len(first.bullets) == 3, first.bullets
    assert any("user engagement by 35%" in b for b in first.bullets)
    assert any("WCAG accessibility" in b for b in first.bullets)

    # A bullet containing a year ("...by 40% in 2022") must stay a bullet, not
    # start a new fragmented entry.
    second = exp[1]
    assert len(second.bullets) == 2, second.bullets
    assert any("cold-start latency by 40%" in b for b in second.bullets)


def test_no_bullet_text_is_lost_across_all_entries(parser):
    """Stronger guarantee: every bullet sentence from the source appears
    somewhere in the parsed output (bullets or description)."""
    sections = _sections(parser)
    exp = parser._parse_experience(sections.get("experience"), RESUME_TEXT)

    captured = " ".join(
        b for e in exp for b in e.bullets
    ) + " " + " ".join(e.description or "" for e in exp)

    for needle in [
        "user engagement by 35%",
        "WCAG accessibility standards across 12 production pages",
        "GraphQL API integration",
        "Python microservices handling 2M requests daily",
        "cold-start latency by 40%",
        "Node.js and Express.js REST APIs",
    ]:
        assert needle in captured, f"LOST: {needle!r}"


def test_titles_and_companies_parsed(parser):
    sections = _sections(parser)
    exp = parser._parse_experience(sections.get("experience"), RESUME_TEXT)
    titles = [e.title for e in exp]
    companies = [e.company for e in exp]

    # ALL three entries keep their title + company (the title sits on the line
    # above the date range — the previous parser stranded it).
    assert any("Frontend Developer" in t for t in titles)
    assert any("NovaForge" in c for c in companies)
    assert any("Software Developer" in t for t in titles)
    assert any("TechCorp" in c for c in companies)
    assert any("Junior Developer" in t for t in titles)
    assert any("StartupXYZ" in c for c in companies)

    # No entry is missing both title and company.
    assert all((e.title or e.company) for e in exp), \
        [(e.title, e.company) for e in exp]

    # Dates correctly attached, not split into empty rows.
    assert exp[0].start_date == "August 2025"
    assert exp[0].end_date == "Present"
    assert exp[1].start_date == "December 2021"
    assert exp[1].end_date == "March 2023"


def test_summary_keeps_full_text_without_bullet_chars(parser):
    sections = _sections(parser)
    summary = parser._extract_summary(sections.get("summary"), RESUME_TEXT)
    assert "Full Stack Developer" in summary
    assert "CI/CD automation" in summary
    # The ● markers are normalized away.
    assert "●" not in summary


def test_skills_unpack_category_groups(parser):
    sections = _sections(parser)
    skills = parser._parse_skills(sections.get("skills"), RESUME_TEXT)
    lower = {s.lower() for s in skills}
    # Real skills extracted, not "Languages: Python".
    assert "python" in lower
    assert "react.js" in lower
    assert "tailwind css" in lower
    assert "github actions" in lower
    # Category labels are stripped, never stored as a skill.
    assert not any(s.lower().startswith("languages") for s in skills)
    assert not any(s.lower().startswith("cloud & devops") for s in skills)
    # The ● markers never leak into a skill value.
    assert not any("●" in s for s in skills)
    # Compound skills like CI/CD must not be split on the slash.
    assert "CI/CD" in skills
    assert "CI" not in skills and "CD" not in skills


def test_education_section_preserved(parser):
    sections = _sections(parser)
    edu = parser._parse_education(sections.get("education"), RESUME_TEXT)
    assert len(edu) >= 1
    assert any("Computer Science" in e.degree for e in edu)
    # No junk fragment entries (e.g. degree just "Bachelor" with no institution).
    assert all(e.institution or "Computer Science" in e.degree for e in edu), \
        [(e.degree, e.institution) for e in edu]
    assert not any(e.degree.strip().lower() == "bachelor" and not e.institution for e in edu)
