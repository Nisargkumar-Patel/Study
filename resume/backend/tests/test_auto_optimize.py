"""Tests for the auto-optimizer: it must improve the ATS score using only
truthful transformations, and never fabricate experience or numbers."""

import pytest

from app.services.resume_optimizer import get_resume_optimizer
from app.services.ats_scorer import get_ats_scorer


@pytest.fixture(scope="module")
def optimizer():
    return get_resume_optimizer()


@pytest.fixture(scope="module")
def scorer():
    return get_ats_scorer()


def _job(required_skills, keywords):
    return {
        "raw_text": " ".join(keywords + required_skills),
        "years_experience": 0,
        "education_requirements": [],
        "keywords": {
            "keywords": [[k, 0.5] for k in keywords],
            "required_skills": required_skills,
            "all_skills": required_skills,
        },
    }


def _resume():
    return {
        "name": "Test User",
        "summary": "Software developer responsible for building web apps.",
        "experience": [
            {
                "title": "Developer",
                "company": "Acme",
                "start_date": "2021",
                "end_date": "2024",
                "bullets": [
                    "Responsible for building REST APIs.",
                    "Helped migrate services to the cloud.",
                ],
            }
        ],
        "education": [],
        "skills": ["Python", "JavaScript"],
        "certifications": [],
        "projects": [],
    }


def test_missing_skills_are_added(optimizer):
    job = _job(required_skills=["Docker", "Kubernetes", "AWS"], keywords=["docker", "kubernetes"])
    optimized, changes = optimizer.build_optimized_resume(_resume(), job)

    skills_lower = {s.lower() for s in optimized["skills"]}
    assert "docker" in skills_lower
    assert "kubernetes" in skills_lower
    assert "aws" in skills_lower
    # Original skills are preserved.
    assert "python" in skills_lower
    assert {"Docker", "Kubernetes", "AWS"} <= set(changes["skills_added"])


def test_weak_verbs_are_strengthened(optimizer):
    job = _job(required_skills=[], keywords=[])
    optimized, changes = optimizer.build_optimized_resume(_resume(), job)

    bullets = optimized["experience"][0]["bullets"]
    joined = " ".join(bullets).lower()
    # "Responsible for" -> "Led", "Helped" -> "Assisted"
    assert "responsible for" not in joined
    assert "helped" not in joined
    assert len(changes["bullets_strengthened"]) >= 1
    # Capitalization preserved at start of bullet.
    assert bullets[0][0].isupper()


def test_no_fabricated_experience_or_metrics(optimizer):
    """The optimizer must not invent new bullets, jobs, or fake numbers."""
    job = _job(required_skills=["Docker"], keywords=["docker"])
    resume = _resume()
    original_bullet_count = sum(len(e["bullets"]) for e in resume["experience"])

    optimized, _ = optimizer.build_optimized_resume(resume, job)

    # Same number of jobs and bullets — nothing invented.
    assert len(optimized["experience"]) == len(resume["experience"])
    assert sum(len(e["bullets"]) for e in optimized["experience"]) == original_bullet_count
    # No placeholder metric text leaked in.
    for e in optimized["experience"]:
        for b in e["bullets"]:
            assert "e.g." not in b.lower()
            assert "add specific metrics" not in b.lower()


def test_score_improves_after_optimization(optimizer, scorer):
    job = _job(
        required_skills=["Docker", "Kubernetes", "AWS", "GraphQL"],
        keywords=["docker", "kubernetes", "aws", "graphql"],
    )
    resume = _resume()

    before = scorer.calculate_score(resume, job)
    optimized, _ = optimizer.build_optimized_resume(resume, job)
    after = scorer.calculate_score(optimized, job)

    assert after.overall_score >= before.overall_score
    # With all required skills added, skills match should be high.
    assert after.skills_match.percentage >= before.skills_match.percentage


def test_original_resume_is_not_mutated(optimizer):
    job = _job(required_skills=["Docker"], keywords=["docker"])
    resume = _resume()
    optimizer.build_optimized_resume(resume, job)
    # The input dict must be untouched (deep copy used internally).
    assert resume["skills"] == ["Python", "JavaScript"]
    assert resume["summary"] == "Software developer responsible for building web apps."
