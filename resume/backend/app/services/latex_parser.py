"""Lightweight LaTeX resume parser.

Extracts structured ResumeData from a `.tex` source while keeping the original
source intact in `ResumeData.latex_source` so it can be edited and exported
losslessly later. Best-effort across common templates (moderncv, awesome-cv,
custom). For unknown layouts, it falls back to plain-text section detection.
"""

import re
from typing import Dict, List, Optional, Tuple
import logging

from app.models.resume import ResumeData, ExperienceItem, EducationItem, ParsedResume

logger = logging.getLogger(__name__)


_SECTION_RE = re.compile(r"\\section\*?\{([^}]+)\}", re.IGNORECASE)
_SUBSECTION_RE = re.compile(r"\\subsection\*?\{([^}]+)\}", re.IGNORECASE)
_CVENTRY_START_RE = re.compile(r"\\cventry\b")


def _balanced_args(text: str, start: int, n: int) -> Optional[List[str]]:
    """Parse ``n`` consecutive ``{...}`` arguments starting at ``text[start:]``.
    Returns the captured contents (without the outer braces) or ``None`` if the
    structure is malformed."""
    i = start
    args: List[str] = []
    while len(args) < n:
        while i < len(text) and text[i].isspace():
            i += 1
        if i >= len(text) or text[i] != "{":
            return None
        depth = 1
        j = i + 1
        while j < len(text) and depth > 0:
            ch = text[j]
            if ch == "\\" and j + 1 < len(text):
                j += 2
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
            j += 1
        if depth != 0:
            return None
        args.append(text[i + 1: j - 1])
        i = j
    return args
_CVITEM_RE = re.compile(r"\\cvitem\{([^}]*)\}\{([^}]*)\}", re.DOTALL)
_NAME_RE = re.compile(r"\\name\{([^}]*)\}(?:\{([^}]*)\})?")
_EMAIL_CMD_RE = re.compile(r"\\(?:email|emailaddress)\{([^}]+)\}")
_PHONE_CMD_RE = re.compile(r"\\(?:phone|phonenumber|mobile)(?:\[[^\]]*\])?\{([^}]+)\}")
_ADDRESS_CMD_RE = re.compile(r"\\(?:address|location)\{([^}]+)\}")
_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")
_PHONE_RE = re.compile(r"(?:\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}")
_LINKEDIN_RE = re.compile(r"linkedin\.com/in/[\w-]+", re.IGNORECASE)
# "City, ON" / "City, Ontario" / "City, ST, Canada" — Canadian/US style.
_LOCATION_RE = re.compile(
    r"\b[A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+)?,\s*"
    r"(?:ON|BC|AB|QC|NS|NB|MB|SK|PE|NL|YT|NT|NU|[A-Z]{2}|"
    r"Ontario|Quebec|Alberta|Manitoba|California|Toronto|Texas|Washington)"
    r"(?:,\s*[A-Z][a-zA-Z]+)?\b"
)
_ITEM_RE = re.compile(r"\\item\b\s*(.*?)(?=\\item\b|\\end\{|\Z)", re.DOTALL)


