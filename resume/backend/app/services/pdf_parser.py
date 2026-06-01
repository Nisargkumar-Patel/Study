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


# Bullet/list markers seen across real-world resumes. Critically includes
# U+25CF ● (BLACK CIRCLE), which many PDF templates use and which the original
# parser did not recognize, silently dropping every bullet.
_BULLET_CHARS = "•◦▪‣·∙○●◉■□►▶◆◇»-*"

# A full date RANGE (start – end). Used both to extract dates and to detect
# where one job entry begins. A lone year (e.g. "in 2023" inside a bullet) does
# NOT match, so bullets no longer fragment an entry.
_DATE_TOKEN = (
    r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|"
    r"January|February|March|April|May|June|July|August|September|October|"
    r"November|December)\s+\d{4}|\d{1,2}/\d{4}|\d{4}"
)
DATE_RANGE_PATTERN = (
    r"(" + _DATE_TOKEN + r")\s*(?:[-–—]|to)\s*"
    r"(" + _DATE_TOKEN + r"|Present|Current|Now|Ongoing)"
)


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

    @staticmethod
    def _strip_bullet(line: str) -> str:
        """Remove a leading bullet/number marker from a line."""
        line = line.strip()
        # Leading run of bullet chars + whitespace
        line = re.sub(r"^[" + re.escape(_BULLET_CHARS) + r"]+\s*", "", line)
        # Numbered list "1." / "1)"
        line = re.sub(r"^\d+[.)]\s*", "", line)
        return line.strip()

    @staticmethod
    def _is_bullet_line(line: str) -> bool:
        s = line.strip()
        if not s:
            return False
        if s[0] in _BULLET_CHARS:
            return True
        return bool(re.match(r"^\d+[.)]\s+", s))

    @staticmethod
    def _split_inline_bullets(text: str) -> List[str]:
        """Split a blob that uses inline bullet chars (e.g. "● A ● B ● C")
        into separate items. Falls back to newline splitting."""
        # If a bullet char appears mid-text (not just line starts), split on it.
        parts = re.split(r"\s*[" + re.escape("•◦▪‣○●◉■□►▶◆◇") + r"]\s*", text)
        items = [p.strip() for p in parts if p and p.strip()]
        if len(items) > 1:
            return items
        # Otherwise split on newlines
        return [l.strip() for l in text.split("\n") if l.strip()]

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
        summary = self._extract_summary(sections.get("summary"), full_text) if "summary" in sections else None
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

    def _extract_summary(self, section_range: Tuple[int, int], full_text: str) -> str:
        """Extract summary text, normalizing inline bullet separators to spaces.

        Some templates render a paragraph summary with ● between sentences; we
        keep the full text but drop the stray markers so it reads as prose.
        """
        text = self._extract_section_text(section_range, full_text)
        if not text:
            return ""
        # Replace inline bullet markers with a space, collapse whitespace.
        text = re.sub(r"[" + re.escape("•◦▪‣○●◉■□►▶◆◇") + r"]", " ", text)
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    def _parse_experience(self, section_range: Tuple[int, int], full_text: str) -> List[ExperienceItem]:
        """Parse experience section.

        Non-lossy by design: every job block is split on full date RANGES (not
        lone years, which previously shredded entries), bullets are recognized
        across all common markers (including U+25CF ●), and any non-bullet body
        text is preserved in `description` so nothing the user wrote is dropped.
        """
        if not section_range:
            return []

        section_text = self._extract_section_text(section_range, full_text)
        if not section_text.strip():
            return []

        experiences = []
        for block in self._split_experience_blocks(section_text):
            exp = self._parse_single_experience(block)
            if exp:
                experiences.append(exp)

        # Safety net: if structured parsing somehow produced nothing but there
        # IS text, keep it all as a single entry's description rather than
        # silently dropping the whole section.
        if not experiences and section_text.strip():
            experiences.append(ExperienceItem(
                title="", company="", start_date="", end_date="",
                bullets=[], description=section_text.strip(),
            ))

        return experiences

    def _split_experience_blocks(self, text: str) -> List[str]:
        """Split the experience section into one block per job.

        Job entries take two common shapes:
          (a) "Title — Company" on one line, date range on the NEXT line, or
          (b) title/company and date range on the SAME line.
        A new block therefore begins at a non-bullet "header" line that either
        contains a date range, or is immediately followed by a date-range line.
        Crucially this keeps a title line together with the date line below it
        (the previous implementation stranded the title in the prior entry).

        A block boundary only fires once the current block already has *content*
        (a date range or at least one bullet), so a bare title directly above its
        own date line does not split into two empty entries.
        """
        lines = text.split("\n")
        n = len(lines)

        def has_range(s: str) -> bool:
            return bool(re.search(DATE_RANGE_PATTERN, s, re.IGNORECASE))

        def next_nonempty(idx: int) -> str:
            j = idx + 1
            while j < n and not lines[j].strip():
                j += 1
            return lines[j].strip() if j < n else ""

        blocks: List[List[str]] = []
        current: List[str] = []
        current_has_content = False  # date range or bullet seen in current block

        for i, line in enumerate(lines):
            s = line.strip()
            if not s:
                current.append(line)
                continue

            is_bullet = self._is_bullet_line(s)
            line_range = has_range(s)

            # Is this line the start of a new entry's header?
            starts_entry = (not is_bullet) and (
                line_range or (not is_bullet and has_range(next_nonempty(i)) and not self._is_bullet_line(next_nonempty(i)))
            )

            if starts_entry and current_has_content:
                blocks.append(current)
                current = []
                current_has_content = False

            current.append(line)
            if line_range or is_bullet:
                current_has_content = True

        if current:
            blocks.append(current)

        return ["\n".join(b).strip() for b in blocks if "\n".join(b).strip()]

    def _parse_single_experience(self, block: str) -> ExperienceItem:
        """Parse a single experience entry without discarding content."""
        raw_lines = [line.strip() for line in block.split("\n") if line.strip()]
        if not raw_lines:
            return None

        dates = self._extract_dates(block)

        # Identify the header line carrying title/company. Prefer the first
        # non-bullet line that is NOT purely a date range; the date range often
        # sits on its own line directly below the title.
        def _is_pure_date(line: str) -> bool:
            stripped = re.sub(DATE_RANGE_PATTERN, "", line, flags=re.IGNORECASE)
            return not stripped.strip(" -–—|,")

        header_idx = next(
            (i for i, l in enumerate(raw_lines)
             if not self._is_bullet_line(l) and not _is_pure_date(l)),
            None,
        )
        if header_idx is None:
            # No title line at all (only dates + bullets); fall back to first line.
            header_idx = 0
            title, company = "", ""
        else:
            header = raw_lines[header_idx]
            header_wo_dates = re.sub(DATE_RANGE_PATTERN, "", header, flags=re.IGNORECASE)
            header_wo_dates = header_wo_dates.strip(" -–—|,")
            title, company = self._extract_title_company(header_wo_dates)

        bullets: List[str] = []
        leftover: List[str] = []
        for i, line in enumerate(raw_lines):
            if i == header_idx:
                continue
            if self._is_bullet_line(line):
                # A single line may pack several inline bullets ("● A ● B").
                for item in self._split_inline_bullets(line):
                    cleaned = self._strip_bullet(item)
                    if cleaned:
                        bullets.append(cleaned)
            elif _is_pure_date(line):
                # A standalone date line — already captured in `dates`; never
                # content, regardless of position.
                continue
            else:
                # Non-bullet, non-date text: could be a sub-blob of inline
                # bullets, or genuine description. Preserve it either way.
                pieces = self._split_inline_bullets(line)
                if len(pieces) > 1:
                    bullets.extend(self._strip_bullet(p) for p in pieces if self._strip_bullet(p))
                else:
                    leftover.append(line)

        description = " ".join(leftover).strip() or None

        return ExperienceItem(
            title=title,
            company=company,
            start_date=dates.get("start", ""),
            end_date=dates.get("end", "") or "",
            bullets=bullets,
            description=description,
        )

    def _parse_education(self, section_range: Tuple[int, int], full_text: str) -> List[EducationItem]:
        """Parse education section"""
        if not section_range:
            return []

        section_text = self._extract_section_text(section_range, full_text)
        education = []

        # Split by degree patterns. The lookahead uses a NON-capturing group so
        # re.split does not inject the matched degree word as its own fragment
        # (which previously produced junk entries like degree="Bachelor").
        degree_pattern = r'(?:bachelor|master|phd|doctorate|associate|bs|ba|ms|ma|mba)'
        blocks = re.split(rf'(?=\b{degree_pattern}\b)', section_text, flags=re.IGNORECASE)

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
        """Parse skills section.

        Handles category-grouped layouts like
        "● Languages: Python, JavaScript ● Frontend: HTML, React ..." by
        stripping the inline bullet markers and the "Category:" labels, then
        splitting the remaining values on commas/pipes/slashes. De-duplicates
        while preserving order.
        """
        if not section_range:
            return []

        section_text = self._extract_section_text(section_range, full_text)
        if not section_text.strip():
            return []

        # Break into category chunks on inline bullet markers and newlines.
        chunks = re.split(r"[" + re.escape("•◦▪‣○●◉■□►▶◆◇") + r"\n]", section_text)

        skills: List[str] = []
        seen = set()
        for chunk in chunks:
            chunk = chunk.strip()
            if not chunk:
                continue
            # Drop a leading "Category:" label (e.g. "Languages: Python, ...").
            if ":" in chunk:
                label, _, rest = chunk.partition(":")
                # Only treat as a label if it's short (a real category name).
                if len(label.split()) <= 4:
                    chunk = rest.strip()
            # Split values on common delimiters. Note: do NOT split on "/",
            # which would wrongly break compound skills like CI/CD or TCP/IP.
            for value in re.split(r"[,|]", chunk):
                value = value.strip(" .;")
                key = value.lower()
                if value and len(value) < 60 and key not in seen:
                    seen.add(key)
                    skills.append(value)

        return skills

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
        """Extract title and company from a header line.

        Handles the common separators in priority order:
          "Title at Company", "Title — Company", "Title – Company",
          "Title | Company", "Title, Company".
        For dash-separated lines like "Title — Company – Location", only the
        first segment after the title is taken as the company; any trailing
        "– Location" is left out of the company name.
        """
        line = line.strip()
        if not line:
            return "", ""

        # " at " (word-boundaried)
        if re.search(r"\s+at\s+", line):
            parts = re.split(r"\s+at\s+", line, maxsplit=1)
            return parts[0].strip(), self._company_head(parts[1])

        # Em/en dash or pipe — these reliably separate title from company.
        for sep in ("—", "–", "|"):
            if sep in line:
                head, _, tail = line.partition(sep)
                return head.strip(" -–—|,"), self._company_head(tail)

        # Comma (least reliable; only the first field is the title).
        if "," in line:
            head, _, tail = line.partition(",")
            return head.strip(), self._company_head(tail)

        return line, ""

    @staticmethod
    def _company_head(text: str) -> str:
        """Take the company name from a "Company – Location" style tail,
        dropping a trailing location segment after a dash."""
        text = text.strip(" -–—|,")
        # Split off a trailing "– Location" / "— Location".
        company = re.split(r"\s*[–—]\s*", text, maxsplit=1)[0]
        return company.strip(" -–—|,")

    def _extract_dates(self, text: str) -> Dict[str, str]:
        """Extract start and end dates from a date range."""
        match = re.search(DATE_RANGE_PATTERN, text, re.IGNORECASE)
        if match:
            return {"start": match.group(1).strip(), "end": match.group(2).strip()}
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
