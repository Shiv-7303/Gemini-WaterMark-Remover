import io
import sys
import time
import zipfile
from pathlib import Path
from fastapi.testclient import TestClient

root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from backend.app.main import app

client = TestClient(app)

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    print("✓ Health endpoint OK")

def test_presets():
    res = client.get("/api/v1/presets")
    assert res.status_code == 200
    presets = res.json()
    assert "auto" in presets
    assert "nano_banana" in presets
    assert "veo3" in presets
    print("✓ Presets endpoint OK")

def test_batch_zip_pipeline():
    fixtures_dir = Path(__file__).resolve().parent / "fixtures"
    img1 = fixtures_dir / "before.webp"
    if not img1.exists():
        print("Skipping zip pipeline test: before.webp not found")
        return

    # Create in-memory zip containing before.webp
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(img1, arcname="photo1.webp")
        zf.write(img1, arcname="subfolder/photo2.webp")

    zip_buffer.seek(0)

    # Post to /api/v1/jobs
    res = client.post(
        "/api/v1/jobs",
        files={"file": ("test_batch.zip", zip_buffer, "application/zip")},
        data={"preset": "auto", "gain": 1.0}
    )
    assert res.status_code == 201, f"Create job failed: {res.text}"
    job_data = res.json()
    job_id = job_data["job_id"]
    print(f"✓ Job created: {job_id}")

    # Poll status until completed (max 15s)
    max_wait = 15
    start = time.time()
    completed = False
    while time.time() - start < max_wait:
        res = client.get(f"/api/v1/jobs/{job_id}")
        assert res.status_code == 200
        status_info = res.json()
        print(f"  Current status: {status_info['status']} ({status_info['progress']['percent']}%)")
        if status_info["status"] == "COMPLETED":
            completed = True
            break
        elif status_info["status"] == "FAILED":
            raise RuntimeError(f"Job failed: {status_info.get('error_message')}")
        time.sleep(0.5)

    assert completed, "Job did not complete within time limit"

    # Verify download ZIP
    dl_res = client.get(f"/api/v1/jobs/{job_id}/download")
    assert dl_res.status_code == 200
    assert dl_res.headers.get("content-type") == "application/zip"

    # Inspect individual file previews
    files = status_info.get("files", [])
    assert len(files) == 2, f"Expected 2 files, got {len(files)}"
    first_file = files[0]
    file_id = first_file["id"]

    # Test preview cleaned file (inline)
    prev_res = client.get(f"/api/v1/jobs/{job_id}/preview/{file_id}")
    assert prev_res.status_code == 200, f"Preview failed: {prev_res.text}"
    assert "image" in prev_res.headers.get("content-type", "")
    assert "inline" in prev_res.headers.get("content-disposition", "")
    print(f"✓ Preview cleaned file OK: {prev_res.headers.get('content-type')}")

    # Test preview original file (inline)
    orig_res = client.get(f"/api/v1/jobs/{job_id}/original/{file_id}")
    assert orig_res.status_code == 200, f"Original preview failed: {orig_res.text}"
    assert "image" in orig_res.headers.get("content-type", "")
    assert "inline" in orig_res.headers.get("content-disposition", "")
    print(f"✓ Preview original file OK: {orig_res.headers.get('content-type')}")

    # Test preview with download=1 (attachment)
    dl_file_res = client.get(f"/api/v1/jobs/{job_id}/preview/{file_id}?download=1")
    assert dl_file_res.status_code == 200
    assert "attachment" in dl_file_res.headers.get("content-disposition", "")
    print("✓ Individual file download OK")

    # Inspect downloaded zip
    out_zip = zipfile.ZipFile(io.BytesIO(dl_res.content))
    namelist = out_zip.namelist()
    print(f"  Downloaded ZIP entries: {namelist}")
    assert any("photo1" in name for name in namelist)
    assert any("photo2" in name for name in namelist)
    print("✓ Full batch upload -> process -> download pipeline verified!")

if __name__ == "__main__":
    test_health()
    test_presets()
    test_batch_zip_pipeline()
    print("\nALL API INTEGRATION TESTS PASSED!")
