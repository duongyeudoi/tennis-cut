---
phase: planning
title: Kế hoạch dự án & Phân chia công việc
description: Danh sách task MVP cho rallies-cut — upload web, xử lý AI local, chia sẻ qua link
---

# Kế hoạch dự án & Phân chia công việc

## Milestones

- [x] **M1 — Scaffold dự án & hạ tầng** — Next.js app + Supabase schema + R2 buckets kết nối xong
- [x] **M2 — Luồng upload** — Upload kéo thả lên R2 với tiến trình, job được tạo trong DB
- [x] **M3 — Python worker chạy local** — Poll jobs, nhận diện rally với Gemini/audio/YOLO/MOG2, cắt bằng FFmpeg, upload clip
- [x] **M4 — Gallery rally & player** — Xem clip đã xử lý, autoplay, filter duration, realtime updates
- [x] **M5 — Chia sẻ qua link** — Share clip đơn + share toàn session, không cần đăng nhập
- [x] **M6 — Clip editor** — Chỉnh sửa in/out point thủ công, worker cắt lại
- [x] **M7 — Hoàn thiện** — Auth, dark mode, navbar, cancel job, prompt tối ưu, GitHub

---

## Chi tiết công việc đã hoàn thành

### M1 — Scaffold ✅
- [x] Next.js 16 + shadcn/ui (Base UI) + Tailwind CSS v4 + TypeScript
- [x] Supabase schema: bảng `jobs`, `clips`, Realtime bật
- [x] R2 buckets: `rallies-raw` (private), `rallies-clips` (public)
- [x] `.env.local` với tất cả credentials

### M2 — Upload ✅
- [x] `/api/upload-url` — presigned PUT URL
- [x] `VideoUpload` component — kéo thả + XHR progress bar
- [x] Tạo job Supabase sau upload + redirect `/jobs/[id]`

### M3 — Python Worker ✅
- [x] `config.py` — load `.env.local`, cấu hình detector params
- [x] `uploader.py` — download từ R2, upload clip/thumbnail
- [x] `detector_gemini.py` — Gemini 2.5 Flash (primary): upload → ACTIVE → prompt → parse JSON → delete
- [x] `detector_audio.py` — RMS energy, tự động tính ngưỡng (fallback 1)
- [x] `detector_yolo.py` — YOLOv8-nano person tracking (fallback 2)
- [x] `detector.py` — MOG2 background subtraction, ROI 15–85% height (fallback 3)
- [x] `splitter.py` — FFmpeg: HEVC double-seek, HDR BT.709 override, VFR→CFR, odd dimension fix
- [x] `main.py` — parallel clip processing (`ThreadPoolExecutor`, 4 workers), cache timestamps, recut_clip, reset_stuck
- [x] Prompt Gemini tối ưu: Vietnamese audio cues, scale check, simplified output schema

### M4 — Gallery ✅
- [x] `ProcessingStatus` — badge, đồng hồ, retry button, hủy button
- [x] `RallyGallery` — grid, thumbnail, duration badge, autoplay, filter ≥5s/≥10s
- [x] `VideoPlayer` — phím tắt Space/←/→, `onEnded` callback
- [x] Nút Retry, Hủy, Reextract, Cancel (xóa R2 + DB)

### M5 — Share ✅
- [x] `/share/[token]` — clip đơn, public
- [x] `/share/session/[jobId]` — toàn bộ session với `SessionGallery`
- [x] `ShareDialog`, `ShareSessionButton` — dialog hiện link, `break-all` fix overflow

### M6 — Clip Editor ✅
- [x] `/api/raw-url` — presigned GET URL video gốc
- [x] `TrimTimeline`, `TimecodeDisplay`, `SourcePlayer`, `EditControls`
- [x] `/jobs/[id]/clips/[clipId]` — trang editor đầy đủ
- [x] Worker `recut_clip` — download raw → FFmpeg cắt → upload R2 → cập nhật DB

### M7 — Hoàn thiện ✅
- [x] Auth: `@supabase/ssr`, `src/proxy.ts` (Next.js 16), login page, UserMenu
- [x] Dark/Light mode: `next-themes`, `ThemeProvider`, `ThemeToggle`
- [x] Navbar sticky: logo + ThemeToggle + UserMenu
- [x] Gemini model update: `gemini-2.0-flash` → `gemini-2.5-flash`
- [x] JSON parser robust: recover từ malformed array (regex fallback per-chunk)
- [x] Push lên GitHub: `duongyeudoi/tennis-cut`

---

## Tóm tắt tiến độ

Cập nhật 2026-06-27. **Tất cả milestone M1–M7 hoàn thành.** App chạy local được, đã push lên GitHub. Bước tiếp theo: connect Vercel để deploy production (cần set env vars trên Vercel dashboard).
