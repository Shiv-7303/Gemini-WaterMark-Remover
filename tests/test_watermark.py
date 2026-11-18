import sys
from pathlib import Path
import numpy as np
from PIL import Image

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root_dir))

from backend.app.processors.alpha_maps.alpha_loader import AlphaMapCache
from backend.app.processors.watermark_math import (
    detect_watermark_box,
    remove_watermark_numpy,
    PRESETS,
)
from backend.app.processors.image_processor import ImageProcessor

def test_alpha_cache():
    cache = AlphaMapCache()
    m96 = cache.get(96)
    assert m96.shape == (96, 96), f"Expected (96, 96), got {m96.shape}"
    assert m96.dtype == np.float32

    m48 = cache.get(48)
    assert m48.shape == (48, 48), f"Expected (48, 48), got {m48.shape}"

    m128 = cache.get(128)
    assert m128.shape == (128, 128), f"Expected (128, 128), got {m128.shape}"
    print("✓ test_alpha_cache passed")

def test_box_detection():
    # 2048x2048 image with Classic Corner preset
    box_classic = detect_watermark_box(2048, 2048, preset="classic")
    assert box_classic.size == 128, f"Expected size 128, got {box_classic.size}"
    assert box_classic.x == 1835, f"Expected x 1835, got {box_classic.x}"
    assert box_classic.y == 1835, f"Expected y 1835, got {box_classic.y}"

    # 2048x2048 image with Nano Banana Adaptive Inset
    box_nano = detect_watermark_box(2048, 2048, preset="nano_banana")
    assert box_nano.size == 128, f"Expected size 128, got {box_nano.size}"
    assert box_nano.x == 1664, f"Expected x 1664, got {box_nano.x}"
    assert box_nano.y == 1664, f"Expected y 1664, got {box_nano.y}"

    # 2048x2048 image with Auto fallback
    box_auto = detect_watermark_box(2048, 2048, preset="auto")
    assert box_auto.size == 128, f"Expected size 128, got {box_auto.size}"
    assert box_auto.x == 1835, f"Expected x 1835, got {box_auto.x}"
    print("✓ test_box_detection passed")

def test_unblending_math_zero_loss_outside_box():
    # Create synthetic 200x200 image
    orig_img = np.random.randint(50, 200, size=(200, 200, 3), dtype=np.uint8)
    cache = AlphaMapCache()
    alpha_map = cache.get(32)

    # Blend a synthetic watermark at x=100, y=100
    blended = orig_img.copy()
    h, w = alpha_map.shape
    roi = blended[100:100+h, 100:100+w].astype(np.float32)
    a = alpha_map[..., np.newaxis]
    blended_roi = np.clip(np.round(roi * (1.0 - a) + 255.0 * a), 0, 255).astype(np.uint8)
    blended[100:100+h, 100:100+w] = blended_roi

    # Recover using unblending
    recovered = remove_watermark_numpy(blended, alpha_map, x=100, y=100, gain=1.0)

    # Assert outside ROI is strictly untouched (0 difference)
    outside_orig = orig_img.copy()
    outside_orig[100:100+h, 100:100+w] = 0
    outside_rec = recovered.copy()
    outside_rec[100:100+h, 100:100+w] = 0
    diff_outside = np.max(np.abs(outside_orig.astype(int) - outside_rec.astype(int)))
    assert diff_outside == 0, f"Pixels outside watermark were modified! Max diff: {diff_outside}"

    # Inside watermark ROI, error should be virtually 0 (small rounding difference <= 1)
    inside_diff = np.max(np.abs(orig_img[100:100+h, 100:100+w].astype(int) - recovered[100:100+h, 100:100+w].astype(int)))
    assert inside_diff <= 1, f"Inside watermark reconstruction error too high: {inside_diff}"
    print("✓ test_unblending_math_zero_loss_outside_box passed (Diff outside: 0, Max reconstruction error: <= 1)")

def test_real_fixture_processing():
    fixture = Path(__file__).resolve().parent / "fixtures" / "before.webp"
    if not fixture.exists():
        print("Skipping real fixture test (before.webp not present)")
        return

    out_path = Path(__file__).resolve().parent / "fixtures" / "cleaned_fixture.png"
    cache = AlphaMapCache()
    processor = ImageProcessor(alpha_cache=cache, preset="auto")
    result_path = processor.process(fixture, out_path)
    assert result_path.exists(), "Processed output file does not exist"
    assert result_path.stat().st_size > 0, "Processed file is empty"
    print(f"✓ test_real_fixture_processing passed, generated {result_path}")

if __name__ == "__main__":
    test_alpha_cache()
    test_box_detection()
    test_unblending_math_zero_loss_outside_box()
    test_real_fixture_processing()
    print("\nALL TESTS PASSED SUCCESSFULLY!")
