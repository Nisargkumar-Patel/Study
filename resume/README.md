# ATS Resume Builder

A self-hosted web app that helps you tailor a resume to a specific job, score
it against an ATS-style rubric, and export the result. Runs entirely on your
machine — **no paid APIs, no third-party data sharing.** Intended for small
on-prem deployments (≈ 5 users).

## Features

- **Multiple input formats** — upload a PDF or a Word `.docx`, or paste a LaTeX
  source. PDF and DOCX use the same plain-text section parser; LaTeX uses a
  brace-balanced parser that preserves the original `.tex` for a layout-exact
  export.
- **Job-description analysis** — extracts required vs. preferred skills,
  technologies, education requirements, and years of experience, with
  spelling/acronym normalization (k8s → Kubernetes, AWS ↔ Amazon Web Services,
  etc.).
- **ATS scoring** — 0–100 score with sub-scores for keyword match, skills,
  experience, education, and formatting.
- **Auto-optimized resume** — generates an ATS-passing version of your resume
  with only truthful, non-fabricating edits (adds JD-required skills you don't
  list yet, weaves JD keywords into the summary, aligns synonym variants,
  strengthens weak verbs). Shows before/after scores and a change summary.
- **Exports** — PDF (ATS-plain), Word (`.docx`), plain text, and LaTeX
  (Overleaf-ready, or your original `.tex` patched in place if you uploaded one).
- **Optional cover letter** — template-filled from your resume + the job,
  fully editable, copy/download as `.txt`.

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Git

### Run it
```bash
git clone <your-fork-url>
cd Study/resume
docker-compose up --build
```

Then open **http://localhost:3000**.

The frontend calls the backend through nginx's `/api` proxy (same-origin), so
no extra configuration is needed for the local Docker deployment.

## Tech Stack

### Backend
- **FastAPI** — Python web framework
- **PyMuPDF** (`fitz`) — PDF text extraction
- **python-docx** — `.docx` parsing + export
- **ReportLab** — ATS-plain PDF export
- **spaCy** (`en_core_web_lg`, falls back to `_md` / `_sm`) — NLP, phrase matching
- **scikit-learn** — TF-IDF vectorization and cosine similarity

### Frontend
- **React 18 + TypeScript**, **Vite**, **Tailwind CSS**, **Zustand**, **Axios**
- Production build served by **nginx** with a built-in `/api → backend:8000`
  reverse proxy.

## API Endpoints

### Resume
- `POST /api/resume/upload` — upload a PDF (`multipart/form-data`)
- `POST /api/resume/upload-docx` — upload a Word `.docx`
- `POST /api/resume/upload-latex` — submit a pasted `.tex` source
- `POST /api/resume/parse-text` — parse a plain-text resume

### Analysis
- `POST /api/analysis/analyze-job` — extract structured data from a JD
- `POST /api/analysis/score` — full ATS score
- `POST /api/analysis/score-live` — fast partial score for live updates
- `POST /api/analysis/optimize` — generate per-bullet suggestions
- `POST /api/analysis/auto-optimize` — produce an optimized resume + change report + before/after scores
- `POST /api/analysis/cover-letter` — generate a template-based cover letter

### Export
- `POST /api/export/pdf` — ATS-plain PDF
- `POST /api/export/docx` — Word document
- `POST /api/export/text` — plain text
- `POST /api/export/latex` — Overleaf-ready `.tex` (patches the original
  `.tex` if you uploaded LaTeX; otherwise emits a fresh template)

Interactive docs: **http://localhost:8000/docs**

## Architecture

```
resume/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point + CORS
│   │   ├── routers/
│   │   │   ├── resume.py        # /upload, /upload-docx, /upload-latex
│   │   │   ├── analysis.py      # /analyze-job, /score, /optimize, ...
│   │   │   └── export.py        # /pdf, /docx, /text, /latex
│   │   ├── services/
│   │   │   ├── pdf_parser.py
│   │   │   ├── docx_parser.py
│   │   │   ├── latex_parser.py
│   │   │   ├── latex_export.py
│   │   │   ├── keyword_extractor.py
│   │   │   ├── ats_scorer.py
│   │   │   ├── resume_optimizer.py
│   │   │   ├── cover_letter_generator.py
│   │   │   └── export_service.py
│   │   ├── utils/text_normalizer.py
│   │   └── models/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/{upload,analysis,editor,export,ui}/
│   │   ├── stores/resumeStore.ts
│   │   ├── utils/api.ts
│   │   └── types/
│   ├── nginx.conf               # serves SPA + proxies /api to backend
│   └── package.json
└── docker-compose.yml
```

