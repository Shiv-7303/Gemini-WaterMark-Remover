from dataclasses import dataclass
from typing import Dict, Any, Tuple, Optional
import numpy as np
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
    layout_name: str = "Classic Corner"

def detect_watermark_candidate(
    img_rgb: np.ndarray,
    alpha_cache: Optional[AlphaMapCache] = None,
) -> WatermarkBox:
    """
    Advanced Multi-Scale, Gradient & Dual-Polarity Auto-Detection System.
    Identifies exact watermark box, scale, layout family and alpha gain.
    """
    if alpha_cache is None:
        alpha_cache = AlphaMapCache()

    h, w = img_rgb.shape[:2]
    min_dim = min(w, h)
    base_ratio = min_dim / 1536.0
    base_size = max(16, round(96.0 * base_ratio))
    base_margin = max(8, round(64.0 * base_ratio))
    base_x = max(0, w - base_margin - base_size)
    base_y = max(0, h - base_margin - base_size)

    # Candidate Layout Families with Bayesian Priors (matching main.js)
    layouts = [
        {
            "name": "Classic Corner (Adaptive)",
            "base_size": base_size,
            "calc_pos": lambda s: (max(0, w - max(8, round(64 * base_ratio)) - s),
                                   max(0, h - max(8, round(64 * base_ratio)) - s)),
            "gain": 1.0,
            "prior": 1.04
        },
        {
            "name": "Gemini & Nano Banana (Adaptive Inset)",
            "base_size": base_size,
            "calc_pos": lambda s: (max(0, w - max(8, round(192 * base_ratio)) - s),
                                   max(0, h - max(8, round(192 * base_ratio)) - s)),
            "gain": 0.6,
            "prior": 1.08
        },
        {
            "name": "Fixed 96px Classic Corner",
            "base_size": 96,
            "calc_pos": lambda s: (max(0, w - (64 if min_dim >= 1024 else 32) - s),
                                   max(0, h - (64 if min_dim >= 1024 else 32) - s)),
            "gain": 1.0,
            "prior": 1.01
        },
        {
            "name": "Gemini & Nano Banana (Fixed 96px Inset)",
            "base_size": 96,
            "calc_pos": lambda s: (max(0, w - (192 if min_dim >= 1400 else round(128 * max(0.5, min_dim / 1024))) - s),
                                   max(0, h - (192 if min_dim >= 1400 else round(128 * max(0.5, min_dim / 1024))) - s)),
            "gain": 0.6,
            "prior": 1.02
        }
    ]

    scale_pyramid = [0.55, 0.70, 0.85, 1.00, 1.15, 1.30, 1.50, 1.70]

    best_match = None
    best_score = -1.0

    def eval_match(x: int, y: int, size: int) -> float:
        if x < 0 or y < 0 or x + size > w or y + size > h or size < 16:
            return -1.0
        alpha = alpha_cache.get(size)
        crop = img_rgb[y:y+size, x:x+size]

        step = 2 if size > 80 else 1
        c_sub = crop[::step, ::step].astype(np.float32)
        a_sub = alpha[::step, ::step]

        lum = 0.299 * c_sub[:, :, 0] + 0.587 * c_sub[:, :, 1] + 0.114 * c_sub[:, :, 2]
        mean_l = float(np.mean(lum))
        mean_a = float(np.mean(a_sub))
        var_l = float(np.var(lum))
        var_a = float(np.var(a_sub))

        if var_a <= 0.0001:
            return 0.0

        ncc_white = 0.0
        if var_l > 0.5:
            cov_la = float(np.mean(lum * a_sub)) - mean_l * mean_a
            ncc_white = cov_la / np.sqrt(var_l * var_a)

        ncc_dark = 0.0
        if var_l > 0.5 and mean_l > 160:
            inv_lum = 255.0 - lum
            mean_inv = 255.0 - mean_l
            cov_inv = float(np.mean(inv_lum * a_sub)) - mean_inv * mean_a
            ncc_dark = cov_inv / np.sqrt(var_l * var_a)

        ncc_lum = max(ncc_white, ncc_dark)

        # High-frequency gradient cross correlation
        gx = np.zeros_like(lum)
        gy = np.zeros_like(lum)
        gx[:, 1:-1] = lum[:, 2:] - lum[:, :-2]
        gy[1:-1, :] = lum[2:, :] - lum[:-2, :]
        img_grad = np.sqrt(gx**2 + gy**2)

        agx = np.zeros_like(a_sub)
        agy = np.zeros_like(a_sub)
        agx[:, 1:-1] = a_sub[:, 2:] - a_sub[:, :-2]
        agy[1:-1, :] = a_sub[2:, :] - a_sub[:-2, :]
        a_grad = np.sqrt(agx**2 + agy**2)

        mean_g = float(np.mean(img_grad))
        mean_ga = float(np.mean(a_grad))
        var_g = float(np.var(img_grad))
        var_ga = float(np.var(a_grad))

        ncc_grad = 0.0
        if var_g > 0.5 and var_ga > 0.0001:
            cov_gga = float(np.mean(img_grad * a_grad)) - mean_g * mean_ga
            ncc_grad = max(0.0, float(cov_gga / np.sqrt(var_g * var_ga)))

        fused = (ncc_lum * 0.65) + (ncc_grad * 0.35)
        if var_l < 20:
            fused = max(fused, (ncc_lum * 0.40) + (ncc_grad * 0.60))

        return max(0.0, float(fused))

    for layout in layouts:
        for scale in scale_pyramid:
            s = max(16, min(round(layout["base_size"] * scale), min_dim - 8))
            pos_x, pos_y = layout["calc_pos"](s)
            sc = eval_match(pos_x, pos_y, s)
            weighted = sc * layout["prior"]
            if weighted > best_score:
                best_score = weighted
                best_match = {
                    "layout": layout,
                    "size": s,
                    "x": pos_x,
                    "y": pos_y,
                    "score": weighted,
                    "gain": layout["gain"]
                }

    # Refinement: Joint 2D Position (±16px) and Scale fine-tuning (±10%)
    if best_match and best_match["score"] > 0.05:
        ref_x = best_match["x"]
        ref_y = best_match["y"]
        ref_size = best_match["size"]
        ref_score = best_match["score"]

        fine_sizes = list(set([
            max(16, round(best_match["size"] * 0.90)),
            max(16, round(best_match["size"] * 0.95)),
            best_match["size"],
            min(min_dim - 8, round(best_match["size"] * 1.05)),
            min(min_dim - 8, round(best_match["size"] * 1.10))
        ]))

        for ts in fine_sizes:
            for dy in range(-16, 17, 4):
                for dx in range(-16, 17, 4):
                    tx = max(0, min(w - ts, best_match["x"] + dx))
                    ty = max(0, min(h - ts, best_match["y"] + dy))
                    sc = eval_match(tx, ty, ts) * best_match["layout"]["prior"]
                    if sc > ref_score:
                        ref_score = sc
                        ref_x = tx
                        ref_y = ty
                        ref_size = ts

        match_found = ref_score >= 0.10
        return WatermarkBox(
            x=int(ref_x),
            y=int(ref_y),
            size=int(ref_size),
            confidence=float(ref_score),
            detected_gain=float(best_match["gain"]),
            layout_name=str(best_match["layout"]["name"])
        )

    # Fallback to Classic Corner
    return WatermarkBox(
        x=int(base_x),
        y=int(base_y),
        size=int(base_size),
        confidence=float(max(0.0, best_score)),
        detected_gain=1.0,
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
