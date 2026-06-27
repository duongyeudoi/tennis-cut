---
phase: planning
title: Kế hoạch dự án & Phân chia công việc
description: Danh sách task MVP cho rallies-cut — upload web, xử lý AI local, chia sẻ qua link
---

# Kế hoạch dự án & Phân chia công việc

## Milestones

- [ ] **M1 — Scaffold dự án & hạ tầng** — Next.js app + Supabase schema + R2 buckets kết nối xong
- [ ] **M2 — Luồng upload** — Upload kéo thả lên R2 với tiến trình, job được tạo trong DB
- [ ] **M3 — Python worker chạy local** — Poll jobs, nhận diện rally với OpenCV/YOLO, cắt bằng FFmpeg, upload clip
- [ ] **M4 — Gallery rally & player** — Xem clip đã xử lý trên trình duyệt, cập nhật trạng thái realtime
- [ ] **M5 — Chia sẻ qua link** — Trang chia sẻ công khai cho một rally, không cần đăng nhập
- [ ] **M6 — Clip editor** — Chỉnh sửa in/out point thủ công với ngữ cảnh footage gốc, worker cắt lại
- [ ] **M7 — Hoàn thiện & tự kiểm tra** — Test end-to-end với footage trận thật, tinh chỉnh ngưỡng nhận diện

---

## Phân chia công việc

### M1 — Scaffold dự án & hạ tầng

- [x] **1.1 — Khởi tạo project Next.js 15 + shadcn/ui**
  - `npx create-next-app@latest` với App Router, TypeScript, Tailwind CSS v4
  - `npx shadcn@latest init` để cài đặt shadcn/ui
  - Cài components cần thiết: `npx shadcn@latest add button card progress badge skeleton separator dialog slider tooltip sonner alert`
  - Kết quả: `npm run dev` chạy không có lỗi, shadcn components import được
  - Ước tính: 45 phút

- [x] **1.2 — Tạo Supabase project + schema**
  - Tạo project trên supabase.com (free tier)
  - Chạy migration: tạo bảng `jobs` và `clips` (xem design doc)
  - Bật Realtime trên bảng `jobs`
  - Đặt RLS: insert có xác thực cho `jobs`; public read trên `clips` qua `share_token`
  - Kết quả: Các bảng tồn tại, RLS policies hoạt động
  - Ước tính: 1 giờ

- [x] **1.3 — Tạo Cloudflare R2 buckets**
  - Bucket `rallies-raw` (private)
  - Bucket `rallies-clips` (public — bật public access)
  - Tạo R2 API token (read+write) cho worker và Next.js server
  - Kết quả: Có thể PUT/GET objects qua boto3 hoặc S3 SDK
  - Ước tính: 30 phút

