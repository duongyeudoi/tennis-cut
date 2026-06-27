"""Python worker — poll Supabase, xử lý video, upload clip."""
import logging
import time
import shutil
from pathlib import Path

from supabase import create_client
import config
import uploader
import detector
import splitter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

sb = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)


# ──────────────────────────────────────────────────────────────
# Xử lý toàn bộ match (job mới)
# ──────────────────────────────────────────────────────────────

def process_job(job: dict) -> None:
    job_id = job["id"]
    log.info(f"▶ Bắt đầu job {job_id}")
    work_dir = config.TMP_DIR / job_id
    work_dir.mkdir(parents=True, exist_ok=True)

    try:
        # 1. Đánh dấu đang xử lý
        sb.table("jobs").update({"status": "processing"}).eq("id", job_id).execute()

        # 2. Tải video gốc
        raw_path = work_dir / "original.mp4"
        uploader.download_video(job_id, raw_path)

        # 3. Nhận diện rally
        rallies = detector.detect_rallies(raw_path)
        if not rallies:
            log.warning("Không tìm thấy rally nào")
            sb.table("jobs").update({
                "status": "done",
                "clip_count": 0,
            }).eq("id", job_id).execute()
            return

        # 4. Cắt clip + tạo thumbnail + upload
        clips_data = []
        for idx, (start, end) in enumerate(rallies):
            clip_key  = f"clips/{job_id}/{idx:03d}.mp4"
            thumb_key = f"thumbs/{job_id}/{idx:03d}.jpg"

            clip_path  = work_dir / f"{idx:03d}.mp4"
            thumb_path = work_dir / f"{idx:03d}.jpg"
            mid = (start + end) / 2

            splitter.extract_clip(raw_path, clip_path, start, end)
            splitter.extract_thumbnail(raw_path, thumb_path, mid)

            uploader.upload_clip(clip_path, clip_key)
            uploader.upload_clip(thumb_path, thumb_key)

            clips_data.append({
                "job_id":        job_id,
                "clip_index":    idx,
                "ai_start_sec":  round(start, 3),
                "ai_end_sec":    round(end, 3),
                "start_sec":     round(start, 3),
                "end_sec":       round(end, 3),
                "clip_key":      clip_key,
                "thumbnail_key": thumb_key,
                "edit_status":   "original",
            })
            log.info(f"  Rally {idx+1}/{len(rallies)}: {start:.1f}s–{end:.1f}s ✓")

        # 5. Lưu clips vào Supabase
        sb.table("clips").insert(clips_data).execute()

        # 6. Cập nhật job thành done
        sb.table("jobs").update({
            "status":     "done",
            "clip_count": len(clips_data),
        }).eq("id", job_id).execute()

        log.info(f"✅ Job {job_id} xong — {len(clips_data)} rally")

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
        # Tải raw video (MP4 cần moov atom hợp lệ — không thể dùng byte range)
        raw_path = work_dir / "source.mp4"
        uploader.download_video(job_id, raw_path)

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
            "edit_status": "original",  # reset để user có thể thử lại
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
            # Ưu tiên 1: job toàn trận chưa xử lý
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
                continue  # không sleep — xử lý ngay job tiếp theo nếu có

            # Ưu tiên 2: clip cần recut sau khi user chỉnh sửa
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
