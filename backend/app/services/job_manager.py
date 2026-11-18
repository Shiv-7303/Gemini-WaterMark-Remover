import asyncio
import os
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Callable, AsyncIterator, Tuple
import threading

from ..config import settings
from ..models.job import Job, JobStatus, FileTask, FileStatus, MediaType, JobProgress
from ..processors.alpha_maps.alpha_loader import AlphaMapCache
from ..processors.image_processor import ImageProcessor, IMAGE_EXTENSIONS
from ..processors.video_processor import VideoProcessor, VIDEO_EXTENSIONS
from .storage import storage_service
from .zip_handler import zip_handler

class JobManager:
    def __init__(self):
        self._jobs: Dict[str, Job] = {}
        self._lock = threading.Lock()
        self._listeners: Dict[str, List[asyncio.Queue]] = {}
        self._alpha_cache = AlphaMapCache()
        self._executor = ThreadPoolExecutor(max_workers=settings.max_concurrent_workers)

    def get_job(self, job_id: str) -> Optional[Job]:
        with self._lock:
            return self._jobs.get(job_id)

    def create_job(
        self,
        preset: str = "auto",
        gain: Optional[float] = None,
        offset_x: int = 0,
        offset_y: int = 0,
        size_scale: float = 1.0,
    ) -> Job:
        job_id = str(uuid.uuid4())
        job = Job(
            job_id=job_id,
            status=JobStatus.PENDING,
            preset=preset,
            gain=gain,
            offset_x=offset_x,
            offset_y=offset_y,
            size_scale=size_scale,
            created_at=datetime.utcnow(),
        )
        storage_service.create_job_dirs(job_id)
        with self._lock:
            self._jobs[job_id] = job
        return job

    def start_job(self, job_id: str) -> None:
        """Schedule job processing in background thread pool."""
        self._executor.submit(self._run_job_pipeline, job_id)

    def _broadcast_job_update(self, job: Job) -> None:
        """Notify any SSE listeners of job state change."""
        queues = self._listeners.get(job.job_id, [])
        if not queues:
            return
        payload = job.model_dump_json()
        for q in list(queues):
            try:
                q.put_nowait(payload)
            except Exception:
                pass

    def register_listener(self, job_id: str, queue: asyncio.Queue) -> None:
        if job_id not in self._listeners:
            self._listeners[job_id] = []
        self._listeners[job_id].append(queue)

    def unregister_listener(self, job_id: str, queue: asyncio.Queue) -> None:
        if job_id in self._listeners and queue in self._listeners[job_id]:
            self._listeners[job_id].remove(queue)

    def _run_job_pipeline(self, job_id: str) -> None:
        job = self.get_job(job_id)
        if not job:
            return

        try:
            # 1. Enumerate input media files
            input_dir = storage_service.get_input_dir(job_id)
            output_dir = storage_service.get_output_dir(job_id)

            media_files: List[Tuple[Path, MediaType]] = []
            for root, _, files in os.walk(input_dir):
                for f in sorted(files):
                    p = Path(root) / f
                    ext = p.suffix.lower()
                    if ext in IMAGE_EXTENSIONS:
                        media_files.append((p, MediaType.IMAGE))
                    elif ext in VIDEO_EXTENSIONS:
                        media_files.append((p, MediaType.VIDEO))

            if not media_files:
                with self._lock:
                    job.status = JobStatus.FAILED
                    job.error_message = "No valid image or video files detected in upload."
                    self._broadcast_job_update(job)
                return

            # 2. Build file tasks
            file_tasks: List[FileTask] = []
            for path, media_type in media_files:
                rel_path = str(path.relative_to(input_dir)).replace("\\", "/")
                task = FileTask(
                    id=str(uuid.uuid4())[:8],
                    original_filename=path.name,
                    media_type=media_type,
                    status=FileStatus.PENDING,
                    input_rel_path=rel_path,
                )
                file_tasks.append(task)

            with self._lock:
                job.files = file_tasks
                job.status = JobStatus.PROCESSING
                self._update_progress_locked(job)
                self._broadcast_job_update(job)

            # 3. Instantiate processors
            img_processor = ImageProcessor(
                alpha_cache=self._alpha_cache,
                gain=job.gain,
                offset_x=job.offset_x,
                offset_y=job.offset_y,
                size_scale=job.size_scale,
                preset=job.preset,
            )
            vid_processor = VideoProcessor(
                alpha_cache=self._alpha_cache,
                gain=job.gain,
                offset_x=job.offset_x,
                offset_y=job.offset_y,
                size_scale=job.size_scale,
                preset=job.preset,
                crf=settings.video_crf,
                ffmpeg_preset=settings.video_preset,
            )

            # 4. Process each media file sequentially or bounded
            for task in file_tasks:
                if job.status == JobStatus.CANCELLED:
                    break

                in_path = input_dir / task.input_rel_path
                out_path = output_dir / task.input_rel_path
                out_path.parent.mkdir(parents=True, exist_ok=True)

                with self._lock:
                    task.status = FileStatus.PROCESSING
                    task.progress_pct = 5.0
                    task.status_text = "Starting"
                    self._update_progress_locked(job)
                    self._broadcast_job_update(job)

                start_t = time.time()
                try:
                    def make_progress_cb(t: FileTask):
                        def cb(pct: float, text: str):
                            with self._lock:
                                t.progress_pct = pct
                                t.status_text = text
                                self._update_progress_locked(job)
                                self._broadcast_job_update(job)
                        return cb

                    cb = make_progress_cb(task)

                    if task.media_type == MediaType.IMAGE:
                        final_out = img_processor.process(in_path, out_path, progress_cb=cb)
                    else:
                        final_out = vid_processor.process(in_path, out_path, progress_cb=cb)

                    task_duration = int((time.time() - start_t) * 1000)
                    with self._lock:
                        task.status = FileStatus.COMPLETED
                        task.progress_pct = 100.0
                        task.status_text = "Completed"
                        task.output_rel_path = str(final_out.relative_to(output_dir)).replace("\\", "/")
                        task.processing_time_ms = task_duration
                        self._update_progress_locked(job)
                        self._broadcast_job_update(job)

                except Exception as ex:
                    task_duration = int((time.time() - start_t) * 1000)
                    with self._lock:
                        task.status = FileStatus.FAILED
                        task.status_text = "Failed"
                        task.error_message = str(ex)
                        task.processing_time_ms = task_duration
                        self._update_progress_locked(job)
                        self._broadcast_job_update(job)

            # 5. Packaging final ZIP
            with self._lock:
                job.status = JobStatus.PACKAGING
                self._broadcast_job_update(job)

            zip_file = storage_service.get_zip_path(job_id)
            zip_handler.create_zip(output_dir, zip_file)

            with self._lock:
                job.completed_at = datetime.utcnow()
                job.download_url = f"/api/v1/jobs/{job_id}/download"
                if job.progress.completed > 0:
                    job.status = JobStatus.COMPLETED
                else:
                    job.status = JobStatus.FAILED
                    job.error_message = "All files failed to process."
                self._update_progress_locked(job)
                self._broadcast_job_update(job)

        except Exception as e:
            with self._lock:
                job.status = JobStatus.FAILED
                job.error_message = f"Job encountered critical error: {str(e)}"
                self._broadcast_job_update(job)

    def _update_progress_locked(self, job: Job) -> None:
        total = len(job.files)
        completed = sum(1 for f in job.files if f.status == FileStatus.COMPLETED)
        failed = sum(1 for f in job.files if f.status == FileStatus.FAILED)
        processing = sum(1 for f in job.files if f.status == FileStatus.PROCESSING)
        pending = sum(1 for f in job.files if f.status == FileStatus.PENDING)

        # Weighted progress calculation
        sub_progress = sum(f.progress_pct for f in job.files)
        pct = round(sub_progress / total, 1) if total > 0 else 0.0

        job.progress = JobProgress(
            total=total,
            completed=completed,
            failed=failed,
            processing=processing,
            pending=pending,
            percent=pct,
        )

job_manager = JobManager()