- [x] **1.4 — Cấu hình biến môi trường**
  - `.env.local` với: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`
  - Thêm `.env.local` vào `.gitignore`
  - Kết quả: Tất cả env vars truy cập được trong Next.js và Python worker
  - Ước tính: 15 phút

**Phụ thuộc M1:** Không có — bắt đầu từ đây.

---

### M2 — Luồng upload

- [x] **2.1 — Route tạo presigned upload URL**
  - `GET /api/upload-url?filename=x&size=y` → trả presigned PUT URL cho bucket `rallies-raw`
  - Định dạng key: `raw/{uuid}/original{ext}`
  - Kết quả: curl với presigned URL PUT file thành công lên R2
  - Ước tính: 1 giờ
  - Phụ thuộc: 1.3, 1.4

- [x] **2.2 — Component VideoUpload**
  - Zone kéo thả + file picker
  - Client-side: lấy presigned URL → PUT lên R2 bằng XHR (để có progress events)
  - Hiển thị thanh tiến trình upload (% bytes đã gửi)
  - Ước tính: 2–3 giờ
  - Phụ thuộc: 2.1

- [x] **2.3 — Tạo job trong Supabase sau khi upload**
  - Sau khi PUT R2 thành công, POST lên Supabase `jobs` với `raw_video_key` và `status: 'pending'`
  - Chuyển hướng đến `/jobs/[id]`
  - Kết quả: Row xuất hiện trong bảng `jobs` với status `pending`
  - Ước tính: 1 giờ
  - Phụ thuộc: 2.2, 1.2

- [x] **2.4 — UI trang upload**
  - `app/page.tsx` — card upload căn giữa, hướng dẫn, danh sách job gần đây
  - Tailwind styling — gọn, thân thiện mobile
  - Ước tính: 1–2 giờ
  - Phụ thuộc: 2.2, 2.3

**Phụ thuộc M2:** M1 hoàn thành.

---

### M3 — Python Worker chạy local

- [ ] **3.1 — Scaffold project worker**
  - Thư mục `worker/` với `main.py`, `requirements.txt`
  - Dependencies: `opencv-python-headless`, `ultralytics`, `boto3`, `supabase`, `python-dotenv`, `ffmpeg-python`
  - Load cùng `.env.local` cho credentials
  - Kết quả: `python worker/main.py` chạy không có lỗi import
  - Ước tính: 30 phút

- [ ] **3.2 — Tải video gốc từ R2**
  - `uploader.py`: `download_video(job_id, dest_path)` dùng boto3
  - Stream download để tránh vấn đề bộ nhớ với file lớn
  - Kết quả: File test 500MB tải thành công
  - Ước tính: 1 giờ
  - Phụ thuộc: 3.1

- [ ] **3.3 — Nhận diện rally (motion-based v1)**
  - `detector.py`: tiếp cận OpenCV frame-diff trước (nhanh hơn để implement)
  - Lấy mẫu ở 2fps, tính độ lớn sai khác giữa các frame
  - Phân loại là RALLY khi diff > ngưỡng trong ≥ 1s
  - Gộp các segment liền kề, áp padding ±1.5s
  - Lọc rally < 3s (có thể cấu hình `MIN_RALLY_SEC`)
  - Output: `list[tuple[float, float]]` — (start_sec, end_sec)
  - Ước tính: 3–4 giờ
  - Phụ thuộc: 3.1

- [ ] **3.4 — Nhận diện rally (YOLO v2, nâng cấp tuỳ chọn)**
  - Load `yolov8n.pt`, detect class 32 (sports ball) và class 0 (person)
  - Dùng sự hiện diện của bóng + chuyển động người làm tín hiệu mạnh hơn
  - Chỉ bật nếu độ chính xác motion-based v1 < 80%
  - Ước tính: thêm 2–3 giờ
  - Phụ thuộc: 3.3

- [ ] **3.5 — Trích xuất clip bằng FFmpeg**
  - `splitter.py`: với mỗi segment gọi FFmpeg để trích xuất clip
  - Dùng `-c copy` (không re-encode) cho tốc độ; fallback re-encode nếu seek không chính xác
  - Tạo thumbnail bằng `ffmpeg -ss {mid} -frames:v 1 thumb.jpg`
  - Ước tính: 2 giờ
  - Phụ thuộc: 3.3

- [ ] **3.6 — Upload clip lên R2**
  - PUT mỗi clip lên `rallies-clips/{job_id}/{index:03d}.mp4`
  - PUT mỗi thumbnail lên `rallies-clips/{job_id}/{index:03d}.jpg`
  - Dùng public bucket URL cho clip
  - Ước tính: 1 giờ
  - Phụ thuộc: 3.5

- [ ] **3.7 — Cập nhật Supabase với kết quả**
  - Chèn rows vào bảng `clips` (clip_index, start_sec, end_sec, clip_key, thumbnail_key, share_token)
  - Cập nhật `jobs.status = 'done'`, `jobs.clip_count = n`
  - Khi có exception: cập nhật `jobs.status = 'failed'`, `jobs.error_msg`
  - Ước tính: 1 giờ
  - Phụ thuộc: 3.6, 1.2

- [ ] **3.8 — Vòng lặp poll**
  - `main.py`: vòng lặp vô hạn, poll mỗi 10s cho job có `status = 'pending'`
  - Đặt job thành `processing` trước khi bắt đầu (tránh xử lý trùng lặp)
  - Log tiến trình ra stdout
  - Ước tính: 1 giờ
  - Phụ thuộc: 3.2, 3.7

**Phụ thuộc M3:** M1 hoàn thành. M2 không bắt buộc (có thể test bằng cách chèn job row thủ công).

---

### M4 — Gallery rally & Player

- [ ] **4.1 — Trang trạng thái job**
  - `app/jobs/[id]/page.tsx`
  - Subscribe Supabase Realtime trên row `jobs`
  - Hiển thị spinner + text trạng thái khi `pending` / `processing`
  - Hiển thị component `ProcessingStatus` (thời gian đã trôi qua, % ước tính)
  - Ước tính: 2 giờ
  - Phụ thuộc: 1.2, M2

- [ ] **4.2 — Component RallyGallery**
  - `RallyGallery.tsx`: lưới card clip
  - Mỗi card: thumbnail, thời lượng, số thứ tự rally, nút chia sẻ
  - Tải clip từ Supabase khi job status = `done`
  - Ước tính: 2 giờ
  - Phụ thuộc: 4.1, M3

- [ ] **4.3 — Video player trên trình duyệt**
  - `VideoPlayer.tsx`: thẻ `<video>` native với controls
  - Lấy presigned GET URL cho clip private HOẶC dùng public URL
  - Phím tắt: space = play/pause, trái/phải = ±5s
  - Ước tính: 1–2 giờ
  - Phụ thuộc: 4.2

- [ ] **4.4 — Route presigned clip URL**
  - `GET /api/clip-url?key=x` → presigned GET URL (hết hạn sau 1 giờ)
  - Chỉ cho clip trong bucket private (nếu thêm chế độ private sau)
  - MVP, bucket clip là public — không cần presigned URL
  - Ước tính: 30 phút (có thể bỏ qua cho MVP)

**Phụ thuộc M4:** M3 hoàn thành hoặc có thể test với clip giả.

---

### M5 — Chia sẻ qua link

- [ ] **5.1 — Trang chia sẻ công khai**
  - `app/share/[token]/page.tsx`
  - Server component: query Supabase tìm clip theo `share_token`
  - Render `VideoPlayer` + metadata clip (số rally, thời lượng, ngày)
  - Trả 404 nếu không tìm thấy token
  - Ước tính: 1–2 giờ
  - Phụ thuộc: M3 (share_token được tạo khi chèn clip)

- [ ] **5.2 — UI sao chép link chia sẻ**
  - Trong card `RallyGallery`: nút "Chia sẻ" copy `https://yourapp.com/share/{token}` vào clipboard
  - Toast thông báo khi copy
  - Ước tính: 30 phút
  - Phụ thuộc: 4.2, 5.1

