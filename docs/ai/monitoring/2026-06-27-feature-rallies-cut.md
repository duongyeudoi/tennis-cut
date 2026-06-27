---
phase: monitoring
title: Giám sát & Quan sát hệ thống
description: Monitoring MVP đơn giản — logs, Supabase dashboard, không cần stack phức tạp
---

# Giám sát & Quan sát hệ thống

## Triết lý monitoring (MVP)

Người dùng duy nhất là chính tác giả. Không cần alerting phức tạp. Chỉ cần đủ thông tin để debug khi có vấn đề.

## Worker logs

Worker in log ra stdout. Chạy nền:
```bash
nohup python main.py > worker.log 2>&1 &
tail -f worker.log
```

Log levels được dùng:
- `INFO` — job picked up, bước xử lý, upload xong
- `WARNING` — clip thất bại nhưng job vẫn tiếp tục
- `ERROR` — job fail hoàn toàn, exception từ Gemini/FFmpeg/R2

Tìm lỗi nhanh:
```bash
grep ERROR worker.log | tail -20
grep "Job.*failed" worker.log
```

## Supabase Dashboard

Xem trực tiếp tại [app.supabase.com](https://app.supabase.com):
- **Table Editor** → `jobs`: xem trạng thái tất cả jobs
- **Table Editor** → `clips`: xem clips của một job
- **Logs** → Postgres: query logs nếu có vấn đề DB

Query hữu ích:
```sql
-- Jobs bị stuck processing > 1 tiếng
SELECT id, status, created_at FROM jobs
WHERE status = 'processing'
  AND created_at < NOW() - INTERVAL '1 hour';

-- Reset stuck job thủ công
UPDATE jobs SET status = 'pending' WHERE id = '...';
```

## Cloudflare R2

Dashboard R2 hiện:
- Dung lượng đã dùng (theo dõi để không vượt free tier 10GB)
- Số objects

Dọn dẹp thủ công nếu cần:
- Bucket `rallies-raw`: xóa sau khi job done (worker xóa tự động, nhưng có thể check)
- Bucket `rallies-clips`: giữ lại clips đã xử lý

## Gemini API

Theo dõi tại [aistudio.google.com](https://aistudio.google.com):
- Quota sử dụng hàng ngày
- Nếu 429 (rate limit) → worker sẽ log ERROR và job failed → retry sau

## Sự cố thường gặp

| Triệu chứng | Nguyên nhân thường gặp | Xử lý |
|---|---|---|
| Job stuck `processing` | Worker bị kill giữa chừng | Nút Hủy UI hoặc UPDATE SQL |
| Job `failed` ngay | Gemini 404/429, FFmpeg crash | Xem `worker.log`, nút Retry |
| Gallery trống sau done | Upload clip lên R2 thất bại | Xem `worker.log` dòng ERROR |
| Video không phát | Clip encode sai codec | Xem thumbnail, thử reextract |
| Login loop | Cookie Supabase hết hạn | Clear cookies trình duyệt |

## Không dùng

Không cần Sentry, Datadog, Prometheus, hay bất kỳ observability stack nào cho MVP single-user này.
