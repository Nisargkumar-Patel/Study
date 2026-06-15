from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import resume, analysis, export

app = FastAPI(
    title=settings.app_name,
    version=settings.api_version,
    debug=settings.debug
)

# CORS middleware.
# In the Docker deployment the frontend talks to the backend same-origin via
# the nginx `/api` proxy, so CORS is effectively unused. We keep a permissive
# allow-list for direct/dev access, but `allow_origins=["*"]` is INVALID with
# `allow_credentials=True` (browsers reject it), and we don't use credentials —
# so credentials are disabled to keep the wildcard valid.
_allow_all = settings.cors_origins == ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=not _allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(resume.router, prefix="/api/resume", tags=["resume"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
app.include_router(export.router, prefix="/api/export", tags=["export"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "ATS Resume Builder API",
        "version": settings.api_version,
        "status": "running"
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
