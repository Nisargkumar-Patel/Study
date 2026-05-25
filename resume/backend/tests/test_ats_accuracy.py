from app.utils.text_normalizer import canonicalize, term_matches_text, normalize_text
from app.services.ats_scorer import ATSScorer


# --- normalizer ---

def test_canadian_spelling_canonicalizes():
    assert canonicalize("Labour") == "labor"
    assert canonicalize("optimisation") == "optimization"
    assert canonicalize("centre") == "center"


def test_synonyms_share_canonical_key():
    assert canonicalize("AWS") == canonicalize("Amazon Web Services")
    assert canonicalize("JavaScript") == canonicalize("js")
    assert canonicalize("Kubernetes") == canonicalize("k8s")


def test_term_matches_text_is_spelling_agnostic():
    resume = normalize_text("Managed labour relations and centre operations")
    assert term_matches_text("labor", resume)      # US term, CA-spelled resume
    assert term_matches_text("centre", resume)      # CA term canonicalizes to center


def test_term_matches_text_handles_acronyms_both_ways():
    assert term_matches_text("AWS", normalize_text("Deployed on Amazon Web Services"))
    assert term_matches_text("Amazon Web Services", normalize_text("Deployed on AWS"))


def test_term_matches_text_word_boundaries():
    # "java" should not match inside "javascript"
    assert not term_matches_text("java", normalize_text("Strong JavaScript developer"))


# --- scorer matching ---

def _job(keywords, required_skills):
    return {
        "raw_text": " ".join(keywords),
        "keywords": {
            "keywords": [[kw, 0.5] for kw in keywords],
            "required_skills": required_skills,
            "all_skills": required_skills,
        },
    }


def test_missing_keywords_spelling_insensitive():
    scorer = ATSScorer()
    resume = {"summary": "Led labour relations and optimized centre operations.", "skills": []}
    job = _job(keywords=["labor", "center", "python"], required_skills=[])
    missing = scorer._get_missing_keywords(resume, job)
    assert "labor" not in missing
    assert "center" not in missing
    assert "python" in missing


def test_matched_skills_handles_acronym_synonyms():
    scorer = ATSScorer()
    resume = {"skills": ["AWS", "JavaScript"]}
    job = _job(keywords=[], required_skills=["Amazon Web Services", "JS", "Docker"])
    matched = {canonicalize(s) for s in scorer._get_matched_skills(resume, job)}
    missing = {canonicalize(s) for s in scorer._get_missing_skills(resume, job)}
    assert canonicalize("Amazon Web Services") in matched
    assert canonicalize("JS") in matched
    assert canonicalize("Docker") in missing


def test_keyword_coverage_score_reflects_matches():
    scorer = ATSScorer()
    resume_text = "Built python services on aws with docker."
    resume = {"summary": resume_text, "skills": [], "raw_text": resume_text}
    job = _job(keywords=["python", "aws", "docker", "kubernetes"], required_skills=[])
    breakdown = scorer._calculate_keyword_match(resume_text, " ".join(["python", "aws", "docker", "kubernetes"]), resume, job)
    # 3 of 4 job keywords present -> 75%
    assert breakdown.percentage == 75.0
    assert breakdown.details["matched_count"] == 3
