import fitz  # PyMuPDF
import re
from typing import Dict, List, Tuple
from datetime import datetime
import logging

from app.models.resume import ResumeData, ExperienceItem, EducationItem, ParsedResume

logger = logging.getLogger(__name__)

# Section header patterns
SECTION_PATTERNS = {
    "summary": r'\b(summary|profile|objective|about\s+me|professional\s+summary)\b',
    "experience": r'\b(experience|work\s+history|employment|professional\s+experience|work\s+experience)\b',
    "education": r'\b(education|academic|qualifications)\b',
    "skills": r'\b(skills|technical\s+skills|competencies|expertise)\b',
    "certifications": r'\b(certifications?|licenses?|credentials)\b',
    "projects": r'\b(projects?|portfolio)\b',
}


class PDFParser:
    """Parse resume PDFs and extract structured data"""

    def parse_resume(self, pdf_bytes: bytes) -> ParsedResume:
        """
        Parse resume PDF and extract structured data

        Args:
            pdf_bytes: PDF file bytes

        Returns:
            ParsedResume with structured data and metadata
        """
        try:
            # Open PDF
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")

            # Extract text with layout
            full_text = ""
            for page in doc:
                full_text += page.get_text()

            doc.close()

            # Check formatting issues
            formatting_issues = self._check_ats_formatting(pdf_bytes)

            # Detect and extract sections
            sections = self._detect_sections(full_text)

            # Parse each section
            resume_data = self._parse_sections(sections, full_text)
            resume_data.raw_text = full_text

            return ParsedResume(
                data=resume_data,
                formatting_issues=formatting_issues,
                confidence=0.8,  # Simple confidence score
                sections_found=list(sections.keys())
            )

        except Exception as e:
            logger.error(f"Error parsing PDF: {e}")
            # Return minimal resume with raw text
            return ParsedResume(
                data=ResumeData(name="Unknown", raw_text=str(e)),
                formatting_issues=["Error parsing PDF"],
                confidence=0.0,
                sections_found=[]
            )

    def _detect_sections(self, text: str) -> Dict[str, Tuple[int, int]]:
        """
        Detect resume sections and their positions

        Returns:
            Dictionary mapping section name to (start_pos, end_pos)
        """
        sections = {}
        lines = text.split('\n')

        for i, line in enumerate(lines):
            line_upper = line.strip().upper()
            line_lower = line.strip().lower()

            # Check each pattern
            for section_name, pattern in SECTION_PATTERNS.items():
                if re.search(pattern, line_lower, re.IGNORECASE):
                    # Check if line looks like a header (short, all caps or title case)
                    if len(line.strip()) < 50 and (line_upper == line.strip() or line.strip().istitle()):
                        # Find character position in original text
                        char_pos = text.find(line.strip())
                        if char_pos != -1:
                            sections[section_name] = char_pos

        # Calculate end positions
        sorted_sections = sorted(sections.items(), key=lambda x: x[1])
        final_sections = {}

        for i, (name, start) in enumerate(sorted_sections):
            if i < len(sorted_sections) - 1:
                end = sorted_sections[i + 1][1]
            else:
                end = len(text)
            final_sections[name] = (start, end)

        return final_sections

    def _parse_sections(self, sections: Dict[str, Tuple[int, int]], full_text: str) -> ResumeData:
        """Parse identified sections into structured data"""

        # Extract contact info (usually at top)
        contact_info = self._extract_contact_info(full_text[:500])

        # Parse each section
        summary = self._extract_section_text(sections.get("summary"), full_text) if "summary" in sections else None
        experience = self._parse_experience(sections.get("experience"), full_text) if "experience" in sections else []
        education = self._parse_education(sections.get("education"), full_text) if "education" in sections else []
        skills = self._parse_skills(sections.get("skills"), full_text) if "skills" in sections else []
        certifications = self._parse_certifications(sections.get("certifications"), full_text) if "certifications" in sections else []

        return ResumeData(
            name=contact_info.get("name", "Unknown"),
            email=contact_info.get("email"),
            phone=contact_info.get("phone"),
            location=contact_info.get("location"),
            linkedin=contact_info.get("linkedin"),
            summary=summary,
            experience=experience,
            education=education,
            skills=skills,
            certifications=certifications
        )

    def _extract_contact_info(self, header_text: str) -> Dict[str, str]:
        """Extract contact information from header"""
        contact = {}

        # Name (usually first line or largest text)
        lines = [line.strip() for line in header_text.split('\n') if line.strip()]
        if lines:
            contact["name"] = lines[0]

        # Email
        email_match = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', header_text)
        if email_match:
            contact["email"] = email_match.group(0)

        # Phone
        phone_match = re.search(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', header_text)
        if phone_match:
            contact["phone"] = phone_match.group(0)

        # LinkedIn
        linkedin_match = re.search(r'linkedin\.com/in/[\w-]+', header_text, re.IGNORECASE)
        if linkedin_match:
            contact["linkedin"] = linkedin_match.group(0)

        return contact

    def _extract_section_text(self, section_range: Tuple[int, int], full_text: str) -> str:
        """Extract text for a section"""
        if not section_range:
            return ""

        start, end = section_range
        section_text = full_text[start:end].strip()

        # Remove section header (first line)
        lines = section_text.split('\n')
        if len(lines) > 1:
            return '\n'.join(lines[1:]).strip()
        return section_text

    def _parse_experience(self, section_range: Tuple[int, int], full_text: str) -> List[ExperienceItem]:
        """Parse experience section"""
        if not section_range:
            return []

        section_text = self._extract_section_text(section_range, full_text)
        experiences = []

        # Split into individual jobs (look for date patterns)
        job_blocks = self._split_by_dates(section_text)

        for block in job_blocks:
            exp = self._parse_single_experience(block)
            if exp:
                experiences.append(exp)

        return experiences

    def _parse_single_experience(self, block: str) -> ExperienceItem:
        """Parse a single experience entry"""
        lines = [line.strip() for line in block.split('\n') if line.strip()]

        if not lines:
            return None

        # First line usually has title and company
        title_line = lines[0]
        title, company = self._extract_title_company(title_line)

        # Second line usually has dates
        dates = self._extract_dates(lines[1] if len(lines) > 1 else lines[0])

        # Remaining lines are bullets
        bullets = []
        for line in lines[1:]:
            if line.startswith(('•', '-', '◦', '▪', '*')) or re.match(r'^\d+\.', line):
                # Clean bullet
                bullet = re.sub(r'^[•\-◦▪*]\s*', '', line)
                bullet = re.sub(r'^\d+\.\s*', '', bullet)
                bullets.append(bullet.strip())

        return ExperienceItem(
            title=title,
            company=company,
            start_date=dates.get("start", ""),
            end_date=dates.get("end", "Present"),
            bullets=bullets
        )

    def _parse_education(self, section_range: Tuple[int, int], full_text: str) -> List[EducationItem]:
        """Parse education section"""
        if not section_range:
            return []

        section_text = self._extract_section_text(section_range, full_text)
        education = []

        # Split by degree patterns
        degree_pattern = r'\b(bachelor|master|phd|doctorate|associate|bs|ba|ms|ma|mba|phd)\b'
        blocks = re.split(f'(?={degree_pattern})', section_text, flags=re.IGNORECASE)

        for block in blocks:
            if not block.strip():
                continue

            edu = self._parse_single_education(block)
            if edu:
                education.append(edu)

        return education

    def _parse_single_education(self, block: str) -> EducationItem:
        """Parse a single education entry"""
        lines = [line.strip() for line in block.split('\n') if line.strip()]

        if not lines:
            return None

        # Extract degree (usually first line)
        degree = lines[0]

        # Extract institution
        institution = lines[1] if len(lines) > 1 else ""

        # Extract graduation date
        grad_date = self._extract_graduation_date(block)

        return EducationItem(
            degree=degree,
            institution=institution,
            graduation_date=grad_date
        )

    def _parse_skills(self, section_range: Tuple[int, int], full_text: str) -> List[str]:
        """Parse skills section"""
        if not section_range:
            return []

        section_text = self._extract_section_text(section_range, full_text)

        # Skills are usually comma or pipe separated
        skills = []

        # Try comma separation first
        if ',' in section_text:
            skills = [s.strip() for s in section_text.split(',')]
        elif '|' in section_text:
            skills = [s.strip() for s in section_text.split('|')]
        else:
            # Try bullet points
            lines = section_text.split('\n')
            for line in lines:
                line = re.sub(r'^[•\-◦▪*]\s*', '', line.strip())
                if line:
                    skills.append(line)

        return [s for s in skills if s and len(s) < 50]  # Filter out too long items

    def _parse_certifications(self, section_range: Tuple[int, int], full_text: str) -> List[str]:
        """Parse certifications section"""
        if not section_range:
            return []

        section_text = self._extract_section_text(section_range, full_text)
        certifications = []

        lines = section_text.split('\n')
        for line in lines:
            line = re.sub(r'^[•\-◦▪*]\s*', '', line.strip())
            if line and len(line) < 100:
                certifications.append(line)

        return certifications

    def _split_by_dates(self, text: str) -> List[str]:
        """Split text into blocks by date patterns"""
        # Look for date patterns like "Jan 2020 - Dec 2022" or "2020 - 2022"
        date_pattern = r'\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December|\d{4})\b'

        blocks = []
        current_block = []
        lines = text.split('\n')

        for line in lines:
            if re.search(date_pattern, line):
                # Start of new block
                if current_block:
                    blocks.append('\n'.join(current_block))
                    current_block = []
            current_block.append(line)

        if current_block:
            blocks.append('\n'.join(current_block))

        return blocks

    def _extract_title_company(self, line: str) -> Tuple[str, str]:
        """Extract title and company from line"""
        # Common patterns: "Title at Company" or "Title | Company" or "Title, Company"
        if ' at ' in line:
            parts = line.split(' at ', 1)
            return parts[0].strip(), parts[1].strip()
        elif ' | ' in line:
            parts = line.split(' | ', 1)
            return parts[0].strip(), parts[1].strip()
        elif ',' in line:
            parts = line.split(',', 1)
            return parts[0].strip(), parts[1].strip()
        else:
            return line.strip(), ""

    def _extract_dates(self, text: str) -> Dict[str, str]:
        """Extract start and end dates"""
        # Pattern: "Month Year - Month Year" or "Year - Year"
        date_pattern = r'((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{4})\s*[-–—to]\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{4}|Present|Current)'

        match = re.search(date_pattern, text, re.IGNORECASE)
        if match:
            return {"start": match.group(1), "end": match.group(2)}

        return {"start": "", "end": ""}

    def _extract_graduation_date(self, text: str) -> str:
        """Extract graduation date"""
        # Look for year
        year_match = re.search(r'\b(19|20)\d{2}\b', text)
        if year_match:
            return year_match.group(0)
        return ""

    def _check_ats_formatting(self, pdf_bytes: bytes) -> List[str]:
        """Check for ATS-unfriendly formatting"""
        issues = []

        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")

            # Check for images
            for page in doc:
                images = page.get_images()
                if images:
                    issues.append("Contains images (may not be parsed by ATS)")
                    break

            # Check for tables
            for page in doc:
                tables = page.find_tables()
                if tables:
                    issues.append("Contains tables (may cause parsing issues)")
                    break

            # Check for multiple columns
            # Simple heuristic: check text block positions
            for page in doc:
                blocks = page.get_text("dict")["blocks"]
                if len(blocks) > 1:
                    x_positions = [block["bbox"][0] for block in blocks if "lines" in block]
                    if len(set(x_positions)) > 2:
                        issues.append("Multiple columns detected (may confuse ATS)")
                        break

            doc.close()

        except Exception as e:
            logger.error(f"Error checking formatting: {e}")

        return issues


# Singleton instance
_pdf_parser = None

def get_pdf_parser() -> PDFParser:
    """Get singleton instance of PDFParser"""
    global _pdf_parser
    if _pdf_parser is None:
        _pdf_parser = PDFParser()
    return _pdf_parser
