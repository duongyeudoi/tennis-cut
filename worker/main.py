"""Python worker — poll Supabase, xử lý video, upload clip."""
import logging
import os
import time
import shutil
import secrets
import base64
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from supabase import create_client
import config
import uploader
import detector
import detector_audio
import detector_yolo
import detector_gemini
import splitter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

sb = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)

CLIP_WORKERS = int(os.environ.get("CLIP_WORKERS", "4"))


# ──────────────────────────────────────────────────────────────
# Xử lý toàn bộ match (job mới)
# ──────────────────────────────────────────────────────────────

def _detect_rallies(job: dict, raw_path: Path) -> list[tuple[float, float]]:
    """
    Nhận diện rally. Nếu job metadata đã có timestamps từ lần chạy trước
    (Gemini xong nhưng FFmpeg crash), dùng lại — không gọi Gemini lại.
    """
    cached = (job.get("metadata") or {}).get("detected_rallies")
    if cached:
        log.info(f"Dùng lại {len(cached)} rally đã cache từ lần trước")
        return [(float(s), float(e)) for s, e in cached]

    detector_mode = os.environ.get("DETECTOR", "gemini")
    rallies = None

    if detector_mode in ("gemini", "auto"):
        rallies = detector_gemini.detect_rallies_gemini(raw_path)
    if rallies is None and detector_mode in ("audio", "auto"):
        log.info("Thử audio detector")
        rallies = detector_audio.detect_rallies_audio(raw_path)
    if rallies is None and detector_mode in ("yolo", "auto"):
        log.info("Thử YOLO detector")
        rallies = detector_yolo.detect_rallies_yolo(raw_path)
    if rallies is None:
        log.info("Fallback về MOG2 visual detector")
        rallies = detector.detect_rallies(raw_path)

    return rallies or []


def _process_one_clip(
    job_id: str,
    idx: int,
    start: float,
    end: float,
    raw_path: Path,
    work_dir: Path,
) -> dict:
    """Cắt 1 clip + thumbnail rồi upload R2. Chạy song song."""
    clip_key  = f"clips/{job_id}/{idx:03d}.mp4"
    thumb_key = f"thumbs/{job_id}/{idx:03d}.jpg"
    clip_path  = work_dir / f"{idx:03d}.mp4"
    thumb_path = work_dir / f"{idx:03d}.jpg"

    splitter.extract_clip(raw_path, clip_path, start, end)
    splitter.extract_thumbnail(raw_path, thumb_path, (start + end) / 2)
    uploader.upload_clip(clip_path, clip_key)
    uploader.upload_clip(thumb_path, thumb_key)

    share_token = base64.urlsafe_b64encode(secrets.token_bytes(12)).rstrip(b"=").decode()
    log.info(f"  Rally {idx + 1}: {start:.1f}s–{end:.1f}s ✓")

    return {
        "job_id":        job_id,
        "clip_index":    idx,
        "ai_start_sec":  round(start, 3),
        "ai_end_sec":    round(end, 3),
        "start_sec":     round(start, 3),
        "end_sec":       round(end, 3),
        "clip_key":      clip_key,
        "thumbnail_key": thumb_key,
        "edit_status":   "original",
        "share_token":   share_token,
    }


def process_job(job: dict) -> None:
    job_id = job["id"]
    log.info(f"▶ Bắt đầu job {job_id}")
    work_dir = config.TMP_DIR / job_id
    work_dir.mkdir(parents=True, exist_ok=True)

    try:
        sb.table("jobs").update({"status": "processing"}).eq("id", job_id).execute()

        # 1. Tải video gốc
        raw_video_key = job["raw_video_key"]
        raw_ext  = Path(raw_video_key).suffix or ".mp4"
        raw_path = work_dir / f"original{raw_ext}"
        uploader.download_video(raw_video_key, raw_path)

        # 2. Nhận diện rally (dùng cache nếu có)
        rallies = _detect_rallies(job, raw_path)
        if not rallies:
            log.warning("Không tìm thấy rally nào")
            sb.table("jobs").update({
                "status":     "done",
                "clip_count": 0,
            }).eq("id", job_id).execute()
            return

        # 3. Cache timestamps vào metadata — tránh gọi lại Gemini nếu crash sau bước này
        existing_meta = job.get("metadata") or {}
        if "detected_rallies" not in existing_meta:
            sb.table("jobs").update({
                "metadata": {**existing_meta, "detected_rallies": [[s, e] for s, e in rallies]},
            }).eq("id", job_id).execute()

        # 4. Cắt clip + upload song song
        log.info(f"Cắt {len(rallies)} clip với {CLIP_WORKERS} worker song song...")
        clips_data: list[dict] = []
        errors: list[str] = []

        with ThreadPoolExecutor(max_workers=CLIP_WORKERS) as pool:
            futures = {
                pool.submit(_process_one_clip, job_id, idx, start, end, raw_path, work_dir): idx
                for idx, (start, end) in enumerate(rallies)
            }
            for future in as_completed(futures):
                try:
                    clips_data.append(future.result())
                except Exception as exc:
                    idx = futures[future]
                    log.error(f"  Rally {idx + 1} thất bại: {exc}")
                    errors.append(f"Rally {idx + 1}: {exc}")

        if not clips_data:
            raise RuntimeError("Tất cả clip đều thất bại:\n" + "\n".join(errors))

        clips_data.sort(key=lambda x: x["clip_index"])

        # 5. Lưu clips vào Supabase
        sb.table("clips").insert(clips_data).execute()

        # 6. Xóa cache timestamps — job đã xong
        sb.table("jobs").update({
            "status":     "done",
            "clip_count": len(clips_data),
            "metadata":   {k: v for k, v in (job.get("metadata") or {}).items() if k != "detected_rallies"},
        }).eq("id", job_id).execute()

        log.info(f"✅ Job {job_id} xong — {len(clips_data)}/{len(rallies)} rally")
        if errors:
            log.warning(f"  {len(errors)} clip bị lỗi: {errors}")

    except Exception as exc:
        log.exception(f"❌ Job {job_id} thất bại")
        sb.table("jobs").update({
            "status":    "failed",
            "error_msg": str(exc)[:500],
        }).eq("id", job_id).execute()

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


