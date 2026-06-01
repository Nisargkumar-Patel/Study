import re
import spacy
from typing import List, Dict, Set, Tuple, Any
from sklearn.feature_extraction.text import TfidfVectorizer
from collections import Counter
import logging

from app.services.skills_data import SKILLS_DATABASE, SKILL_ALIASES, TECH_SKILLS

logger = logging.getLogger(__name__)

# Ultra-short skill names that are real languages but also appear constantly as
# ordinary letters/words. We only accept them when tech context is nearby.
AMBIGUOUS_SHORT_SKILLS = {"r", "c", "go"}

# Words that, when near an ambiguous short skill, confirm it's the language.
_TECH_CONTEXT_WORDS = {
    "programming", "language", "languages", "developer", "engineer", "proficient",
    "experience", "expertise", "coding", "scripting", "skills", "knowledge",
    "fluent", "proficiency", "familiar", "familiarity", "stack", "lang",
}


class KeywordExtractor:
    """Extract keywords and skills from resumes and job descriptions using NLP"""

    def __init__(self):
        """Initialize spaCy model and TF-IDF vectorizer"""
        try:
            self.nlp = spacy.load("en_core_web_lg")
        except OSError:
            logger.warning("en_core_web_lg not found, trying en_core_web_md")
            try:
                self.nlp = spacy.load("en_core_web_md")
            except OSError:
                logger.error("No spaCy model found. Using en_core_web_sm as fallback")
                self.nlp = spacy.load("en_core_web_sm")

        # Create phrase matcher for skills. We match canonical skills AND their
        # aliases/short forms; matched alias surface forms are resolved back to
        # the canonical name in _extract_skills, so "k8s" is reported as
        # "kubernetes".
        from spacy.matcher import PhraseMatcher
        self.skill_matcher = PhraseMatcher(self.nlp.vocab, attr="LOWER")
        surface_forms = set(SKILLS_DATABASE) | set(SKILL_ALIASES.keys())
        # Single-token surface forms, used to detect when an ambiguous short
        # skill sits in a list of other skills (e.g. "C, Python, Go").
        self._known_surface_forms = {f for f in surface_forms if " " not in f}
        skill_patterns = [self.nlp.make_doc(form) for form in surface_forms]
        self.skill_matcher.add("SKILLS", skill_patterns)

        # TF-IDF vectorizer for keyword extraction
        self.vectorizer = TfidfVectorizer(
            max_features=100,
            stop_words='english',
            ngram_range=(1, 3),  # Unigrams to trigrams
            min_df=1
        )

    def extract_from_job_description(self, jd_text: str) -> Dict[str, Any]:
        """
        Extract keywords, skills, and requirements from job description

        Args:
            jd_text: Job description text

        Returns:
            Dictionary with extracted information
        """
        doc = self.nlp(jd_text)

        # Extract skills using phrase matching
        skills = self._extract_skills(doc)

        # Extract keywords using TF-IDF
        keywords = self._extract_tfidf_keywords(jd_text)

        # Extract years of experience
        years_exp = self._extract_years_experience(jd_text)

        # Extract education requirements
        education = self._extract_education_requirements(jd_text)

        # Extract job title and company (if present)
        job_info = self._extract_job_info(doc)

        # Separate required vs preferred
        required_skills, preferred_skills = self._categorize_skills(jd_text, skills)

        # Extract technologies (subset of skills)
        technologies = self._extract_technologies(skills)

        return {
            "required_skills": list(required_skills),
            "preferred_skills": list(preferred_skills),
            "technologies": technologies,
            "keywords": keywords,
            "years_experience": years_exp,
            "education_requirements": education,
            "title": job_info.get("title"),
            "company": job_info.get("company"),
            "all_skills": list(skills)
        }

    def extract_from_resume(self, resume_text: str) -> Dict[str, Any]:
        """
        Extract keywords and skills from resume

        Args:
            resume_text: Resume text

        Returns:
            Dictionary with extracted information
        """
        doc = self.nlp(resume_text)

        # Extract skills
        skills = self._extract_skills(doc)

        # Extract keywords using TF-IDF
        keywords = self._extract_tfidf_keywords(resume_text)

        # Extract technologies
        technologies = self._extract_technologies(skills)

        # Extract certifications
        certifications = self._extract_certifications(resume_text)

        return {
            "skills": list(skills),
            "keywords": keywords,
            "technologies": technologies,
            "certifications": certifications
        }

    def _extract_skills(self, doc) -> Set[str]:
        """Extract skills using the curated phrase matcher.

        Only known skills (and their aliases) are returned. Alias surface forms
        like "k8s" or "postgres" are resolved to their canonical name. Noun-chunk
        scanning was removed because it pulled in noise like "a senior python
        engineer" whenever a chunk merely contained a skill substring.
        """
        skills = set()

        matches = self.skill_matcher(doc)
        for match_id, start, end in matches:
            surface = doc[start:end].text.lower()
            canonical = SKILL_ALIASES.get(surface, surface)
            if canonical in AMBIGUOUS_SHORT_SKILLS and not self._has_tech_context(doc, start, end):
                continue
            skills.add(canonical)

        return skills

    def _has_tech_context(self, doc, start: int, end: int) -> bool:
        """True if an ambiguous short skill (r/c/go) at doc[start:end] is
        surrounded by tech context: a context word, or an adjacent token that is
        itself a known skill (e.g. a comma-separated list "C, Python, Go")."""
        window = 4
        lo = max(0, start - window)
        hi = min(len(doc), end + window)
        for i in range(lo, hi):
            if start <= i < end:
                continue
            tok = doc[i].text.lower()
            if tok in _TECH_CONTEXT_WORDS:
                return True
            # Neighbor is another recognised skill/alias -> looks like a tech list.
            if tok in self._known_surface_forms:
                return True
        return False

    def _extract_tfidf_keywords(self, text: str) -> List[Tuple[str, float]]:
        """Extract keywords using TF-IDF"""
        try:
            tfidf_matrix = self.vectorizer.fit_transform([text])
            feature_names = self.vectorizer.get_feature_names_out()

            # Get scores
            scores = zip(feature_names, tfidf_matrix.toarray()[0])
            sorted_scores = sorted(scores, key=lambda x: x[1], reverse=True)

            # Return top 50 keywords with scores
            return [(word, float(score)) for word, score in sorted_scores[:50] if score > 0]
        except:
            return []

    def _extract_years_experience(self, text: str) -> int:
        """Extract years of experience requirement"""
        # Patterns for years of experience
        patterns = [
            r'(\d+)\+?\s*years?\s+(?:of\s+)?experience',
            r'experience\s+(?:of\s+)?(\d+)\+?\s*years?',
            r'minimum\s+(?:of\s+)?(\d+)\+?\s*years?',
            r'(\d+)\+?\s*years?\s+in',
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return int(match.group(1))

        return 0

    def _extract_education_requirements(self, text: str) -> List[str]:
        """Extract education requirements"""
        education_keywords = [
            "bachelor", "master", "phd", "doctorate", "mba", "associate",
            "degree", "diploma", "certification", "bs", "ba", "ms", "ma"
        ]

        education = []
        doc = self.nlp(text.lower())

        for sent in doc.sents:
            sent_text = sent.text
            if any(keyword in sent_text for keyword in education_keywords):
                education.append(sent.text.strip())

        return education[:3]  # Top 3 education mentions

    def _extract_job_info(self, doc) -> Dict[str, str]:
        """Extract job title and company"""
        info = {}

        # Look for organization entities
        for ent in doc.ents:
            if ent.label_ == "ORG" and "company" not in info:
                info["company"] = ent.text
            elif ent.label_ == "WORK_OF_ART" and "title" not in info:
                info["title"] = ent.text

        return info

    # Cue phrases that mark a line/section as required vs preferred.
    _REQUIRED_CUES = [
        "must have", "must-have", "required", "requirement", "essential",
        "mandatory", "you have", "you'll need", "what you need", "qualifications",
        "minimum qualifications", "basic qualifications", "we require",
    ]
    _PREFERRED_CUES = [
        "nice to have", "nice-to-have", "preferred", "bonus", "a plus", "plus",
        "desired", "desirable", "ideally", "would be great", "good to have",
        "familiarity with", "exposure to", "advantageous", "pluses",
    ]

    def _categorize_skills(self, text: str, skills: Set[str]) -> Tuple[Set[str], Set[str]]:
        """Categorize skills into required vs preferred.

        Classification is *scoped*: it looks at the line a skill appears on and
        the section header above it, rather than running ".*" across the whole
        document (which falsely tagged a skill "required" whenever the word
        "required" appeared anywhere). A skill seen in any required context wins
        over preferred; skills with no cue default to required (unchanged
        behaviour, so ATS scoring stays stable).
        """
        required: Set[str] = set()
        preferred: Set[str] = set()

        segments = self._segment_lines(text)  # list of (section_class, line_lower)

        for skill in skills:
            classes: Set[str] = set()
            for section_class, line in segments:
                if not self._line_contains_skill(line, skill):
                    continue
                cue = self._line_cue(line) or section_class
                if cue:
                    classes.add(cue)

            if "required" in classes:
                required.add(skill)
            elif "preferred" in classes:
                preferred.add(skill)
            else:
                required.add(skill)  # default unchanged

        return required, preferred

    def _segment_lines(self, text: str) -> List[Tuple[str, str]]:
        """Split text into (section_class, lowercased_line) pairs.

        A line that looks like a section header (short, cue-bearing, often ending
        with ':') sets the active section class for the lines beneath it until the
        next header. section_class is "required", "preferred", or "" (none).
        """
        segments: List[Tuple[str, str]] = []
        active = ""
        for raw_line in text.splitlines():
            line = raw_line.strip().lower()
            if not line:
                continue

            header_class = self._header_class(line)
            if header_class is not None:
                active = header_class
                # A header line itself rarely contains skills; still scan it.
                segments.append((active, line))
                continue

            segments.append((active, line))
        return segments

    def _header_class(self, line: str) -> str | None:
        """Return "required"/"preferred"/"" if the line is a section header, else None."""
        # Headers are short and typically end with ':' or are title-like.
        is_headerish = len(line) <= 60 and (line.endswith(":") or len(line.split()) <= 6)
        if not is_headerish:
            return None
        if any(cue in line for cue in self._PREFERRED_CUES):
            return "preferred"
        if any(cue in line for cue in self._REQUIRED_CUES):
            return "required"
        return None

    def _line_cue(self, line: str) -> str:
        """Return the cue class implied by a single line, or "" if none.

        Preferred cues are checked first so a phrase like "X is a plus" is not
        swallowed by an unrelated required cue elsewhere on the line.
        """
        if any(cue in line for cue in self._PREFERRED_CUES):
            return "preferred"
        if any(cue in line for cue in self._REQUIRED_CUES):
            return "required"
        return ""

    @staticmethod
    def _line_contains_skill(line: str, skill: str) -> bool:
        """Whole-token containment check so 'go'/'r'/'c' don't match substrings."""
        return re.search(
            r"(?<![a-z0-9+#.])" + re.escape(skill) + r"(?![a-z0-9+#])",
            line,
        ) is not None

    def _extract_technologies(self, skills: Set[str]) -> List[str]:
        """Return the subset of extracted skills that are technologies.

        Uses the curated TECH_SKILLS set (everything except soft skills) instead
        of a tiny hard-coded list, so e.g. terraform, svelte, snowflake all count.
        """
        return [skill for skill in skills if skill.lower() in TECH_SKILLS]

    def _extract_certifications(self, text: str) -> List[str]:
        """Extract certifications from resume"""
        cert_patterns = [
            r'certified\s+[\w\s]+',
            r'certification\s+in\s+[\w\s]+',
            r'[A-Z]{2,}[\s\-][A-Z]{2,}',  # Acronyms like AWS-SAA, PMP
        ]

        certifications = []
        for pattern in cert_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            certifications.extend(matches)

        return certifications[:10]  # Top 10


# Singleton instance
_keyword_extractor = None

def get_keyword_extractor() -> KeywordExtractor:
    """Get singleton instance of KeywordExtractor"""
    global _keyword_extractor
    if _keyword_extractor is None:
        _keyword_extractor = KeywordExtractor()
    return _keyword_extractor
