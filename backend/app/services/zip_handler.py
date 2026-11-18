import os
import zipfile
from pathlib import Path
from typing import List

class ZipHandler:
    @staticmethod
    def extract_zip_safely(zip_path: Path, target_dir: Path) -> List[Path]:
        """
        Extract zip file safely preventing zip slip / path traversal attacks.
        Returns list of extracted file Paths.
        """
        extracted_files: List[Path] = []
        target_dir = target_dir.resolve()
        target_dir.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(zip_path, "r") as zf:
            for member in zf.infolist():
                if member.is_dir():
                    continue

                # Protect against zip slip: resolve target and ensure it starts with target_dir
                extracted_path = (target_dir / member.filename).resolve()
                if not str(extracted_path).startswith(str(target_dir)):
                    raise ValueError(f"Path traversal detected in zip member: {member.filename}")

                extracted_path.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(member) as src, open(extracted_path, "wb") as dst:
                    # Stream write
                    while chunk := src.read(64 * 1024):
                        dst.write(chunk)

                extracted_files.append(extracted_path)

        return extracted_files

    @staticmethod
    def create_zip(source_dir: Path, output_zip: Path) -> Path:
        """Compress contents of source_dir into output_zip preserving folder structure."""
        output_zip.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, _, files in os.walk(source_dir):
                for file in files:
                    full_path = Path(root) / file
                    arcname = full_path.relative_to(source_dir)
                    zf.write(full_path, arcname=str(arcname))
        return output_zip

zip_handler = ZipHandler()
