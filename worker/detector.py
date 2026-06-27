"""Nhận diện rally trong video tennis bằng MOG2 background subtraction."""
import logging
import os
from pathlib import Path

import cv2
import numpy as np

import config

log = logging.getLogger(__name__)


def detect_rallies(video_path: Path) -> list[tuple[float, float]]:
    """
    Thuật toán cải tiến so với frame-diff:

    1. MOG2 background subtraction — phân biệt foreground (người/bóng di chuyển)
       với background (sân, đường kẻ). Không bị nhiễu bởi thay đổi ánh sáng chậm.

    2. ROI — chỉ phân tích 15%–85% chiều cao, bỏ qua scoreboard phía trên
       và crowd phía dưới cùng.

    3. Yêu cầu motion liên tục — 40% số frame trong 1 giây phải có foreground
       pixel > ngưỡng, tránh false positive từ 1 frame nhiễu.

    4. Gap filling — khoảng nghỉ ngắn (≤ GAP_SEC) giữa 2 đoạn được merge,
       xử lý trường hợp người nhặt bóng nhanh giữa 2 điểm liên tiếp.
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Không mở được video: {video_path}")

    fps      = cap.get(cv2.CAP_PROP_FPS) or 30.0
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = n_frames / fps
    h        = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    w        = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    log.info(f"Video: {duration:.1f}s, {fps:.1f}fps, {w}x{h}")

    # ROI: 15%–85% chiều cao, bỏ qua scoreboard + crowd
    roi_y1 = int(h * 0.15)
    roi_y2 = int(h * 0.85)

    # MOG2: history ngắn để detect chuyển động nhanh
    mog2 = cv2.createBackgroundSubtractorMOG2(
        history=50, varThreshold=40, detectShadows=False
    )

    frame_step   = max(1, int(fps / config.SAMPLE_FPS))
    # 0.5% diện tích ROI phải là foreground để coi là "có chuyển động"
    pixel_thresh = int((roi_y2 - roi_y1) * w * 0.005)
    # 40% frame trong 1 giây phải active
    active_ratio = float(os.environ.get("ACTIVE_RATIO", "0.4"))
    gap_sec      = int(os.environ.get("GAP_SEC", "8"))

    scores: dict[int, list[bool]] = {}
    frame_idx = 0

    while True:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret:
            break

        roi   = frame[roi_y1:roi_y2, :]
        mask  = mog2.apply(roi)
        count = int(np.count_nonzero(mask))
        sec   = int(frame_idx / fps)

        scores.setdefault(sec, []).append(count > pixel_thresh)
        frame_idx += frame_step

    cap.release()

    active_map: dict[int, bool] = {
        sec: (sum(flags) / len(flags)) >= active_ratio
        for sec, flags in scores.items()
    }

    # Build raw segments
    total_sec = int(duration) + 1
    segments: list[tuple[int, int]] = []
    seg_start: int | None = None
    for sec in range(total_sec):
        if active_map.get(sec, False):
            if seg_start is None:
                seg_start = sec
        else:
            if seg_start is not None:
                segments.append((seg_start, sec))
                seg_start = None
    if seg_start is not None:
        segments.append((seg_start, int(duration)))

    # Gap filling: merge 2 segment cách nhau ≤ gap_sec
    merged: list[tuple[int, int]] = []
    for start, end in segments:
        if merged and start - merged[-1][1] <= gap_sec:
            merged[-1] = (merged[-1][0], end)
        else:
            merged.append((start, end))

    # Áp padding + lọc MIN_RALLY_SEC
    rallies: list[tuple[float, float]] = []
    for start, end in merged:
        ps = max(0.0, start - config.PADDING_SEC)
        pe = min(duration, end + config.PADDING_SEC)
        if (pe - ps) >= config.MIN_RALLY_SEC:
            rallies.append((ps, pe))

    log.info(
        f"Phát hiện {len(rallies)} rally "
        f"(raw: {len(segments)}, sau merge gap {gap_sec}s: {len(merged)})"
    )
    for i, (s, e) in enumerate(rallies):
        log.info(f"  Rally {i+1}: {s:.1f}s – {e:.1f}s ({e-s:.1f}s)")

    return rallies
