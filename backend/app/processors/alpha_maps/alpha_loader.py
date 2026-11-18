from pathlib import Path
from typing import Dict, Optional
import numpy as np
from PIL import Image

class AlphaMapCache:
    """Loads and caches alpha watermark maps scaled to arbitrary target sizes."""

    def __init__(self, maps_dir: Optional[Path] = None):
        if maps_dir is None:
            maps_dir = Path(__file__).resolve().parent
        self.maps_dir = Path(maps_dir)
        self._cache: Dict[int, np.ndarray] = {}
        self._base_48: Optional[np.ndarray] = None
        self._base_96: Optional[np.ndarray] = None
        self._preload_bases()

    def _preload_bases(self) -> None:
        p48 = self.maps_dir / "bg_48.png"
        p96 = self.maps_dir / "bg_96.png"

        if p48.exists():
            img = Image.open(p48).convert("RGB")
            arr = np.array(img, dtype=np.float32)
            self._base_48 = np.max(arr, axis=2) / 255.0
            self._cache[48] = self._base_48

        if p96.exists():
            img = Image.open(p96).convert("RGB")
            arr = np.array(img, dtype=np.float32)
            self._base_96 = np.max(arr, axis=2) / 255.0
            self._cache[96] = self._base_96

    def get(self, size: int) -> np.ndarray:
        """Return the (size, size) float32 alpha map array in range [0, 1]."""
        size = max(8, int(round(size)))
        if size in self._cache:
            return self._cache[size]

        # Choose the best base to scale from
        base = self._base_96 if self._base_96 is not None else self._base_48
        if base is None:
            raise FileNotFoundError(f"No base alpha maps found in {self.maps_dir}")

        scaled = self._resize_alpha(base, size)
        self._cache[size] = scaled
        return scaled

    def _resize_alpha(self, alpha: np.ndarray, target_size: int) -> np.ndarray:
        # Convert float alpha map to 8-bit image for high-quality Lanczos resampling
        img = Image.fromarray((alpha * 255.0).clip(0, 255).astype(np.uint8), mode="L")
        resized = img.resize((target_size, target_size), Image.Resampling.LANCZOS)
        return (np.array(resized, dtype=np.float32) / 255.0).astype(np.float32)
