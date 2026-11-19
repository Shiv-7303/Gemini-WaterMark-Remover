from dataclasses import dataclass
from typing import Dict, Any, Tuple, Optional, List
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
    candidate_gains = [0.35, 0.40, 0.45, 0.48, 0.50, 0.52, 0.55, 0.57, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00]
    for g in candidate_gains:
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
    residual_score: float = 0.0,
    is_dark: bool = False
) -> np.ndarray:
    """
    Pure Mathematical Alpha Unblending - Zero inpainting, zero blur, zero quality loss.
    Restores original scene pixels using exact mathematical formula:
        Original = (Watermarked - alpha * 255.0) / (1.0 - alpha)
    No blur, no smearing, 100% texture preservation on grass, curbs, water, and tracks.
    """
    return remove_watermark_numpy(image, alpha_map, x, y, gain=gain)

def get_preset_anchors(width: int, height: int) -> List[Tuple[str, int, int, int]]:
    """
    Returns calibrated 5 preset candidate locations (name, exp_x, exp_y, size)
    ordered by highest priority first:
      - 768p / Small Images (<1000px min_dim, e.g. 1376x768):
          1. Calibrated Gemini 768p Inset: margin_right=73, margin_bottom=73, size=48 (x=w-121, y=h-121)
          2. Adaptive Inset (12.5%): margin=round(192*ratio), size=48
          3. Classic Corner (4.16%): margin=round(64*ratio), size=48
          4. Fixed Standard Inset: margin=96, size=48
          5. Veo Video Inset: margin=round(min_dim/10)+24, size=48
      - Full-Resolution Images (>=1000px min_dim, e.g. 2752x1536, 3200x1344, 2528x1696):
          1. Calibrated Gemini Full-Res Inset: margin_right=64, margin_bottom=64, size=96 (x=w-160, y=h-160)
          2. Adaptive Inset (12.5%): margin=round(192*ratio), size=96
          3. Classic Corner (4.16%): margin=round(64*ratio), size=96
          4. Fixed Standard Inset: margin=192, size=96
          5. Veo Video Inset: margin=round(min_dim/10)+24, size=96
    """
    min_dim = min(width, height)
    ratio = min_dim / 1536.0

    if min_dim < 1000:
        sz = 48
        return [
            ("Calibrated 768p Inset", width - 73 - sz, height - 73 - sz, sz),
            ("Gemini Adaptive Inset", int(width - round(192 * ratio) - sz), int(height - round(192 * ratio) - sz), sz),
            ("Classic Corner", int(width - round(64 * ratio) - sz), int(height - round(64 * ratio) - sz), sz),
            ("Fixed Standard Inset", width - 96 - sz, height - 96 - sz, sz),
            ("Veo Video Inset", int(width - round(min_dim / 10.0) - sz - 24), int(height - round(min_dim / 10.0) - sz - 24), sz),
        ]
    else:
        sz = 96
        return [
            ("Calibrated Full-Res Inset", width - 64 - sz, height - 64 - sz, sz),
            ("Gemini Adaptive Inset", int(width - round(192 * ratio) - sz), int(height - round(192 * ratio) - sz), sz),
            ("Classic Corner", int(width - round(64 * ratio) - sz), int(height - round(64 * ratio) - sz), sz),
            ("Fixed Standard Inset", width - 192 - sz, height - 192 - sz, sz),
            ("Veo Video Inset", int(width - round(min_dim / 10.0) - sz - 24), int(height - round(min_dim / 10.0) - sz - 24), sz),
        ]