- [ ] **5.3 — Deploy lên Vercel**
  - `vercel deploy` (free hobby plan)
  - Đặt biến môi trường trong Vercel dashboard
  - Kết quả: URL công khai truy cập được, share link hoạt động
  - Ước tính: 1 giờ
  - Phụ thuộc: M4, 5.1

**Phụ thuộc M5:** M4 hoàn thành, clip trong R2 public bucket.

---

### M6 — Clip Editor

- [ ] **6.1 — Cập nhật DB schema: thêm cột editor vào `clips`**
  - Thêm `ai_start_sec`, `ai_end_sec` (giá trị AI bất biến)
  - Thêm cột `edit_status` (`original` | `pending_recut` | `recut`)
  - Thêm cột `updated_at`
  - Migration: điền `ai_start_sec`/`ai_end_sec` từ `start_sec`/`end_sec` hiện có
  - Kết quả: Schema khớp với design doc
  - Ước tính: 30 phút
  - Phụ thuộc: 1.2

- [ ] **6.2 — Route presigned URL video gốc**
  - `GET /api/raw-url?job_id=x` → presigned GET URL cho `rallies-raw/{job_id}/original.mp4`
  - Hết hạn: 2 giờ (đủ cho một phiên chỉnh sửa)
  - Kết quả: Trình duyệt có thể stream video gốc từ R2
  - Ước tính: 30 phút
  - Phụ thuộc: 1.3, 1.4

