import re
from typing import Dict, Set

# Canadian / British spelling -> American canonical form, applied per word so
# keyword matching is spelling-agnostic (a CA-spelled resume still matches a
# US-spelled job description and vice versa).
SPELLING_CANONICAL = {
    "labour": "labor", "colour": "color", "favour": "favor", "favourite": "favorite",
    "behaviour": "behavior", "honour": "honor", "neighbour": "neighbor",
    "centre": "center", "metre": "meter", "litre": "liter", "theatre": "theater",
    "fibre": "fiber", "calibre": "caliber",
    "organisation": "organization", "organise": "organize", "organised": "organized",
    "analyse": "analyze", "analysed": "analyzed", "analyses": "analyzes",
    "optimise": "optimize", "optimised": "optimized", "optimisation": "optimization",
    "specialise": "specialize", "specialised": "specialized", "specialisation": "specialization",
    "recognise": "recognize", "prioritise": "prioritize", "standardise": "standardize",
    "customise": "customize", "utilise": "utilize", "minimise": "minimize", "maximise": "maximize",
    "programme": "program", "licence": "license", "defence": "defense", "offence": "offense",
    "catalogue": "catalog", "dialogue": "dialog", "cheque": "check",
    "enrol": "enroll", "enrolment": "enrollment", "fulfil": "fulfill", "fulfilment": "fulfillment",
    "modelling": "modeling", "travelling": "traveling", "labelled": "labeled",
    "cancelled": "canceled", "counselling": "counseling", "practise": "practice",
}

# Acronym / synonym groups. Members are treated as interchangeable for matching.
SYNONYM_GROUPS = [
    {"aws", "amazon web services"},
    {"gcp", "google cloud", "google cloud platform"},
    {"azure", "microsoft azure"},
    {"js", "javascript"},
    {"ts", "typescript"},
    {"k8s", "kubernetes"},
    {"ml", "machine learning"},
    {"ai", "artificial intelligence"},
    {"nlp", "natural language processing"},
    {"ci/cd", "cicd", "continuous integration", "continuous delivery"},
    {"postgres", "postgresql"},
    {"node", "nodejs", "node.js"},
    {"oop", "object oriented programming", "object-oriented programming"},
    {"db", "database"},
    {"ui", "user interface"},
    {"ux", "user experience"},
    {"qa", "quality assurance"},
    {"rest", "restful", "rest api"},
    {"mssql", "sql server", "microsoft sql server"},
    {"c#", "c sharp", "csharp"},
    {"react", "react.js", "reactjs"},
    {"vue", "vue.js", "vuejs"},
    {"angular", "angular.js", "angularjs"},
    {"dotnet", ".net", "dot net"},
]


def _normalize_words(text: str) -> str:
    """Lowercase and apply Canadian/British -> American spelling per word."""
    return " ".join(SPELLING_CANONICAL.get(w, w) for w in text.lower().split())


def _build_synonym_maps():
    variant_to_canon: Dict[str, str] = {}
    canon_to_variants: Dict[str, Set[str]] = {}
    for group in SYNONYM_GROUPS:
        spelled = {_normalize_words(member) for member in group}
        canon = sorted(spelled)[0]
        canon_to_variants[canon] = spelled
        for variant in spelled:
            variant_to_canon[variant] = canon
    return variant_to_canon, canon_to_variants


_VARIANT_TO_CANON, _CANON_TO_VARIANTS = _build_synonym_maps()


def normalize_text(text: str) -> str:
    """Lowercase a block of text and apply spelling normalization, so keyword
    matching is spelling-agnostic."""
    return _normalize_words(text)


def canonicalize(term: str) -> str:
    """Canonical key for a term: lowercased, whitespace-collapsed, spelling- and
    synonym/acronym-normalized (e.g. 'AWS' and 'Amazon Web Services' share a key)."""
    # Posted resume/job dicts are untrusted: a skill may be None or a non-string.
    term = str(term) if term is not None else ""
    spelled = _normalize_words(re.sub(r"\s+", " ", term.strip()))
    return _VARIANT_TO_CANON.get(spelled, spelled)


def term_variants(term: str) -> Set[str]:
    """All spelling/acronym variants of a term that should count as a match."""
    canon = canonicalize(term)
    variants = {canon} | _CANON_TO_VARIANTS.get(canon, set())
    return {v for v in variants if v}


def term_matches_text(term: str, normalized_text: str) -> bool:
    """Whether a term (or any spelling/acronym variant) appears as a whole token
    in already-normalized text (see ``normalize_text``)."""
    for variant in term_variants(term):
        if re.search(r"(?<!\w)" + re.escape(variant) + r"(?!\w)", normalized_text):
            return True
    return False
