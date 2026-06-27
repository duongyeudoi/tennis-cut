---
phase: design
title: Thiết kế hệ thống & Kiến trúc
description: Kiến trúc thực tế của rallies-cut — xử lý local, Cloudflare R2, Supabase, Next.js 16, Gemini 2.5 Flash
---

# Thiết kế hệ thống & Kiến trúc

## Kiến trúc tổng thể

```
Browser (Next.js 16)
  │
  ├── PUT video → R2 bucket rallies-raw (presigned URL)
  ├── Supabase Realtime → nhận updates job/clip
  └── GET clip → R2 bucket rallies-clips (public URL)

Python Worker (local)
  │
  ├── Poll Supabase mỗi 10s (status = 'pending')
  ├── Download raw video từ R2
  ├── Gemini 2.5 Flash → timestamps [start, end, confidence]
  ├── FFmpeg × 4 (parallel) → cắt clip + thumbnail
  └── Upload clips/thumbs → R2, cập nhật Supabase

Supabase
  ├── DB: bảng jobs, clips
  └── Realtime: push update xuống browser

Cloudflare R2
  ├── rallies-raw (private) — raw video upload
  └── rallies-clips (public) — clips + thumbnails
```

## Stack kỹ thuật

| Layer | Công nghệ |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript |
| UI | shadcn/ui với Base UI (không phải Radix), Tailwind CSS v4 |
| Theme | next-themes (`attribute="class"`) |
| Auth | Supabase email/password, `@supabase/ssr`, cookie-based |
| Database | Supabase (Postgres + Realtime) |
| Storage | Cloudflare R2 (AWS S3 compatible) |
| AI detector | Gemini 2.5 Flash (primary) + audio/YOLO/MOG2 (fallback) |
| Video cut | FFmpeg (local) |
| Package manager | pnpm |

## Bảng dữ liệu Supabase

### jobs
```sql
id            uuid PRIMARY KEY
status        text  -- pending | processing | done | failed
raw_video_key text  -- R2 object key
clip_count    int
metadata      jsonb -- { filename, detected_rallies: [{start,end,confidence}] }
created_at    timestamptz
```

`metadata.detected_rallies` là cache timestamps từ Gemini — nếu worker crash sau detection nhưng trước khi cắt xong, restart không cần upload lại video.

### clips
```sql
id            uuid PRIMARY KEY
job_id        uuid REFERENCES jobs
clip_url      text  -- R2 public URL
thumb_url     text
duration_sec  float
start_sec     float
end_sec       float
ai_start_sec  float  -- giá trị gốc từ Gemini (để reset về AI)
ai_end_sec    float
confidence    float
share_token   text UNIQUE  -- cho /share/[token]
edit_status   text  -- ai | edited
updated_at    timestamptz
```

## Luồng xử lý chính

### Upload
1. Browser gọi `/api/upload-url` → nhận presigned PUT URL từ R2
2. Browser PUT video thẳng lên R2 (không qua Next.js server)
3. Browser gọi `/api/jobs` POST → tạo job Supabase với `status=pending`
4. Redirect `/jobs/[id]`

### Worker processing
1. `main.py` poll Supabase mỗi 10s, lấy job `pending` đầu tiên
2. Cập nhật status `processing`
3. Kiểm tra `metadata.detected_rallies` → nếu có, dùng cache (skip Gemini)
4. Nếu không: download raw video → upload Gemini Files API → poll ACTIVE → gửi prompt → parse JSON
5. Cache timestamps vào `jobs.metadata`
6. `ThreadPoolExecutor(4)` cắt parallel:
   - `FFmpeg extract_clip` → upload R2
   - `FFmpeg extract_thumbnail` (frame tại giữa clip) → upload R2
   - Insert clip row Supabase (realtime push xuống browser)
7. Update job `done` + `clip_count`
8. Xóa file video trên Google Files API

