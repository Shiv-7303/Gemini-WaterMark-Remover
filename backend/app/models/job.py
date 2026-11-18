from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class JobStatus(str, Enum):
    PENDING = "PENDING"
    EXTRACTING = "EXTRACTING"
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    PACKAGING = "PACKAGING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"

class FileStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class MediaType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    OTHER = "other"

class FileTask(BaseModel):
    id: str
    original_filename: str
    media_type: MediaType
    status: FileStatus = FileStatus.PENDING
    error_message: Optional[str] = None
    progress_pct: float = 0.0
    status_text: Optional[str] = None
    input_rel_path: str
    output_rel_path: Optional[str] = None
    processing_time_ms: Optional[int] = None

class JobProgress(BaseModel):
    total: int = 0
    completed: int = 0
    failed: int = 0
    processing: int = 0
    pending: int = 0
    percent: float = 0.0

class Job(BaseModel):
    job_id: str
    status: JobStatus = JobStatus.PENDING
    preset: str = "auto"
    gain: float = 1.0
    offset_x: int = 0
    offset_y: int = 0
    size_scale: float = 1.0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    progress: JobProgress = Field(default_factory=JobProgress)
    files: List[FileTask] = Field(default_factory=list)
    download_url: Optional[str] = None
    error_message: Optional[str] = None