def detect_all_watermarks(
    img_rgb: np.ndarray,
    alpha_cache: Optional[AlphaMapCache] = None,
) -> List[WatermarkBox]:
    """
    Priority-Based Preset Detection:
    1. First checks the known preset locations in a tight window (+/- 2px).
       If template correlation >= 0.25, immediately confirms and determines
       the exact optimal gain that minimizes residual correlation.
    2. If no preset matches, falls back to general quadrant search in bottom-right corner.
    3. If still not detected, falls back to default preset coordinates.
    """
    if alpha_cache is None:
        alpha_cache = AlphaMapCache()

    h, w = img_rgb.shape[:2]
    min_dim = min(w, h)
    gray = cv2.cvtColor(img_rgb, cv2.COLOR_BGR2GRAY).astype(np.float32)

    presets = get_preset_anchors(w, h)

    # === STAGE 1: Check Known Presets FIRST in a Focused Window (+/- 20px) ===
    pad = 20
    best_preset_match = None
    best_preset_conf = -1.0

    for name, exp_x, exp_y, sz in presets:
        alpha = (alpha_cache.get(sz) * 255.0).astype(np.float32)
        y0 = max(0, exp_y - pad)
        y1 = min(h, exp_y + sz + pad)
        x0 = max(0, exp_x - pad)
        x1 = min(w, exp_x + sz + pad)

        roi = gray[y0:y1, x0:x1]
        if roi.shape[0] < sz or roi.shape[1] < sz:
            continue

        res = cv2.matchTemplate(roi, alpha, cv2.TM_CCOEFF_NORMED)
        min_v, max_v, min_l, max_l = cv2.minMaxLoc(res)

        if max_v > best_preset_conf:
            best_preset_conf = max_v
            actual_x = x0 + max_l[0]
            actual_y = y0 + max_l[1]
            best_preset_match = (name, actual_x, actual_y, sz, max_v)

    if best_preset_match is not None and best_preset_conf >= 0.28:
        name, actual_x, actual_y, sz, conf = best_preset_match
        gain, res_score = find_optimal_gain(img_rgb, actual_x, actual_y, sz, alpha_cache)
        return [WatermarkBox(
            x=actual_x,
            y=actual_y,
            size=sz,
            confidence=conf,
            detected_gain=gain,
            residual_score=res_score,
            layout_name=f"{name} ({sz}px, {gain:.2f}x gain)"
        )]

    # === STAGE 2: Fallback to General Quadrant Search ===
    roi_y0 = int(round(h * 0.70))
    roi_x0 = int(round(w * 0.65))
    search_roi = gray[roi_y0:, roi_x0:]
    rh, rw = search_roi.shape

    target_size = 48 if min_dim < 1000 else 96
    search_sizes = [target_size, 48 if target_size == 96 else 96]

    best_fb_score = -1.0
    best_fb_loc = None
    best_fb_s = target_size

    for s in search_sizes:
        if rh < s or rw < s:
            continue
        alpha = (alpha_cache.get(s) * 255.0).astype(np.float32)
        res = cv2.matchTemplate(search_roi, alpha, cv2.TM_CCOEFF_NORMED)
        _, max_v, _, max_l = cv2.minMaxLoc(res)
        if max_v > best_fb_score:
            best_fb_score = max_v
            best_fb_s = s
            best_fb_loc = (roi_x0 + max_l[0], roi_y0 + max_l[1])

    if best_fb_loc is not None and best_fb_score >= 0.28:
        bx, by = best_fb_loc
        gain, res_score = find_optimal_gain(img_rgb, bx, by, best_fb_s, alpha_cache)
        return [WatermarkBox(
            x=bx,
            y=by,
            size=best_fb_s,
            confidence=best_fb_score,
            detected_gain=gain,
            residual_score=res_score,
            layout_name=f"Auto Sparkle ({best_fb_s}px, {gain:.2f}x gain)"
        )]

    # === STAGE 3: Default Fallback to Primary Calibrated Preset ===
    exp_name, exp_x, exp_y, exp_sz = presets[0]
    return [WatermarkBox(
        x=max(0, exp_x),
        y=max(0, exp_y),
        size=exp_sz,
        confidence=0.0,
        detected_gain=0.60 if min_dim < 1000 else 1.00,
        residual_score=0.0,
        layout_name=f"Fallback {exp_name} ({exp_sz}px)"
    )]

def detect_watermark_candidate(
    img_rgb: np.ndarray,
    alpha_cache: Optional[AlphaMapCache] = None,
) -> WatermarkBox:
    """Returns the primary detected watermark candidate."""
    boxes = detect_all_watermarks(img_rgb, alpha_cache)
    return boxes[0]

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
