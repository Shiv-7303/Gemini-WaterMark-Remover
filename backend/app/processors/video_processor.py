import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Callable, Optional, Tuple, Dict, Any
import numpy as np

from .base import BaseMediaProcessor
from .alpha_maps.alpha_loader import AlphaMapCache
from .watermark_math import detect_watermark_box, remove_watermark_numpy, PRESETS

VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"}

class VideoProcessor(BaseMediaProcessor):
    def __init__(
        self,
        alpha_cache: AlphaMapCache,
        gain: Optional[float] = None,
        offset_x: int = 0,
        offset_y: int = 0,
        size_scale: float = 1.0,
        preset: str = "veo3",
        crf: int = 18,
        ffmpeg_preset: str = "fast",
    ):
        self.alpha_cache = alpha_cache
        self.preset = preset.lower() if preset else "veo3"
        preset_cfg = PRESETS.get(self.preset, PRESETS.get("veo3", PRESETS["auto"]))

        self.gain = gain if (gain is not None and gain > 0) else preset_cfg.get("gain", 0.85)
        self.offset_x = offset_x
        self.offset_y = offset_y
        self.size_scale = size_scale
        self.crf = crf
        self.ffmpeg_preset = ffmpeg_preset

    def probe_video(self, input_path: Path) -> Dict[str, Any]:
        """Probe video file using ffprobe to obtain dimensions, fps, duration and audio presence."""
        cmd = [
            "ffprobe",
            "-v", "error",
            "-show_entries", "stream=index,codec_type,width,height,r_frame_rate,nb_frames,duration:format=duration",
            "-of", "json",
            str(input_path)
        ]
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        data = json.loads(result.stdout)
        streams = data.get("streams", [])

        video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
        if not video_stream:
            raise ValueError(f"No video stream found in {input_path}")

        has_audio = any(s.get("codec_type") == "audio" for s in streams)

        width = int(video_stream["width"])
        height = int(video_stream["height"])

        # Frame rate calculation
        fps_str = video_stream.get("r_frame_rate", "30/1")
        if "/" in fps_str:
            num, den = fps_str.split("/")
            fps = float(num) / float(den) if float(den) != 0 else 30.0
        else:
            fps = float(fps_str)

        # Duration & total frames estimation
        duration = float(video_stream.get("duration") or data.get("format", {}).get("duration") or 0.0)
        nb_frames = int(video_stream.get("nb_frames") or round(duration * fps) or 0)

        return {
            "width": width,
            "height": height,
            "fps": fps,
            "duration": duration,
            "total_frames": nb_frames,
            "has_audio": has_audio,
        }

    def process(
        self,
        input_path: Path,
        output_path: Path,
        progress_cb: Optional[Callable[[float, str], None]] = None
    ) -> Path:
        input_path = Path(input_path).resolve()
        output_path = Path(output_path).resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)

        if progress_cb:
            progress_cb(5.0, "Analyzing video metadata")

        info = self.probe_video(input_path)
        width, height, fps = info["width"], info["height"], info["fps"]
        total_frames = info["total_frames"]
        has_audio = info["has_audio"]

        box = detect_watermark_box(
            width=width,
            height=height,
            preset=self.preset,
            offset_x=self.offset_x,
            offset_y=self.offset_y,
            size_scale=self.size_scale,
        )
        alpha = self.alpha_cache.get(box.size)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp = Path(tmp_dir)
            temp_video = tmp / "temp_processed.mp4"
            audio_track = tmp / "audio.aac"

            # 1. Extract audio if present
            audio_extracted = False
            if has_audio:
                if progress_cb:
                    progress_cb(8.0, "Extracting audio track")
                extract_cmd = [
                    "ffmpeg", "-y",
                    "-i", str(input_path),
                    "-vn",
                    "-c:a", "aac",
                    "-b:a", "192k",
                    str(audio_track)
                ]
                res = subprocess.run(extract_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                audio_extracted = (res.returncode == 0 and audio_track.exists() and audio_track.stat().st_size > 0)

            # 2. Setup decoder process (reading raw RGB frames)
            decode_cmd = [
                "ffmpeg",
                "-i", str(input_path),
                "-f", "rawvideo",
                "-pix_fmt", "rgb24",
                "-v", "error",
                "pipe:1"
            ]
            decoder = subprocess.Popen(decode_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

            # 3. Setup encoder process (writing processed RGB frames to H.264)
            encode_cmd = [
                "ffmpeg", "-y",
                "-f", "rawvideo",
                "-vcodec", "rawvideo",
                "-s", f"{width}x{height}",
                "-pix_fmt", "rgb24",
                "-r", f"{fps:.3f}",
                "-i", "pipe:0",
                "-c:v", "libx264",
                "-crf", str(self.crf),
                "-preset", self.ffmpeg_preset,
                "-pix_fmt", "yuv420p",
                "-v", "error",
                str(temp_video)
            ]
            encoder = subprocess.Popen(encode_cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)

            frame_bytes = width * height * 3
            frame_idx = 0

            try:
                while True:
                    raw_frame = decoder.stdout.read(frame_bytes)
                    if not raw_frame or len(raw_frame) < frame_bytes:
                        break

                    frame = np.frombuffer(raw_frame, dtype=np.uint8).reshape((height, width, 3))

                    cleaned_frame = remove_watermark_numpy(
                        image=frame,
                        alpha_map=alpha,
                        x=box.x,
                        y=box.y,
                        gain=self.gain,
                    )

                    encoder.stdin.write(cleaned_frame.tobytes())
                    frame_idx += 1

                    if frame_idx % 15 == 0 and progress_cb:
                        if total_frames > 0:
                            pct = min(92.0, 10.0 + (frame_idx / total_frames) * 82.0)
                            progress_cb(pct, f"Processing frame {frame_idx}/{total_frames} ({pct:.1f}%)")
                        else:
                            progress_cb(50.0, f"Processing frame {frame_idx}")

            finally:
                if decoder.stdout:
                    decoder.stdout.close()
                decoder.wait()

                if encoder.stdin:
                    encoder.stdin.close()
                encoder.wait()

            if encoder.returncode != 0:
                err = encoder.stderr.read().decode("utf-8", errors="ignore") if encoder.stderr else "Unknown encoder error"
                raise RuntimeError(f"FFmpeg encoder error: {err}")

            # 4. Remux audio & finalize
            if progress_cb:
                progress_cb(95.0, "Finalizing and muxing media")

            final_mp4 = output_path.with_suffix(".mp4")
            if audio_extracted:
                mux_cmd = [
                    "ffmpeg", "-y",
                    "-i", str(temp_video),
                    "-i", str(audio_track),
                    "-c:v", "copy",
                    "-c:a", "copy",
                    "-movflags", "+faststart",
                    "-shortest",
                    "-v", "error",
                    str(final_mp4)
                ]
                mux_res = subprocess.run(mux_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                if mux_res.returncode != 0 or not final_mp4.exists():
                    # Fallback to pure video if remux had an issue
                    shutil.move(str(temp_video), str(final_mp4))
            else:
                shutil.move(str(temp_video), str(final_mp4))

            if progress_cb:
                progress_cb(100.0, f"Completed ({frame_idx} frames)")

            return final_mp4
