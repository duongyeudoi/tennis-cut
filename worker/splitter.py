"""Cắt clip và tạo thumbnail bằng FFmpeg.

Hỗ trợ:
- iPhone  : H.264 / HEVC (.mov, VFR, HDR, rotation metadata)
- Android : H.264 / HEVC (.mp4)
- Action cam: H.264 / HEVC / GoPro CineForm / AV1 (.mp4, odd dimensions)
"""
import json
import logging
import subprocess
from pathlib import Path

log = logging.getLogger(__name__)


def _probe(source: Path) -> dict:
    """Lấy thông tin codec, container, rotation, HDR của video."""
    result = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-print_format", "json",
            "-show_streams", "-show_format",
            str(source),
        ],
        capture_output=True, text=True,
    )
    return json.loads(result.stdout) if result.returncode == 0 else {}


def _video_stream(info: dict) -> dict:
    return next(
        (s for s in info.get("streams", []) if s.get("codec_type") == "video"),
        {},
    )


def _is_variable_fps(stream: dict) -> bool:
    """iPhone hay record VFR (r_frame_rate != avg_frame_rate)."""
    r   = stream.get("r_frame_rate", "0/1")
    avg = stream.get("avg_frame_rate", "0/1")
    def to_float(s: str) -> float:
        try:
            a, b = s.split("/")
            return float(a) / float(b) if float(b) else 0
        except Exception:
            return 0
    return abs(to_float(r) - to_float(avg)) > 0.5


def _has_rotation(stream: dict) -> bool:
    """Kiểm tra rotation tag (video quay dọc trên phone)."""
    tags = stream.get("tags", {})
    side = stream.get("side_data_list", [])
    if tags.get("rotate") not in (None, "0", 0):
        return True
    return any(d.get("type") == "Display Matrix" for d in side)


def _is_hdr(stream: dict) -> bool:
    ct = stream.get("color_transfer", "")
    return ct in ("smpte2084", "arib-std-b67", "smpte428")


def _ffmpeg(*args: str) -> None:
    cmd = ["ffmpeg", "-y", "-hide_banner", *args]
    log.debug("$ " + " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg lỗi:\n{result.stderr[-3000:]}")


def _encode_args(stream: dict) -> list[str]:
    """
    Tạo video filter + encode args phù hợp với nguồn.
    Output luôn là H.264 yuv420p để browser phát được.

    Không dùng zscale (cần libzimg, thường không có sẵn).
    HDR content: gắn color metadata BT.709 để player hiển thị đúng.
    """
    # Đảm bảo dimension chẵn
    filters = ["scale=trunc(iw/2)*2:trunc(ih/2)*2"]

    args = [
        "-vf", ",".join(filters),
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-ac", "2",
        "-movflags", "+faststart",
    ]

    # HDR: override color metadata — tránh player hiển thị màu sai
    if _is_hdr(stream):
        log.info("HDR detected — override color metadata sang BT.709")
        args += [
            "-colorspace", "bt709",
            "-color_trc", "bt709",
            "-color_primaries", "bt709",
        ]

    # Fix VFR → CFR (iPhone VFR gây lệch audio sync)
    if _is_variable_fps(stream):
        log.info("VFR detected — convert sang CFR")
        avg = stream.get("avg_frame_rate", "30/1")
        args = ["-r", avg] + args

    return args


def extract_clip(source: Path, dest: Path, start_sec: float, end_sec: float) -> Path:
    duration = end_sec - start_sec
    info   = _probe(source)
    stream = _video_stream(info)
    codec  = stream.get("codec_name", "").lower()

    log.info(f"Codec: {codec}, VFR: {_is_variable_fps(stream)}, HDR: {_is_hdr(stream)}, rotation: {_has_rotation(stream)}")

    # Chỉ copy khi H.264 thuần trong MP4 — an toàn nhất
    container = Path(source).suffix.lower()
    can_copy = (
        codec == "h264"
        and container == ".mp4"
        and not _is_variable_fps(stream)
        and not _has_rotation(stream)
        and not _is_hdr(stream)
    )

    if can_copy:
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
            probe = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries",
                 "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(dest)],
                capture_output=True, text=True,
            )
            if probe.returncode == 0 and probe.stdout.strip():
                log.info("Stream copy thành công")
                return dest
        except RuntimeError:
            pass
        log.warning("Stream copy thất bại, re-encode...")
        dest.unlink(missing_ok=True)

    # Re-encode — xử lý HEVC/ProRes/AV1/MOV/VFR/HDR/rotation
    encode = _encode_args(stream)

    if codec in ("hevc", "h265"):
        # Double-seek: fast seek đến gần → fine seek chính xác
        buffer = min(5.0, start_sec)
        _ffmpeg(
            "-ss", str(start_sec - buffer),
            "-i", str(source),
            "-ss", str(buffer),
            "-t", str(duration),
            *encode,
            str(dest),
        )
    else:
        _ffmpeg(
            "-ss", str(start_sec),
            "-i", str(source),
            "-t", str(duration),
            *encode,
            str(dest),
        )

    return dest


def extract_thumbnail(source: Path, dest: Path, at_sec: float) -> Path:
    """Trích xuất một frame làm thumbnail JPEG."""
    info   = _probe(source)
    stream = _video_stream(info)

    extra = []
    if _is_hdr(stream):
        extra = ["-colorspace", "bt709", "-color_trc", "bt709", "-color_primaries", "bt709"]

    _ffmpeg(
        "-ss", str(at_sec),
        "-i", str(source),
        "-frames:v", "1",
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-pix_fmt", "yuvj420p",
        *extra,
        "-q:v", "3",
        str(dest),
    )
    return dest