- [ ] **6.3 — Component TrimTimeline**
  - Scrubber nằm ngang hiển thị cửa sổ ±30s căn giữa theo bounds clip hiện tại
  - Tay cầm kéo IN (trái) và OUT (phải)
  - Khi kéo: seek `<video>` đến vị trí đó trong footage gốc
  - Phím tắt: `[` đặt in-point tại thời điểm hiện tại, `]` đặt out-point
  - Hiển thị bounds do AI phát hiện làm ghost marker (để tham chiếu)
  - Kết quả: Tay cầm snap vào range hợp lệ, video seek đúng
  - Ước tính: 3–4 giờ
  - Phụ thuộc: 6.2

- [ ] **6.4 — Component TimecodeDisplay**
  - Hiển thị `HH:MM:SS.f` của vị trí video hiện tại trong footage gốc
  - Cập nhật theo sự kiện `timeupdate` (throttled 100ms)
  - Hiển thị nhãn riêng: "▶ VÀO 00:23:44.1" và "RA 00:23:58.3 ◀"
  - Ước tính: 1 giờ
  - Phụ thuộc: 6.3

- [ ] **6.5 — Component SourcePlayer**
  - `<video>` native tải với presigned raw URL
  - `currentTime` đồng bộ với vị trí scrubber
  - Chỉ phát trong khoảng in/out bounds (dừng ở out-point, auto-loop nếu người dùng giữ play)
  - Ước tính: 1–2 giờ
  - Phụ thuộc: 6.2

- [ ] **6.6 — EditControls + luồng Lưu**
  - Nút Lưu: PATCH `clips/{id}` — `{start_sec, end_sec, edit_status: 'pending_recut'}`
  - Reset về AI: đặt `start_sec = ai_start_sec`, `end_sec = ai_end_sec`
  - Huỷ: điều hướng về gallery không lưu
  - Realtime subscription trên row clip: hiển thị spinner "Đang cắt lại..." khi `edit_status = 'pending_recut'`; làm mới clip player khi `edit_status = 'recut'`
  - Ước tính: 1.5 giờ
  - Phụ thuộc: 6.3, 6.4, 6.5

- [ ] **6.7 — Trang clip editor**
  - Route: `app/jobs/[id]/clips/[clipId]/page.tsx`
  - Ghép: SourcePlayer + TrimTimeline + TimecodeDisplay + EditControls
  - Hiển thị header metadata clip: Rally #N, bounds AI, bounds hiện tại, thời lượng
  - Nút "Chỉnh sửa" trên card RallyGallery link đến trang này
  - Ước tính: 1 giờ
  - Phụ thuộc: 6.3–6.6

- [ ] **6.8 — Worker: hàm recut_clip**
  - Poll cho clip có `edit_status = 'pending_recut'` (cùng vòng lặp với full jobs)
  - Chỉ tải xuống cửa sổ cần thiết: `ffmpeg -ss {start-5} -t {end-start+10} -i original.mp4` (tránh tải cả video)
  - Cắt lại với `start_sec`/`end_sec` mới, re-upload vào cùng R2 key (ghi đè)
  - Cập nhật `edit_status = 'recut'`, `clip_key` (có thể cùng key), `duration_sec`, `updated_at`
  - Khi lỗi: đặt `edit_status = 'original'`, ghi log lỗi
  - Ước tính: 2 giờ
  - Phụ thuộc: 3.5, 3.6, 3.7

**Phụ thuộc M6:** M4 hoàn thành (gallery tồn tại). Worker M3 đang chạy (để recut). M5 không bắt buộc.

---

### M7 — Hoàn thiện & Tự kiểm tra

- [ ] **7.1 — Test end-to-end với footage thật**
  - Upload clip trận đấu 30 phút thật
  - Kiểm tra thủ công 10 rally: độ chính xác, timing, loại bỏ dead time
  - Chỉnh sửa 2–3 clip bằng clip editor; xác minh chất lượng bản cắt lại
  - Tinh chỉnh `MIN_RALLY_SEC` và ngưỡng motion nếu cần
  - Ghi kết quả vào testing doc

