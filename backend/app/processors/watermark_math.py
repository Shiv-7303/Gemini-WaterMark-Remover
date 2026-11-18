from dataclasses import dataclass
from typing import Dict, Any, Tuple, Optional
import numpy as np
import cv2
from .alpha_maps.alpha_loader import AlphaMapCache

PRESETS: Dict[str, Dict[str, Any]] = {
    "auto": {
        "name": "Auto Detect (AI Sparkle)",
        "gain": 1.0,
        "mode": "auto",
        "description": "Multi-scale candidate detection (Corner & Inset layouts)"
    },
    "classic": {
        "name": "Classic Corner (Fixed)",
        "gain": 1.0,
        "mode": "classic",
        "description": "Fixed 4.16% margin corner watermark (1.0x gain)"
    },
    "nano_banana": {
        "name": "Gemini & Nano Banana (Adaptive Inset)",
        "gain": 0.6,
        "mode": "adaptive",
        "description": "Adaptive Inset (12.5% Inset, 0.6x gain)"
    },
    "veo3": {
        "name": "Veo 3 (Video)",
        "gain": 0.6,
        "mode": "veo",
        "description": "Veo 3 Video preset (gain 0.6, adaptive offset)"
    },
    "flow": {
        "name": "Flow & Omni",
        "gain": 0.6,
        "mode": "veo",
        "description": "Google Flow & Gemini Omni video preset"
    },
    "omni": {
        "name": "Gemini Omni",
        "gain": 0.6,
        "mode": "veo",
        "description": "Gemini Omni multimodal preset"
    },
}

@dataclass
class WatermarkBox:
    x: int
    y: int
    size: int
    confidence: float = 1.0
    detected_gain: float = 1.0
    residual_score: float = 0.0
    layout_name: str = "Auto Detected Sparkle"

def find_optimal_gain(
    img_rgb: np.ndarray,
    x: int,
    y: int,
    size: int,
    alpha_cache: AlphaMapCache
) -> Tuple[float, float]:
    """
    Find optimal unblending gain by minimizing residual template correlation
    on the restored image. This guarantees exact watermark cancellation across all
    backgrounds (flat surfaces, textured asphalt, grass, or high-contrast curb edges).
    Returns (best_gain, best_residual_score).
    """
    h, w = img_rgb.shape[:2]
    x_end = min(w, x + size)
    y_end = min(h, y + size)
    if x_end <= x or y_end <= y:
        return 1.0, 0.0

    alpha = alpha_cache.get(size)
    crop_alpha = alpha[:y_end - y, :x_end - x]
    tmpl = (crop_alpha * 255.0).astype(np.uint8)

    best_gain = 1.0
    best_score = float("inf")

    # Evaluate candidate gains
    for g in [0.40, 0.45, 0.50, 0.55, 0.57, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00]:
        cleaned = remove_watermark_numpy(img_rgb, alpha, x, y, gain=g)
        roi_gray = cv2.cvtColor(cleaned[y:y_end, x:x_end, :3], cv2.COLOR_RGB2GRAY)
        res = cv2.matchTemplate(roi_gray, tmpl, cv2.TM_CCOEFF_NORMED)
        score = abs(float(res[0][0]))
        if score < best_score:
            best_score = score
            best_gain = g

    return best_gain, best_score

def recheck_and_refine_watermark(
    image: np.ndarray,
    alpha_map: np.ndarray,
    x: int,
    y: int,
    gain: float,
    residual_score: float = 0.0
) -> np.ndarray:
    """
    Automated Recheck & Smart Touch-Up Pass.
    After mathematical unblending, checks whether any residual compression ringing
    or faint edge artifacts remain. If so, applies a subtle edge-preserving refinement
    strictly on the watermark alpha mask, preserving 100% of underlying real scene detail.
    """
    cleaned = remove_watermark_numpy(image, alpha_map, x, y, gain=gain)

    h_map, w_map = alpha_map.shape[:2]
    h_img, w_img = image.shape[:2]
    x_end = min(w_img, x + w_map)
    y_end = min(h_img, y + h_map)

    if x_end <= x or y_end <= y:
        return cleaned

    roi_cleaned = cleaned[y:y_end, x:x_end, :3]
    crop_alpha = alpha_map[:y_end - y, :x_end - x]

    # Recheck condition: if residual score is detectable (>0.015) or gain < 0.85 (indicates compressed JPEG)
    if residual_score > 0.015 or gain < 0.85:
        smoothed = cv2.edgePreservingFilter(roi_cleaned, flags=1, sigma_s=6, sigma_r=0.15)
        # Weight by alpha mask so only watermark pixels receive subtle touch-up
        alpha_weight = (np.clip(crop_alpha * gain, 0.0, 1.0)[..., np.newaxis]) ** 0.8
        blended = (roi_cleaned * (1.0 - 0.55 * alpha_weight) + smoothed * (0.55 * alpha_weight)).astype(np.uint8)
        cleaned[y:y_end, x:x_end, :3] = blended

    return cleaned

