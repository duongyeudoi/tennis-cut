"""Nhận diện rally bằng Gemini Flash — upload video, hỏi AI timestamps."""
import json
import logging
import os
import re
import time
from pathlib import Path

import config

log = logging.getLogger(__name__)

try:
    from google import genai
    from google.genai import types
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False
    log.warning("google-genai chưa cài — chạy: pip install google-genai")


PROMPT = """ROLE
You are an expert tennis analyst. Watch the attached video and identify every individual point of live play so the footage can be cut into rally clips with ffmpeg.

RECORDING CONTEXT
- Single FIXED camera covering the full court. ONE continuous shot — no broadcast cuts, replays, or studio segments.
- Amateur Vietnamese players. Informal pacing; players self-call lines and chat in Vietnamese between points.
- May be singles or doubles — the segmentation rules are the same either way.

WHAT COUNTS AS ONE RALLY (= one point of live play)
- Starts: when the server begins the serve motion / ball toss that starts the point.
- Ends: the instant the ball is dead — out, hits the net and stops, or bounces twice unreturned.
- If the first serve faults, do NOT clip the fault alone. The clip starts from the serve that actually plays the point.
- ONE point = ONE clip. Do NOT merge consecutive points into one clip.

HOW TO FIND THE BOUNDARIES
- PRIMARY cue (most reliable): serve toss → ball in motion → players stop and reset. Trust your eyes.
- SECONDARY cue: audio "pock" of ball strikes; Vietnamese line calls — "ra" (out), "lỗi" (fault), "vào/tốt" (in), "net/chạm" (let).
- IGNORE casual chat, laughter, counting, coaching talk between points — those do not mark a boundary.

EXCLUDE from all clips
- Walking, ball-retrieval, bouncing ball before serve, toweling off, chatting between points.
- Warm-up, practice feeds, changeovers, any stretch where no live point is being played.

TIMESTAMP & PADDING
- Express times as seconds from the start of the video, with 3 decimal places (e.g. 253.400).
- Add ~1.0 s lead-in before the serve motion and ~1.5 s lead-out after the ball dies.
- When unsure of an exact boundary, be conservative — a little extra is better than clipping the action.

SCALE CHECK (important)
- A 20-minute amateur match typically contains 30–80 points.
- A 10-minute clip typically contains 15–40 points.
- If your output has fewer than 10 clips for a 20-minute video, you are almost certainly merging points or missing rallies — recount.

OUTPUT
Return ONLY a valid JSON array, no prose, no markdown fences:
[
  {"start": 12.500, "end": 28.000, "confidence": 0.95},
  {"start": 45.200, "end": 67.800, "confidence": 0.80}
]

- Sort by start ascending. No overlapping clips. Minimum clip length 5.0 s.
- If a segment is uncertain but looks like a rally, include it with confidence < 0.5 rather than dropping it.
"""


def _parse_timestamp(ts: str) -> float:
    """Chuyển MM:SS.sss hoặc H:MM:SS.sss về số giây."""
    parts = ts.strip().split(":")
    if len(parts) == 2:
        return int(parts[0]) * 60 + float(parts[1])
    if len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
    return float(ts)


def _parse_response(raw: str) -> list[dict]:
    """Parse JSON array từ response của Gemini.

    Gemini đôi khi merge 2 object thành 1 dòng lỗi format.
    Nếu parse toàn bộ thất bại, extract từng {"start","end","confidence"} riêng lẻ.
    """
    text = raw.strip()

    # 1. Parse bình thường
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            for v in data.values():
                if isinstance(v, list):
                    return v
    except json.JSONDecodeError:
        pass

    # 2. Tìm array trong markdown fence
    try:
        m = re.search(r"\[.*\]", text, re.DOTALL)
        if m:
            return json.loads(m.group())
    except json.JSONDecodeError:
        pass

    # 3. Extract từng object riêng — bỏ qua dòng lỗi format
    pattern = re.compile(
        r'"start"\s*:\s*([\d.]+).*?"end"\s*:\s*([\d.]+).*?"confidence"\s*:\s*([\d.]+)',
        re.DOTALL,
    )
    items = []
    # Tách theo ranh giới object để không match nhầm giữa 2 object khác nhau
    for chunk in re.split(r'\}\s*,\s*\{', text):
        m = pattern.search(chunk)
        if m:
            items.append({
                "start": float(m.group(1)),
                "end": float(m.group(2)),
                "confidence": float(m.group(3)),
            })

    if items:
        log.warning(f"JSON bị lỗi format — recovered {len(items)} items bằng regex")
        return items

    raise ValueError(f"Không parse được JSON array từ response:\n{text[:500]}")


