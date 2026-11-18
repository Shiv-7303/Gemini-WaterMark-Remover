from abc import ABC, abstractmethod
from pathlib import Path
from typing import Callable, Optional

class BaseMediaProcessor(ABC):
    @abstractmethod
    def process(
        self,
        input_path: Path,
        output_path: Path,
        progress_cb: Optional[Callable[[float, str], None]] = None
    ) -> None:
        """Process a media file and save the watermark-free output."""
        pass
