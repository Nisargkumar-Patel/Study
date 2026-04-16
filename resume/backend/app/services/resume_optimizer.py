import re
import uuid
from typing import List, Dict, Set
import spacy
from collections import defaultdict

from app.models.suggestion import Suggestion, SuggestionType

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
                self.nlp = spacy.load("en_core_web_sm")

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
            if weak in summary.lower():
                new_summary = summary.lower().replace(weak, strong_alternatives[0])
                suggestions.append(Suggestion(
                    id=str(uuid.uuid4()),
                    type=SuggestionType.WEAK_VERB,
                    section="summary",
                    original_text=summary,
                    suggested_text=new_summary.capitalize(),
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

        current_skills = set(skill.lower() for skill in resume_data.get("skills", []))

        # Suggest adding missing skills
        for skill in missing_skills[:10]:  # Top 10 missing skills
            if skill.lower() not in current_skills:
                current_skills_text = ", ".join(resume_data.get("skills", []))
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
        doc = self.nlp(text)

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
        doc = self.nlp(text.lower())
        keyword_doc = self.nlp(keyword.lower())

        # Check if keyword appears in similar context
        text_tokens = {token.lemma_ for token in doc if not token.is_stop}
        keyword_tokens = {token.lemma_ for token in keyword_doc if not token.is_stop}

        # If there's any overlap in lemmas, consider related
        return len(text_tokens & keyword_tokens) > 0 or len(text) > 50  # Long texts more flexible

    def _get_missing_keywords(self, resume_data: Dict, job_data: Dict) -> List[str]:
        """Get keywords from job missing in resume"""
        job_keywords = job_data.get("keywords", {})

        if isinstance(job_keywords, dict):
            keywords_list = job_keywords.get("keywords", [])
        else:
            keywords_list = []

        # Extract keyword strings
        if keywords_list and isinstance(keywords_list[0], tuple):
            job_kw_set = {kw[0].lower() for kw in keywords_list}
        else:
            job_kw_set = {str(kw).lower() for kw in keywords_list}

        # Get all resume text
        resume_text = self._get_resume_text(resume_data).lower()

        # Find missing
        missing = [kw for kw in job_kw_set if kw not in resume_text]

        # Sort by importance (TF-IDF scores if available)
        return missing[:20]  # Top 20

    def _get_missing_skills(self, resume_data: Dict, job_data: Dict) -> List[str]:
        """Get skills from job missing in resume"""
        job_skills = set()

        if isinstance(job_data.get("keywords"), dict):
            job_skills.update(job_data["keywords"].get("required_skills", []))

        resume_skills = {skill.lower() for skill in resume_data.get("skills", [])}
        job_skills_lower = {skill.lower() for skill in job_skills}

        missing = list(job_skills_lower - resume_skills)
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

        return " ".join(parts)


# Singleton instance
_resume_optimizer = None

def get_resume_optimizer() -> ResumeOptimizer:
    """Get singleton instance of ResumeOptimizer"""
    global _resume_optimizer
    if _resume_optimizer is None:
        _resume_optimizer = ResumeOptimizer()
    return _resume_optimizer
