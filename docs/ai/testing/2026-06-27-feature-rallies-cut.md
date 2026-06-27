---
phase: testing
title: Chiến lược kiểm thử
description: Checklist kiểm thử thủ công cho các luồng chính của rallies-cut
---

# Chiến lược kiểm thử

Không có automated test. Mọi kiểm thử đều là manual. Dùng checklist này trước mỗi lần deploy.

## Luồng Upload

- [ ] Kéo thả file .MP4 vào drop zone → tiến trình hiện đúng %
- [ ] Upload xong → redirect sang `/jobs/[id]`
- [ ] Status badge hiện `pending` → chuyển `processing` khi worker pick up
- [ ] Upload file `.MOV` (iPhone HEVC) → xử lý bình thường
- [ ] Upload file HEVC (Samsung Android) → không lỗi FFmpeg

## Worker & Gemini

- [ ] Worker poll → chọn job `pending` → cập nhật status `processing`
- [ ] Gemini trả về JSON hợp lệ → clip được cắt đúng timestamp
- [ ] Gemini trả về JSON malformed → parser fallback regex hoạt động, không crash
- [ ] Worker crash giữa chừng → timestamps cache trong `jobs.metadata` → restart không upload lại video Gemini
- [ ] Nút Retry trên job `failed` → status reset `pending` → worker pick up lại
- [ ] Parallel 4 workers → 20 clip xử lý trong ~2.5 phút (thay vì 10 phút sequential)

## Gallery & Player

- [ ] Job `done` → gallery hiện đúng số clip
- [ ] Click clip → video phát đúng
- [ ] Phím Space → play/pause
- [ ] Phím ←/→ → seek -5s / +5s
- [ ] Autoplay: clip phát xong → tự chuyển clip tiếp, card highlight + scroll vào view
- [ ] Filter "≥ 5 giây" → ẩn clip ngắn hơn 5s
- [ ] Filter "≥ 10 giây" → ẩn clip ngắn hơn 10s
- [ ] Filter "Tất cả" → hiện toàn bộ

## Chia sẻ

- [ ] Nút "Chia sẻ" trên clip → dialog mở với URL đúng
- [ ] URL `/share/[token]` truy cập được mà không cần đăng nhập
- [ ] Nút "Chia sẻ session" → dialog với URL `/share/session/[id]`
- [ ] URL `/share/session/[id]` → gallery đầy đủ (autoplay + filter hoạt động)
- [ ] URL dài không overflow ra ngoài dialog (`break-all`)
- [ ] Nút Copy → toast "Đã copy link"

## Clip Editor

- [ ] Nút Sửa → redirect `/jobs/[id]/clips/[clipId]`
- [ ] Video gốc load trong SourcePlayer
- [ ] Kéo slider left/right → timecode cập nhật đúng
- [ ] Ghost AI markers hiện đúng vị trí ban đầu
- [ ] Nút Lưu → worker recut → clip mới upload → gallery cập nhật
- [ ] Nút Reset về AI → markers về vị trí ban đầu
- [ ] Nút Huỷ → về gallery, không lưu

## Auth

- [ ] Truy cập `/` không đăng nhập → redirect `/login?next=/`
- [ ] Đăng nhập sai password → hiện lỗi
- [ ] Đăng nhập đúng → redirect về `next` param
- [ ] Logout → redirect `/login`
- [ ] Trang `/share/*` không cần đăng nhập → truy cập được bình thường

## Cancel & Reextract

- [ ] Nút Huỷ job → confirm dialog → xóa R2 + DB → redirect `/`
- [ ] Nút Reextract → xóa clips cũ → reset `pending` → worker pick up lại
- [ ] Nút Hủy trên job `processing` → gọi retry API → reset về `pending`

## Dark / Light Mode

- [ ] Click ThemeToggle → chuyển dark ↔ light
- [ ] Reload trang → theme được giữ nguyên (localStorage)
- [ ] System dark mode → app tự chọn dark khi không có preference

---

## Kết quả kiểm thử (2026-06-27)

Tất cả luồng chính test thủ công và pass. Edge cases đã xử lý và verify:
- HEVC double-seek fix (Samsung Galaxy)
- HDR color override (không cần zscale / libzimg)
- Gemini malformed JSON recovery (regex per-chunk fallback)
- Link `break-all` trong modal dialog
- Autoplay scroll với `cardRefs.current[index]?.scrollIntoView`
- `proxy.ts` thay `middleware.ts` (Next.js 16 breaking change)
- `DialogTrigger render={<Button />}` thay `asChild` (Base UI không có asChild)
