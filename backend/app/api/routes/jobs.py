import asyncio
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from typing import Dict, Any

from ...models.job import Job, JobStatus
from ...processors.watermark_math import PRESETS
from ...services.job_manager import job_manager
from ...services.storage import storage_service

router = APIRouter()

@router.get("/presets")
def get_presets() -> Dict[str, Any]:
    """Get list of supported models and their default calibration parameters."""
    return PRESETS

@router.get("/jobs/{job_id}", response_model=Job)
def get_job_status(job_id: str) -> Job:
    """Retrieve full status, file breakdown, and progress of a batch job."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found."
        )
    return job

@router.get("/jobs/{job_id}/events")
async def job_events_stream(job_id: str):
    """Server-Sent Events endpoint for real-time progress updates without polling."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found."
        )

    queue = asyncio.Queue()
    job_manager.register_listener(job_id, queue)

    async def event_generator():
        # First send the current state
        yield f"data: {job.model_dump_json()}\n\n"

        try:
            while True:
                # Wait for updates or heartbeat
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=20.0)
                    yield f"data: {payload}\n\n"
                    # If job reached terminal state, stop stream after sending
                    current_job = job_manager.get_job(job_id)
                    if current_job and current_job.status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED):
                        break
                except asyncio.TimeoutError:
                    # Send keep-alive comment
                    yield ": ping\n\n"
        finally:
            job_manager.unregister_listener(job_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

@router.delete("/jobs/{job_id}", status_code=status.HTTP_200_OK)
def cancel_and_delete_job(job_id: str):
    """Cancel job and remove its files from server."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found."
        )
    job.status = JobStatus.CANCELLED
    storage_service.delete_job(job_id)
    return {"message": f"Job {job_id} cancelled and cleaned up."}
