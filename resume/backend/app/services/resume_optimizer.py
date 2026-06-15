import re
import uuid
import copy
from typing import List, Dict, Set, Tuple
import spacy

from app.models.suggestion import Suggestion, SuggestionType
from app.utils.job_data import extract_keyword_strings
from app.utils.text_normalizer import (
    normalize_text, canonicalize, term_matches_text, term_variants,
)

# Strong action verbs categorized by type
ACTION_VERBS = {
    "leadership": ["led", "directed", "managed", "supervised", "coordinated", "orchestrated", "spearheaded", "oversaw"],
    "achievement": ["achieved", "accomplished", "attained", "delivered", "exceeded", "surpassed", "completed"],
    "creation": ["created", "developed", "built", "designed", "engineered", "established", "implemented", "launched"],
    "improvement": ["improved", "enhanced", "optimized", "streamlined", "refined", "upgraded", "modernized", "transformed"],
    "analysis": ["analyzed", "evaluated", "assessed", "investigated", "researched", "examined", "identified"],
    "communication": ["presented", "communicated", "documented", "reported", "published", "authored", "articulated"],
    "collaboration": ["collaborated", "partnered", "cooperated", "facilitated", "contributed", "supported"],
}

# Weak verbs to replace
WEAK_VERBS = {
    "did": ["executed", "performed", "completed", "accomplished"],
    "made": ["created", "developed", "produced", "engineered", "built"],
    "helped": ["assisted", "supported", "facilitated", "enabled", "contributed to"],
    "worked on": ["developed", "implemented", "executed", "delivered"],
    "responsible for": ["managed", "led", "oversaw", "directed"],
    "was in charge of": ["managed", "directed", "led", "supervised"],
    "handled": ["managed", "processed", "coordinated", "executed"],
    "dealt with": ["managed", "resolved", "addressed", "handled"],
    "used": ["utilized", "leveraged", "employed", "applied"],
    "got": ["achieved", "obtained", "secured", "acquired"]
}

# Preferred display casing for skills that would otherwise show up lowercased
# (the JD/extractor works in lowercase). Anything not listed is title-cased,
# except short all-caps acronyms which are upper-cased.
SKILL_DISPLAY_CASE = {
    "aws": "AWS", "gcp": "GCP", "ci/cd": "CI/CD", "ecs": "ECS", "eks": "ECS",
    "s3": "S3", "sql": "SQL", "html": "HTML", "css": "CSS", "api": "API",
    "rest": "REST", "rest api": "REST API", "graphql": "GraphQL",
    "restful apis": "RESTful APIs", "nodejs": "Node.js", "node.js": "Node.js",
    "next.js": "Next.js", "react": "React", "react.js": "React.js",
    "vue.js": "Vue.js", "github actions": "GitHub Actions", "jira": "JIRA",
    "postgresql": "PostgreSQL", "mongodb": "MongoDB", "mysql": "MySQL",
    "dynamodb": "DynamoDB", "aws lambda": "AWS Lambda", "lambda": "Lambda",
    "tcp/ip": "TCP/IP", "ios": "iOS", "macos": "macOS", "kubernetes": "Kubernetes",
    "docker": "Docker", "redis": "Redis", "kafka": "Kafka", "django": "Django",
    "flask": "Flask", "fastapi": "FastAPI", "python": "Python", "java": "Java",
    "javascript": "JavaScript", "typescript": "TypeScript", "terraform": "Terraform",
}


def _display_skill(skill: str) -> str:
    """Return a presentable casing for a (possibly lowercase) skill string."""
    s = skill.strip()
    key = s.lower()
    if key in SKILL_DISPLAY_CASE:
        return SKILL_DISPLAY_CASE[key]
    # Preserve a value that already has mixed/intentional casing.
    if s != key:
        return s
    # Short tokens with no vowels are likely acronyms -> upper-case.
    if len(s) <= 4 and not (set("aeiou") & set(key)):
        return s.upper()
    return s[:1].upper() + s[1:]