## How It Works

### 1. Parsing
- **PDF / DOCX** — text is extracted then split into sections by header
  patterns (Summary / Experience / Education / Skills / …) using a shared
  section parser.
- **LaTeX** — a brace-balanced scanner handles `\cventry` / `\cvitem`
  (moderncv) and plain `article` templates with `\textbf` / `\textit` headers
  and `itemize` bullet lists. The original `.tex` is kept so edits can be
  patched back in for a layout-exact export.
- Image-only / scanned / encrypted PDFs are rejected with a 422 and an
  actionable message (not silently returned as an empty resume).

### 2. Keyword extraction (no LLM)
- spaCy phrase matcher over a curated ~400-skill vocabulary, with alias /
  acronym normalization (`k8s`/`kubernetes`, `js`/`javascript`,
  `postgres`/`postgresql`, …).
- TF-IDF for general keywords, with a boilerplate filter so JD scaffolding
  (`requirements`, `nice to have`, …) doesn't count.

### 3. ATS scoring
Weighted blend:
```
score = 0.40 * keyword_match
      + 0.30 * skills_match
      + 0.15 * experience_match
      + 0.10 * education_match
      + 0.05 * formatting
```
Scoring is spelling- and acronym-agnostic.

### 4. Auto-optimization (truthful, no LLM)
Applies only these transformations:
1. Append JD-required skills you don't list yet (with proper casing — AWS, CI/CD, PostgreSQL, …).
2. Weave missing JD keywords (backed by skills you now list) into the summary.
3. Rewrite synonym variants to the JD's exact wording (`k8s → Kubernetes`).
4. Strengthen weak verbs in existing bullets (`responsible for → led`).

It deliberately does **not** invent jobs, dates, degrees, titles, or metrics.

### 5. Cover letter (optional)
A toggle in the Export step generates a template-filled cover letter from your
resume + the job. Fully editable; copy or download as `.txt`.

## Known limits

- **No persistence.** The backend is stateless; parsed resumes and any LaTeX
  source live only in the browser. A refresh loses unsaved work.
- **LaTeX patcher is best-effort.** moderncv and plain `article` templates
  parse and round-trip well; very exotic templates fall back to a structured
  re-render. `\input{}`/`\include{}` multi-file documents and custom
  `\newcommand` macros are not expanded.
- **In-app PDF/DOCX export is ATS-plain.** It cannot reproduce your original
  PDF/Word styling — for an exact format, re-upload as LaTeX and use the
  patched LaTeX export.
- **No OCR.** Scanned/image-only PDFs are rejected.

## Development

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# Install the spaCy model from its pinned wheel (the lg model also has
# en_core_web_md / en_core_web_sm fallbacks):
pip install https://github.com/explosion/spacy-models/releases/download/en_core_web_lg-3.7.1/en_core_web_lg-3.7.1-py3-none-any.whl
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # http://localhost:3000, proxies /api to localhost:8000
```

### Tests
```bash
cd backend && pytest
cd frontend && npm run build   # also runs tsc
```

## Environment Variables

### Backend (`backend/.env`)
```
DEBUG=False        # set True for verbose error pages in development
API_VERSION=v1
```

### Frontend
The frontend has **no required env vars** in the standard Docker deployment —
it talks to the backend through nginx's `/api` proxy using a relative URL.

If you ever need to point the frontend at a backend on a different origin (e.g.
for a non-Docker dev setup), set `VITE_API_URL` **at build time** (it's
inlined by Vite during `npm run build`):
```bash
VITE_API_URL=http://my-backend:8000 npm run build
```

## Troubleshooting

### Clean rebuild
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### Port already in use
Change ports in `docker-compose.yml` (default: `3000` frontend, `8000` backend).

### "No text could be extracted from this PDF"
The parser requires a text-based PDF. Scanned / image-only PDFs are rejected
because there is no OCR step.

## License

MIT.
