"""Export resumes as LaTeX (.tex).

For resumes uploaded as LaTeX, the original source is preserved on
``ResumeData.latex_source`` and we patch it with the user's edits via targeted
string substitution — this preserves the user's original layout/styling.

For resumes uploaded as PDF (no original .tex available), we emit a clean,
Overleaf-compatible LaTeX template populated from the parsed structure. The
user can then refine it in Overleaf.
"""

import re
from typing import Any, Dict, List, Optional


_TEX_ESCAPES = [
    ("\\", r"\textbackslash{}"),
    ("&", r"\&"),
    ("%", r"\%"),
    ("$", r"\$"),
    ("#", r"\#"),
    ("_", r"\_"),
    ("{", r"\{"),
    ("}", r"\}"),
    ("~", r"\textasciitilde{}"),
    ("^", r"\textasciicircum{}"),
]

# Lighter escape used when patching an existing .tex source: we only escape
# characters that would otherwise be interpreted by LaTeX. Backslashes and
# braces are left alone since user-typed content shouldn't double-escape
# existing markup.
_PATCH_ESCAPE = {"%": r"\%", "&": r"\&", "$": r"\$", "#": r"\#", "_": r"\_"}


def _tex_escape(s: str) -> str:
    if s is None:
        return ""
    out = s
    for raw, esc in _TEX_ESCAPES:
        out = out.replace(raw, esc)
    return out


def _patch_escape(s: str) -> str:
    """Re-escape a plain-text field for substitution into a .tex source."""
    if s is None:
        return ""
    out = s
    for ch, esc in _PATCH_ESCAPE.items():
        out = out.replace(ch, esc)
    return out