### Retry / Reextract
- **Retry**: reset job `pending` (giữ Gemini cache → chỉ cắt lại, không detect lại)
- **Reextract**: xóa clips R2 + clips DB + xóa `detected_rallies` cache + reset `pending` (detect lại từ đầu)

## Auth & Route protection

`src/proxy.ts` (Next.js 16 — thay `middleware.ts`) chặn tất cả route trừ:
- `/login` — trang đăng nhập
- `/share/*` — share link công khai
- `/_next/*`, `/favicon.ico`

Redirect: `→ /login?next=<path>` khi chưa đăng nhập.

Sessions dùng cookie (Supabase SSR) — không dùng localStorage.

## FFmpeg HEVC/mobile support

Splitter detect codec + container trước khi chọn strategy:

| Input | Strategy |
|---|---|
| H.264, plain MP4, no VFR, no rotation | Stream copy (nhanh nhất) |
| HEVC bất kỳ | Double-seek (`-ss start-5 -i input -ss 5`) + re-encode |
| H.264 nhưng VFR/rotation/HDR | Re-encode |
| AV1, ProRes, khác | Re-encode |

Re-encode output: H.264 + AAC + yuv420p + faststart (browser-safe).

HDR: override metadata `-colorspace bt709 -color_trc bt709 -color_primaries bt709` (không dùng zscale — thư viện libzimg thường không có sẵn).

## Gemini prompt design

- **Language**: tiếng Anh (model chính xác hơn)
- **Context**: nhắc Vietnamese audio cues ("let's go", "trái/phải")
- **Scale check**: calibrate số lượng ("20 phút → 30-80 rallies, nếu <10 thì đang merge sai")
- **Dead-time**: liệt kê cụ thể cái gì không phải rally (serve fault, nhặt bóng, đi lại)
- **Output schema**: đơn giản `[{start, end, confidence}]` — không 9 fields phức tạp

Parser có 3 tầng fallback:
1. `json.loads(raw)` trực tiếp
2. Regex tìm `[...]` array trong text
3. Split by `},{` → regex extract `start/end/confidence` từng chunk

## Components chính

| Component | Chức năng |
|---|---|
| `VideoUpload` | Kéo thả + XHR + progress bar |
| `ProcessingStatus` | Badge + đồng hồ + Retry/Hủy buttons + Realtime |
| `RallyGallery` | Grid clip, autoplay, duration filter |
| `SessionGallery` | Như RallyGallery nhưng public (không có Sửa/Chia sẻ) |
| `VideoPlayer` | `<video>` + phím tắt + `onEnded` |
| `ShareDialog` | Share link clip đơn |
| `ShareSessionButton` | Share link toàn session |
| `CancelJobButton` | Confirm + DELETE `/api/jobs/[id]/cancel` |
| `ReextractButton` | POST `/api/jobs/[id]/reextract` |
| `ThemeProvider` / `ThemeToggle` | next-themes dark/light |
| `UserMenu` | Email + logout |
| ClipEditor suite | `TrimTimeline`, `SourcePlayer`, `TimecodeDisplay`, `EditControls` |

## API Routes

| Route | Method | Chức năng |
|---|---|---|
| `/api/upload-url` | POST | Presigned PUT URL cho R2 |
| `/api/raw-url` | POST | Presigned GET URL video gốc |
| `/api/jobs` | POST | Tạo job mới |
| `/api/jobs/[id]/retry` | POST | Reset failed/processing → pending |
| `/api/jobs/[id]/reextract` | POST | Xóa clips + reset pending |
| `/api/jobs/[id]/cancel` | DELETE | Xóa R2 + DB |

## Share routes (public)

| Route | Mô tả |
|---|---|
| `/share/[token]` | Xem clip đơn theo share_token |
| `/share/session/[jobId]` | Xem toàn bộ session (job phải status=done) |

Cả hai không cần auth (proxy.ts whitelist `/share/`).
