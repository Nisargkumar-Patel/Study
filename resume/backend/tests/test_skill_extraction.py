"""Tests for the upgraded rule-based skill extraction."""

import pytest

from app.services.keyword_extractor import get_keyword_extractor


@pytest.fixture(scope="module")
def extractor():
    return get_keyword_extractor()


def _all(result):
    return {s.lower() for s in result["all_skills"]}


def test_expanded_dictionary_catches_modern_stack(extractor):
    jd = """
    We are looking for a frontend engineer experienced with Svelte and Astro.
    You will use Vite, Playwright, and Tailwind CSS daily, and deploy on
    Cloudflare Workers. Familiarity with tRPC and Drizzle is helpful.
    """
    found = _all(extractor.extract_from_job_description(jd))
    for skill in ["svelte", "astro", "vite", "playwright", "tailwind css",
                  "cloudflare workers", "trpc", "drizzle"]:
        assert skill in found, f"expected {skill!r} in {found}"


def test_aliases_resolve_to_canonical(extractor):
    jd = """
    Required: strong experience with k8s and postgres. You should know node
    and write clean JS/TS. GCP experience required.
    """
    found = _all(extractor.extract_from_job_description(jd))
    # Aliases must be reported under canonical names, not their short forms.
    assert "kubernetes" in found
    assert "postgresql" in found
    assert "node.js" in found
    assert "javascript" in found
    assert "typescript" in found
    assert "google cloud" in found
    # Short forms should NOT leak through as separate skills.
    assert "k8s" not in found
    assert "postgres" not in found


def test_required_vs_preferred_uses_sections(extractor):
    jd = """
    Requirements:
    - 5+ years with Python
    - Strong SQL skills

    Nice to have:
    - Experience with Rust
    - Familiarity with GraphQL
    """
    result = extractor.extract_from_job_description(jd)
    required = {s.lower() for s in result["required_skills"]}
    preferred = {s.lower() for s in result["preferred_skills"]}

    assert "python" in required
    assert "sql" in required
    assert "rust" in preferred
    assert "graphql" in preferred
    # A preferred skill must not also be marked required.
    assert "rust" not in required
    assert "graphql" not in required


def test_preferred_cue_not_overridden_by_distant_required(extractor):
    """The old whole-document regex would tag Rust 'required' just because the
    word 'required' appeared elsewhere. The scoped classifier must not."""
    jd = """
    Python is required for this role.

    Rust experience is a plus.
    """
    result = extractor.extract_from_job_description(jd)
    required = {s.lower() for s in result["required_skills"]}
    preferred = {s.lower() for s in result["preferred_skills"]}

    assert "python" in required
    assert "rust" in preferred
    assert "rust" not in required


def test_technologies_exclude_soft_skills(extractor):
    jd = """
    Requirements: Python, Docker, and strong communication and leadership.
    """
    result = extractor.extract_from_job_description(jd)
    techs = {t.lower() for t in result["technologies"]}
    assert "python" in techs
    assert "docker" in techs
    assert "communication" not in techs
    assert "leadership" not in techs


def test_short_token_skills_no_false_substring(extractor):
    """'go' must not be matched inside words like 'goals' or 'category'."""
    jd = "We value candidates who set ambitious goals in every category."
    found = _all(extractor.extract_from_job_description(jd))
    assert "go" not in found
    assert "r" not in found
    assert "c" not in found