- [ ] **7.2 — UI trạng thái lỗi**
  - Hiển thị thông báo lỗi trên trang job nếu `status = 'failed'`
  - Nút Thử lại (reset status về `pending`)
  - Hiển thị trạng thái lỗi trong clip editor nếu recut thất bại

- [ ] **7.3 — Worker khôi phục sự cố**
  - Khi khởi động, reset các job bị kẹt `processing` về `pending`
  - Reset các clip bị kẹt `pending_recut` về `original` (để người dùng có thể thử lại)
  - Ước tính: 30 phút

- [ ] **7.4 — README cơ bản**
  - Cách chạy worker local
  - Cách deploy Next.js lên Vercel
  - Các biến môi trường cần thiết

## Thứ tự phụ thuộc

```
M1 → M2 → (M3 có thể bắt đầu song song sau M1)
M3 + M2 → M4
M4 → M5 (share link)
M4 → M6 (clip editor, cần worker M3 để recut)
M5 + M6 → M7
```

Con đường nhanh nhất: scaffold hạ tầng (M1), xây upload (M2) và worker (M3) song song, rồi kết nối gallery (M4), rồi share link (M5) và clip editor (M6) song song, rồi self-test (M7).

---

## Timeline & Ước tính

| Milestone | Công sức | Tích luỹ |
|---|---|---|
| M1 — Hạ tầng | ~2.5 giờ | Ngày 1 |
| M2 — Upload | ~5 giờ | Ngày 2 |
| M3 — Worker | ~9 giờ | Ngày 3–4 |
| M4 — Gallery | ~5.5 giờ | Ngày 5 |
| M5 — Share + Deploy | ~3.5 giờ | Ngày 6 |
| M6 — Clip editor | ~9.5 giờ | Ngày 7–8 |
| M7 — Tự kiểm tra + hoàn thiện | ~2.5 giờ | Ngày 8–9 |
| **Tổng** | **~37 giờ** | **~1.5 tuần buổi tối** |

---

## Rủi ro & Giảm thiểu

| Rủi ro | Khả năng | Giảm thiểu |
|---|---|---|
| YOLOv8 quá chậm trên CPU cho video 2 giờ | Trung bình | Dùng motion-only detection trước; YOLO là nâng cấp tuỳ chọn |
| Frame-diff cho quá nhiều false positive (gió, bóng) | Trung bình | Tinh chỉnh ngưỡng; thêm temporal smoothing (yêu cầu ≥ 3 frame active) |
| Presigned URL R2 hết hạn trong khi upload file lớn | Thấp | Tạo URL với thời hạn 2 giờ; dùng multipart upload nếu >5GB |
| FFmpeg `-c copy` tạo clip không phát được do keyframe | Thấp | Fallback re-encode: `-c:v libx264 -preset fast` |
| Giới hạn Supabase free tier (500MB DB) | Rất thấp | Metadata clip rất nhỏ; 500MB chứa được hàng triệu row |
| Xử lý bị kẹt (crash giữa chừng) | Trung bình | Khôi phục sự cố trong 7.3; job bị kẹt reset khi worker khởi động lại |
| Trình duyệt không seek video gốc hiệu quả (file lớn) | Trung bình | Presigned URL hỗ trợ HTTP range requests; R2 phục vụ byte range natively |
| TrimTimeline kéo thả giật trên mobile | Thấp | MVP web-first; hoàn thiện mobile là phạm vi sau MVP |

---

## Tài nguyên cần thiết

- **Tài khoản Supabase** — free tier (supabase.com)
- **Tài khoản Cloudflare** — free R2 tier (cloudflare.com)
- **Tài khoản Vercel** — free hobby tier (vercel.com)
- **Máy local** — Python 3.10+, FFmpeg đã cài (`brew install ffmpeg`)
- **Node.js 20+** cho Next.js
- **Python packages** — opencv-python-headless, ultralytics, boto3, supabase-py

**Chi phí hạ tầng tổng cộng: $0/tháng cho MVP (trong giới hạn free tier)**

---

## Tóm tắt tiến độ

> *Cập nhật sau mỗi buổi implementation.*

Kế hoạch ban đầu tạo ngày 2026-06-27. Chưa bắt đầu triển khai. Bước tiếp theo: scaffold M1.
