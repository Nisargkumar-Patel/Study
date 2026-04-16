from typing import Dict, List, Set
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import re
from datetime import datetime
import logging

from app.models.score import ATSScore, ScoreBreakdown

logger = logging.getLogger(__name__)


class ATSScorer:
    """Calculate ATS compatibility score"""

    def __init__(self):
        self.vectorizer = TfidfVectorizer(stop_words='english', ngram_range=(1, 2))

    def calculate_score(self, resume_data: Dict, job_data: Dict) -> ATSScore:
        """
        Calculate comprehensive ATS score

        Args:
            resume_data: Parsed resume data
            job_data: Analyzed job description data

        Returns:
            ATSScore with detailed breakdown
        """
        # Extract text for comparison
        resume_text = self._get_resume_text(resume_data)
        job_text = job_data.get("raw_text", job_data.get("description", ""))

        # Calculate component scores
        keyword_score = self._calculate_keyword_match(resume_text, job_text, resume_data, job_data)
        skills_score = self._calculate_skills_match(resume_data, job_data)
        experience_score = self._calculate_experience_match(resume_data, job_data)
        education_score = self._calculate_education_match(resume_data, job_data)
        formatting_score = self._calculate_formatting_score(resume_data)

        # Calculate overall score (weighted average)
        overall = (
            keyword_score.score * 0.40 +
            skills_score.score * 0.30 +
            experience_score.score * 0.15 +
            education_score.score * 0.10 +
            formatting_score.score * 0.05
        )

        # Get missing items
        missing_keywords = self._get_missing_keywords(resume_data, job_data)
        matched_keywords = self._get_matched_keywords(resume_data, job_data)
        missing_skills = self._get_missing_skills(resume_data, job_data)
        matched_skills = self._get_matched_skills(resume_data, job_data)

        # Generate suggestions summary
        suggestions = self._generate_suggestions_summary(
            keyword_score, skills_score, experience_score, education_score, formatting_score
        )

        return ATSScore(
            overall_score=round(overall, 1),
            keyword_match=keyword_score,
            skills_match=skills_score,
            experience_match=experience_score,
            education_match=education_score,
            formatting_score=formatting_score,
            missing_keywords=missing_keywords[:20],
            matched_keywords=matched_keywords[:20],
            missing_skills=missing_skills,
            matched_skills=matched_skills,
            formatting_issues=resume_data.get("formatting_issues", []),
            suggestions_summary=suggestions,
            calculated_at=datetime.now().isoformat()
        )

    def _get_resume_text(self, resume_data: Dict) -> str:
        """Extract all text from resume"""
        parts = []

        # Add summary
        if resume_data.get("summary"):
            parts.append(resume_data["summary"])

        # Add experience
        for exp in resume_data.get("experience", []):
            parts.append(exp.get("title", ""))
            parts.append(exp.get("company", ""))
            parts.extend(exp.get("bullets", []))

        # Add education
        for edu in resume_data.get("education", []):
            parts.append(edu.get("degree", ""))
            parts.append(edu.get("institution", ""))

        # Add skills
        parts.extend(resume_data.get("skills", []))

        # Add raw text if available
        if resume_data.get("raw_text"):
            parts.append(resume_data["raw_text"])

        return " ".join(parts)

    def _calculate_keyword_match(self, resume_text: str, job_text: str,
                                  resume_data: Dict, job_data: Dict) -> ScoreBreakdown:
        """Calculate keyword match score using TF-IDF and cosine similarity"""
        try:
            # Vectorize both texts
            vectors = self.vectorizer.fit_transform([job_text, resume_text])
            job_vector = vectors[0]
            resume_vector = vectors[1]

            # Calculate cosine similarity
            similarity = cosine_similarity(resume_vector, job_vector)[0][0]

            # Convert to score (0-100)
            score = similarity * 100

            # Get keyword counts
            job_keywords = set(job_data.get("keywords", {}).get("keywords", []))
            resume_keywords = set(resume_data.get("keywords", []))

            if isinstance(job_keywords, list) and len(job_keywords) > 0:
                if isinstance(job_keywords[0], tuple):
                    job_keywords = set([kw[0] for kw in job_keywords])

            matched = len(job_keywords & resume_keywords) if job_keywords else 0
            total = len(job_keywords) if job_keywords else 1

            percentage = (matched / total * 100) if total > 0 else 0

            return ScoreBreakdown(
                score=round(score, 1),
                max_score=100,
                percentage=round(percentage, 1),
                details={
                    "similarity": round(similarity, 3),
                    "matched_count": matched,
                    "total_keywords": total,
                    "method": "TF-IDF + Cosine Similarity"
                }
            )
        except Exception as e:
            logger.error(f"Error calculating keyword match: {e}")
            return ScoreBreakdown(score=0, max_score=100, percentage=0, details={})

    def _calculate_skills_match(self, resume_data: Dict, job_data: Dict) -> ScoreBreakdown:
        """Calculate skills match percentage"""
        job_skills = set()

        # Get required skills from job
        if isinstance(job_data.get("keywords"), dict):
            job_skills.update(job_data["keywords"].get("required_skills", []))
            job_skills.update(job_data["keywords"].get("all_skills", []))
        elif isinstance(job_data.get("required_skills"), list):
            job_skills.update(job_data.get("required_skills", []))

        # Get resume skills
        resume_skills = set(resume_data.get("skills", []))

        # Case-insensitive matching
        job_skills_lower = {skill.lower() for skill in job_skills}
        resume_skills_lower = {skill.lower() for skill in resume_skills}

        # Calculate match
        matched = job_skills_lower & resume_skills_lower
        match_count = len(matched)
        total = len(job_skills_lower) if job_skills_lower else 1

        percentage = (match_count / total * 100) if total > 0 else 0
        score = percentage  # Direct mapping

        return ScoreBreakdown(
            score=round(score, 1),
            max_score=100,
            percentage=round(percentage, 1),
            details={
                "matched_count": match_count,
                "total_required": total,
                "matched_skills": list(matched)[:10]
            }
        )

    def _calculate_experience_match(self, resume_data: Dict, job_data: Dict) -> ScoreBreakdown:
        """Calculate experience match score"""
        # Get required years from job
        required_years = job_data.get("years_experience", 0)

        # Calculate total experience from resume
        total_years = self._calculate_total_years(resume_data.get("experience", []))

        # Calculate score
        if required_years == 0:
            score = 100  # No requirement
            percentage = 100
        elif total_years >= required_years:
            score = 100
            percentage = 100
        else:
            percentage = (total_years / required_years * 100)
            score = percentage

        return ScoreBreakdown(
            score=round(score, 1),
            max_score=100,
            percentage=round(percentage, 1),
            details={
                "required_years": required_years,
                "candidate_years": round(total_years, 1),
                "meets_requirement": total_years >= required_years
            }
        )

    def _calculate_education_match(self, resume_data: Dict, job_data: Dict) -> ScoreBreakdown:
        """Calculate education match score"""
        job_education = job_data.get("education_requirements", [])
        resume_education = resume_data.get("education", [])

        if not job_education:
            # No requirement
            return ScoreBreakdown(score=100, max_score=100, percentage=100, details={})

        # Extract degree levels
        job_degrees = self._extract_degree_levels(job_education)
        resume_degrees = set()

        for edu in resume_education:
            degree = edu.get("degree", "").lower()
            resume_degrees.add(self._get_degree_level(degree))

        # Check if requirements met
        meets_requirement = any(
            self._degree_satisfies(resume_deg, job_deg)
            for resume_deg in resume_degrees
            for job_deg in job_degrees
        )

        score = 100 if meets_requirement else 50
        percentage = 100 if meets_requirement else 50

        return ScoreBreakdown(
            score=score,
            max_score=100,
            percentage=percentage,
            details={
                "meets_requirement": meets_requirement,
                "resume_degrees": list(resume_degrees),
                "required_degrees": list(job_degrees)
            }
        )

    def _calculate_formatting_score(self, resume_data: Dict) -> ScoreBreakdown:
        """Calculate formatting score (deduct points for ATS-unfriendly elements)"""
        issues = resume_data.get("formatting_issues", [])

        # Start with perfect score
        max_score = 100
        deductions = len(issues) * 20  # 20 points per issue

        score = max(0, max_score - deductions)
        percentage = score

        return ScoreBreakdown(
            score=score,
            max_score=100,
            percentage=percentage,
            details={
                "issues_count": len(issues),
                "issues": issues[:5],
                "is_ats_friendly": len(issues) == 0
            }
        )

    def _calculate_total_years(self, experience: List[Dict]) -> float:
        """Calculate total years of experience"""
        total_months = 0

        for exp in experience:
            start = exp.get("start_date", "")
            end = exp.get("end_date", "")

            months = self._parse_date_range(start, end)
            total_months += months

        return total_months / 12.0

    def _parse_date_range(self, start: str, end: str) -> int:
        """Parse date range and return months"""
        # Simple parsing (assumes format like "Jan 2020" or "2020")
        # Returns approximate months

        if "present" in end.lower() or "current" in end.lower():
            end = datetime.now().strftime("%Y")

        # Extract years
        start_year = self._extract_year(start)
        end_year = self._extract_year(end)

        if start_year and end_year:
            years_diff = end_year - start_year
            return max(0, years_diff * 12)  # Approximate months

        return 12  # Default to 1 year if can't parse

    def _extract_year(self, date_str: str) -> int:
        """Extract year from date string"""
        match = re.search(r'\b(19|20)\d{2}\b', date_str)
        if match:
            return int(match.group(0))
        return 0

    def _extract_degree_levels(self, education_list: List) -> Set[str]:
        """Extract degree levels from education requirements"""
        degrees = set()
        for edu in education_list:
            if isinstance(edu, str):
                degrees.add(self._get_degree_level(edu.lower()))
        return degrees

    def _get_degree_level(self, text: str) -> str:
        """Get degree level from text"""
        text = text.lower()

        if any(word in text for word in ["phd", "doctorate", "doctoral"]):
            return "phd"
        elif any(word in text for word in ["master", "ms", "ma", "mba", "msc"]):
            return "masters"
        elif any(word in text for word in ["bachelor", "bs", "ba", "bsc", "undergraduate"]):
            return "bachelors"
        elif any(word in text for word in ["associate", "aa", "as"]):
            return "associates"
        else:
            return "other"

    def _degree_satisfies(self, resume_degree: str, required_degree: str) -> bool:
        """Check if resume degree satisfies requirement"""
        degree_hierarchy = {
            "phd": 4,
            "masters": 3,
            "bachelors": 2,
            "associates": 1,
            "other": 0
        }

        resume_level = degree_hierarchy.get(resume_degree, 0)
        required_level = degree_hierarchy.get(required_degree, 0)

        return resume_level >= required_level

    def _get_missing_keywords(self, resume_data: Dict, job_data: Dict) -> List[str]:
        """Get keywords present in job but missing from resume"""
        job_keywords = job_data.get("keywords", {})

        if isinstance(job_keywords, dict):
            keywords_list = job_keywords.get("keywords", [])
        else:
            keywords_list = []

        if keywords_list and isinstance(keywords_list[0], tuple):
            job_kw_set = {kw[0].lower() for kw in keywords_list}
        else:
            job_kw_set = {kw.lower() for kw in keywords_list}

        resume_text = self._get_resume_text(resume_data).lower()

        missing = [kw for kw in job_kw_set if kw not in resume_text]
        return missing

    def _get_matched_keywords(self, resume_data: Dict, job_data: Dict) -> List[str]:
        """Get keywords present in both job and resume"""
        job_keywords = job_data.get("keywords", {})

        if isinstance(job_keywords, dict):
            keywords_list = job_keywords.get("keywords", [])
        else:
            keywords_list = []

        if keywords_list and isinstance(keywords_list[0], tuple):
            job_kw_set = {kw[0].lower() for kw in keywords_list}
        else:
            job_kw_set = {kw.lower() for kw in keywords_list}

        resume_text = self._get_resume_text(resume_data).lower()

        matched = [kw for kw in job_kw_set if kw in resume_text]
        return matched

    def _get_missing_skills(self, resume_data: Dict, job_data: Dict) -> List[str]:
        """Get skills required by job but missing from resume"""
        job_skills = set()

        if isinstance(job_data.get("keywords"), dict):
            job_skills.update(job_data["keywords"].get("required_skills", []))

        resume_skills = set(skill.lower() for skill in resume_data.get("skills", []))
        job_skills_lower = {skill.lower() for skill in job_skills}

        missing = list(job_skills_lower - resume_skills)
        return missing

    def _get_matched_skills(self, resume_data: Dict, job_data: Dict) -> List[str]:
        """Get skills present in both job and resume"""
        job_skills = set()

        if isinstance(job_data.get("keywords"), dict):
            job_skills.update(job_data["keywords"].get("required_skills", []))

        resume_skills = set(skill.lower() for skill in resume_data.get("skills", []))
        job_skills_lower = {skill.lower() for skill in job_skills}

        matched = list(job_skills_lower & resume_skills)
        return matched

    def _generate_suggestions_summary(self, keyword_score, skills_score,
                                     experience_score, education_score,
                                     formatting_score) -> List[str]:
        """Generate high-level suggestions based on scores"""
        suggestions = []

        if keyword_score.score < 60:
            suggestions.append("Add more relevant keywords from the job description")

        if skills_score.score < 70:
            suggestions.append("Include more required skills in your skills section")

        if experience_score.score < 80:
            suggestions.append("Highlight relevant experience more prominently")

        if education_score.score < 90:
            suggestions.append("Ensure education requirements are clearly stated")

        if formatting_score.score < 100:
            suggestions.append("Fix formatting issues for better ATS compatibility")

        if not suggestions:
            suggestions.append("Great job! Your resume is well-optimized for ATS")

        return suggestions


# Singleton instance
_ats_scorer = None

def get_ats_scorer() -> ATSScorer:
    """Get singleton instance of ATSScorer"""
    global _ats_scorer
    if _ats_scorer is None:
        _ats_scorer = ATSScorer()
    return _ats_scorer