class LatexParser:
    """Parse LaTeX resume sources into structured ResumeData."""

    def parse(self, latex_source: str) -> ParsedResume:
        try:
            name = self._extract_name(latex_source)
            email = self._extract_email(latex_source)
            phone = self._extract_phone(latex_source)
            location = self._extract_address(latex_source)
            linkedin = self._extract_linkedin(latex_source)

            sections = self._detect_sections(latex_source)

            summary = self._extract_summary(latex_source, sections)
            experience = self._extract_experience(latex_source, sections)
            education = self._extract_education(latex_source, sections)
            skills = self._extract_skills(latex_source, sections)

            plain_text = self._to_plain_text(latex_source)

            data = ResumeData(
                name=name or "Unknown",
                email=email,
                phone=phone,
                location=location,
                linkedin=linkedin,
                summary=summary,
                experience=experience,
                education=education,
                skills=skills,
                raw_text=plain_text,
                latex_source=latex_source,
                source_format="latex",
            )

            return ParsedResume(
                data=data,
                formatting_issues=[],
                confidence=0.85 if name and email else 0.6,
                sections_found=list(sections.keys()),
            )
        except Exception as exc:
            logger.error("LaTeX parse failed: %s", exc)
            return ParsedResume(
                data=ResumeData(
                    name="Unknown",
                    raw_text=latex_source,
                    latex_source=latex_source,
                    source_format="latex",
                ),
                formatting_issues=["Could not fully parse the LaTeX source"],
                confidence=0.1,
                sections_found=[],
            )

    # ---- contact / header ---------------------------------------------------

    def _extract_name(self, src: str) -> Optional[str]:
        m = _NAME_RE.search(src)
        if m:
            parts = [p for p in [m.group(1), m.group(2)] if p]
            joined = " ".join(parts).strip()
            if joined:
                return self._clean(joined)
        # Try \author{...}, \Huge{First Last}, or the first text inside \begin{document}
        m = re.search(r"\\author\{([^}]+)\}", src)
        if m:
            return self._clean(m.group(1))
        # Centered header block: {\LARGE ... NAME} or {\huge \textbf{NAME}}.
        m = re.search(r"\\begin\{center\}(.*?)\\end\{center\}", src, re.DOTALL)
        if m:
            name = self._name_from_block(m.group(1))
            if name:
                return name
        m = re.search(r"\\begin\{document\}([\s\S]{0,500})", src)
        if m:
            after = m.group(1)
            for line in after.splitlines():
                line = self._clean(line).strip()
                if line and not line.startswith("%"):
                    # Avoid common headings
                    if not re.match(r"(curriculum|cv|resume)", line, re.IGNORECASE):
                        return line
        return None

    def _extract_email(self, src: str) -> Optional[str]:
        m = _EMAIL_CMD_RE.search(src)
        if m:
            return self._clean(m.group(1))
        m = _EMAIL_RE.search(src)
        if m:
            return m.group(0)
        return None

    def _extract_phone(self, src: str) -> Optional[str]:
        m = _PHONE_CMD_RE.search(src)
        if m:
            return self._clean(m.group(1))
        m = _PHONE_RE.search(src)
        if m:
            return m.group(0)
        return None

    def _extract_address(self, src: str) -> Optional[str]:
        m = _ADDRESS_CMD_RE.search(src)
        if m:
            return self._clean(m.group(1))
        # Inline contact lines: "Address: Toronto, Ontario, Canada" or a bare
        # "City, ST[, Country]" run inside the centered header.
        plain = self._to_plain_text(src)
        m = re.search(r"Address:\s*([^|\n]+)", plain, re.IGNORECASE)
        if m:
            return m.group(1).strip(" .,")
        m = _LOCATION_RE.search(plain)
        if m:
            return m.group(0).strip(" .,")
        return None

    def _extract_linkedin(self, src: str) -> Optional[str]:
        m = _LINKEDIN_RE.search(src)
        return m.group(0) if m else None

    _NAME_RUN_RE = re.compile(r"[A-Z][A-Za-z'.\-]*(?:\s+[A-Z][A-Za-z'.\-]*){1,4}")

    def _name_from_block(self, block: str) -> Optional[str]:
        """Find the applicant name inside a centered header block."""
        # Prefer a \textbf{...} run (common in `{\huge \textbf{Name}}`).
        for b in self._find_commands(block, "textbf"):
            cand = self._clean(b)
            if self._looks_like_name(cand):
                return cand
        plain = self._to_plain_text(block)
        for m in self._NAME_RUN_RE.finditer(plain):
            cand = m.group(0).strip()
            if self._looks_like_name(cand):
                return cand
        return None

    @staticmethod
    def _looks_like_name(s: str) -> bool:
        if not s:
            return False
        s = s.strip()
        if not (3 <= len(s) <= 60):
            return False
        if "@" in s or any(c.isdigit() for c in s):
            return False
        words = s.split()
        if not (2 <= len(words) <= 5):
            return False
        if re.search(
            r"(curriculum|vitae|resume|engineer|developer|email|phone|"
            r"portfolio|linkedin|github|present|relevant|summary)",
            s, re.IGNORECASE,
        ):
            return False
        return True

    @staticmethod
    def _find_commands(text: str, cmd: str) -> List[str]:
        """Return brace-balanced contents of every ``\\cmd{...}`` in ``text``."""
        out: List[str] = []
        for m in re.finditer(r"\\" + cmd + r"\b", text):
            args = _balanced_args(text, m.end(), 1)
            if args:
                out.append(args[0])
        return out

    # ---- sections -----------------------------------------------------------

    def _detect_sections(self, src: str) -> Dict[str, Tuple[int, int]]:
        """Map normalized section-name -> (start_index, end_index) in src."""
        positions: List[Tuple[str, int]] = []
        for m in _SECTION_RE.finditer(src):
            positions.append((self._normalize_section_name(m.group(1)), m.start()))
        positions.sort(key=lambda p: p[1])

        sections: Dict[str, Tuple[int, int]] = {}
        for i, (name, start) in enumerate(positions):
            end = positions[i + 1][1] if i + 1 < len(positions) else len(src)
            # Skip duplicates: keep the first occurrence of a known name
            if name and name not in sections:
                sections[name] = (start, end)
        return sections

    @staticmethod
    def _normalize_section_name(raw: str) -> str:
        n = raw.strip().lower()
        if re.search(r"\b(summary|profile|objective|about)\b", n):
            return "summary"
        if re.search(r"\b(experience|employment|work)\b", n):
            return "experience"
        if re.search(r"\b(education|academic)\b", n):
            return "education"
        if re.search(r"\b(skills?|competenc|expertise|technologies)\b", n):
            return "skills"
        if re.search(r"\b(projects?|portfolio)\b", n):
            return "projects"
        if re.search(r"\b(certifications?|licenses?)\b", n):
            return "certifications"
        return n.split()[0] if n else ""

    def _slice(self, src: str, sections: Dict[str, Tuple[int, int]], key: str) -> Optional[str]:
        rng = sections.get(key)
        if not rng:
            return None
        return src[rng[0]:rng[1]]

    # ---- section bodies -----------------------------------------------------

    def _extract_summary(self, src: str, sections) -> Optional[str]:
        body = self._slice(src, sections, "summary")
        if not body:
            return None
        text = self._strip_section_header(body)
        text = self._to_plain_text(text).strip()
        return text or None

    def _extract_experience(self, src: str, sections) -> List[ExperienceItem]:
        body = self._slice(src, sections, "experience")
        if not body:
            return []

        items: List[ExperienceItem] = []

        # Pattern 1: moderncv \cventry{when}{title}{company}{location}{}{description}
        for m in _CVENTRY_START_RE.finditer(body):
            args = _balanced_args(body, m.end(), 6)
            if not args:
                continue
            when, title, company, location, _grade, description = (
                self._clean(args[0]), self._clean(args[1]), self._clean(args[2]),
                self._clean(args[3]), self._clean(args[4]), args[5],
            )
            start, end = self._split_date_range(when)
            bullets = self._bullets_from_description(description)
            items.append(ExperienceItem(
                title=title or "",
                company=company or "",
                location=location or None,
                start_date=start,
                end_date=end or "Present",
                bullets=bullets,
            ))

        if items:
            return items

        # Pattern 2: \textbf/\textit header lines each followed by an itemize
        # bullet list (common in plain `article`-class resumes).
        items = self._parse_itemize_entries(body)
        if items:
            return items

        # Pattern 3: fallback — split on blank lines, look for \item-style bullets
        blocks = re.split(r"\n\s*\n", self._strip_section_header(body))
        for block in blocks:
            text = self._to_plain_text(block).strip()
            if not text:
                continue
            lines = [l.strip("•-*◦ \t") for l in text.splitlines() if l.strip()]
            if len(lines) < 2:
                continue
            header = lines[0]
            title, company = self._title_company_from_line(header)
            dates = self._extract_date_range_from_line(" ".join(lines[:3]))
            bullets = [l for l in lines[1:] if len(l) > 4]
            if title or company:
                items.append(ExperienceItem(
                    title=title or "",
                    company=company or "",
                    start_date=dates[0],
                    end_date=dates[1] or "Present",
                    bullets=bullets,
                ))
        return items

    def _parse_itemize_entries(self, body: str) -> List[ExperienceItem]:
        """Parse `\\textbf{role} ... \\begin{itemize}...\\end{itemize}` entries.

        Each ``itemize`` block holds the bullets; the text since the previous
        block (or the section header) is the entry header that carries the
        title, company and dates.
        """
        items: List[ExperienceItem] = []
        sec = _SECTION_RE.search(body)
        last = sec.end() if sec else 0
        for m in re.finditer(r"\\begin\{itemize\}", body):
            header = body[last:m.start()]
            end_m = re.search(r"\\end\{itemize\}", body[m.end():])
            if not end_m:
                continue
            inner = body[m.end(): m.end() + end_m.start()]
            last = m.end() + end_m.end()

            bullets = self._bullets_from_description(inner)
            title, company, start, end = self._parse_entry_header(header)
            if title or company:
                items.append(ExperienceItem(
                    title=title or "",
                    company=company or "",
                    start_date=start,
                    end_date=end or "Present",
                    bullets=bullets,
                ))
        return items

    def _parse_entry_header(self, header: str) -> Tuple[str, str, str, str]:
        """Extract (title, company, start, end) from an entry header."""
        bolds = [self._clean(b) for b in self._find_commands(header, "textbf")]
        italics = [self._clean(i) for i in self._find_commands(header, "textit")]
        plain = self._to_plain_text(header)
        start, end = self._extract_date_range_from_line(plain)

        def is_date(s: str) -> bool:
            if not s:
                return True
            if s in (start, end):
                return True
            return self._extract_date_range_from_line(s) != ("", "")

        bold_nd = [b for b in bolds if not is_date(b)]
        ital_nd = [i for i in italics if not is_date(i)]

        title = ""
        company = ""
        if bold_nd:
            title = bold_nd[0]
            rest = bold_nd[1:] + ital_nd
            if rest:
                company = rest[0]
            else:
                # Single bold run holding "Title | Company" / "Title - Company".
                title, company = self._title_company_from_line(title)
        elif ital_nd:
            title = ital_nd[0]
            company = ital_nd[1] if len(ital_nd) > 1 else ""
        return title, company, start, end

    _EDU_INST_RE = re.compile(
        r"\b(University|College|Institute|School|Polytechnic|Academy)\b", re.IGNORECASE
    )
    _EDU_DEG_RE = re.compile(
        r"\b(Bachelor|Master|Ph\.?\s?D|Doctor|Diploma|Associate|Engineering|"
        r"Technology|Post[\s-]*Grad\w*|Graduation|Certified|Certificate|"
        r"Foundations?|B\.?E|B\.?Sc|M\.?Sc|B\.?Tech|M\.?Tech|MBA|BBA|B\.?A|M\.?A)\b",
        re.IGNORECASE,
    )
    _DATE_RANGE_RE = re.compile(
        r"((?:[A-Za-z]{3,9}\.?\s+)?\d{4})\s*[-–—to]+\s*"
        r"((?:[A-Za-z]{3,9}\.?\s+)?\d{4}|Present|Current)",
        re.IGNORECASE,
    )

    def _parse_education_entries(self, body: str) -> List[EducationItem]:
        """Parse line-based education entries, classifying degree vs. institution
        by keyword so the two never get swapped, and keeping every entry."""
        body = self._strip_section_header(body)
        rows = re.split(r"\\\\|\n", body)

        groups: List[List[str]] = []
        current: List[str] = []
        for row in rows:
            if "\\textbf" in row and current:
                groups.append(current)
                current = []
            current.append(row)
        if current:
            groups.append(current)

        items: List[EducationItem] = []
        for group in groups:
            chunks: List[str] = []
            date_str = ""
            for row in group:
                plain = self._to_plain_text(row).strip()
                if not plain:
                    continue
                m = self._DATE_RANGE_RE.search(plain)
                if m and not date_str:
                    date_str = f"{m.group(1)} - {m.group(2)}"
                # Strip a date range, then a trailing single date.
                plain = self._DATE_RANGE_RE.sub("", plain)
                plain = re.sub(
                    r"\s*(?:Graduated\s+)?(?:[A-Za-z]{3,9}\.?\s+)?(?:19|20)\d{2}\s*$",
                    "", plain,
                ).strip(" ,–-")
                # Keep only the part before a `|` note (e.g. coursework).
                plain = plain.split("|")[0].strip(" ,")
                if plain:
                    chunks.append(plain)

            if not date_str:
                joined = " ".join(self._to_plain_text(r) for r in group)
                ym = re.search(r"\b(19|20)\d{2}\b", joined)
                date_str = ym.group(0) if ym else ""

            institution = next((c for c in chunks if self._EDU_INST_RE.search(c)), "")
            degree = next(
                (c for c in chunks if c != institution and self._EDU_DEG_RE.search(c)),
                "",
            )
            if not institution:
                institution = next((c for c in chunks if c != degree), "")
            if not degree:
                degree = next((c for c in chunks if c != institution), "")

            # Trim a trailing location off the institution ("College, City").
            if institution and "," in institution:
                head = institution.split(",")[0].strip()
                if self._EDU_INST_RE.search(head):
                    institution = head

            if degree or institution:
                items.append(EducationItem(
                    degree=degree,
                    institution=institution,
                    graduation_date=date_str,
                ))
        return items

    def _extract_education(self, src: str, sections) -> List[EducationItem]:
        body = self._slice(src, sections, "education")
        if not body:
            return []

        items: List[EducationItem] = []

        for m in _CVENTRY_START_RE.finditer(body):
            args = _balanced_args(body, m.end(), 6)
            if not args:
                continue
            when, degree, institution, location, gpa, _ = [self._clean(a) for a in args]
            items.append(EducationItem(
                degree=degree or "",
                institution=institution or "",
                location=location or None,
                graduation_date=when,
                gpa=gpa or None,
            ))

        if items:
            return items

        # Keyword-classified, multi-entry line parser (handles plain templates
        # where degree/institution order varies between templates).
        items = self._parse_education_entries(body)
        if items:
            return items

        text = self._to_plain_text(self._strip_section_header(body))
        blocks = [b.strip() for b in re.split(r"\n\s*\n", text) if b.strip()]
        for block in blocks:
            lines = [l.strip() for l in block.splitlines() if l.strip()]
            if not lines:
                continue
            degree = lines[0]
            institution = lines[1] if len(lines) > 1 else ""
            year_match = re.search(r"\b(19|20)\d{2}\b", block)
            items.append(EducationItem(
                degree=degree,
                institution=institution,
                graduation_date=year_match.group(0) if year_match else "",
            ))
        return items

    def _extract_skills(self, src: str, sections) -> List[str]:
        body = self._slice(src, sections, "skills")
        if not body:
            return []

        skills: List[str] = []

        # moderncv \cvitem{category}{comma-list}
        for m in _CVITEM_RE.finditer(body):
            content = self._to_plain_text(m.group(2))
            for s in self._split_skills(content):
                if s and s not in skills:
                    skills.append(s)

        if skills:
            return skills

        # Fall back to plain-text after the header, comma/pipe-delimited
        text = self._to_plain_text(self._strip_section_header(body))
        for s in self._split_skills(text):
            if s and s not in skills:
                skills.append(s)
        return skills

    @staticmethod
    def _split_skills(text: str) -> List[str]:
        # Split on commas, pipes, semicolons, or bullet markers
        parts = re.split(r"[,|;••\n]", text)
        out: List[str] = []
        for p in parts:
            s = p.strip(" \t-•:")
            # Drop a leading "Category:" label, keep the actual skill after it.
            if ":" in s:
                s = s.split(":", 1)[1].strip()
            if s and len(s) < 60:
                out.append(s)
        return out

    # ---- helpers ------------------------------------------------------------

    @staticmethod
    def _strip_section_header(body: str) -> str:
        # Drop the leading \section{...} line
        return _SECTION_RE.sub("", body, count=1)

    @staticmethod
    def _split_date_range(when: str) -> Tuple[str, str]:
        if not when:
            return "", ""
        # Accept one-or-more hyphens (LaTeX `--` en-dash) and unicode dashes.
        sep = re.split(r"\s*[-–—]+\s*|\s+to\s+", when, maxsplit=1, flags=re.IGNORECASE)
        if len(sep) == 2:
            return sep[0].strip(), sep[1].strip()
        return when.strip(), ""

    @staticmethod
    def _extract_date_range_from_line(line: str) -> Tuple[str, str]:
        m = re.search(
            r"((?:[A-Za-z]{3,9}\.?\s+)?\d{4})\s*[-–—to]+\s*((?:[A-Za-z]{3,9}\.?\s+)?\d{4}|Present|Current)",
            line,
            re.IGNORECASE,
        )
        if m:
            return m.group(1), m.group(2)
        return "", ""

    @staticmethod
    def _title_company_from_line(line: str) -> Tuple[str, str]:
        for sep in (" at ", " | ", ", ", " – ", " - "):
            if sep in line:
                a, b = line.split(sep, 1)
                return a.strip(), b.strip()
        return line.strip(), ""

    def _bullets_from_description(self, description: str) -> List[str]:
        # Look for \item bullets first; fall back to newline split.
        bullets: List[str] = []
        for m in _ITEM_RE.finditer(description):
            bullets.append(self._to_plain_text(m.group(1)).strip())
        if bullets:
            return [b for b in bullets if b]

        text = self._to_plain_text(description)
        for line in text.splitlines():
            line = line.strip(" \t-•◦*•")
            if line and len(line) > 4:
                bullets.append(line)
        return bullets

    @staticmethod
    def _clean(text: str) -> str:
        # Drop simple LaTeX leftovers from a captured field.
        text = re.sub(r"\\\\\s*(?:\[[^\]]*\])?", " ", text)
        text = re.sub(r"\\([%&$#_])", r"\1", text)
        text = re.sub(r"\\[a-zA-Z]+\*?(\[[^\]]*\])?", "", text)
        text = text.replace("{", "").replace("}", "")
        text = re.sub(r"~", " ", text)
        return re.sub(r"\s+", " ", text).strip()

    @staticmethod
    def _to_plain_text(latex: str) -> str:
        """Best-effort: strip LaTeX commands and environments down to readable text."""
        # 1. Drop true LaTeX comments: `%` not preceded by a backslash.
        text = re.sub(r"(?<!\\)%[^\n]*", "", latex)
        # 2. Unescape common LaTeX special-character escapes BEFORE removing
        #    backslash commands, so `\%` becomes `%` (not lost as a command).
        text = re.sub(r"\\([%&$#_])", r"\1", text)
        # Convert LaTeX line breaks (`\\` / `\\[2pt]`) and spacing macros into
        # newlines/spaces so list rows and skill lines don't run together.
        text = re.sub(r"\\\\\s*(?:\[[^\]]*\])?", "\n", text)
        text = re.sub(r"\\(?:quad|qquad)\b", "\n", text)
        text = re.sub(r"\\[,;:!]", " ", text)
        # Drop \begin{env}[opts] WITH its optional argument so list options
        # like `[noitemsep, leftmargin=12pt]` don't leak into the text.
        text = re.sub(r"\\begin\{[^}]+\}(?:\[[^\]]*\])?|\\end\{[^}]+\}", "", text)
        text = re.sub(r"\\item\b\s*", "\n- ", text)
        # Inline single-arg commands like \textbf{X} -> X
        for _ in range(3):
            text = re.sub(r"\\[a-zA-Z]+\*?\{([^{}]*)\}", r"\1", text)
        text = re.sub(r"\\[a-zA-Z]+\*?(\[[^\]]*\])?", "", text)
        text = text.replace("{", "").replace("}", "").replace("~", " ")
        return re.sub(r"\n{3,}", "\n\n", text).strip()


_latex_parser: Optional[LatexParser] = None


def get_latex_parser() -> LatexParser:
    global _latex_parser
    if _latex_parser is None:
        _latex_parser = LatexParser()
    return _latex_parser
