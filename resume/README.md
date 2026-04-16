# ATS Resume Builder

An intelligent, full-stack web application that helps users optimize their resumes for Applicant Tracking Systems (ATS). Built with React, TypeScript, FastAPI, and powered by NLP - no paid API keys required!

## Features

✨ **PDF Resume Upload & Parsing** - Extract structured data from PDF resumes with automatic section detection

📊 **ATS Compatibility Scoring** - Get a comprehensive 0-100 score with detailed breakdowns:
- Keyword match analysis (40%)
- Skills match percentage (30%)
- Experience relevance (15%)
- Education matching (10%)
- Formatting issues detection (5%)

🤖 **AI-Powered Suggestions** - Get intelligent optimization recommendations using NLP:
- Weak verb replacement
- Missing keyword insertion
- Quantification suggestions
- Tone adjustments
- All powered by spaCy and TF-IDF (no paid APIs!)

✏️ **Side-by-Side Editor** - Compare original vs optimized resume with:
- Real-time ATS score updates
- Accept/reject suggestions individually
- Undo/redo functionality
- Section reordering

📄 **Export Options** - Download ATS-friendly resumes in:
- PDF (single-column, standard fonts, no images)
- DOCX (Microsoft Word format)
- Plain text

🎨 **5 ATS-Optimized Templates**:
- Classic - Traditional single-column
- Modern - Clean with subtle accents
- Technical - Optimized for engineering roles
- Executive - For senior/leadership positions
- Minimal - Maximum readability

🌙 **Dark Mode** - Beautiful dark theme enabled by default

## Quick Start

### Prerequisites

- Docker
- Docker Compose
- Git

### Installation & Running

1. **Clone the repository**
```bash
git clone git@github.com:Nisargkumar-Patel/Study.git
cd Study/resume
```

2. **Run with Docker Compose**
```bash
docker-compose up --build
```

3. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

That's it! The application is now running.

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **PyMuPDF (fitz)** - PDF parsing and extraction
- **ReportLab** - ATS-friendly PDF generation
- **python-docx** - DOCX export
- **spaCy** (en_core_web_lg) - NLP and Named Entity Recognition
- **scikit-learn** - TF-IDF vectorization and cosine similarity
- **NLTK** - Text processing utilities

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS
- **Zustand** - State management
- **TipTap** - Rich text editor
- **Framer Motion** - Animations
- **Axios** - HTTP client

### Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **Nginx** - Frontend web server

## Architecture

```
resume/
├── backend/          # FastAPI application
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── routers/             # API endpoints
│   │   │   ├── resume.py        # Resume upload & parsing
│   │   │   ├── analysis.py      # Job analysis & scoring
│   │   │   └── export.py        # Export endpoints
│   │   ├── services/            # Core business logic
│   │   │   ├── pdf_parser.py         # PDF parsing
│   │   │   ├── keyword_extractor.py  # NLP keyword extraction
│   │   │   ├── ats_scorer.py         # ATS scoring algorithm
│   │   │   ├── resume_optimizer.py   # Suggestion generation
│   │   │   └── export_service.py     # Document export
│   │   └── models/              # Pydantic data models
│   └── requirements.txt
│
├── frontend/         # React application
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── stores/              # Zustand state management
│   │   ├── types/               # TypeScript types
│   │   ├── utils/               # Utilities (API client)
│   │   └── App.tsx              # Main app component
│   └── package.json
│
└── docker-compose.yml    # Container orchestration
```

## How It Works

### 1. PDF Parsing
The application uses PyMuPDF to extract text while preserving layout. It then uses heuristics and regex patterns to detect resume sections:
- Looks for common section headers (EXPERIENCE, EDUCATION, SKILLS, etc.)
- Uses font size, capitalization, and whitespace as indicators
- Parses each section with section-specific logic
- Checks for ATS-unfriendly elements (tables, images, multiple columns)

