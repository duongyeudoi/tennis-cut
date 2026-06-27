"""Nhận diện rally bằng audio energy — nhanh hơn và ít bị nhiễu hơn visual."""
import logging
import os
import subprocess
import tempfile
from pathlib import Path

import numpy as np

log = logging.getLogger(__name__)

# Cài: pip install librosa soundfile
try:
    import librosa
    HAS_LIBROSA = True
except ImportError:
    HAS_LIBROSA = False
    log.warning("librosa chưa cài — fallback về visual detector")


def detect_rallies_audio(video_path: Path) -> list[tuple[float, float]] | None:
    """
    Trả về None nếu librosa chưa cài hoặc video không có audio.
    Thuật toán:
    1. Extract audio mono 16kHz từ video bằng ffmpeg
    2. Tính RMS energy mỗi 0.5s
    3. Smooth bằng rolling window
    4. Ngưỡng = median + k * std (tự động, không cần tune tay)
    5. Gap fill + filter ngắn
    """
    if not HAS_LIBROSA:
        return None

    import config

    min_rally  = config.MIN_RALLY_SEC
    padding    = config.PADDING_SEC
    gap_sec    = int(os.environ.get("GAP_SEC", "8"))
    energy_k   = float(os.environ.get("AUDIO_ENERGY_K", "1.5"))  # độ nhạy
    frame_sec  = 0.5  # phân tích mỗi 0.5 giây

    # Extract audio bằng ffmpeg
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        audio_path = f.name

    result = subprocess.run([
        "ffmpeg", "-y", "-i", str(video_path),
        "-ac", "1", "-ar", "16000", "-vn",
        audio_path
    ], capture_output=True)

    if result.returncode != 0:
        log.warning("Không extract được audio, dùng visual detector")
        Path(audio_path).unlink(missing_ok=True)
        return None

    y, sr = librosa.load(audio_path, sr=16000, mono=True)
    Path(audio_path).unlink(missing_ok=True)

    duration = len(y) / sr
    log.info(f"Audio: {duration:.1f}s, {sr}Hz")

    # RMS energy theo frame 0.5s
    frame_len = int(sr * frame_sec)
    hop_len   = frame_len
    rms = librosa.feature.rms(y=y, frame_length=frame_len, hop_length=hop_len)[0]
    times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop_len)

    # Smooth 3-frame rolling
    kernel = np.ones(3) / 3
    rms_smooth = np.convolve(rms, kernel, mode="same")

    # Ngưỡng tự động: median + k * std (bỏ qua silence hoàn toàn)
    nonzero = rms_smooth[rms_smooth > 0]
    if len(nonzero) == 0:
        log.warning("Video không có âm thanh")
        return None
    threshold = float(np.median(nonzero) + energy_k * np.std(nonzero))
    log.info(f"Audio threshold: {threshold:.4f} (median={np.median(nonzero):.4f})")

    active = rms_smooth > threshold

    # Build segments
    segments: list[tuple[float, float]] = []
    seg_start: float | None = None
    for i, is_active in enumerate(active):
        t = float(times[i])
        if is_active and seg_start is None:
            seg_start = t
        elif not is_active and seg_start is not None:
            segments.append((seg_start, t))
            seg_start = None
    if seg_start is not None:
        segments.append((seg_start, duration))

    # Gap fill
    merged: list[tuple[float, float]] = []
    for s, e in segments:
        if merged and s - merged[-1][1] <= gap_sec:
            merged[-1] = (merged[-1][0], e)
        else:
            merged.append((s, e))

    # Padding + filter
    rallies: list[tuple[float, float]] = []
    for s, e in merged:
        ps = max(0.0, s - padding)
        pe = min(duration, e + padding)
        if pe - ps >= min_rally:
            rallies.append((ps, pe))

    log.info(f"Audio detector: {len(rallies)} rally từ {len(segments)} segment")
    return rallies
