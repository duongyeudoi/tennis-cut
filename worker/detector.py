"""Nhận diện rally trong video tennis bằng OpenCV frame-diff."""
import logging
from pathlib import Path

import cv2
import numpy as np

import config

log = logging.getLogger(__name__)


def detect_rallies(video_path: Path) -> list[tuple[float, float]]:
    """
    Phân tích video và trả về danh sách (start_sec, end_sec) của từng rally.

    Thuật toán:
    1. Lấy mẫu frame theo SAMPLE_FPS (mặc định 2fps)
    2. Tính độ lớn sai khác giữa 2 frame liên tiếp (frame diff)
    3. Frame nào có diff > MOTION_THRESH → đánh dấu là ACTIVE
    4. Gộp các giây ACTIVE liên tiếp thành segment
    5. Áp padding ±PADDING_SEC cho mỗi segment
    6. Lọc bỏ segment ngắn hơn MIN_RALLY_SEC
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Không mở được video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps
    log.info(f"Video: {duration:.1f}s, {fps:.1f}fps, {total_frames} frames")

    # Bước nhảy frame để đạt SAMPLE_FPS
    frame_step = max(1, int(fps / config.SAMPLE_FPS))

    prev_gray = None
    # active_at[giây] = True nếu có chuyển động trong giây đó
    active_map: dict[int, bool] = {}

    frame_idx = 0
    while True:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret:
            break

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)

        if prev_gray is not None:
            diff = cv2.absdiff(prev_gray, gray)
            score = float(np.mean(diff))
            current_sec = int(frame_idx / fps)
            if score > config.MOTION_THRESH:
                active_map[current_sec] = True
            elif current_sec not in active_map:
                active_map[current_sec] = False

        prev_gray = gray
        frame_idx += frame_step

    cap.release()

    # Gộp các giây active thành segment liên tiếp
    total_sec = int(duration) + 1
    segments: list[tuple[float, float]] = []
    seg_start: int | None = None

    for sec in range(total_sec):
        is_active = active_map.get(sec, False)
        if is_active and seg_start is None:
            seg_start = sec
        elif not is_active and seg_start is not None:
            segments.append((float(seg_start), float(sec)))
            seg_start = None

    if seg_start is not None:
        segments.append((float(seg_start), duration))

    # Áp padding và merge segment gần nhau (cách < 2s)
    padded: list[tuple[float, float]] = []
    for start, end in segments:
        ps = max(0.0, start - config.PADDING_SEC)
        pe = min(duration, end + config.PADDING_SEC)
        if padded and ps <= padded[-1][1]:
            # Merge với segment trước
            padded[-1] = (padded[-1][0], max(padded[-1][1], pe))
        else:
            padded.append((ps, pe))

    # Lọc rally ngắn hơn MIN_RALLY_SEC
    rallies = [(s, e) for s, e in padded if (e - s) >= config.MIN_RALLY_SEC]

    log.info(f"Phát hiện {len(rallies)} rally từ {len(segments)} segment")
    return rallies
