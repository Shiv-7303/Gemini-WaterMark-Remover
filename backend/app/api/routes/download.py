from fastapi import APIRouter, HTTPException, status, Query
from fastapi.responses import FileResponse
from pathlib import Path

from ...models.job import JobStatus
from ...services.job_manager import job_manager
from ...services.storage import storage_service

router = APIRouter()

def get_media_type(path: Path) -> str:
    ext = path.suffix.lower()
    if ext == ".png":
        return "image/png"
    elif ext in (".jpg", ".jpeg"):
        return "image/jpeg"
    elif ext == ".webp":
        return "image/webp"
    elif ext == ".mp4":
        return "video/mp4"
    elif ext in (".mov", ".qt"):
        return "video/quicktime"
    elif ext == ".webm":
        return "video/webm"
    return "application/octet-stream"

@router.get("/jobs/{job_id}/download")
def download_job_results(job_id: str):
    """Download the batch processed output folder as a single ZIP archive."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found."
        )

    if job.status not in (JobStatus.COMPLETED, JobStatus.PACKAGING):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Job is not yet completed. Current status: {job.status}"
        )

    zip_path = storage_service.get_zip_path(job_id)
    if not zip_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Result archive not found on disk."
        )

    return FileResponse(
        path=str(zip_path),
        filename=f"gemini_watermark_cleaned_{job_id[:8]}.zip",
        media_type="application/zip",
        content_disposition_type="attachment",
    )

@router.get("/jobs/{job_id}/preview/{file_id}")
def preview_cleaned_file(job_id: str, file_id: str, download: bool = Query(False)):
    """View inline or download an individual cleaned image or video."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    task = next((f for f in job.files if f.id == file_id), None)
    if not task or not task.output_rel_path:
        raise HTTPException(status_code=404, detail="File task or output not ready")

    output_dir = storage_service.get_output_dir(job_id)
    file_path = output_dir / task.output_rel_path
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Processed file not found on disk")

    return FileResponse(
        path=str(file_path),
        filename=file_path.name,
        media_type=get_media_type(file_path),
        content_disposition_type="attachment" if download else "inline"
    )

@router.get("/jobs/{job_id}/original/{file_id}")
def preview_original_file(job_id: str, file_id: str):
    """View inline the original uploaded image or video before watermark removal."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    task = next((f for f in job.files if f.id == file_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="File task not found")

    input_dir = storage_service.get_input_dir(job_id)
    file_path = input_dir / task.input_rel_path
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Original file not found on disk")

    return FileResponse(
        path=str(file_path),
        filename=file_path.name,
        media_type=get_media_type(file_path),
        content_disposition_type="inline"
    )