def detect_rallies_gemini(video_path: Path) -> list[tuple[float, float]] | None:
    if not HAS_GEMINI:
        return None

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        log.warning("GEMINI_API_KEY chưa set trong .env.local")
        return None

    client = genai.Client(api_key=api_key)
    model  = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

    # 1. Upload video lên Google Files API
    log.info(f"Đang upload {video_path.name} lên Google Files API...")
    log.info(f"  Kích thước: {video_path.stat().st_size / 1e6:.1f} MB")

    video_file = client.files.upload(
        file=video_path,
        config=types.UploadFileConfig(
            mime_type=_mime_type(video_path),
            display_name=video_path.name,
        ),
    )
    log.info(f"Upload xong: {video_file.name}")

    # 2. Chờ Google xử lý video
    log.info("Chờ Google xử lý video...")
    while video_file.state.name == "PROCESSING":
        time.sleep(5)
        video_file = client.files.get(name=video_file.name)
        log.info(f"  Trạng thái: {video_file.state.name}")

    if video_file.state.name != "ACTIVE":
        log.error(f"Video processing thất bại: {video_file.state.name}")
        _delete_file(client, video_file.name)
        return None

    log.info("Video sẵn sàng — đang gửi prompt...")

    # 3. Gọi Gemini
    try:
        response = client.models.generate_content(
            model=model,
            contents=[
                types.Part.from_uri(
                    file_uri=video_file.uri,
                    mime_type=_mime_type(video_path),
                ),
                PROMPT,
            ],
            config=types.GenerateContentConfig(
                temperature=0,
                response_mime_type="application/json",
            ),
        )
    finally:
        _delete_file(client, video_file.name)

    # 4. Parse response
    raw = response.text.strip()
    log.info(f"Gemini raw response ({len(raw)} ký tự), 500 đầu: {raw[:500]}")

    try:
        items = _parse_response(raw)
    except Exception as e:
        log.error(f"Parse thất bại: {e}")
        return None

    # 5. Chuyển timestamps + filter
    rallies: list[tuple[float, float]] = []
    for i, item in enumerate(items):
        try:
            s = max(0.0, float(item["start"]))
            e = float(item["end"])
        except Exception:
            log.warning(f"  Bỏ qua item lỗi timestamp: {item}")
            continue

        if e - s < config.MIN_RALLY_SEC:
            log.warning(f"  Rally {i+1} quá ngắn ({e-s:.1f}s), bỏ qua")
            continue

        conf = item.get("confidence", 1.0)
        rallies.append((s, e))
        log.info(f"  Rally {len(rallies)}: {s:.1f}s → {e:.1f}s ({e-s:.1f}s, conf={conf})")

    log.info(f"Gemini detector: {len(rallies)} rally hợp lệ / {len(items)} tổng")
    return rallies


def _mime_type(path: Path) -> str:
    ext = path.suffix.lower()
    return "video/quicktime" if ext == ".mov" else "video/mp4"


def _delete_file(client, name: str) -> None:
    try:
        client.files.delete(name=name)
        log.info(f"Đã xóa file khỏi Google: {name}")
    except Exception as e:
        log.warning(f"Không xóa được Google file: {e}")