### 2. Keyword Extraction (No Paid APIs!)
Uses a hybrid NLP approach:
- **TF-IDF Vectorization** - Extracts top keywords from job descriptions with importance scores
- **spaCy NER** - Identifies skills, technologies, and entities
- **Phrase Matching** - Matches against a database of 1000+ common skills
- **Dependency Parsing** - Extracts requirement phrases

### 3. ATS Scoring Algorithm
Calculates a weighted score based on:
```python
Overall Score = (
    Keyword Match × 0.40 +      # Cosine similarity of TF-IDF vectors
    Skills Match × 0.30 +        # Percentage of required skills present
    Experience Match × 0.15 +    # Years of experience comparison
    Education Match × 0.10 +     # Degree requirements
    Formatting × 0.05            # ATS-friendly formatting check
)
```

### 4. Resume Optimization (Template-Based, No LLM)
Generates suggestions using:
- **Weak Verb Replacement** - Library of 200+ strong action verbs
- **Keyword Insertion** - Uses dependency parsing to find natural insertion points
- **Quantification Detection** - Suggests adding metrics to vague statements
- **Tone Matching** - Uses POS distribution analysis

### 5. ATS-Friendly PDF Export
Generates PDFs that pass ATS parsers:
- Single-column layout (no multi-column confusion)
- Standard fonts only (Helvetica, Arial, Times)
- No images, graphics, or charts
- No critical info in headers/footers
- Pure black text (#000000)
- Proper text layer for parsing

## API Endpoints

### Resume Endpoints
- `POST /api/resume/upload` - Upload PDF resume
- `POST /api/resume/parse-text` - Parse text resume

### Analysis Endpoints
- `POST /api/analysis/analyze-job` - Analyze job description
- `POST /api/analysis/score` - Calculate ATS score
- `POST /api/analysis/optimize` - Generate suggestions
- `POST /api/analysis/score-live` - Real-time score (fast)

### Export Endpoints
- `POST /api/export/pdf` - Export to PDF
- `POST /api/export/docx` - Export to DOCX
- `POST /api/export/text` - Export to text

Full API documentation available at: http://localhost:8000/docs

## Development

### Backend Development
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m spacy download en_core_web_lg
uvicorn app.main:app --reload
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### Testing
```bash
# Backend tests
cd backend
pytest

# Frontend linting
cd frontend
npm run lint
```

## Environment Variables

### Backend
Create `.env` file in `backend/` directory:
```
DEBUG=True
API_VERSION=v1
```

### Frontend
Create `.env` file in `frontend/` directory:
```
VITE_API_URL=http://localhost:8000
```

## Key Features & Benefits

### No Paid APIs Required
All AI-powered features use open-source NLP libraries:
- spaCy for entity recognition and dependency parsing
- scikit-learn for TF-IDF and cosine similarity
- NLTK for text processing
- Template-based suggestion generation

### Real ATS Compatibility
The scoring algorithm and PDF export follow actual ATS requirements:
- Based on industry-standard ATS systems
- Tests against common ATS parsing rules
- Generates truly machine-readable PDFs

### Fast & Efficient
- Real-time score updates with debouncing
- Cached job description analysis
- Optimized TF-IDF vectorization
- Singleton pattern for NLP model loading

### Production Ready
- Docker containerization
- Health checks
- Error handling and validation
- CORS configuration
- Nginx reverse proxy

## Troubleshooting

### Docker Build Issues
If spaCy model download fails during build:
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### Port Already in Use
Change ports in `docker-compose.yml`:
```yaml
ports:
  - "3001:80"  # Frontend
  - "8001:8000"  # Backend
```

### PDF Parsing Issues
The parser works best with:
- Clean, well-formatted PDFs
- Standard section headers
- Single-column layouts
- Text-based PDFs (not scanned images)

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

This project is open source and available under the MIT License.

## Acknowledgments

- Built with Claude Code
- Powered by open-source NLP libraries
- No paid APIs required

---

**Made with ❤️ for job seekers**

Transform your resume, ace the ATS, land your dream job! 🚀
