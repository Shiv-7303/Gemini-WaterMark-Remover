from pathlib import Path
from typing import Callable, Optional
import numpy as np
from PIL import Image, ImageOps

from .base import BaseMediaProcessor
from .alpha_maps.alpha_loader import AlphaMapCache
from .watermark_math import detect_watermark_box, remove_watermark_numpy, PRESETS

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".tif"}

class ImageProcessor(BaseMediaProcessor):
    def __init__(
        self,
        alpha_cache: AlphaMapCache,
        gain: Optional[float] = None,
        offset_x: int = 0,
        offset_y: int = 0,
        size_scale: float = 1.0,
        preset: str = "auto",
        save_as_png: bool = True,
    ):
        self.alpha_cache = alpha_cache
        self.preset = preset.lower() if preset else "auto"
        self.custom_gain = gain if (gain is not None and gain > 0) else None
        self.offset_x = offset_x
        self.offset_y = offset_y
        self.size_scale = size_scale
        self.save_as_png = save_as_png

    def process(
        self,
        input_path: Path,
        output_path: Path,
        progress_cb: Optional[Callable[[float, str], None]] = None
    ) -> Path:
        if progress_cb:
            progress_cb(10.0, "Reading image")

        input_path = Path(input_path)
        output_path = Path(output_path)

        with Image.open(input_path) as img:
            # Handle orientation from EXIF if present
            try:
                img = ImageOps.exif_transpose(img)
            except Exception:
                pass

            # Ensure image is in RGB or RGBA mode
            orig_mode = img.mode
            if orig_mode not in ("RGB", "RGBA"):
                img = img.convert("RGBA" if "transparency" in img.info or orig_mode in ("LA", "P", "PA") else "RGB")

            img_arr = np.array(img)
            h, w = img_arr.shape[:2]

            if progress_cb:
                progress_cb(30.0, f"Watermark detection ({w}x{h})")

            box = detect_watermark_box(
                width=w,
                height=h,
                preset=self.preset,
                offset_x=self.offset_x,
                offset_y=self.offset_y,
                size_scale=self.size_scale,
                image=img_arr[:, :, :3],
                alpha_cache=self.alpha_cache,
            )

            effective_gain = self.custom_gain if self.custom_gain is not None else box.detected_gain

            if progress_cb:
                progress_cb(50.0, f"Alpha unblending ({box.layout_name} at x={box.x}, y={box.y}, size={box.size})")

            alpha = self.alpha_cache.get(box.size)

            cleaned_arr = remove_watermark_numpy(
                image=img_arr,
                alpha_map=alpha,
                x=box.x,
                y=box.y,
                gain=effective_gain,
            )

            if progress_cb:
                progress_cb(80.0, "Saving output file")

            cleaned_img = Image.fromarray(cleaned_arr, mode=img.mode)
            output_path.parent.mkdir(parents=True, exist_ok=True)

            # Target format
            final_output_path = output_path
            if self.save_as_png and output_path.suffix.lower() not in {".png", ".tif", ".tiff"}:
                final_output_path = output_path.with_suffix(".png")

            fmt = "PNG" if final_output_path.suffix.lower() == ".png" else None
            save_kwargs = {}
            if fmt == "PNG":
                save_kwargs = {"compress_level": 4}  # Fast yet good compression
            elif final_output_path.suffix.lower() in {".jpg", ".jpeg"}:
                save_kwargs = {"quality": 95, "subsampling": 0}
            elif final_output_path.suffix.lower() == ".webp":
                save_kwargs = {"lossless": True}

            cleaned_img.save(final_output_path, format=fmt, **save_kwargs)

            if progress_cb:
                progress_cb(100.0, "Completed")

            return final_output_path
