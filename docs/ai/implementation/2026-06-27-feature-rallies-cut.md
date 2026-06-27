---
phase: implementation
title: Hướng dẫn triển khai
description: Ghi chú kỹ thuật, patterns và quyết định implementation thực tế
---

# Hướng dẫn triển khai

## Cài đặt môi trường

### Frontend
```bash
pnpm install
cp .env.local.example .env.local   # điền credentials
pnpm dev                            # http://localhost:3000
```

### Python Worker
```bash
cd worker
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# ffmpeg phải cài sẵn: brew install ffmpeg
python main.py
```

### Biến môi trường bắt buộc (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
NEXT_PUBLIC_R2_PUBLIC_URL=       # URL public của bucket rallies-clips
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash    # tuỳ chọn, mặc định đã set trong code
DETECTOR=gemini                  # gemini | audio | yolo | mog2 | auto
CLIP_WORKERS=4                   # số worker parallel cho clip processing
```

---

## Cấu trúc code

```
src/
  app/
    page.tsx                        — trang chủ (upload + job list)
    jobs/[id]/page.tsx              — job detail + gallery
    jobs/[id]/clips/[clipId]/page.tsx — clip editor
    share/[token]/page.tsx          — share clip đơn (public)
    share/session/[jobId]/page.tsx  — share session (public)
    login/page.tsx                  — login email/password
    api/
      upload-url/route.ts           — presigned PUT cho R2
      raw-url/route.ts              — presigned GET video gốc
      jobs/[id]/retry/route.ts      — reset failed/processing → pending
      jobs/[id]/reextract/route.ts  — xóa clips + reset pending
      jobs/[id]/cancel/route.ts     — xóa R2 objects + xóa DB
  components/
    VideoUpload.tsx                 — upload kéo thả
    RallyGallery.tsx                — gallery với autoplay + filter
    SessionGallery.tsx              — gallery cho trang share session
    VideoPlayer.tsx                 — <video> với phím tắt + onEnded
    ProcessingStatus.tsx            — badge trạng thái + realtime
    ShareDialog.tsx                 — dialog share clip đơn
    ShareSessionButton.tsx          — dialog share session
    CancelJobButton.tsx             — xóa hẳn job + files
    ReextractButton.tsx             — extract lại từ đầu
    ThemeProvider.tsx               — next-themes wrapper
    ThemeToggle.tsx                 — icon sun/moon
    UserMenu.tsx                    — email + logout
    ClipEditor/
      ClipEditor.tsx, SourcePlayer.tsx, TrimTimeline.tsx
      TimecodeDisplay.tsx, EditControls.tsx
    ui/                             — shadcn/ui components (Base UI)
  lib/
    supabase.ts                     — browser client (createBrowserClient)
    supabase-server.ts              — server client (createServerClient + cookies)
    r2.ts                           — S3Client + presigned URLs + deleteObject/deleteByPrefix
  proxy.ts                          — auth middleware (Next.js 16 convention)
  types/database.ts                 — TypeScript types: Job, Clip, Database

worker/
  main.py            — vòng lặp poll, parallel clip processing, recut_clip
  config.py          — load .env.local, constants
  detector_gemini.py — Gemini 2.5 Flash primary detector
  detector_audio.py  — RMS energy fallback
  detector_yolo.py   — YOLOv8-nano fallback
  detector.py        — MOG2 visual fallback
  splitter.py        — FFmpeg: extract_clip + extract_thumbnail
  uploader.py        — download từ R2, upload clip/thumb
  requirements.txt
```

---

## Ghi chú kỹ thuật quan trọng

### Next.js 16 breaking changes
- `middleware.ts` → `proxy.ts`, export `proxy` thay vì `middleware`
- shadcn/ui dùng **Base UI** (không phải Radix UI) — không có `asChild` prop
- Dùng `render={<Button />}` thay `asChild` cho `DialogTrigger`

### Supabase Auth với SSR
- Browser client: `createBrowserClient` từ `@supabase/ssr` — session lưu trong cookie
- Server client: `createSupabaseServerClient()` trong `supabase-server.ts` — đọc cookie từ request
- `proxy.ts`: refresh session + redirect `/login?next=<path>` nếu chưa đăng nhập
- Routes public: `/login`, `/share/*` (không bị proxy chặn)

### Cloudflare R2 với AWS SDK v3
- `requestChecksumCalculation: "WHEN_REQUIRED"` (chữ hoa) — R2 reject nếu có CRC32 tự động
- Bucket `rallies-raw`: private, dùng presigned URL để browser PUT và GET
- Bucket `rallies-clips`: public, URL thẳng không cần presigned

### Gemini detector flow
1. Upload video local → Google Files API
2. Poll cho đến khi `state == ACTIVE`
3. Gửi prompt → nhận JSON array `[{start, end, confidence}]`
4. Xóa file khỏi Google ngay sau khi xong
5. Cache timestamps vào `jobs.metadata.detected_rallies` trước khi cắt
6. Retry không upload lại nếu cache còn

### FFmpeg HEVC/mobile support
- iPhone (.MOV, HEVC): double-seek trick `ffmpeg -ss (start-5) -i input -ss 5`
- HDR: override `-colorspace bt709 -color_trc bt709 -color_primaries bt709`
- VFR (iPhone): `-r {avg_frame_rate}` → convert sang CFR
- Odd dimensions: `scale=trunc(iw/2)*2:trunc(ih/2)*2`
- Không dùng `zscale` (cần libzimg thường không có sẵn)
- Output luôn H.264 + AAC + yuv420p để browser phát được

### Parallel clip processing
- `ThreadPoolExecutor(max_workers=CLIP_WORKERS)` trong `main.py`
- Mỗi worker: FFmpeg extract → thumbnail → upload R2 (2 files)
- Partial success: clip lỗi bị bỏ qua, clips thành công vẫn được lưu
- Fail hoàn toàn chỉ khi 100% clip đều lỗi

### Gemini prompt design
- Tiếng Anh (model hiệu quả hơn), nhưng mention Vietnamese audio cues
- Scale check: "20 phút → 30-80 clips, nếu <10 thì đang merge sai"
- Output đơn giản: `[{start, end, confidence}]` — không có 9 fields phức tạp
- JSON parser có 3 fallback: parse trực tiếp → regex `\[.*\]` → extract per-chunk

---

## Patterns thường dùng

### Realtime subscription (client component)
```tsx
useEffect(() => {
  const channel = supabase.channel(`job-${id}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${id}` },
      (payload) => setJob(payload.new as Job))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [id]);
```

### Server Component lấy user
```tsx
const sb = await createSupabaseServerClient();
const { data: { user } } = await sb.auth.getUser();
```

### R2 delete khi cancel job
```ts
await Promise.allSettled([
  deleteObject(BUCKET_RAW, job.raw_video_key),
  deleteByPrefix(BUCKET_CLIPS, `clips/${id}/`),
  deleteByPrefix(BUCKET_CLIPS, `thumbs/${id}/`),
]);
```
