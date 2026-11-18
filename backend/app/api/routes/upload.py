import shutil
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, status
from pydantic import BaseModel

from ...config import settings
from ...models.job import JobStatus
from ...processors.watermark_math import PRESETS
from ...services.job_manager import job_manager
from ...services.storage import storage_service
from ...services.zip_handler import zip_handler

router = APIRouter()

class UploadResponse(BaseModel):
    job_id: str
    status: JobStatus
    message: str

@router.post("/jobs", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def create_and_upload_job(
    file: Optional[UploadFile] = File(None, description="ZIP archive of images or videos"),
    files: Optional[List[UploadFile]] = File(None, description="Multiple image or video files"),
    preset: str = Form("auto"),
    gain: Optional[float] = Form(None),
    offset_x: int = Form(0),
    offset_y: int = Form(0),
    size_scale: float = Form(1.0),
):
    # Validate preset
    preset_key = preset.lower() if preset else "auto"
    if preset_key not in PRESETS:
        preset_key = "auto"

    preset_gain = PRESETS[preset_key]["gain"] if (gain is None or gain <= 0) else gain

    # Check that at least one file was provided
    has_zip = file is not None and file.filename
    has_multi = files is not None and len(files) > 0 and files[0].filename

    if not has_zip and not has_multi:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided. Please upload a ZIP file or select multiple files/folder."
        )

    # 1. Create Job record
    job = job_manager.create_job(
        preset=preset_key,
        gain=preset_gain,
        offset_x=offset_x,
        offset_y=offset_y,
        size_scale=size_scale,
    )
    job_id = job.job_id
    input_dir = storage_service.get_input_dir(job_id)

    # 2. Extract or Save Files
    try:
        if has_zip:
            # Save uploaded ZIP to temp directory
            temp_zip = storage_service.get_temp_dir(job_id) / "upload.zip"
            with open(temp_zip, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            # Unpack zip safely
            job.status = JobStatus.EXTRACTING
            zip_handler.extract_zip_safely(temp_zip, input_dir)
            if temp_zip.exists():
                temp_zip.unlink()

        if has_multi and files:
            for item in files:
                if not item.filename:
                    continue
                # Some browsers send relative paths in filename or headers
                clean_name = Path(item.filename).name
                dest = input_dir / clean_name
                with open(dest, "wb") as buffer:
                    shutil.copyfileobj(item.file, buffer)

    except Exception as e:
        storage_service.delete_job(job_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process uploaded files: {str(e)}"
        )

    # 3. Trigger processing asynchronously
    job_manager.start_job(job_id)

    return UploadResponse(
        job_id=job_id,
        status=JobStatus.QUEUED,
        message="Upload received and queued for batch processing.",
    )
