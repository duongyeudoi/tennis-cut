"""Nhận diện rally bằng YOLOv8-nano — track chuyển động của người chơi."""
import logging
import os
from pathlib import Path

import cv2
import numpy as np

import config

log = logging.getLogger(__name__)

try:
    from ultralytics import YOLO
    HAS_YOLO = True
except ImportError:
    HAS_YOLO = False
    log.warning("ultralytics chưa cài — chạy: pip install ultralytics")


def detect_rallies_yolo(video_path: Path) -> list[tuple[float, float]] | None:
    """
    Thuật toán:
    1. Sample frame mỗi 1s (đủ để track vị trí người)
    2. YOLO detect class 0 (person) trong ROI sân
    3. Tính tổng diện tích + vị trí bbox của người
    4. Delta vị trí giữa 2 frame liên tiếp = chỉ số "chuyển động"
    5. Giây nào có delta cao = rally
    """
    if not HAS_YOLO:
        return None

    gap_sec  = int(os.environ.get("GAP_SEC", "8"))
    yolo_k   = float(os.environ.get("YOLO_MOTION_K", "1.2"))

    model = YOLO("yolov8n.pt")  # tự download ~6MB lần đầu
    log.info("YOLO model loaded")

    cap = cv2.VideoCapture(str(video_path))
    fps      = cap.get(cv2.CAP_PROP_FPS) or 30.0
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = n_frames / fps
    h        = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Chỉ nhìn vào 80% giữa frame (bỏ scoreboard)
    roi_y1 = int(h * 0.10)
    roi_y2 = int(h * 0.90)

    # Sample 1 frame/giây
    frame_step = max(1, int(fps))

    # centroids[sec] = list of (cx, cy) của từng người detect được
    centroids_per_sec: dict[int, list[tuple[float, float]]] = {}

    frame_idx = 0
    while True:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret:
            break

        sec = int(frame_idx / fps)
        roi = frame[roi_y1:roi_y2, :]

        results = model(roi, classes=[0], verbose=False, conf=0.3)
        boxes = results[0].boxes

        pts: list[tuple[float, float]] = []
        if boxes is not None and len(boxes) > 0:
            for box in boxes.xyxy.cpu().numpy():
                cx = (box[0] + box[2]) / 2
                cy = (box[1] + box[3]) / 2 + roi_y1  # offset ROI
                pts.append((cx, cy))

        centroids_per_sec[sec] = pts
        frame_idx += frame_step

    cap.release()

    # Tính delta vị trí giữa 2 giây liên tiếp
    total_sec = int(duration) + 1
    motion_scores: list[float] = []
    prev_pts: list[tuple[float, float]] = []

    for sec in range(total_sec):
        curr_pts = centroids_per_sec.get(sec, [])
        if prev_pts and curr_pts:
            # Match người gần nhất giữa 2 frame và tính khoảng cách
            deltas: list[float] = []
            for cx, cy in curr_pts:
                dists = [((cx - px) ** 2 + (cy - py) ** 2) ** 0.5
                         for px, py in prev_pts]
                deltas.append(min(dists))
            motion_scores.append(float(np.mean(deltas)) if deltas else 0.0)
        else:
            motion_scores.append(0.0)
        prev_pts = curr_pts

    # Ngưỡng tự động
    arr = np.array(motion_scores)
    nonzero = arr[arr > 0]
    if len(nonzero) == 0:
        log.warning("YOLO không detect được người nào trong video")
        return None

    threshold = float(np.median(nonzero) + yolo_k * np.std(nonzero))
    log.info(f"YOLO motion threshold: {threshold:.1f}px")

    active = arr > threshold

    # Build segments
    segments: list[tuple[float, float]] = []
    seg_start: int | None = None
    for sec, is_active in enumerate(active):
        if is_active and seg_start is None:
            seg_start = sec
        elif not is_active and seg_start is not None:
            segments.append((float(seg_start), float(sec)))
            seg_start = None
    if seg_start is not None:
        segments.append((float(seg_start), duration))

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
        ps = max(0.0, s - config.PADDING_SEC)
        pe = min(duration, e + config.PADDING_SEC)
        if pe - ps >= config.MIN_RALLY_SEC:
            rallies.append((ps, pe))

    log.info(f"YOLO detector: {len(rallies)} rally")
    for i, (s, e) in enumerate(rallies):
        log.info(f"  Rally {i+1}: {s:.1f}s – {e:.1f}s ({e-s:.1f}s)")

    return rallies
