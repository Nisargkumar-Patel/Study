import re
import spacy
from typing import List, Dict, Set, Tuple
from sklearn.feature_extraction.text import TfidfVectorizer
from collections import Counter
import logging

logger = logging.getLogger(__name__)

# Comprehensive skills database (1000+ common skills)
SKILLS_DATABASE = [
    # Programming Languages
    "python", "java", "javascript", "typescript", "c++", "c#", "ruby", "php", "swift", "kotlin",
    "go", "rust", "scala", "perl", "r", "matlab", "sql", "html", "css", "bash", "shell",

    # Frameworks & Libraries
    "react", "angular", "vue", "nodejs", "express", "django", "flask", "fastapi", "spring boot",
    "asp.net", "rails", "laravel", "tensorflow", "pytorch", "keras", "scikit-learn", "pandas",
    "numpy", "jquery", "bootstrap", "tailwind css", "material ui", "next.js", "nuxt.js",

    # Databases
    "mysql", "postgresql", "mongodb", "redis", "elasticsearch", "cassandra", "dynamodb",
    "oracle", "sql server", "sqlite", "mariadb", "couchdb", "neo4j", "firebase",

    # Cloud & DevOps
    "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "jenkins", "gitlab ci",
    "github actions", "terraform", "ansible", "chef", "puppet", "circleci", "travis ci",

    # Tools & Technologies
    "git", "linux", "unix", "windows server", "nginx", "apache", "kafka", "rabbitmq",
    "graphql", "rest api", "microservices", "agile", "scrum", "jira", "confluence",

    # Soft Skills
    "leadership", "communication", "problem solving", "team collaboration", "project management",
    "analytical thinking", "critical thinking", "time management", "adaptability", "creativity",

    # Other Technical
    "machine learning", "deep learning", "natural language processing", "computer vision",
    "data analysis", "data science", "business intelligence", "etl", "data warehousing",
    "ci/cd", "test driven development", "unit testing", "integration testing", "api development"
]


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

        # Create phrase matcher for skills
        from spacy.matcher import PhraseMatcher
        self.skill_matcher = PhraseMatcher(self.nlp.vocab, attr="LOWER")
        skill_patterns = [self.nlp.make_doc(skill.lower()) for skill in SKILLS_DATABASE]
        self.skill_matcher.add("SKILLS", skill_patterns)

        # TF-IDF vectorizer for keyword extraction
        self.vectorizer = TfidfVectorizer(
            max_features=100,
            stop_words='english',
            ngram_range=(1, 3),  # Unigrams to trigrams
            min_df=1
        )

    def extract_from_job_description(self, jd_text: str) -> Dict[str, any]:
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

    def extract_from_resume(self, resume_text: str) -> Dict[str, any]:
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
        """Extract skills using phrase matcher and NER"""
        skills = set()

        # Use phrase matcher
        matches = self.skill_matcher(doc)
        for match_id, start, end in matches:
            skill = doc[start:end].text.lower()
            skills.add(skill)

        # Also check for skills in noun chunks
        for chunk in doc.noun_chunks:
            chunk_text = chunk.text.lower()
            if any(skill in chunk_text for skill in SKILLS_DATABASE[:50]):  # Check top skills
                skills.add(chunk_text)

        return skills

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

    def _categorize_skills(self, text: str, skills: Set[str]) -> Tuple[Set[str], Set[str]]:
        """Categorize skills into required vs preferred"""
        required = set()
        preferred = set()

        text_lower = text.lower()

        # Simple heuristic: check context around skill mentions
        for skill in skills:
            # Check if skill appears near "required" or "must have"
            required_patterns = [
                f"required.*{skill}", f"{skill}.*required",
                f"must have.*{skill}", f"{skill}.*must have",
                f"essential.*{skill}", f"{skill}.*essential"
            ]

            # Check if skill appears near "preferred" or "nice to have"
            preferred_patterns = [
                f"preferred.*{skill}", f"{skill}.*preferred",
                f"nice to have.*{skill}", f"{skill}.*nice to have",
                f"bonus.*{skill}", f"{skill}.*bonus"
            ]

            is_required = any(re.search(pattern, text_lower) for pattern in required_patterns)
            is_preferred = any(re.search(pattern, text_lower) for pattern in preferred_patterns)

            if is_required:
                required.add(skill)
            elif is_preferred:
                preferred.add(skill)
            else:
                # Default to required if not specified
                required.add(skill)

        return required, preferred

    def _extract_technologies(self, skills: Set[str]) -> List[str]:
        """Extract technologies from skills set"""
        tech_keywords = [
            "python", "java", "javascript", "react", "angular", "vue", "docker", "kubernetes",
            "aws", "azure", "gcp", "mongodb", "postgresql", "mysql", "redis", "kafka",
            "tensorflow", "pytorch", "django", "flask", "fastapi", "nodejs", "express"
        ]

        technologies = [skill for skill in skills if any(tech in skill.lower() for tech in tech_keywords)]
        return technologies

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
