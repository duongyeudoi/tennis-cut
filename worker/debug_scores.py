"""Chạy: python debug_scores.py /path/to/video.MOV
Xuất biểu đồ motion score theo thời gian để tune threshold."""
import sys
from pathlib import Path
import cv2
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import config
from detector import detect_rallies

video_path = Path(sys.argv[1])

cap = cv2.VideoCapture(str(video_path))
fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
h   = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
w   = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
roi_y1, roi_y2 = int(h * 0.15), int(h * 0.85)

mog2 = cv2.createBackgroundSubtractorMOG2(history=50, varThreshold=40, detectShadows=False)
frame_step   = max(1, int(fps / config.SAMPLE_FPS))
pixel_thresh = int((roi_y2 - roi_y1) * w * 0.005)

times, raw_scores = [], []
frame_idx = 0
while True:
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    ret, frame = cap.read()
    if not ret:
        break
    roi   = frame[roi_y1:roi_y2, :]
    mask  = mog2.apply(roi)
    count = int(np.count_nonzero(mask))
    times.append(frame_idx / fps)
    raw_scores.append(count / ((roi_y2 - roi_y1) * w) * 100)  # % pixel
    frame_idx += frame_step
cap.release()

# Detect với thuật toán hiện tại
rallies = detect_rallies(video_path)

fig, ax = plt.subplots(figsize=(20, 5))
ax.plot(times, raw_scores, lw=0.8, color="steelblue", label="Foreground %")
ax.axhline(0.5, color="orange", lw=1, ls="--", label="Ngưỡng 0.5%")
for s, e in rallies:
    ax.axvspan(s, e, alpha=0.2, color="green")
patch = mpatches.Patch(color="green", alpha=0.3, label="Rally detected")
ax.legend(handles=[*ax.get_legend_handles_labels()[0], patch])
ax.set_xlabel("Thời gian (giây)")
ax.set_ylabel("Foreground pixel %")
ax.set_title(video_path.name)
plt.tight_layout()
out = video_path.with_suffix(".scores.png")
plt.savefig(out, dpi=120)
print(f"Đã lưu: {out}")