class LatexExporter:
    """Produce .tex output from a (possibly edited) resume."""

    def export(self, resume_data: Dict[str, Any], original: Optional[Dict[str, Any]] = None) -> str:
        """Return a LaTeX source string for the given resume.

        If ``resume_data`` has a ``latex_source`` (the original .tex saved at
        upload time), it is patched with field-level substitutions using the
        differences vs. ``original`` (the snapshot taken at upload). Otherwise
        a clean template is generated from the structured fields.
        """
        latex_source = (resume_data.get("latex_source") or "").strip()

        if latex_source and original:
            return self._patch_source(latex_source, original, resume_data)

        return self._render_template(resume_data)

    # ---- patch path (LaTeX input) -------------------------------------------

    def _patch_source(self, source: str, original: Dict[str, Any], updated: Dict[str, Any]) -> str:
        out = source

        # Top-level scalar fields
        for key in ("name", "email", "phone", "location", "linkedin", "website", "summary"):
            old_val = (original.get(key) or "").strip()
            new_val = (updated.get(key) or "").strip()
            if old_val and new_val and old_val != new_val:
                out = self._replace_first(out, old_val, new_val)

        # Experience bullets — match by (exp_index, bullet_index)
        orig_exp = original.get("experience") or []
        new_exp = updated.get("experience") or []
        for i, new_e in enumerate(new_exp):
            if i >= len(orig_exp):
                continue
            old_e = orig_exp[i]
            for field in ("title", "company", "start_date", "end_date"):
                a, b = (old_e.get(field) or "").strip(), (new_e.get(field) or "").strip()
                if a and b and a != b:
                    out = self._replace_first(out, a, b)
            old_bullets = old_e.get("bullets") or []
            new_bullets = new_e.get("bullets") or []
            for j, nb in enumerate(new_bullets):
                if j >= len(old_bullets):
                    continue
                ob = (old_bullets[j] or "").strip()
                nb = (nb or "").strip()
                if ob and nb and ob != nb:
                    out = self._replace_first(out, ob, nb)

        # Education entries
        for i, ne in enumerate(updated.get("education") or []):
            orig_edu = (original.get("education") or [])
            if i >= len(orig_edu):
                continue
            oe = orig_edu[i]
            for field in ("degree", "institution", "graduation_date", "gpa", "honors"):
                a, b = (oe.get(field) or "").strip(), (ne.get(field) or "").strip()
                if a and b and a != b:
                    out = self._replace_first(out, a, b)

        # Skills — if any new skills were added, attempt to replace the old
        # joined list with a new joined list in the source.
        old_skills = list(original.get("skills") or [])
        new_skills = list(updated.get("skills") or [])
        if old_skills and new_skills and old_skills != new_skills:
            joined_old = ", ".join(old_skills)
            joined_new = ", ".join(new_skills)
            if joined_old in out:
                out = out.replace(joined_old, joined_new, 1)
            else:
                # Fallback: append a comment near the end of the document.
                out = self._append_skills_comment(out, new_skills)

        return out

    @staticmethod
    def _replace_first(source: str, old: str, new: str) -> str:
        if not old:
            return source
        # The plain-text "old" came from a LaTeX-unescaped extract; in source
        # form it might appear with LaTeX escapes (e.g. `40%` -> `40\%`).
        # Try the raw form first, then the escaped form. Always write the new
        # text in escaped form so the resulting .tex stays valid.
        new_esc = _patch_escape(new)
        if old in source:
            return source.replace(old, new_esc, 1)
        old_esc = _patch_escape(old)
        if old_esc and old_esc in source:
            return source.replace(old_esc, new_esc, 1)
        return source

    @staticmethod
    def _append_skills_comment(source: str, skills: List[str]) -> str:
        marker = "% --- updated skills (added by ATS Resume Builder) ---\n% Skills: "
        block = marker + ", ".join(skills) + "\n"
        end_doc = "\\end{document}"
        if end_doc in source:
            return source.replace(end_doc, block + end_doc, 1)
        return source + "\n" + block

    # ---- template path (PDF input) ------------------------------------------

    def _render_template(self, r: Dict[str, Any]) -> str:
        e = _tex_escape

        head_lines: List[str] = []
        contact_parts: List[str] = []
        if r.get("email"):
            contact_parts.append(e(r["email"]))
        if r.get("phone"):
            contact_parts.append(e(r["phone"]))
        if r.get("location"):
            contact_parts.append(e(r["location"]))
        if r.get("linkedin"):
            contact_parts.append(e(r["linkedin"]))

        sep = " \\\\ "
        contact_line = sep.join(contact_parts) if contact_parts else ""
        name_safe = e(r.get("name") or "Your Name")
        head = "\n".join([
            r"\documentclass[11pt,letterpaper]{article}",
            r"\usepackage[margin=0.75in]{geometry}",
            r"\usepackage{enumitem}",
            r"\usepackage{hyperref}",
            r"\usepackage{titlesec}",
            r"\titleformat{\section}{\large\bfseries\uppercase}{}{0em}{}[\titlerule]",
            r"\titlespacing*{\section}{0pt}{8pt}{4pt}",
            r"\pagenumbering{gobble}",
            r"\setlist[itemize]{leftmargin=*,topsep=2pt,itemsep=1pt}",
            r"\begin{document}",
            r"",
            r"\begin{center}{\Large \textbf{" + name_safe + r"}}\\",
            contact_line,
            r"\end{center}",
        ])
        head_lines.append(head)

        sections: List[str] = []

        if r.get("summary"):
            sections.append("\\section{Summary}\n" + e(r["summary"]))

        experience = r.get("experience") or []
        if experience:
            exp_body = ["\\section{Experience}"]
            for exp in experience:
                title = e(exp.get("title") or "")
                company = e(exp.get("company") or "")
                start = e(exp.get("start_date") or "")
                end = e(exp.get("end_date") or "")
                location = e(exp.get("location") or "")
                bullets = exp.get("bullets") or []
                header_left = title + ((" \\textbar\\ " + company) if company else "")
                date_range = (start + " -- " + end).strip(" -")
                header_right_parts = [p for p in [date_range, location] if p.strip()]
                header_right = " \\quad ".join(header_right_parts)
                exp_body.append(
                    "\\noindent\\textbf{" + header_left + "} \\hfill " + header_right + "\\\\"
                )
                if bullets:
                    exp_body.append(r"\begin{itemize}")
                    for b in bullets:
                        exp_body.append("  \\item " + e(b))
                    exp_body.append(r"\end{itemize}")
                exp_body.append("")
            sections.append("\n".join(exp_body))

        education = r.get("education") or []
        if education:
            edu_body = ["\\section{Education}"]
            for edu in education:
                degree = e(edu.get("degree") or "")
                inst = e(edu.get("institution") or "")
                grad = e(edu.get("graduation_date") or "")
                gpa = e(edu.get("gpa") or "")
                line = "\\noindent\\textbf{" + degree + "} \\hfill " + grad + "\\\\\n" + inst
                if gpa:
                    line += " \\quad GPA: " + gpa
                edu_body.append(line + "\\\\")
            sections.append("\n".join(edu_body))

        skills = r.get("skills") or []
        if skills:
            sections.append("\\section{Skills}\n" + e(", ".join(skills)))

        certifications = r.get("certifications") or []
        if certifications:
            sections.append("\\section{Certifications}\n" + "\\\\\n".join(e(c) for c in certifications))

        body = "\n\n".join(sections)
        return "\n".join(["\n".join(head_lines), "", body, "", r"\end{document}", ""])


_latex_exporter: Optional[LatexExporter] = None


def get_latex_exporter() -> LatexExporter:
    global _latex_exporter
    if _latex_exporter is None:
        _latex_exporter = LatexExporter()
    return _latex_exporter
