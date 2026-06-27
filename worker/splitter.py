"""Cắt clip và tạo thumbnail bằng FFmpeg."""
import logging
import subprocess
from pathlib import Path

log = logging.getLogger(__name__)


def _ffmpeg(*args: str) -> None:
    cmd = ["ffmpeg", "-y", *args]
    log.debug("$ " + " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg lỗi:\n{result.stderr[-2000:]}")


def extract_clip(
    source: Path,
    dest: Path,
    start_sec: float,
    end_sec: float,
) -> Path:
    """
    Cắt đoạn [start_sec, end_sec] từ source, lưu vào dest.
    Thử -c copy trước (không re-encode, nhanh hơn).
    Fallback re-encode nếu file không phát được do keyframe.
    """
    duration = end_sec - start_sec
    try:
        _ffmpeg(
            "-ss", str(start_sec),
            "-i", str(source),
            "-t", str(duration),
            "-c", "copy",
            "-avoid_negative_ts", "make_zero",
            "-movflags", "+faststart",
            str(dest),
        )
        # Kiểm tra file hợp lệ
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries",
             "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(dest)],
            capture_output=True, text=True,
        )
        if probe.returncode != 0 or not probe.stdout.strip():
            raise RuntimeError("File đầu ra không hợp lệ")
    except RuntimeError:
        log.warning("copy stream thất bại, thử re-encode...")
        dest.unlink(missing_ok=True)
        _ffmpeg(
            "-ss", str(start_sec),
            "-i", str(source),
            "-t", str(duration),
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            str(dest),
        )
    return dest


def extract_thumbnail(source: Path, dest: Path, at_sec: float) -> Path:
    """Trích xuất một frame làm thumbnail JPEG."""
    _ffmpeg(
        "-ss", str(at_sec),
        "-i", str(source),
        "-frames:v", "1",
        "-q:v", "3",
        str(dest),
    )
    return dest
