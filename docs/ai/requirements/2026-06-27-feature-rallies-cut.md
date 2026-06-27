---
phase: requirements
title: Yêu cầu & Hiểu vấn đề
description: Ứng dụng tự động cắt rally tennis — thay thế SwingVision với chi phí tối thiểu
---

# Yêu cầu & Hiểu vấn đề

## Vấn đề cần giải quyết

SwingVision ($15–20/tháng) tự cắt rally từ video tennis nhưng quá đắt với người dùng chỉ cần một tính năng đó. Mục tiêu: xây dụng thay thế open-source chạy local, chi phí <$2/tháng, chất lượng ngang.

## Người dùng mục tiêu

1 người duy nhất (tác giả) — tennis player kiêm frontend developer.

## Yêu cầu chức năng

### Upload
- [x] Upload video tennis (MP4, MOV, HEVC từ iPhone/Android/action cam)
- [x] Kéo thả với tiến trình realtime
- [x] Hỗ trợ file lớn (>1GB) qua presigned upload thẳng lên R2

### Phân tích AI
- [x] Tự động nhận diện các đoạn rally (loại dead time: lỗi giao bóng, nhặt bóng, đi lại)
- [x] Sử dụng Gemini 2.5 Flash (primary) — hiểu context video + audio
- [x] Fallback: RMS audio → YOLOv8 → MOG2 visual
- [x] Parallel processing 4 workers để giảm thời gian chờ

### Gallery & Player
- [x] Xem các clip rally đã cắt dạng grid
- [x] Video player với phím tắt
- [x] Autoplay tuần tự (clip phát xong → tự sang clip tiếp)
- [x] Filter clip theo duration (Tất cả / ≥5s / ≥10s)
- [x] Trạng thái job realtime (pending → processing → done/failed)

### Chỉnh sửa
- [x] Chỉnh sửa in/out point thủ công
- [x] Xem video gốc trong editor
- [x] Reset về timestamp AI gốc

### Chia sẻ
- [x] Link chia sẻ clip đơn — public, không cần đăng nhập
- [x] Link chia sẻ toàn bộ session — public, không cần đăng nhập

### Quản lý
- [x] Retry job failed
- [x] Hủy job + xóa toàn bộ files (R2 + DB)
- [x] Reextract: extract lại từ đầu, bỏ clips cũ

### Auth
- [x] Đăng nhập email/password (single user)
- [x] Tất cả routes trừ `/share/*` yêu cầu đăng nhập

### UI/UX
- [x] Dark mode / Light mode với toggle
- [x] Responsive (desktop-first, dùng trên MacBook)

## Yêu cầu phi chức năng

- Chi phí: <$2/tháng (R2 free tier 10GB, Gemini ~$0.03/video, Vercel Hobby $0)
- Worker: chạy local trên máy người dùng (không cần server riêng)
- Tương thích video: iPhone .MOV, Samsung .MP4 HEVC, action cam với HDR/VFR
- Thời gian xử lý: <5 phút cho video 20 phút (~20 clips)
- Output clip: H.264 + AAC + yuv420p (browser-safe 100%)

## Tiêu chí hoàn thành (đã đạt — 2026-06-27)

- [x] Upload video → xử lý → xem clips, toàn bộ <5 phút
- [x] Clip được cắt đúng rally, không có dead time
- [x] Share link hoạt động mà không cần đăng nhập
- [x] App chỉ cho phép truy cập khi đã đăng nhập
- [x] Dark/light mode toggle
- [x] Video từ iPhone và Samsung đều xử lý được
- [x] Source code trên GitHub (`duongyeudoi/tennis-cut`)

## Ngoài phạm vi

- Mobile app (Web-first MVP)
- Record trực tiếp từ app
- Nhiều người dùng / đăng ký
- Highlight reel tự động
- Phân tích kỹ thuật (tốc độ bóng, thống kê)
