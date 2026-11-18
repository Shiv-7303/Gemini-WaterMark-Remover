from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from .config import settings
from .api.routes import upload, jobs, download

app = FastAPI(
    title="Gemini Watermark Remover",
    description="Mathematical alpha unblending remover for Gemini, Veo, Flow and Omni media with batch folder support.",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(upload.router, prefix="/api/v1", tags=["upload"])
app.include_router(jobs.router, prefix="/api/v1", tags=["jobs"])
app.include_router(download.router, prefix="/api/v1", tags=["download"])

root_dir = Path(__file__).resolve().parent.parent.parent
assets_dir = root_dir / "assets"

if assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

@app.get("/", include_in_schema=False)
async def serve_index():
    index_file = root_dir / "index.html"
    if index_file.exists():
        return FileResponse(index_file, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    return {"status": "ok", "message": "Backend API running. Visit /docs for Swagger documentation."}

@app.get("/style.css", include_in_schema=False)
async def serve_css():
    return FileResponse(root_dir / "style.css", media_type="text/css", headers={"Cache-Control": "no-cache, no-store, must-revalidate"})

@app.get("/main.js", include_in_schema=False)
async def serve_js():
    return FileResponse(root_dir / "main.js", media_type="application/javascript", headers={"Cache-Control": "no-cache, no-store, must-revalidate"})

@app.get("/{filename}.html", include_in_schema=False)
async def serve_html_pages(filename: str):
    page = root_dir / f"{filename}.html"
    if page.exists():
        return FileResponse(page)
    return FileResponse(root_dir / "index.html")

@app.get("/health", tags=["system"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.app_name,
        "environment": settings.app_env,
        "jobs_root": str(settings.job_data_root),
    }
