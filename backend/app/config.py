import os
from pathlib import Path
from pydantic import BaseModel, Field

class Settings(BaseModel):
    app_name: str = "Gemini Watermark Remover"
    app_env: str = os.getenv("APP_ENV", "production")
    host: str = os.getenv("HOST", "127.0.0.1")
    port: int = int(os.getenv("PORT", "8000"))

    # Paths
    base_dir: Path = Path(__file__).resolve().parent.parent.parent
    job_data_root: Path = Path(__file__).resolve().parent.parent.parent / "data" / "jobs"

    # Limits
    max_upload_size_mb: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "2048"))
    job_ttl_hours: int = int(os.getenv("JOB_TTL_HOURS", "24"))
    max_concurrent_workers: int = int(os.getenv("MAX_CONCURRENT_WORKERS", "4"))

    # Processing Defaults
    default_gain: float = float(os.getenv("DEFAULT_GAIN", "1.0"))
    video_crf: int = int(os.getenv("VIDEO_CRF", "18"))
    video_preset: str = os.getenv("VIDEO_PRESET", "fast")

settings = Settings()
settings.job_data_root.mkdir(parents=True, exist_ok=True)
