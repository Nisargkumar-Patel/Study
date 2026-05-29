from app.services.cover_letter_generator import CoverLetterGenerator


def _job(title, company, required_skills, keywords=None):
    return {
        "title": title,
        "company": company,
        "raw_text": " ".join(required_skills),
        "keywords": {
            "required_skills": required_skills,
            "all_skills": required_skills,
            "keywords": [[kw, 0.5] for kw in (keywords or [])],
        },
    }


def _resume():
    return {
        "name": "Jane Doe",
        "email": "jane@example.com",
        "phone": "416-555-0100",
        "location": "Toronto, ON",
        "summary": "Backend engineer.",
        "experience": [
            {
                "title": "Engineer",
                "company": "Acme",
                "start_date": "2019",
                "end_date": "2024",
                "bullets": [
                    "Reduced API latency by 40% serving 2M monthly users",
                    "Mentored junior developers",
                ],
            }
        ],
        "skills": ["Python", "AWS", "Docker"],
    }


def test_cover_letter_includes_core_fields():
    gen = CoverLetterGenerator()
    job = _job("Senior Backend Engineer", "Shopify",
               required_skills=["Python", "Amazon Web Services", "Kubernetes"])
    letter = gen.generate(_resume(), job)

    assert "Jane Doe" in letter
    assert "Shopify" in letter
    assert "Senior Backend Engineer" in letter
    # Resume's "AWS" matches the job's "Amazon Web Services" via canonicalization,
    # and the letter shows the resume's own casing.
    assert "AWS" in letter
    assert "Python" in letter
    # A metric-bearing achievement should be woven in
    assert "40%" in letter
    assert len(letter) > 300


def test_cover_letter_degrades_without_title_or_company():
    gen = CoverLetterGenerator()
    job = _job("", "", required_skills=[])
    letter = gen.generate(_resume(), job)

    assert "the role" in letter
    assert "your company" in letter
    assert "Dear Hiring Manager," in letter
    assert "Jane Doe" in letter


def test_cover_letter_handles_empty_resume_fields():
    gen = CoverLetterGenerator()
    job = _job("Analyst", "BigCo", required_skills=["Excel"])
    letter = gen.generate({"name": "", "experience": [], "skills": []}, job)

    assert "Your Name" in letter
    assert "Analyst" in letter
    assert "BigCo" in letter