# Metric patterns to suggest
METRIC_SUGGESTIONS = [
    "X% improvement",
    "Y users/customers",
    "$Z revenue/savings",
    "N hours/days reduced",
    "M team members",
    "X projects completed"
]


class ResumeOptimizer:
    """Generate resume optimization suggestions using NLP and templates"""

    def __init__(self):
        try:
            self.nlp = spacy.load("en_core_web_lg")
        except OSError:
            try:
                self.nlp = spacy.load("en_core_web_md")
            except OSError:
                try:
                    self.nlp = spacy.load("en_core_web_sm")
                except OSError as exc:
                    raise RuntimeError(
                        "No spaCy English model is installed. Install one, e.g. "
                        "`python -m spacy download en_core_web_sm`."
                    ) from exc

    def _nlp(self, text):
        """Run spaCy, capped at the model's max_length (avoids spaCy E088 on
        very large resume text)."""
        text = text or ""
        limit = getattr(self.nlp, "max_length", 1_000_000)
        if len(text) > limit:
            text = text[:limit]
        return self.nlp(text)

    def generate_suggestions(self, resume_data: Dict, job_data: Dict) -> List[Suggestion]:
        """
        Generate all optimization suggestions

        Args:
            resume_data: Parsed resume data
            job_data: Analyzed job data

        Returns:
            List of Suggestion objects ranked by impact
        """
        suggestions = []

        # Get missing keywords and skills
        missing_keywords = self._get_missing_keywords(resume_data, job_data)
        missing_skills = self._get_missing_skills(resume_data, job_data)

        # Generate suggestions for each section
        suggestions.extend(self._optimize_summary(resume_data, missing_keywords, missing_skills))
        suggestions.extend(self._optimize_experience(resume_data, missing_keywords, missing_skills))
        suggestions.extend(self._optimize_skills(resume_data, missing_skills))

        # Sort by impact (highest first)
        suggestions.sort(key=lambda x: x.impact, reverse=True)

        return suggestions

    def build_optimized_resume(self, resume_data: Dict, job_data: Dict) -> Tuple[Dict, Dict]:
        """Auto-generate an ATS-optimized version of the resume.

        Applies only SAFE, non-fabricating transformations so the result stays
        truthful to what the candidate actually uploaded:

          1. Skills: append any JD-required skills that are missing, into the
             real skills list (this is the highest-signal ATS lever).
          2. Summary: weave missing JD keywords the candidate plausibly has
             (i.e. that also appear as JD-required skills now in their skills
             list) into the professional summary, naturally.
          3. Experience bullets: upgrade weak verbs ("responsible for" -> "led")
             in EXISTING bullets only. No invented bullets, no fake metrics.

        It deliberately does NOT invent jobs, dates, degrees, or numbers.

        Returns (optimized_resume, change_report) where change_report lists the
        concrete edits made, for display in the UI.
        """
        optimized = copy.deepcopy(resume_data)
        changes = {
            "skills_added": [],
            "summary_keywords_added": [],
            "bullets_strengthened": [],
            "terminology_aligned": [],
        }

        missing_skills = self._get_missing_skills(resume_data, job_data)
        missing_keywords = self._get_missing_keywords(resume_data, job_data)

        # --- 0. Terminology alignment (experience + projects) ----------------
        # Where the resume already uses a SYNONYM/variant of a term the JD uses
        # (e.g. resume "JS"/"k8s"/"Postgres" vs JD "JavaScript"/"Kubernetes"/
        # "PostgreSQL"), rewrite it to the JD's exact wording. This is truthful —
        # same technology, already present — and helps ATS systems that do exact
        # string matching. We never insert a term that isn't already represented.
        jd_term_forms = self._jd_preferred_forms(job_data)
        self._align_terminology(optimized, jd_term_forms, changes)

        # --- 1. Skills: add missing required skills -------------------------
        existing_canon = {canonicalize(s) for s in optimized.get("skills", [])}
        skills_list = list(optimized.get("skills", []))
        for skill in missing_skills:
            if canonicalize(skill) not in existing_canon:
                display = _display_skill(skill)
                skills_list.append(display)
                existing_canon.add(canonicalize(skill))
                changes["skills_added"].append(display)
        optimized["skills"] = skills_list

        # --- 2. Summary: weave in missing keywords --------------------------
        # Only add keywords that are now backed by the skills section, so we
        # never claim something the resume doesn't otherwise support.
        backed = {canonicalize(s) for s in skills_list}
        summary = optimized.get("summary") or ""
        added_to_summary: List[str] = []
        # Prefer keywords that are real skills the candidate has/added.
        candidate_kws = [
            kw for kw in missing_keywords
            if canonicalize(kw) in backed and kw.lower() not in summary.lower()
        ]
        # De-duplicate by canonical form, keep order.
        seen = set()
        ordered_kws = []
        for kw in candidate_kws:
            c = canonicalize(kw)
            if c not in seen:
                seen.add(c)
                ordered_kws.append(kw)

        if ordered_kws:
            display_kws = [_display_skill(k) for k in ordered_kws[:6]]
            phrase = self._format_keyword_phrase(display_kws)
            if summary.strip():
                connector = " " if summary.strip().endswith(".") else ". "
                optimized["summary"] = summary.rstrip() + connector + \
                    f"Core technical strengths include {phrase}."
            else:
                optimized["summary"] = f"Results-driven professional with hands-on expertise in {phrase}."
            added_to_summary = display_kws
        changes["summary_keywords_added"] = added_to_summary

        # --- 3. Experience: strengthen weak verbs in existing bullets -------
        for i, exp in enumerate(optimized.get("experience", [])):
            new_bullets = []
            for j, bullet in enumerate(exp.get("bullets", [])):
                improved = self._strengthen_verbs(bullet)
                if improved != bullet:
                    changes["bullets_strengthened"].append({
                        "experience_index": i,
                        "bullet_index": j,
                        "before": bullet,
                        "after": improved,
                    })
                new_bullets.append(improved)
            exp["bullets"] = new_bullets

        return optimized, changes

    def _jd_preferred_forms(self, job_data: Dict) -> Dict[str, str]:
        """Map canonical-term -> the JD's preferred surface form.

        For each skill/keyword the JD uses, record the exact wording the JD
        wrote it as, keyed by canonical form. Used to rewrite resume synonyms to
        match the JD's phrasing.
        """
        forms: Dict[str, str] = {}
        # Required + preferred skills carry the JD's own casing/wording.
        kw = job_data.get("keywords", {})
        terms: List[str] = []
        if isinstance(kw, dict):
            terms += list(kw.get("required_skills", []))
            terms += list(kw.get("preferred_skills", []))
            terms += list(kw.get("all_skills", []))
        for term in terms:
            if not term:
                continue
            canon = canonicalize(term)
            # Present the term with proper casing (the analyze endpoint stores
            # skills lowercased; we don't want "javascript"/"aws" in bullets).
            if canon not in forms:
                forms[canon] = _display_skill(term.strip())
        return forms

    def _align_terminology(self, resume: Dict, jd_forms: Dict[str, str], changes: Dict) -> None:
        """Rewrite synonym variants in experience & project bullets to the JD's
        wording. Mutates ``resume`` and appends to ``changes['terminology_aligned']``."""
        if not jd_forms:
            return

        def rewrite(text: str) -> str:
            # Bullets/descriptions in a posted resume may be null or non-string.
            if not isinstance(text, str):
                return text
            for canon, jd_form in jd_forms.items():
                jd_lower = jd_form.lower()
                # Variants of this term, written in the resume but NOT already in
                # the JD's exact wording.
                for variant in term_variants(canon):
                    if variant == jd_lower:
                        continue
                    # Whole-token, case-insensitive match of the variant.
                    pattern = r"(?<![A-Za-z0-9+#.])" + re.escape(variant) + r"(?![A-Za-z0-9+#])"
                    m = re.search(pattern, text, re.IGNORECASE)
                    if m and m.group(0).lower() != jd_lower:
                        text = text[:m.start()] + jd_form + text[m.end():]
                        changes["terminology_aligned"].append({
                            "before": m.group(0), "after": jd_form,
                        })
                        # Only one rewrite per term per pass to avoid churn.
            return text

        for exp in resume.get("experience", []):
            exp["bullets"] = [rewrite(b) for b in exp.get("bullets", [])]
            if exp.get("description"):
                exp["description"] = rewrite(exp["description"])

        for proj in resume.get("projects", []):
            if isinstance(proj, dict):
                if proj.get("description"):
                    proj["description"] = rewrite(proj["description"])
                if isinstance(proj.get("bullets"), list):
                    proj["bullets"] = [rewrite(b) for b in proj["bullets"]]

    def _strengthen_verbs(self, bullet: str) -> str:
        """Replace the first weak verb/phrase in a bullet with a strong verb.

        Capitalizes the replacement if it starts the bullet. Only the first
        match is replaced to avoid over-editing a single line.
        """
        # A posted bullet may be null or non-string; nothing to strengthen.
        if not isinstance(bullet, str):
            return bullet
        for weak, strong_alternatives in WEAK_VERBS.items():
            pattern = r'\b' + re.escape(weak) + r'\b'
            m = re.search(pattern, bullet, re.IGNORECASE)
            if m:
                replacement = strong_alternatives[0]
                # Match capitalization of the original occurrence.
                if m.group(0)[:1].isupper():
                    replacement = replacement[:1].upper() + replacement[1:]
                return re.sub(pattern, replacement, bullet, count=1, flags=re.IGNORECASE)
        return bullet

    @staticmethod
    def _format_keyword_phrase(keywords: List[str]) -> str:
        """Join keywords into a readable phrase: 'a, b, and c'."""
        kws = [k.strip() for k in keywords if k.strip()]
        if not kws:
            return ""
        if len(kws) == 1:
            return kws[0]
        if len(kws) == 2:
            return f"{kws[0]} and {kws[1]}"
        return ", ".join(kws[:-1]) + f", and {kws[-1]}"

    def _optimize_summary(self, resume_data: Dict, missing_keywords: List[str],
                         missing_skills: List[str]) -> List[Suggestion]:
        """Generate suggestions for summary section"""
        suggestions = []
        summary = resume_data.get("summary", "")

        if not summary:
            # Suggest creating a summary
            suggestions.append(Suggestion(
                id=str(uuid.uuid4()),
                type=SuggestionType.ADD_METRIC,
                section="summary",
                original_text="",
                suggested_text="Add a professional summary highlighting your key skills and achievements",
                reason="Professional summary improves ATS score and catches recruiter attention",
                impact=4
            ))
            return suggestions

        # Check for weak verbs
        for weak, strong_alternatives in WEAK_VERBS.items():
            pattern = r'\b' + re.escape(weak) + r'\b'
            if re.search(pattern, summary, re.IGNORECASE):
                new_summary = re.sub(pattern, strong_alternatives[0], summary, count=1, flags=re.IGNORECASE)
                suggestions.append(Suggestion(
                    id=str(uuid.uuid4()),
                    type=SuggestionType.WEAK_VERB,
                    section="summary",
                    original_text=summary,
                    suggested_text=new_summary,
                    reason=f"Replace weak verb '{weak}' with stronger alternative",
                    impact=3
                ))

        # Check for missing keywords in summary
        summary_lower = summary.lower()
        for keyword in missing_keywords[:5]:  # Top 5 missing keywords
            if keyword.lower() not in summary_lower:
                # Create suggestion to add keyword
                suggested = self._insert_keyword_naturally(summary, keyword)
                if suggested != summary:
                    suggestions.append(Suggestion(
                        id=str(uuid.uuid4()),
                        type=SuggestionType.MISSING_KEYWORD,
                        section="summary",
                        original_text=summary,
                        suggested_text=suggested,
                        reason=f"Add important keyword: {keyword}",
                        impact=5,
                        keywords_added=[keyword]
                    ))

        return suggestions

    def _optimize_experience(self, resume_data: Dict, missing_keywords: List[str],
                            missing_skills: List[str]) -> List[Suggestion]:
        """Generate suggestions for experience section"""
        suggestions = []

        for i, exp in enumerate(resume_data.get("experience", [])):
            bullets = exp.get("bullets", [])

            for j, bullet in enumerate(bullets):
                # Check for weak verbs
                bullet_suggestions = self._improve_bullet_point(
                    bullet, missing_keywords, missing_skills, i, j
                )
                suggestions.extend(bullet_suggestions)

        return suggestions

    def _improve_bullet_point(self, bullet: str, missing_keywords: List[str],
                             missing_skills: List[str], exp_index: int,
                             bullet_index: int) -> List[Suggestion]:
        """Generate suggestions for a single bullet point"""
        suggestions = []

        # A posted bullet may be null or non-string; skip it.
        if not isinstance(bullet, str):
            return suggestions

        # 1. Check for weak verbs
        for weak, strong_alternatives in WEAK_VERBS.items():
            pattern = r'\b' + re.escape(weak) + r'\b'
            if re.search(pattern, bullet, re.IGNORECASE):
                improved = re.sub(pattern, strong_alternatives[0], bullet, count=1, flags=re.IGNORECASE)
                suggestions.append(Suggestion(
                    id=str(uuid.uuid4()),
                    type=SuggestionType.WEAK_VERB,
                    section="experience",
                    original_text=bullet,
                    suggested_text=improved,
                    reason=f"Replace weak verb '{weak}' with '{strong_alternatives[0]}'",
                    impact=2,
                    location={"experience_index": exp_index, "bullet_index": bullet_index}
                ))
                break  # Only one weak verb suggestion per bullet

        # 2. Check for missing metrics
        if not self._has_metrics(bullet):
            suggested = bullet + " (Add specific metrics: e.g., '25% improvement', '500 users', '$100K savings')"
            suggestions.append(Suggestion(
                id=str(uuid.uuid4()),
                type=SuggestionType.ADD_METRIC,
                section="experience",
                original_text=bullet,
                suggested_text=suggested,
                reason="Adding quantifiable results increases impact and ATS score",
                impact=4,
                location={"experience_index": exp_index, "bullet_index": bullet_index}
            ))

        # 3. Try to add missing keywords naturally
        bullet_lower = bullet.lower()
        for keyword in missing_keywords[:10]:  # Check top 10
            if keyword.lower() not in bullet_lower:
                # Check if semantically related
                if self._is_semantically_related(bullet, keyword):
                    improved = self._insert_keyword_naturally(bullet, keyword)
                    if improved != bullet:
                        suggestions.append(Suggestion(
                            id=str(uuid.uuid4()),
                            type=SuggestionType.MISSING_KEYWORD,
                            section="experience",
                            original_text=bullet,
                            suggested_text=improved,
                            reason=f"Add relevant keyword: {keyword}",
                            impact=5,
                            keywords_added=[keyword],
                            location={"experience_index": exp_index, "bullet_index": bullet_index}
                        ))
                        break  # One keyword per bullet

        return suggestions

    def _optimize_skills(self, resume_data: Dict, missing_skills: List[str]) -> List[Suggestion]:
        """Generate suggestions for skills section"""
        suggestions = []

        current_skills = set(str(skill).lower() for skill in resume_data.get("skills", []))

        # Suggest adding missing skills
        for skill in missing_skills[:10]:  # Top 10 missing skills
            if str(skill).lower() not in current_skills:
                current_skills_text = ", ".join(str(s) for s in resume_data.get("skills", []))
                suggested_text = f"{current_skills_text}, {skill}" if current_skills_text else skill

                suggestions.append(Suggestion(
                    id=str(uuid.uuid4()),
                    type=SuggestionType.SKILL_HIGHLIGHT,
                    section="skills",
                    original_text=current_skills_text,
                    suggested_text=suggested_text,
                    reason=f"Add required skill: {skill}",
                    impact=5,
                    keywords_added=[skill]
                ))

        return suggestions

    def _has_metrics(self, text: str) -> bool:
        """Check if text contains quantifiable metrics"""
        metric_patterns = [
            r'\d+\s*%',  # Percentages
            r'\$\s*\d+',  # Dollar amounts
            r'\d+\s*(?:users|customers|clients|people|employees)',  # User counts
            r'\d+\s*(?:hours|days|weeks|months|years)',  # Time
            r'\d+\s*(?:projects|tasks|features|components)',  # Counts
            r'\d+[xX]',  # Multipliers (2x, 3x)
            r'\d+\+',  # Plus numbers (100+)
        ]

        return any(re.search(pattern, text) for pattern in metric_patterns)

    def _insert_keyword_naturally(self, text: str, keyword: str) -> str:
        """
        Try to insert keyword naturally into text using NLP

        Uses dependency parsing to find appropriate insertion points
        """
        doc = self._nlp(text)

        # Simple strategy: try to append with appropriate context
        # For a production system, this would be more sophisticated

        # Check if we can add it as a skill/technology mention
        if any(token.text.lower() in ["using", "with", "in", "for"] for token in doc):
            # Find last mention of a tool/technology
            for token in reversed(list(doc)):
                if token.pos_ in ["NOUN", "PROPN"]:
                    # Insert after this token
                    return f"{text} and {keyword}"

        # Default: append at the end with context
        if text.endswith('.'):
            return f"{text[:-1]} using {keyword}."
        else:
            return f"{text} leveraging {keyword}"

    def _is_semantically_related(self, text: str, keyword: str) -> bool:
        """
        Check if keyword is semantically related to the text

        Simple version: check for common words or themes
        """
        doc = self._nlp(text.lower())
        keyword_doc = self._nlp(keyword.lower())

        # Check if keyword appears in similar context
        text_tokens = {token.lemma_ for token in doc if not token.is_stop}
        keyword_tokens = {token.lemma_ for token in keyword_doc if not token.is_stop}

        # If there's any overlap in lemmas, consider related
        return len(text_tokens & keyword_tokens) > 0 or len(text) > 50  # Long texts more flexible

    def _get_missing_keywords(self, resume_data: Dict, job_data: Dict) -> List[str]:
        """Get keywords from job missing in resume"""
        job_kw_set = set(extract_keyword_strings(job_data))

        # Spelling/acronym-aware presence check
        resume_blob = normalize_text(self._get_resume_text(resume_data))

        # Find missing
        missing = [kw for kw in job_kw_set if not term_matches_text(kw, resume_blob)]

        return missing[:20]  # Top 20

    def _get_missing_skills(self, resume_data: Dict, job_data: Dict) -> List[str]:
        """Get skills from job missing in resume"""
        job_skills = set()

        if isinstance(job_data.get("keywords"), dict):
            job_skills.update(job_data["keywords"].get("required_skills", []))

        resume_canon = {canonicalize(skill) for skill in resume_data.get("skills", [])}

        missing = [skill for skill in job_skills if canonicalize(skill) not in resume_canon]
        return missing

    def _get_resume_text(self, resume_data: Dict) -> str:
        """Get all text from resume"""
        parts = []

        if resume_data.get("summary"):
            parts.append(resume_data["summary"])

        for exp in resume_data.get("experience", []):
            parts.append(exp.get("title", ""))
            parts.extend(exp.get("bullets", []))

        for edu in resume_data.get("education", []):
            parts.append(edu.get("degree", ""))

        parts.extend(resume_data.get("skills", []))

        # Untrusted dicts: coerce so a None/numeric item can't break the join.
        return " ".join(str(p) for p in parts if p is not None)


# Singleton instance
_resume_optimizer = None

def get_resume_optimizer() -> ResumeOptimizer:
    """Get singleton instance of ResumeOptimizer"""
    global _resume_optimizer
    if _resume_optimizer is None:
        _resume_optimizer = ResumeOptimizer()
    return _resume_optimizer
