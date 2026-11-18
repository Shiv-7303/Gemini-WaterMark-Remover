#!/usr/bin/env python3
"""
Command Line Interface (CLI) for Gemini Batch Watermark Remover.
Usage:
    python cli.py -i ./my_folder -o ./cleaned_folder --preset auto
    python cli.py -i sample.png -o sample_clean.png --preset nano_banana
"""

import argparse
import sys
import time
from pathlib import Path
from backend.app.processors.alpha_maps.alpha_loader import AlphaMapCache
from backend.app.processors.image_processor import ImageProcessor, IMAGE_EXTENSIONS
from backend.app.processors.video_processor import VideoProcessor, VIDEO_EXTENSIONS
from backend.app.processors.watermark_math import PRESETS

def main():
    parser = argparse.ArgumentParser(
        description="Gemini Batch Watermark Remover — Mathematical Alpha Unblending"
    )
    parser.add_argument("-i", "--input", required=True, help="Input directory or single media file")
    parser.add_argument("-o", "--output", required=True, help="Output directory or output file path")
    parser.add_argument(
        "--preset",
        default="auto",
        choices=list(PRESETS.keys()),
        help="Model preset (auto, nano_banana, veo3, flow, omni)"
    )
    parser.add_argument("--gain", type=float, default=None, help="Custom alpha gain (e.g. 1.0)")
    parser.add_argument("--offset-x", type=int, default=0, help="Horizontal watermark offset (px)")
    parser.add_argument("--offset-y", type=int, default=0, help="Vertical watermark offset (px)")
    parser.add_argument("--size-scale", type=float, default=1.0, help="Watermark size scale multiplier")
    parser.add_argument("--crf", type=int, default=18, help="Video CRF quality (18 = near lossless)")
    parser.add_argument("--ffmpeg-preset", default="fast", help="FFmpeg speed preset (fast, medium)")

    args = parser.parse_args()

    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()

    if not input_path.exists():
        print(f"Error: Input path '{input_path}' does not exist.")
        sys.exit(1)

    alpha_cache = AlphaMapCache()
    img_processor = ImageProcessor(
        alpha_cache=alpha_cache,
        gain=args.gain,
        offset_x=args.offset_x,
        offset_y=args.offset_y,
        size_scale=args.size_scale,
        preset=args.preset,
    )
    vid_processor = VideoProcessor(
        alpha_cache=alpha_cache,
        gain=args.gain,
        offset_x=args.offset_x,
        offset_y=args.offset_y,
        size_scale=args.size_scale,
        preset=args.preset,
        crf=args.crf,
        ffmpeg_preset=args.ffmpeg_preset,
    )

    # Single file mode
    if input_path.is_file():
        ext = input_path.suffix.lower()
        print(f"Processing single file: {input_path.name} (Preset: {args.preset})")
        if ext in IMAGE_EXTENSIONS:
            out = img_processor.process(input_path, output_path)
            print(f"Saved cleaned image to: {out}")
        elif ext in VIDEO_EXTENSIONS:
            out = vid_processor.process(input_path, output_path)
            print(f"Saved cleaned video to: {out}")
        else:
            print(f"Unsupported file type: {ext}")
            sys.exit(1)
        return

    # Directory batch mode
    output_path.mkdir(parents=True, exist_ok=True)
    all_files = []
    for root, _, files in os.walk(input_path):
        for f in files:
            p = Path(root) / f
            ext = p.suffix.lower()
            if ext in IMAGE_EXTENSIONS or ext in VIDEO_EXTENSIONS:
                all_files.append(p)

    if not all_files:
        print(f"No supported media files found in '{input_path}'.")
        sys.exit(1)

    print(f"Found {len(all_files)} media files. Beginning batch processing...")
    start_time = time.time()
    success_count = 0
    fail_count = 0

    for idx, file_p in enumerate(all_files, 1):
        rel = file_p.relative_to(input_path)
        dest = output_path / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        ext = file_p.suffix.lower()

        print(f"[{idx}/{len(all_files)}] Processing {rel} ...", end="", flush=True)
        try:
            if ext in IMAGE_EXTENSIONS:
                img_processor.process(file_p, dest)
            else:
                vid_processor.process(file_p, dest)
            print(" [OK]")
            success_count += 1
        except Exception as e:
            print(f" [FAILED: {e}]")
            fail_count += 1

    elapsed = time.time() - start_time
    print(f"\nBatch Completed in {elapsed:.2f}s!")
    print(f"Success: {success_count} | Failed: {fail_count} | Output: {output_path}")

if __name__ == "__main__":
    import os
    main()