# ──────────────────────────────────────────────────────────────
# Recut clip sau khi user chỉnh sửa in/out point
# ──────────────────────────────────────────────────────────────

def recut_clip(clip: dict) -> None:
    clip_id = clip["id"]
    job_id  = clip["job_id"]
    start   = clip["start_sec"]
    end     = clip["end_sec"]
    idx     = clip["clip_index"]
    log.info(f"✂ Recut clip {clip_id} ({start:.1f}s–{end:.1f}s)")

    work_dir = config.TMP_DIR / f"recut_{clip_id}"
    work_dir.mkdir(parents=True, exist_ok=True)

    try:
        job_res = sb.table("jobs").select("raw_video_key").eq("id", job_id).single().execute()
        raw_video_key = job_res.data["raw_video_key"]
        raw_ext  = Path(raw_video_key).suffix or ".mp4"
        raw_path = work_dir / f"source{raw_ext}"
        uploader.download_video(raw_video_key, raw_path)

        clip_key  = f"clips/{job_id}/{idx:03d}.mp4"
        thumb_key = f"thumbs/{job_id}/{idx:03d}.jpg"
        clip_path  = work_dir / "clip.mp4"
        thumb_path = work_dir / "thumb.jpg"

        splitter.extract_clip(raw_path, clip_path, start, end)
        splitter.extract_thumbnail(raw_path, thumb_path, (start + end) / 2)
        uploader.upload_clip(clip_path, clip_key)
        uploader.upload_clip(thumb_path, thumb_key)

        sb.table("clips").update({
            "edit_status": "recut",
            "clip_key":    clip_key,
        }).eq("id", clip_id).execute()

        log.info(f"✅ Recut {clip_id} xong")

    except Exception as exc:
        log.exception(f"❌ Recut {clip_id} thất bại")
        sb.table("clips").update({
            "edit_status": "original",
        }).eq("id", clip_id).execute()

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


# ──────────────────────────────────────────────────────────────
# Khôi phục khi worker crash giữa chừng
# ──────────────────────────────────────────────────────────────

def reset_stuck() -> None:
    stuck_jobs = (
        sb.table("jobs")
        .update({"status": "pending"})
        .eq("status", "processing")
        .execute()
    )
    stuck_clips = (
        sb.table("clips")
        .update({"edit_status": "original"})
        .eq("edit_status", "pending_recut")
        .execute()
    )
    if stuck_jobs.data:
        log.warning(f"Reset {len(stuck_jobs.data)} job bị kẹt → pending")
    if stuck_clips.data:
        log.warning(f"Reset {len(stuck_clips.data)} clip bị kẹt → original")


# ──────────────────────────────────────────────────────────────
# Vòng lặp chính
# ──────────────────────────────────────────────────────────────

def main() -> None:
    log.info("🎾 Rallies Cut Worker khởi động")
    reset_stuck()

    while True:
        try:
            job_res = (
                sb.table("jobs")
                .select("*")
                .eq("status", "pending")
                .order("created_at")
                .limit(1)
                .execute()
            )
            if job_res.data:
                process_job(job_res.data[0])
                continue

            clip_res = (
                sb.table("clips")
                .select("*")
                .eq("edit_status", "pending_recut")
                .order("updated_at")
                .limit(1)
                .execute()
            )
            if clip_res.data:
                recut_clip(clip_res.data[0])
                continue

        except Exception:
            log.exception("Lỗi trong vòng lặp poll")

        time.sleep(config.POLL_INTERVAL)


if __name__ == "__main__":
    main()
