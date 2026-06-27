---
phase: deployment
title: Chiến lược triển khai
description: Hạ tầng, quy trình deploy và cấu hình môi trường
---

# Chiến lược triển khai

## Hạ tầng

| Thành phần | Dịch vụ | Chi phí |
|---|---|---|
| Frontend | Vercel (Hobby) | $0 |
| Database + Realtime | Supabase Free | $0 |
| Video storage raw | Cloudflare R2 | $0 (10GB free) |
| Clip storage | Cloudflare R2 public | $0 (10GB free) |
| AI detector | Gemini 2.5 Flash | ~$0.03/video |
| Python worker | Máy local người dùng | $0 |
| **Tổng** | | **~$1-2/tháng** |

## Source code

- GitHub: `https://github.com/duongyeudoi/tennis-cut`
- Branch mặc định: `main`

## Deploy Frontend lên Vercel

### Lần đầu
1. Vào [vercel.com](https://vercel.com) → Import Git Repository → chọn `duongyeudoi/tennis-cut`
2. Framework: Next.js (tự detect)
3. Thêm tất cả env vars (xem danh sách bên dưới)
4. Deploy

### Env vars cần set trên Vercel
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
NEXT_PUBLIC_R2_PUBLIC_URL
```
> `GEMINI_API_KEY`, `DETECTOR`, `GEMINI_MODEL` — chỉ dùng bởi worker local, không cần trên Vercel.

### Các lần sau
```bash
git push origin main   # Vercel tự deploy khi push
```

## Deploy Worker (local)

Worker **không** deploy lên server — chạy trên máy người dùng khi cần xử lý video.

```bash
cd worker
source .venv/bin/activate
python main.py
```

Để worker chạy nền:
```bash
nohup python main.py > worker.log 2>&1 &
```

## CORS cấu hình R2

Bucket `rallies-raw` cần CORS để browser PUT trực tiếp:
```json
[{
  "AllowedOrigins": ["http://localhost:3000", "https://your-vercel-domain.vercel.app"],
  "AllowedMethods": ["PUT", "GET", "HEAD"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3600
}]
```

## Quản lý Secrets

- Không commit `.env.local` (đã có trong `.gitignore`)
- Service key Supabase chỉ dùng phía server (API routes + worker)
- R2 credentials không expose ra client
- Gemini API key chỉ trong worker

## Rollback

Vercel giữ lịch sử deployment — có thể rollback 1-click từ dashboard.

Worker không có rollback — nếu có bug, fix code và restart.
