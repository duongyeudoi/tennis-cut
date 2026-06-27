"""Upload/download video từ/lên Cloudflare R2."""
import logging
from pathlib import Path
import boto3
from botocore.config import Config
import config

log = logging.getLogger(__name__)

_s3 = boto3.client(
    "s3",
    endpoint_url=config.R2_ENDPOINT,
    aws_access_key_id=config.R2_ACCESS_KEY_ID,
    aws_secret_access_key=config.R2_SECRET_ACCESS_KEY,
    config=Config(signature_version="s3v4"),
    region_name="auto",
)


def download_video(raw_video_key: str, dest: Path) -> Path:
    """Tải raw video về máy local. raw_video_key lấy từ cột jobs.raw_video_key."""
    log.info(f"Đang tải {raw_video_key} → {dest}")
    _s3.download_file(config.BUCKET_RAW, raw_video_key, str(dest))
    log.info(f"Tải xong: {dest.stat().st_size / 1e6:.1f} MB")
    return dest


def download_video_segment(job_id: str, dest: Path, start: float, duration: float) -> Path:
    """Tải một đoạn nhỏ của raw video bằng HTTP Range request.
    Dùng cho recut — không cần tải cả file."""
    key = f"raw/{job_id}/original.mp4"
    # Ước tính byte range: giả sử bitrate ~8 Mbps (1 MB/s) để tính offset
    # FFmpeg sẽ seek chính xác sau khi có file, đây chỉ là ước tính
    # Cách an toàn hơn: tải toàn bộ nếu file nhỏ (<500MB), dùng range nếu lớn hơn
    meta = _s3.head_object(Bucket=config.BUCKET_RAW, Key=key)
    total_bytes = meta["ContentLength"]

    if total_bytes < 500 * 1024 * 1024:  # < 500 MB — tải luôn
        log.info(f"File nhỏ ({total_bytes/1e6:.0f}MB), tải toàn bộ")
        _s3.download_file(config.BUCKET_RAW, key, str(dest))
    else:
        # Ước tính byte offset từ timestamp — an toàn hơn là thêm buffer lớn
        duration_total = total_bytes / (8 * 1024 * 1024 / 8)  # ước tính từ 8Mbps
        byte_per_sec = total_bytes / max(duration_total, 1)
        start_byte = max(0, int((start - 60) * byte_per_sec))  # buffer 60s
        end_byte = min(total_bytes - 1, int((start + duration + 60) * byte_per_sec))

        log.info(f"Tải range [{start_byte}–{end_byte}] của {total_bytes} bytes")
        resp = _s3.get_object(
            Bucket=config.BUCKET_RAW, Key=key,
            Range=f"bytes={start_byte}-{end_byte}"
        )
        dest.write_bytes(resp["Body"].read())

    return dest


def upload_clip(local_path: Path, r2_key: str) -> str:
    """Upload clip/thumbnail lên R2 public bucket, trả về public URL."""
    content_type = "video/mp4" if local_path.suffix == ".mp4" else "image/jpeg"
    log.info(f"Upload {local_path.name} → {r2_key}")
    _s3.upload_file(
        str(local_path),
        config.BUCKET_CLIPS,
        r2_key,
        ExtraArgs={"ContentType": content_type},
    )
    return f"{config.R2_PUBLIC_URL}/{r2_key}"
