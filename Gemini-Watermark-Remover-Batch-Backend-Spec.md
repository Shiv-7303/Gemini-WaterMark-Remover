# Gemini / Veo / Flow / Omni Watermark Remover — Full Batch Backend System Specification

> **Version:** 1.0.0  
> **Last Updated:** 18 November 2026  
> **Target:** Production-ready batch processing system  
> **Core Technique:** Mathematical Alpha Unblending (Zero Quality Loss)  
> **Goal:** Upload complete folders of images **or** videos → Backend processes every file → Download cleaned folder

---

## Table of Contents

1. [Project Vision & Requirements](#1-project-vision--requirements)
2. [Core Technique Deep Dive](#2-core-technique-deep-dive)
3. [System Architecture Overview](#3-system-architecture-overview)
4. [Recommended Tech Stack](#4-recommended-tech-stack)
5. [Project Folder Structure](#5-project-folder-structure)
6. [Backend Design — Detailed](#6-backend-design--detailed)
7. [Image Processing Pipeline](#7-image-processing-pipeline)
8. [Video Processing Pipeline](#8-video-processing-pipeline)
9. [Alpha Map Generation & Caching](#9-alpha-map-generation--caching)
10. [Watermark Detection Logic](#10-watermark-detection-logic)
11. [API Design (REST)](#11-api-design-rest)
12. [Frontend Specification](#12-frontend-specification)
13. [Job Queue & Progress Tracking](#13-job-queue--progress-tracking)
14. [File Storage Strategy](#14-file-storage-strategy)
15. [Error Handling & Edge Cases](#15-error-handling--edge-cases)
16. [Performance Optimization](#16-performance-optimization)
17. [Security Considerations](#17-security-considerations)
18. [Deployment Guide](#18-deployment-guide)
19. [Environment Variables](#19-environment-variables)
20. [Database Schema](#20-database-schema)
21. [Code Skeletons — Backend](#21-code-skeletons--backend)
22. [Code Skeletons — Image Processor](#22-code-skeletons--image-processor)
23. [Code Skeletons — Video Processor](#23-code-skeletons--video-processor)
24. [Code Skeletons — Frontend](#24-code-skeletons--frontend)
25. [Testing Strategy](#25-testing-strategy)
26. [Monitoring & Logging](#26-monitoring--logging)
27. [Future Extensions](#27-future-extensions)
28. [Appendix A — Reference Alpha Maps](#appendix-a--reference-alpha-maps)
29. [Appendix B — Model Presets](#appendix-b--model-presets)
30. [Appendix C — Troubleshooting](#appendix-c--troubleshooting)

---

## 1. Project Vision & Requirements

### 1.1 What This System Does

User uploads **one complete folder** containing either:

- Multiple images (PNG / JPG / JPEG / WebP / BMP / TIFF)
- **OR** multiple videos (MP4 / MOV / WebM / MKV)

Backend automatically:

1. Scans the entire folder
2. Detects every valid media file
3. Applies mathematical alpha unblending on each file
4. Preserves original quality (no AI inpainting)
5. Creates a new output folder with all cleaned files
6. Returns a downloadable ZIP of the cleaned folder

### 1.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | Accept ZIP or multi-file folder upload | Must |
| FR-02 | Support batch image processing | Must |
| FR-03 | Support batch video processing | Must |
| FR-04 | Auto-detect watermark size & position | Must |
| FR-05 | Allow manual override (gain, offset, size) | Should |
| FR-06 | Preserve original audio in videos | Must |
| FR-07 | Progress tracking per file + overall | Must |
| FR-08 | Download cleaned folder as ZIP | Must |
| FR-09 | Auto-cleanup of temporary files | Must |
| FR-10 | Concurrent processing with limits | Should |
| FR-11 | Model presets (Nano Banana, Veo 3, Flow, Omni) | Should |
| FR-12 | Support mixed folders (images + videos) | Could |

### 1.3 Non-Functional Requirements

- Zero quality loss on original pixels under watermark
- Client never needs to process anything (pure backend)
- Horizontal scaling possible
- Memory-safe video processing (frame-by-frame, not full load)
- Maximum upload size configurable (default 2 GB)
- Job timeout configurable (default 30 min)

---

## 2. Core Technique Deep Dive

### 2.1 Why Alpha Unblending Works

Google applies the visible sparkle watermark using standard alpha compositing:

```
Watermarked_Pixel = α × Logo_Color + (1 − α) × Original_Pixel
```

Where:

- `α` (alpha) is the transparency of the watermark at that pixel (0.0 – ~0.31)
- `Logo_Color` is almost always pure white (255, 255, 255)
- Original pixels are **never destroyed** — only blended

Because the formula is linear and invertible, we can recover the exact original:

```
Original_Pixel = (Watermarked_Pixel − α × 255) / (1 − α)
```

This is pure arithmetic. No neural network, no hallucination, no blur.

### 2.2 Alpha Map Creation

We capture the watermark on known solid backgrounds (black + white) and solve for α per pixel:

```
α = 1 − (obs_white − obs_black) / (bg_white − bg_black)
```

In practice the open-source community has already extracted high-quality alpha maps:

- 48×48 map (small images / older Gemini)
- 96×96 map (standard modern outputs)
- Scaled versions for different resolutions

These maps are stored as grayscale PNG or Float32 binary files.

### 2.3 Position & Size Rules (Gemini Family)

```python
min_dim = min(width, height)
ratio   = min_dim / 1536.0

size    = max(16, round(96 * ratio))
margin  = max(8,  round(64 * ratio))

x = width  - margin - size
y = height - margin - size
```

This formula works for the majority of Gemini / Veo / Flow outputs.  
User can override with presets or manual sliders.

### 2.4 Limitations

- Only removes the **visible** sparkle logo
- Does **not** remove SynthID (invisible watermark)
- Works best on original, unresized, uncompressed files
- Heavy compression or aggressive resizing can leave faint artifacts

---

## 3. System Architecture Overview

```
┌─────────────────┐
│   Frontend      │  (React / Next.js / Vue)
│  Folder Upload  │
│  Progress UI    │
│  Download ZIP   │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│   API Gateway   │  (FastAPI / NestJS / Express)
│  Auth + Rate    │
│  Limit + Upload │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Job Manager    │  (Redis + BullMQ / Celery)
│  Queue + Status │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│ Image  │ │ Video  │
│ Worker │ │ Worker │
└───┬────┘ └───┬────┘
    │          │
    ▼          ▼
┌─────────────────┐
│  Shared Storage │  (Local / S3 / MinIO)
│  input/ + out/  │
└─────────────────┘
```

### 3.1 High-Level Flow

1. User selects folder → Frontend zips it (or streams files)
2. Backend receives ZIP → extracts to unique job directory
3. Job Manager creates a job record + enqueues tasks
4. Workers pick tasks (one file = one task)
5. Each worker:
   - Loads file
   - Detects watermark parameters
   - Applies unblending
   - Writes cleaned file to output directory
6. When all tasks complete → Backend creates final ZIP
7. Frontend polls status → downloads ZIP when ready
8. Cleanup job removes temporary folders after TTL

---

## 4. Recommended Tech Stack

### 4.1 Backend

| Component | Recommendation | Alternative |
|-----------|----------------|-------------|
| Language | Python 3.11+ | Node.js 20+ |
| Framework | FastAPI | NestJS / Express |
| Queue | Celery + Redis | BullMQ + Redis |
| Image Processing | Pillow + NumPy | Sharp (Node) |
| Video Processing | FFmpeg + OpenCV / PyAV | FFmpeg + fluent-ffmpeg |
| Storage | Local disk + S3-compatible | MinIO |
| Database | PostgreSQL | SQLite (dev) / MongoDB |
| Auth | JWT + API Key | Clerk / Auth0 |

### 4.2 Why Python is Preferred for This Project

- Excellent scientific libraries (NumPy for pixel math)
- Mature FFmpeg bindings
- Easy to write high-performance pixel loops
- Celery is battle-tested for long-running media jobs

### 4.3 Frontend

- Next.js 14+ (App Router) or Vite + React
- Tailwind CSS + shadcn/ui
- React Dropzone or Uppy for folder upload
- Server-Sent Events or WebSocket for live progress

---

## 5. Project Folder Structure

```
gemini-batch-remover/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── upload.py
│   │   │   │   ├── jobs.py
│   │   │   │   └── download.py
│   │   │   └── deps.py
│   │   ├── core/
│   │   │   ├── security.py
│   │   │   └── exceptions.py
│   │   ├── models/
│   │   │   ├── job.py
│   │   │   └── file_task.py
│   │   ├── services/
│   │   │   ├── job_manager.py
│   │   │   ├── storage.py
│   │   │   └── zip_handler.py
│   │   ├── processors/
│   │   │   ├── base.py
│   │   │   ├── image_processor.py
│   │   │   ├── video_processor.py
│   │   │   ├── alpha_maps/
│   │   │   │   ├── bg_48.png
│   │   │   │   ├── bg_96.png
│   │   │   │   └── alpha_loader.py
│   │   │   └── watermark_math.py
│   │   ├── workers/
│   │   │   ├── celery_app.py
│   │   │   └── tasks.py
│   │   └── utils/
│   │       ├── media_utils.py
│   │       └── logging.py
│   ├── tests/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── alembic/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   │   ├── FolderUploader.tsx
│   │   │   ├── JobProgress.tsx
│   │   │   ├── PresetSelector.tsx
│   │   │   └── DownloadButton.tsx
│   │   ├── lib/
│   │   │   └── api.ts
│   │   └── hooks/
│   │       └── useJobStatus.ts
│   ├── package.json
│   └── Dockerfile
├── shared/
│   └── alpha_maps/          # shared binary maps
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 6. Backend Design — Detailed

### 6.1 Job Lifecycle States

```
PENDING → EXTRACTING → QUEUED → PROCESSING → PACKAGING → COMPLETED
                                              ↘ FAILED
                                              ↘ CANCELLED
```

### 6.2 Job Manager Responsibilities

- Create unique job UUID
- Create isolated working directories:
  - `/data/jobs/{job_id}/input/`
  - `/data/jobs/{job_id}/output/`
  - `/data/jobs/{job_id}/temp/`
- Extract uploaded ZIP safely
- Enumerate media files
- Create one FileTask per media file
- Enqueue tasks to Redis
- Aggregate progress
- Trigger packaging when all tasks done
- Schedule cleanup

### 6.3 Worker Types

**ImageWorker**
- Lightweight
- Can run many concurrent instances
- Uses NumPy vectorized operations

**VideoWorker**
- Heavier (FFmpeg + frame decoding)
- Limited concurrency (CPU/GPU bound)
- Processes one video at a time per worker process

### 6.4 Concurrency Strategy

```python
# Suggested limits
MAX_IMAGE_WORKERS = 8
MAX_VIDEO_WORKERS = 2
MAX_CONCURRENT_JOBS_PER_USER = 3
```

Use Celery task routing:

```python
CELERY_TASK_ROUTES = {
    "processors.process_image": {"queue": "images"},
    "processors.process_video": {"queue": "videos"},
}
```

---

## 7. Image Processing Pipeline

### 7.1 Step-by-Step

1. **Load** image with Pillow → convert to RGB NumPy array (`uint8`)
2. **Detect** watermark box using size formula or preset
3. **Load / scale** alpha map to exact watermark size
4. **Apply** reverse alpha blending only inside the ROI
5. **Clip** values to 0–255 and convert back to `uint8`
6. **Save** as PNG (lossless) or original format with high quality

### 7.2 Vectorized Implementation (NumPy)

```python
def remove_watermark_numpy(image: np.ndarray, alpha_map: np.ndarray, 
                           x: int, y: int, gain: float = 1.0) -> np.ndarray:
    """
    image: (H, W, 3) uint8
    alpha_map: (h, w) float32 in [0, 1]
    """
    h, w = alpha_map.shape
    roi = image[y:y+h, x:x+w].astype(np.float32)
    
    alpha = np.clip(alpha_map * gain, 0.0, 0.99)
    alpha = alpha[..., np.newaxis]          # (h, w, 1)
    
    # Only process where alpha is significant
    mask = alpha[..., 0] > 0.002
    
    original = (roi - alpha * 255.0) / (1.0 - alpha)
    original = np.clip(original, 0, 255)
    
    result = image.copy()
    result[y:y+h, x:x+w][mask] = original[mask].astype(np.uint8)
    return result
```

### 7.3 Supported Formats

| Input | Output Recommendation |
|-------|-----------------------|
| PNG | PNG (lossless) |
| JPEG | PNG or high-quality JPEG (q=95) |
| WebP | PNG |
| TIFF | TIFF / PNG |
| BMP | PNG |

Always prefer lossless output for cleaned results.

---

## 8. Video Processing Pipeline

### 8.1 Strategy

Never load entire video into memory.

```
Decode frame → Process frame → Encode frame → Write to output
```

### 8.2 Recommended Tools

**Option A (Recommended): FFmpeg + Python**

- Use `ffmpeg-python` or subprocess
- Decode with rawvideo pipe
- Process frames in Python
- Encode back with libx264

**Option B: PyAV**

- More Pythonic
- Direct access to frames as NumPy

**Option C: MediaBunny style (if Node)**

- WebCodecs equivalent on server is harder; stick to FFmpeg

### 8.3 Frame Processing Loop (Conceptual)

```python
def process_video(input_path: str, output_path: str, params: WatermarkParams):
    # 1. Probe video (width, height, fps, audio codec)
    probe = ffmpeg.probe(input_path)
    
    # 2. Extract audio separately (copy stream)
    # 3. Open video stream as raw frames
    process = (
        ffmpeg
        .input(input_path)
        .output('pipe:', format='rawvideo', pix_fmt='rgb24')
        .run_async(pipe_stdout=True)
    )
    
    # 4. Create output encoder
    out = (
        ffmpeg
        .input('pipe:', format='rawvideo', pix_fmt='rgb24',
               s=f'{width}x{height}', framerate=fps)
        .output(output_path, vcodec='libx264', crf=18, 
                preset='medium', pix_fmt='yuv420p')
        .overwrite_output()
        .run_async(pipe_stdin=True)
    )
    
    # 5. Frame loop
    frame_size = width * height * 3
    while True:
        raw = process.stdout.read(frame_size)
        if not raw:
            break
        frame = np.frombuffer(raw, np.uint8).reshape((height, width, 3))
        cleaned = remove_watermark_numpy(frame, alpha, x, y, gain)
        out.stdin.write(cleaned.tobytes())
    
    # 6. Mux original audio back
    # ffmpeg -i cleaned_video.mp4 -i original.mp4 -c copy -map 0:v -map 1:a final.mp4
```

### 8.4 Audio Preservation

Always extract audio track first and remux at the end:

```bash
ffmpeg -i input.mp4 -vn -acodec copy audio.m4a
# ... process video ...
ffmpeg -i cleaned_video.mp4 -i audio.m4a -c:v copy -c:a copy -shortest output.mp4
```

### 8.5 Memory Safety

- Process at most 1–2 frames in memory at a time
- Use `crf=18` or `crf=20` for near-lossless quality
- Prefer `preset=medium` or `fast` for speed vs quality balance

---

## 9. Alpha Map Generation & Caching

### 9.1 Loading Reference Maps

```python
# alpha_loader.py
from pathlib import Path
import numpy as np
from PIL import Image

class AlphaMapCache:
    def __init__(self, maps_dir: Path):
        self.maps_dir = maps_dir
        self._cache: dict[int, np.ndarray] = {}
    
    def get(self, size: int) -> np.ndarray:
        if size in self._cache:
            return self._cache[size]
        
        # Prefer exact match, otherwise scale from 96
        base = self._load_base(size)
        if base is None:
            base = self._load_base(96)
            base = self._resize_alpha(base, size)
        
        self._cache[size] = base
        return base
    
    def _load_base(self, size: int) -> np.ndarray | None:
        path = self.maps_dir / f"bg_{size}.png"
        if not path.exists():
            return None
        img = Image.open(path).convert("RGB")
        arr = np.array(img, dtype=np.float32)
        # Alpha = max channel / 255
        alpha = np.max(arr, axis=2) / 255.0
        return alpha.astype(np.float32)
    
    def _resize_alpha(self, alpha: np.ndarray, target: int) -> np.ndarray:
        img = Image.fromarray((alpha * 255).astype(np.uint8), mode="L")
        img = img.resize((target, target), Image.Resampling.LANCZOS)
        return np.array(img, dtype=np.float32) / 255.0
```

### 9.2 Where to Get the Maps

Copy the exact `bg_48.png` and `bg_96.png` from the original open-source project:

- https://github.com/ishara-madu/gemini-watermark-remover/tree/main/assets

Or regenerate them yourself by generating pure black and pure white images in Gemini and solving the two-equation system.

---

## 10. Watermark Detection Logic

### 10.1 Automatic Detection

```python
@dataclass
class WatermarkBox:
    x: int
    y: int
    size: int
    confidence: float = 1.0

def detect_watermark_box(width: int, height: int, 
                         preset: str = "auto") -> WatermarkBox:
    if preset == "nano_banana":
        # Specific offsets for Nano Banana
        ...
    elif preset == "veo3":
        ...
    
    # Default Gemini formula
    min_dim = min(width, height)
    ratio = min_dim / 1536.0
    size = max(16, round(96 * ratio))
    margin = max(8, round(64 * ratio))
    
    x = max(0, width - margin - size)
    y = max(0, height - margin - size)
    
    return WatermarkBox(x=x, y=y, size=size)
```

### 10.2 Optional Template Matching (Advanced)

For higher robustness you can run a small correlation search around the predicted location using the alpha map as template. This is optional but useful when the formula is slightly off.

---

## 11. API Design (REST)

### 11.1 Endpoints

#### `POST /api/v1/jobs`

Upload a folder (as ZIP).

**Request:**
- `Content-Type: multipart/form-data`
- `file`: the ZIP file
- `preset` (optional): `auto | nano_banana | veo3 | flow | omni`
- `gain` (optional): float 0.5 – 1.5
- `offset_x`, `offset_y` (optional)

**Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PENDING",
  "created_at": "2026-11-18T10:00:00Z",
  "total_files": 0
}
```

#### `GET /api/v1/jobs/{job_id}`

```json
{
  "job_id": "...",
  "status": "PROCESSING",
  "progress": {
    "total": 42,
    "completed": 17,
    "failed": 1,
    "percent": 40.5
  },
  "files": [
    {
      "filename": "img_001.png",
      "status": "COMPLETED",
      "type": "image"
    },
    ...
  ],
  "download_url": null,
  "error": null
}
```

#### `GET /api/v1/jobs/{job_id}/download`

Returns the final ZIP when status == COMPLETED.

#### `DELETE /api/v1/jobs/{job_id}`

Cancel + cleanup.

### 11.2 Authentication

- Simple API Key header for start: `X-API-Key: ...`
- Later upgrade to JWT if multi-user.

---

## 12. Frontend Specification

### 12.1 Main Screens

1. **Upload Screen**
   - Drag & drop zone that accepts folders or ZIP
   - Preset selector
   - Advanced options (gain, offsets)
   - Upload button

2. **Processing Screen**
   - Overall progress bar
   - Per-file list with status icons
   - Live log (optional)
   - Cancel button

3. **Result Screen**
   - Summary (X images, Y videos cleaned)
   - Big Download ZIP button
   - Option to process another folder

### 12.2 Folder Upload UX

Browsers do not give full folder paths easily. Best approaches:

- Use `<input webkitdirectory directory multiple>`
- Or force user to zip the folder first (simpler & more reliable)
- Or use Uppy / FilePond with directory support

Recommended: **Accept both ZIP and directory selection**.

### 12.3 Progress Updates

Prefer Server-Sent Events:

```
GET /api/v1/jobs/{job_id}/events
```

Frontend listens and updates UI in real time.

---

## 13. Job Queue & Progress Tracking

### 13.1 Celery Task Example

```python
@celery_app.task(bind=True, name="processors.process_image")
def process_image_task(self, job_id: str, file_id: str, input_path: str, 
                       output_path: str, params: dict):
    try:
        update_file_status(file_id, "PROCESSING")
        processor = ImageProcessor(params)
        processor.process(input_path, output_path)
        update_file_status(file_id, "COMPLETED")
        check_job_completion(job_id)
    except Exception as e:
        update_file_status(file_id, "FAILED", error=str(e))
        raise
```

### 13.2 Progress Calculation

```python
def get_job_progress(job_id: str) -> dict:
    files = get_files_for_job(job_id)
    total = len(files)
    completed = sum(1 for f in files if f.status == "COMPLETED")
    failed = sum(1 for f in files if f.status == "FAILED")
    return {
        "total": total,
        "completed": completed,
        "failed": failed,
        "percent": round((completed + failed) / total * 100, 1) if total else 0
    }
```

---

## 14. File Storage Strategy

### 14.1 Directory Layout per Job

```
/data/jobs/
└── 550e8400-e29b-41d4-a716-446655440000/
    ├── input/
    │   ├── photo1.png
    │   ├── photo2.jpg
    │   └── video1.mp4
    ├── output/
    │   ├── photo1.png
    │   ├── photo2.png
    │   └── video1.mp4
    ├── temp/
    │   └── (intermediate files)
    └── result.zip
```

### 14.2 Cleanup Policy

- Keep completed jobs for 24 hours (configurable)
- Failed jobs kept for 6 hours
- Background cron deletes expired job folders
- Use `shutil.rmtree` carefully with path validation

### 14.3 S3 / Object Storage (Optional)

For multi-server deployments:

- Upload ZIP → S3
- Workers download from S3, process, upload cleaned files
- Final ZIP assembled and stored in S3
- Presigned URL returned to client

---

## 15. Error Handling & Edge Cases

| Scenario | Handling |
|----------|----------|
| Corrupted image | Mark file FAILED, continue others |
| Unsupported codec | Mark FAILED with clear message |
| Watermark not found | Still process with default box, log warning |
| Out of memory on video | Kill worker, mark FAILED, free memory |
| Partial ZIP | Reject at upload time |
| Zero media files | Return 400 with message |
| Extremely large video | Enforce max duration / resolution limits |

Always isolate failures per file so one bad file does not kill the whole job.

---

## 16. Performance Optimization

### 16.1 Images

- Use NumPy vectorization (already shown)
- Process multiple images in parallel (ThreadPool or Celery)
- Pre-load and cache all alpha maps in memory

### 16.2 Videos

- Limit concurrent video workers to 1–2 per machine
- Use hardware acceleration if available (`h264_nvenc`, `h264_qsv`)
- Tune FFmpeg preset (`veryfast` for speed, `medium` for quality)
- Consider lower resolution preview first (optional)

### 16.3 System Level

- Use SSD storage for job directories
- Monitor RAM usage; restart workers if memory leaks
- Set `ulimit` appropriately

---

## 17. Security Considerations

1. **Path Traversal Protection**  
   Never trust filenames from ZIP. Sanitize with `os.path.basename` + whitelist.

2. **ZIP Bomb Protection**  
   Check uncompressed size before extraction. Limit max files and max size.

3. **File Type Validation**  
   Use `python-magic` or file signatures, not just extensions.

4. **Resource Limits**  
   - Max upload size
   - Max job duration
   - Max concurrent jobs per IP / API key

5. **No Code Execution**  
   Never evaluate any user content.

6. **Temporary File Permissions**  
   Restrict directory permissions (`0o700`).

---

## 18. Deployment Guide

### 18.1 Docker Compose (Recommended Start)

```yaml
version: "3.9"

services:
  api:
    build: ./backend
    ports:
      - "8000:8000"
    env_file: .env
    volumes:
      - job_data:/data/jobs
    depends_on:
      - redis
      - db

  worker-images:
    build: ./backend
    command: celery -A app.workers.celery_app worker -Q images -c 6
    env_file: .env
    volumes:
      - job_data:/data/jobs
    depends_on:
      - redis

  worker-videos:
    build: ./backend
    command: celery -A app.workers.celery_app worker -Q videos -c 2
    env_file: .env
    volumes:
      - job_data:/data/jobs
    depends_on:
      - redis

  redis:
    image: redis:7-alpine

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000

volumes:
  job_data:
  pgdata:
```

### 18.2 Production Notes

- Put Nginx / Caddy in front
- Use HTTPS
- Enable Redis persistence
- Set up log rotation
- Monitor with Prometheus + Grafana (optional)

---

## 19. Environment Variables

```bash
# .env.example

# App
APP_ENV=production
SECRET_KEY=change-me-to-long-random-string
API_KEY=your-strong-api-key

# Storage
JOB_DATA_ROOT=/data/jobs
MAX_UPLOAD_SIZE_MB=2048
JOB_TTL_HOURS=24

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@db:5432/watermark

# Redis
REDIS_URL=redis://redis:6379/0

# Processing
MAX_IMAGE_WORKERS=8
MAX_VIDEO_WORKERS=2
DEFAULT_GAIN=1.0
VIDEO_CRF=18
VIDEO_PRESET=medium

# Limits
MAX_VIDEO_DURATION_SEC=600
MAX_IMAGE_DIMENSION=8192
```

---

## 20. Database Schema

### jobs

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| status | ENUM | PENDING, EXTRACTING, ... |
| preset | VARCHAR | |
| gain | FLOAT | |
| offset_x | INT | |
| offset_y | INT | |
| total_files | INT | |
| created_at | TIMESTAMP | |
| completed_at | TIMESTAMP | |
| error_message | TEXT | |
| result_zip_path | VARCHAR | |

### file_tasks

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| job_id | UUID | FK |
| original_filename | VARCHAR | |
| media_type | ENUM | image / video |
| status | ENUM | PENDING, PROCESSING, COMPLETED, FAILED |
| error_message | TEXT | |
| input_path | VARCHAR | |
| output_path | VARCHAR | |
| processing_time_ms | INT | |

---

## 21. Code Skeletons — Backend

### 21.1 main.py (FastAPI)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import upload, jobs, download

app = FastAPI(title="Gemini Batch Watermark Remover", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api/v1", tags=["upload"])
app.include_router(jobs.router, prefix="/api/v1", tags=["jobs"])
app.include_router(download.router, prefix="/api/v1", tags=["download"])

@app.get("/health")
def health():
    return {"status": "ok"}
```

### 21.2 config.py

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_env: str = "development"
    secret_key: str
    api_key: str
    job_data_root: str = "/data/jobs"
    max_upload_size_mb: int = 2048
    job_ttl_hours: int = 24
    database_url: str
    redis_url: str = "redis://localhost:6379/0"
    max_image_workers: int = 8
    max_video_workers: int = 2
    default_gain: float = 1.0
    video_crf: int = 18
    video_preset: str = "medium"

    class Config:
        env_file = ".env"

settings = Settings()
```

---

## 22. Code Skeletons — Image Processor

```python
# processors/image_processor.py

from pathlib import Path
import numpy as np
from PIL import Image
from .watermark_math import remove_watermark_numpy, detect_watermark_box
from .alpha_maps.alpha_loader import AlphaMapCache

class ImageProcessor:
    def __init__(self, alpha_cache: AlphaMapCache, gain: float = 1.0,
                 offset_x: int = 0, offset_y: int = 0, preset: str = "auto"):
        self.alpha_cache = alpha_cache
        self.gain = gain
        self.offset_x = offset_x
        self.offset_y = offset_y
        self.preset = preset

    def process(self, input_path: Path, output_path: Path) -> None:
        img = Image.open(input_path).convert("RGB")
        arr = np.array(img, dtype=np.uint8)
        h, w = arr.shape[:2]

        box = detect_watermark_box(w, h, self.preset)
        box.x = max(0, box.x + self.offset_x)
        box.y = max(0, box.y + self.offset_y)

        alpha = self.alpha_cache.get(box.size)

        cleaned = remove_watermark_numpy(
            arr, alpha, box.x, box.y, gain=self.gain
        )

        out_img = Image.fromarray(cleaned, mode="RGB")
        output_path.parent.mkdir(parents=True, exist_ok=True)

        # Always save as PNG for lossless
        if output_path.suffix.lower() not in {".png", ".tif", ".tiff"}:
            output_path = output_path.with_suffix(".png")

        out_img.save(output_path, format="PNG", optimize=True)
```

---

## 23. Code Skeletons — Video Processor

```python
# processors/video_processor.py

import subprocess
import tempfile
from pathlib import Path
import numpy as np
import ffmpeg
from .image_processor import ImageProcessor  # reuse math
from .watermark_math import detect_watermark_box

class VideoProcessor:
    def __init__(self, alpha_cache, gain=1.0, offset_x=0, offset_y=0,
                 preset="auto", crf=18, ffmpeg_preset="medium"):
        self.image_processor = ImageProcessor(
            alpha_cache, gain, offset_x, offset_y, preset
        )
        self.crf = crf
        self.ffmpeg_preset = ffmpeg_preset

    def process(self, input_path: Path, output_path: Path) -> None:
        probe = ffmpeg.probe(str(input_path))
        video_info = next(s for s in probe["streams"] if s["codec_type"] == "video")
        width = int(video_info["width"])
        height = int(video_info["height"])
        fps = eval(video_info["r_frame_rate"])  # careful, better use fractions

        # Detect box once
        box = detect_watermark_box(width, height, self.image_processor.preset)
        box.x = max(0, box.x + self.image_processor.offset_x)
        box.y = max(0, box.y + self.image_processor.offset_y)
        alpha = self.image_processor.alpha_cache.get(box.size)

        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            raw_video = tmp / "cleaned_raw.mp4"
            audio_file = tmp / "audio.m4a"

            # Extract audio
            (
                ffmpeg
                .input(str(input_path))
                .output(str(audio_file), vn=None, acodec="copy")
                .overwrite_output()
                .run(quiet=True)
            )

            # Process frames
            self._process_frames(
                input_path, raw_video, width, height, fps, box, alpha
            )

            # Mux
            output_path.parent.mkdir(parents=True, exist_ok=True)
            (
                ffmpeg
                .input(str(raw_video))
                .input(str(audio_file))
                .output(
                    str(output_path),
                    vcodec="copy",
                    acodec="aac",  # or copy if compatible
                    shortest=None
                )
                .overwrite_output()
                .run(quiet=True)
            )

    def _process_frames(self, input_path, output_path, width, height, fps, box, alpha):
        # Implementation using pipes as shown earlier in section 8
        ...
```

*(Full pipe implementation should follow the pattern in Section 8.3)*

---

## 24. Code Skeletons — Frontend

### 24.1 FolderUploader.tsx (React)

```tsx
"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

interface Props {
  onJobCreated: (jobId: string) => void;
}

export function FolderUploader({ onJobCreated }: Props) {
  const [uploading, setUploading] = useState(false);
  const [preset, setPreset] = useState("auto");

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploading(true);
    const formData = new FormData();

    // If user dropped a folder, browsers give files with webkitRelativePath
    // Easiest reliable way: ask user to zip, or zip on client with JSZip
    const zipBlob = await createZipFromFiles(acceptedFiles);
    formData.append("file", zipBlob, "upload.zip");
    formData.append("preset", preset);

    const res = await fetch("/api/v1/jobs", {
      method: "POST",
      body: formData,
      headers: {
        "X-API-Key": process.env.NEXT_PUBLIC_API_KEY || "",
      },
    });

    const data = await res.json();
    onJobCreated(data.job_id);
    setUploading(false);
  }, [preset, onJobCreated]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    // @ts-ignore
    directory: true,
  });

  return (
    <div {...getRootProps()} className="border-2 border-dashed p-12 rounded-xl">
      <input {...getInputProps()} />
      {isDragActive ? (
        <p>Drop the folder here...</p>
      ) : (
        <p>Drag & drop a folder (or ZIP) of Gemini images/videos</p>
      )}
      {/* Preset selector + Upload button */}
    </div>
  );
}
```

---

## 25. Testing Strategy

### 25.1 Unit Tests

- `test_watermark_math.py` — pure formula correctness
- `test_alpha_loader.py` — map loading & resizing
- `test_detect_box.py` — position formula

### 25.2 Integration Tests

- Upload small ZIP with 3 images → verify output ZIP contains 3 cleaned files
- One corrupted file → job still completes, one file marked FAILED
- Video with audio → audio still present after processing

### 25.3 Sample Test Assets

Create a `tests/fixtures/` folder with:

- Known Gemini image with watermark
- Same image after manual cleaning (ground truth)
- Short Veo video clip

Compare pixel differences only in non-watermark regions (should be zero).

---

## 26. Monitoring & Logging

- Structured JSON logging
- Job ID in every log line
- Metrics:
  - Jobs created / completed / failed per hour
  - Average processing time per image / per video minute
  - Queue length
- Alert on high failure rate or stuck jobs

---

## 27. Future Extensions

1. **GPU Acceleration** — CUDA kernels for the unblending step
2. **Webhook Notifications** — notify when job finishes
3. **User Accounts** — history of past jobs
4. **Batch Presets** — save custom gain/offset combinations
5. **Partial Re-processing** — re-run only failed files
6. **SynthID Detection** — report whether invisible watermark is still present
7. **CLI Tool** — same engine as command-line utility

---

## Appendix A — Reference Alpha Maps

Place these files in `backend/app/processors/alpha_maps/`:

- `bg_48.png` — 48×48 reference
- `bg_96.png` — 96×96 reference

You can extract them from the original repository:

```bash
git clone https://github.com/ishara-madu/gemini-watermark-remover.git
cp gemini-watermark-remover/assets/bg_48.png backend/app/processors/alpha_maps/
cp gemini-watermark-remover/assets/bg_96.png backend/app/processors/alpha_maps/
```

---

## Appendix B — Model Presets

```python
PRESETS = {
    "auto": {
        "gain": 1.0,
        "offset_x": 0,
        "offset_y": 0,
        "size_scale": 1.0,
    },
    "nano_banana": {
        "gain": 1.05,
        "offset_x": 0,
        "offset_y": 0,
        "size_scale": 1.0,
    },
    "veo3": {
        "gain": 0.85,
        "offset_x": -8,
        "offset_y": -8,
        "size_scale": 1.05,
    },
    "flow": {
        "gain": 0.9,
        "offset_x": -4,
        "offset_y": -4,
        "size_scale": 1.0,
    },
    "omni": {
        "gain": 0.95,
        "offset_x": 0,
        "offset_y": 0,
        "size_scale": 1.0,
    },
}
```

Tune these values by testing real outputs from each model.

---

## Appendix C — Troubleshooting

| Problem | Possible Cause | Solution |
|---------|----------------|----------|
| Faint watermark remains | Gain too low / wrong size | Increase gain or adjust size_scale |
| Halo / dark ring | Gain too high | Lower gain to 0.8–0.95 |
| Video has no audio | Remux step failed | Check audio extraction logs |
| Worker OOM | Large video resolution | Add resolution limit or use lower CRF |
| Job stuck in PROCESSING | Worker crashed | Restart workers, check Redis |
| ZIP extraction fails | ZIP bomb or path traversal | Strengthen validation |

---

## Final Implementation Checklist

- [ ] Copy alpha maps (`bg_48.png`, `bg_96.png`)
- [ ] Implement `watermark_math.py` with vectorized NumPy
- [ ] Implement `AlphaMapCache`
- [ ] Implement `ImageProcessor`
- [ ] Implement `VideoProcessor` with FFmpeg pipes
- [ ] Set up FastAPI + Celery + Redis
- [ ] Create upload + job status + download endpoints
- [ ] Build simple frontend with folder/ZIP upload
- [ ] Add progress tracking (SSE or polling)
- [ ] Add cleanup cron
- [ ] Write basic tests
- [ ] Dockerize everything
- [ ] Test with real Gemini images and Veo videos

---

**This document is a complete blueprint.**  
Follow it section by section and you will have a production-capable batch system that:

1. Accepts a full folder (images or videos)
2. Processes every file on the backend using exact mathematical alpha unblending
3. Returns a clean folder (as ZIP) with all watermarks removed

No AI inpainting. Zero quality loss on recoverable pixels. Fully automated.

Good luck building it!