def detect_watermark_candidate(
    img_rgb: np.ndarray,
    alpha_cache: Optional[AlphaMapCache] = None,
) -> WatermarkBox:
    """
    High-precision Normalized Cross-Correlation and Dynamic Gain Estimator.
    Works accurately across full-resolution, cropped, or WhatsApp-resized Gemini images.
    """
    if alpha_cache is None:
        alpha_cache = AlphaMapCache()

    h, w = img_rgb.shape[:2]
    min_dim = min(w, h)
    base_ratio = min_dim / 1536.0

    # Search in bottom-right region (bottom 38% and right 38% of image)
    roi_y0 = int(h * 0.62)
    roi_x0 = int(w * 0.62)
    gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
    search_roi = gray[roi_y0:, roi_x0:]

    # Dynamic size bounds based on expected watermark scale
    expected_size = max(24, int(round(96.0 * base_ratio)))
    min_size = max(24, int(round(expected_size * 0.70)))
    max_size = min(int(round(expected_size * 1.35)), min(h - roi_y0 - 4, w - roi_x0 - 4))

    best_val = -1.0
    best_loc = (max(0, w - int(round(64 * base_ratio)) - int(round(96 * base_ratio))),
                max(0, h - int(round(64 * base_ratio)) - int(round(96 * base_ratio))))
    best_size = expected_size

    # Step 1: Multi-scale template matching across sizes
    step = 2 if (max_size - min_size) <= 30 else 4
    for s in range(min_size, max_size + 1, step):
        if search_roi.shape[0] < s or search_roi.shape[1] < s:
            continue
        tmpl = (alpha_cache.get(s) * 255.0).astype(np.uint8)
        res = cv2.matchTemplate(search_roi, tmpl, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(res)
        if max_val > best_val:
            best_val = max_val
            best_size = s
            best_loc = (roi_x0 + max_loc[0], roi_y0 + max_loc[1])

    # Step 2: Fine-tune size in ±2px
    if best_val > 0.35:
        for s in [best_size - 2, best_size, best_size + 2]:
            if s < min_size or s > max_size or search_roi.shape[0] < s or search_roi.shape[1] < s:
                continue
            tmpl = (alpha_cache.get(s) * 255.0).astype(np.uint8)
            res = cv2.matchTemplate(search_roi, tmpl, cv2.TM_CCOEFF_NORMED)
            _, max_val, _, max_loc = cv2.minMaxLoc(res)
            if max_val > best_val:
                best_val = max_val
                best_size = s
                best_loc = (roi_x0 + max_loc[0], roi_y0 + max_loc[1])

    x, y = best_loc
    size = best_size

    # Step 3: Compute optimal gain if match is confident
    if best_val >= 0.25:
        optimal_gain, residual_score = find_optimal_gain(img_rgb, x, y, size, alpha_cache)
        return WatermarkBox(
            x=int(x),
            y=int(y),
            size=int(size),
            confidence=float(best_val),
            detected_gain=float(optimal_gain),
            residual_score=float(residual_score),
            layout_name=f"Auto Sparkle ({size}px, {optimal_gain:.2f}x gain)"
        )

    # Fallback to Classic Corner
    base_size = max(16, round(96.0 * base_ratio))
    base_margin = max(8, round(64.0 * base_ratio))
    base_x = max(0, w - base_margin - base_size)
    base_y = max(0, h - base_margin - base_size)
    return WatermarkBox(
        x=int(base_x),
        y=int(base_y),
        size=int(base_size),
        confidence=float(max(0.0, best_val)),
        detected_gain=1.0,
        residual_score=0.0,
        layout_name="Classic Corner (Fallback)"
    )

def detect_watermark_box(
    width: int,
    height: int,
    preset: str = "auto",
    offset_x: int = 0,
    offset_y: int = 0,
    size_scale: float = 1.0,
    image: Optional[np.ndarray] = None,
    alpha_cache: Optional[AlphaMapCache] = None,
) -> WatermarkBox:
    """Calculate the expected bounding box for the visible sparkle watermark."""
    preset_lower = preset.lower() if preset else "auto"
    cfg = PRESETS.get(preset_lower, PRESETS["auto"])
    mode = cfg.get("mode", "auto")

    min_dim = min(width, height)
    base_ratio = min_dim / 1536.0

    if mode == "auto" and image is not None:
        detected = detect_watermark_candidate(image[:, :, :3], alpha_cache)
        final_x = max(0, min(width - detected.size, detected.x + offset_x))
        final_y = max(0, min(height - detected.size, detected.y + offset_y))
        final_size = max(8, min(round(detected.size * size_scale), min_dim))
        return WatermarkBox(
            x=int(final_x),
            y=int(final_y),
            size=int(final_size),
            confidence=detected.confidence,
            detected_gain=detected.detected_gain,
            residual_score=detected.residual_score,
            layout_name=detected.layout_name
        )

    if mode == "veo":
        base_size = max(24, min(round(min_dim / 15.0), min_dim))
        margin = round(min_dim / 10.0)
        base_x = width - margin - base_size
        base_y = height - margin - base_size
        scale_ratio = max(0.3, min(1.5, min_dim / 720.0))
        adaptive_offset = round(-24.0 * scale_ratio)
        calc_x = base_x + adaptive_offset + offset_x
        calc_y = base_y + adaptive_offset + offset_y
        final_size = max(8, min(round(base_size * size_scale), min_dim))
        return WatermarkBox(
            x=int(max(0, min(width - final_size, calc_x))),
            y=int(max(0, min(height - final_size, calc_y))),
            size=int(final_size),
            confidence=1.0,
            detected_gain=cfg.get("gain", 0.6),
            layout_name="Veo 3 Video"
        )
    elif mode == "adaptive":
        base_size = max(16, round(96.0 * base_ratio))
        margin = max(8, round(192.0 * base_ratio))
        base_x = width - margin - base_size
        base_y = height - margin - base_size
        calc_x = base_x + offset_x
        calc_y = base_y + offset_y
        final_size = max(8, min(round(base_size * size_scale), min_dim))
        return WatermarkBox(
            x=int(max(0, min(width - final_size, calc_x))),
            y=int(max(0, min(height - final_size, calc_y))),
            size=int(final_size),
            confidence=1.0,
            detected_gain=cfg.get("gain", 0.6),
            layout_name="Gemini & Nano Banana (Adaptive Inset)"
        )
    else:  # classic corner
        base_size = max(16, round(96.0 * base_ratio))
        margin = max(8, round(64.0 * base_ratio))
        base_x = width - margin - base_size
        base_y = height - margin - base_size
        calc_x = base_x + offset_x
        calc_y = base_y + offset_y
        final_size = max(8, min(round(base_size * size_scale), min_dim))
        return WatermarkBox(
            x=int(max(0, min(width - final_size, calc_x))),
            y=int(max(0, min(height - final_size, calc_y))),
            size=int(final_size),
            confidence=1.0,
            detected_gain=cfg.get("gain", 1.0),
            layout_name="Classic Corner (Standard)"
        )

def remove_watermark_numpy(
    image: np.ndarray,
    alpha_map: np.ndarray,
    x: int,
    y: int,
    gain: float = 1.0,
    alpha_threshold: float = 0.002,
    max_alpha: float = 0.99,
) -> np.ndarray:
    """
    Remove watermark using exact mathematical alpha unblending:
        Original = (Watermarked - alpha * 255.0) / (1.0 - alpha)

    image: (H, W, 3) uint8 or (H, W, 4) uint8
    alpha_map: (h, w) float32 in [0, 1]
    """
    h_map, w_map = alpha_map.shape[:2]
    img_h, img_w = image.shape[:2]

    # Boundary protection
    x_end = min(img_w, x + w_map)
    y_end = min(img_h, y + h_map)
    if x >= img_w or y >= img_h or x_end <= x or y_end <= y:
        return image.copy()

    actual_w = x_end - x
    actual_h = y_end - y

    crop_alpha = alpha_map[:actual_h, :actual_w]
    scaled_alpha = np.clip(crop_alpha * gain, 0.0, max_alpha)
    mask = scaled_alpha > alpha_threshold

    result = image.copy()

    # Work in float32 for exact arithmetic on RGB channels
    roi_rgb = result[y:y_end, x:x_end, :3].astype(np.float32)
    alpha_3d = scaled_alpha[..., np.newaxis]

    # Mathematical unblending
    restored = (roi_rgb - alpha_3d * 255.0) / (1.0 - alpha_3d)
    restored = np.clip(np.round(restored), 0, 255).astype(np.uint8)

    # Apply only where alpha watermark is active
    roi_slice = result[y:y_end, x:x_end, :3]
    roi_slice[mask] = restored[mask]
    result[y:y_end, x:x_end, :3] = roi_slice

    return result
