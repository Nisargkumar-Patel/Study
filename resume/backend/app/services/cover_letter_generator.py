import re
from datetime import date
from typing import Dict, List, Optional

from app.utils.text_normalizer import canonicalize

_METRIC = re.compile(r"\d+\s*%|\$\s*\d+|\d+[kKmMxX]\b|\b\d{2,}\b")


class CoverLetterGenerator:
    """Generate an editable, template-based cover letter from resume + job data.

    Uses no external/LLM APIs — the letter is assembled from the applicant's own
    resume and the analyzed job description, then left fully editable in the UI.
    Optional ``company`` / ``title`` overrides let the UI supply the correct
    employer and role (job-description NER is unreliable for these).
    """

    def generate(self, resume_data: Dict, job_data: Dict,
                 company: Optional[str] = None, title: Optional[str] = None) -> str:
        name = (resume_data.get("name") or "").strip() or "Your Name"

        title = (title or job_data.get("title") or "").strip()
        has_title = bool(title)
        if not has_title:
            title = "the role"

        company = (company or job_data.get("company") or "").strip()
        has_company = bool(company)
        if not has_company:
            company = "your company"

        matched_skills = self._matched_skills(resume_data, job_data)
        achievement = self._key_achievement(resume_data)

        paragraphs: List[str] = []

        # Opening
        role_phrase = f"the {title} position" if has_title else title
        paragraphs.append(
            f"I am writing to express my strong interest in {role_phrase} at "
            f"{company}. After reviewing the role, I am confident that my "
            f"background and skills make me a strong fit for your team."
        )

        # Body 1 — relevant skills
        if matched_skills:
            paragraphs.append(
                f"Your team is looking for strengths in {self._join(matched_skills)} "
                f"— areas where I have direct, hands-on experience. I would bring "
                f"that same focus and capability to {company}."
            )
        else:
            paragraphs.append(
                f"My experience has prepared me to contribute to {company} from "
                f"day one, and I am eager to apply my skills to this role."
            )

        # Body 2 — a concrete achievement
        if achievement:
            sentence = f"In a recent role, I {self._lower_first(achievement)}"
            if not sentence.rstrip().endswith("."):
                sentence += "."
            paragraphs.append(sentence)

        # Closing
        paragraphs.append(
            f"I would welcome the opportunity to discuss how my background can "
            f"support the goals of {company}. Thank you for your time and "
            f"consideration — I look forward to hearing from you."
        )

        return self._assemble(name, resume_data, has_company, company, paragraphs)

    def _assemble(self, name: str, resume_data: Dict, has_company: bool,
                  company: str, paragraphs: List[str]) -> str:
        contact = [
            v for v in [
                resume_data.get("email"),
                resume_data.get("phone"),
                resume_data.get("location"),
            ] if v
        ]

        lines: List[str] = [name]
        if contact:
            lines.append(" | ".join(str(c) for c in contact))
        lines.append("")
        lines.append(date.today().strftime("%B %d, %Y"))
        lines.append("")
        lines.append(f"Dear {company} Hiring Team," if has_company else "Dear Hiring Manager,")
        lines.append("")
        for para in paragraphs:
            lines.append(para)
            lines.append("")
        lines.append("Sincerely,")
        lines.append(name)

        return "\n".join(lines)

    def _matched_skills(self, resume_data: Dict, job_data: Dict) -> List[str]:
        required = []
        keywords = job_data.get("keywords")
        if isinstance(keywords, dict):
            required = keywords.get("required_skills", []) or keywords.get("all_skills", [])

        required_canon = {canonicalize(s) for s in required}

        # Return the resume's own (nicely cased) skill strings that overlap.
        matched: List[str] = []
        for skill in resume_data.get("skills", []):
            if canonicalize(skill) in required_canon and skill not in matched:
                matched.append(skill)
            if len(matched) >= 5:
                break
        return matched

    def _key_achievement(self, resume_data: Dict) -> str:
        bullets: List[str] = []
        for exp in resume_data.get("experience", []):
            bullets.extend(b for b in exp.get("bullets", []) if b and b.strip())

        if not bullets:
            return ""

        for bullet in bullets:
            if _METRIC.search(bullet):
                return bullet.strip()

        for bullet in bullets:
            if len(bullet.strip()) > 25:
                return bullet.strip()
        return bullets[0].strip()

    @staticmethod
    def _join(items: List[str]) -> str:
        items = [i for i in items if i]
        if len(items) == 1:
            return items[0]
        if len(items) == 2:
            return f"{items[0]} and {items[1]}"
        return ", ".join(items[:-1]) + f", and {items[-1]}"

    @staticmethod
    def _lower_first(text: str) -> str:
        text = text.strip()
        return text[0].lower() + text[1:] if text else text


_cover_letter_generator = None


def get_cover_letter_generator() -> CoverLetterGenerator:
    """Get singleton instance of CoverLetterGenerator"""
    global _cover_letter_generator
    if _cover_letter_generator is None:
        _cover_letter_generator = CoverLetterGenerator()
    return _cover_letter_generator
