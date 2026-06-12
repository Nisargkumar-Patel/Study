from app.services.latex_parser import LatexParser
from app.services.latex_export import LatexExporter


SAMPLE_TEX = r"""\documentclass{moderncv}
\name{Jane}{Doe}
\email{jane@example.com}
\phone{416-555-0100}
\address{Toronto, ON}

\begin{document}
\makecvtitle

\section{Summary}
Backend engineer with five years of experience building distributed systems.

\section{Experience}
\cventry{2020--2024}{Senior Engineer}{Acme Corp}{Toronto}{}{%
\begin{itemize}
  \item Reduced API latency by 40\% serving 2M monthly users.
  \item Mentored junior developers across two product teams.
\end{itemize}}

\section{Education}
\cventry{2019}{BS Computer Science}{University of Waterloo}{ON}{}{}

\section{Skills}
\cvitem{Languages}{Python, JavaScript, TypeScript}
\cvitem{Cloud}{AWS, Docker, Kubernetes}

\end{document}
"""


def test_latex_parser_extracts_core_fields():
    parser = LatexParser()
    parsed = parser.parse(SAMPLE_TEX)
    data = parsed.data

    assert data.name == "Jane Doe"
    assert data.email == "jane@example.com"
    assert data.phone == "416-555-0100"
    assert data.location == "Toronto, ON"
    assert data.source_format == "latex"
    assert data.latex_source == SAMPLE_TEX

    assert data.summary and "distributed systems" in data.summary

    assert len(data.experience) == 1
    exp = data.experience[0]
    assert exp.title == "Senior Engineer"
    assert exp.company == "Acme Corp"
    assert exp.start_date == "2020"
    assert exp.end_date == "2024"
    # Bullets are extracted in full (LaTeX `\%` is unescaped to `%`).
    bullets_joined = " | ".join(exp.bullets)
    assert "40% serving 2M monthly users" in bullets_joined
    assert "Mentored junior developers" in bullets_joined

    assert len(data.education) == 1
    edu = data.education[0]
    assert "Computer Science" in edu.degree
    assert "Waterloo" in edu.institution

    # Skills should include the comma-listed items from both \cvitem blocks.
    skills_lower = {s.lower() for s in data.skills}
    assert {"python", "javascript", "aws", "docker", "kubernetes"} <= skills_lower


def test_latex_export_patches_original_for_latex_input():
    parser = LatexParser()
    parsed = parser.parse(SAMPLE_TEX)
    original = _to_dict(parsed.data)

    updated = _to_dict(parsed.data)
    # Edit a bullet
    updated["experience"][0]["bullets"][0] = (
        "Reduced API latency by 60% serving 5M monthly users."
    )
    # Edit summary
    updated["summary"] = "Senior backend engineer specializing in scalable services."

    exporter = LatexExporter()
    out_tex = exporter.export(updated, original=original)

    # The edits are reflected with a properly LaTeX-escaped `%`, and the
    # original cventry / section structure is preserved verbatim.
    assert "60\\% serving 5M monthly users" in out_tex
    assert "Senior backend engineer specializing in scalable services." in out_tex
    assert "\\cventry" in out_tex
    assert "\\section{Experience}" in out_tex
    # Untouched bullet is preserved and the old text no longer appears.
    assert "Mentored junior developers" in out_tex
    assert "40\\% serving 2M monthly users" not in out_tex


def test_latex_export_generates_template_when_no_source():
    exporter = LatexExporter()
    resume = {
        "name": "Sam Lee",
        "email": "sam@x.com",
        "phone": "604-555-0100",
        "location": "Vancouver, BC",
        "summary": "Data analyst.",
        "experience": [{
            "title": "Analyst",
            "company": "BrightCo",
            "start_date": "2022",
            "end_date": "Present",
            "bullets": ["Built dashboards"],
        }],
        "education": [{
            "degree": "BS Stats",
            "institution": "UBC",
            "graduation_date": "2021",
        }],
        "skills": ["SQL", "Python", "Tableau"],
        "source_format": "pdf",
    }
    out_tex = exporter.export(resume, original=None)

    assert out_tex.startswith("\\documentclass")
    assert "\\end{document}" in out_tex
    assert "Sam Lee" in out_tex
    assert "Built dashboards" in out_tex
    assert "SQL, Python, Tableau" in out_tex


