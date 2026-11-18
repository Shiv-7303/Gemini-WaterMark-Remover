import shutil
import time
from pathlib import Path
from typing import Optional
from ..config import settings

class StorageService:
    def __init__(self, root_dir: Optional[Path] = None):
        self.root_dir = root_dir or settings.job_data_root
        self.root_dir.mkdir(parents=True, exist_ok=True)

    def get_job_dir(self, job_id: str) -> Path:
        return self.root_dir / job_id

    def get_input_dir(self, job_id: str) -> Path:
        return self.get_job_dir(job_id) / "input"

    def get_output_dir(self, job_id: str) -> Path:
        return self.get_job_dir(job_id) / "output"

    def get_temp_dir(self, job_id: str) -> Path:
        return self.get_job_dir(job_id) / "temp"

    def get_zip_path(self, job_id: str) -> Path:
        return self.get_job_dir(job_id) / "result.zip"

    def create_job_dirs(self, job_id: str) -> None:
        self.get_input_dir(job_id).mkdir(parents=True, exist_ok=True)
        self.get_output_dir(job_id).mkdir(parents=True, exist_ok=True)
        self.get_temp_dir(job_id).mkdir(parents=True, exist_ok=True)

    def delete_job(self, job_id: str) -> bool:
        job_dir = self.get_job_dir(job_id)
        if job_dir.exists():
            shutil.rmtree(job_dir, ignore_errors=True)
            return True
        return False

    def cleanup_old_jobs(self, max_age_hours: int = 24) -> int:
        now = time.time()
        max_age_sec = max_age_hours * 3600
        removed = 0
        for item in self.root_dir.iterdir():
            if item.is_dir():
                mtime = item.stat().st_mtime
                if (now - mtime) > max_age_sec:
                    shutil.rmtree(item, ignore_errors=True)
                    removed += 1
        return removed

storage_service = StorageService()