# A plain `article`-class resume (NOT moderncv): centered name, \textbf/\textit
# headers, itemize bullets, and category-labelled plain-text skills. This is the
# common "any LaTeX format" case that used to degrade badly.
ARTICLE_TEX = r"""\documentclass[10pt,letterpaper]{article}
\usepackage[margin=0.5in]{geometry}
\usepackage{enumitem}
\usepackage{xcolor}

\begin{document}

\begin{center}
    {\LARGE\bfseries\color{primary} NISARGKUMAR PATEL}\\[4pt]
    \small +1 343-558-5184 \,|\, Ottawa, ON, Canada \,|\, njpatel944@gmail.com \,|\, \href{https://www.linkedin.com/in/nisargkumar-patel/}{LinkedIn}
\end{center}

\section{PROFESSIONAL SUMMARY}
Versatile \textbf{Software Developer} with hands-on expertise in Python scripting.

\section{TECHNICAL SKILLS}
\noindent
\textbf{Programming \& Scripting:} Python, C, SQL \quad
\textbf{DevOps \& Tools:} CI/CD (Jenkins/GitLab), Git, JIRA, Linux\\[2pt]
\textbf{Soft Skills:} Technical Documentation, Root Cause Analysis

\section{PROFESSIONAL EXPERIENCE}

\noindent
\textbf{Software Developer / QA Automation Engineer} \hfill \textit{Jan 2025 -- Jul 2025}\\
\textit{Light Heart Vision}
\begin{itemize}[noitemsep, topsep=2pt, leftmargin=12pt]
    \item Architected automated testing frameworks using \textbf{Python and Pytest}.
    \item Automated regression testing, \textbf{reducing manual efforts by 40\%}.
\end{itemize}

\section{EDUCATION}

\noindent
\textbf{Computer Engineering Technology} \hfill \textit{Graduated Aug 2025}\\
\textit{Algonquin College} | Relevant Coursework: Systems Programming

\end{document}
"""


def test_article_template_extracts_structure():
    """The plain article template must NOT degrade: real name (not 'center'),
    clean titles/companies/dates, category-stripped skills, classified education.
    """
    parsed = LatexParser().parse(ARTICLE_TEX)
    data = parsed.data

    # Name must come from the centered header, not `\begin{center}`.
    assert data.name == "NISARGKUMAR PATEL"
    assert data.email == "njpatel944@gmail.com"
    assert data.location and "Ottawa" in data.location

    # Experience: title/company split, dates parsed, NO itemize options leaked.
    assert len(data.experience) == 1
    exp = data.experience[0]
    assert exp.title == "Software Developer / QA Automation Engineer"
    assert exp.company == "Light Heart Vision"
    assert exp.start_date == "Jan 2025"
    assert exp.end_date == "Jul 2025"
    joined = " | ".join(exp.bullets)
    assert "noitemsep" not in joined and "leftmargin" not in joined
    assert "reducing manual efforts by 40%" in joined

    # Skills: category labels and `\\[2pt]` stripped.
    skills_lower = {s.lower() for s in data.skills}
    assert {"python", "git", "ci/cd (jenkins/gitlab)", "linux"} <= skills_lower
    assert not any(":" in s for s in data.skills)
    assert not any("[2pt]" in s for s in data.skills)

    # Education: degree vs institution classified correctly (not swapped).
    assert len(data.education) == 1
    edu = data.education[0]
    assert "Algonquin College" in edu.institution
    assert "Engineering Technology" in edu.degree


def test_article_template_added_skill_is_visible_not_a_comment():
    """A newly-added skill must render in the PDF, not hide in a `%` comment."""
    parser = LatexParser()
    parsed = parser.parse(ARTICLE_TEX)
    original = _to_dict(parsed.data)

    updated = _to_dict(parsed.data)
    updated["skills"].append("Kubernetes")

    out = LatexExporter().export(updated, original=original)

    # Structure preserved.
    assert out.count("\\begin{document}") == 1
    assert out.count("\\section") == ARTICLE_TEX.count("\\section")
    # The skill appears on a NON-comment line (visible in the compiled PDF).
    visible = [ln for ln in out.splitlines()
               if "Kubernetes" in ln and not ln.lstrip().startswith("%")]
    assert visible, "added skill must be on a visible (non-comment) line"


def test_docx_export_handles_missing_contact_fields():
    """Regression: empty contact line used to crash with IndexError because
    `add_paragraph("")` produces a paragraph with no runs."""
    from app.services.export_service import get_export_service

    resume = {
        "name": "Pat Smith",
        # Intentionally no email/phone/location/linkedin -> empty contact line
        "summary": "Engineer.",
        "experience": [],
        "education": [],
        "skills": [],
        "certifications": [],
        "projects": [],
    }
    out = get_export_service().export_to_docx(resume, "classic")
    assert isinstance(out, (bytes, bytearray)) and len(out) > 1000


def _to_dict(data):
    return {
        "name": data.name, "email": data.email, "phone": data.phone,
        "location": data.location, "linkedin": data.linkedin,
        "summary": data.summary,
        "experience": [{
            "title": e.title, "company": e.company, "location": e.location,
            "start_date": e.start_date, "end_date": e.end_date,
            "bullets": list(e.bullets), "description": e.description,
        } for e in data.experience],
        "education": [{
            "degree": d.degree, "institution": d.institution, "location": d.location,
            "graduation_date": d.graduation_date, "gpa": d.gpa, "honors": d.honors,
        } for d in data.education],
        "skills": list(data.skills),
        "certifications": list(data.certifications),
        "raw_text": data.raw_text,
        "latex_source": data.latex_source,
        "source_format": data.source_format,
    }
