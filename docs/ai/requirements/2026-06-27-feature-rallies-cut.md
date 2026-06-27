---
phase: requirements
title: Yêu cầu & Hiểu vấn đề
description: Ứng dụng tự động cắt rally tennis — thay thế SwingVision với chi phí tối thiểu
---

# Yêu cầu & Hiểu vấn đề

## Mô tả vấn đề

SwingVision ($20+/tháng) tự động cắt video trận đấu tennis thành các đoạn rally và loại bỏ dead time (nhặt bóng, đi về baseline, chuẩn bị giao bóng). Người dùng chỉ cần đúng một tính năng đó, không cần phân tích kỹ thuật hay đo tốc độ cú đánh. Mục tiêu: xây dựng giải pháp tự host làm đúng việc này — với chi phí thấp nhất.

**Đối tượng:** Người chơi tennis tự quay trận đấu để review và chia sẻ với đối luyện tập.

**Cách giải quyết hiện tại:** Dùng subscription SwingVision — quá đắt so với việc chỉ dùng một tính năng.

## Mục tiêu

**Mục tiêu chính**
- Upload video trận đấu đầy đủ (1–3 giờ) và nhận lại danh sách clip rally với dead time đã được loại bỏ
- Chia sẻ từng clip rally qua link công khai (người nhận không cần đăng nhập)
- Web trước; mobile sau

**Mục tiêu phụ**
- Xử lý batch: upload một lần, tự động tạo nhiều clip
- Gallery để duyệt tất cả rally trong một buổi tập/thi đấu
- Chi phí vận hành thấp (<$5/tháng cho cá nhân)

**Không nằm trong phạm vi MVP**
- Phân tích kỹ thuật, đo tốc độ cú đánh, số liệu coaching
- Tài khoản nhiều người dùng / tính năng nhóm
- Live streaming / xử lý thời gian thực
- Quay video trực tiếp trong app (chỉ upload cho MVP)
- Thanh toán subscription

## User Stories & Use Cases

- Là người dùng, tôi muốn upload video trận đấu 2 giờ để app tự xử lý trong khi tôi làm việc khác
- Là người dùng, tôi muốn xem gallery tất cả rally đã phát hiện với thumbnail để nhanh chóng tìm những pha đấu hay
- Là người dùng, tôi muốn chia sẻ clip rally với HLV qua link đơn giản để họ không cần đăng nhập
- Là người dùng, tôi muốn xem lại rally trên trình duyệt với video đã cắt gọn (không cần đợi thời gian dead)
- Là người dùng, tôi muốn biết trạng thái xử lý (đang chờ / đang xử lý / xong) để không phải đoán mò
- Là người dùng, tôi muốn tự điều chỉnh điểm bắt đầu/kết thúc của clip để sửa trường hợp AI cắt sớm hoặc muộn
- Là người dùng, tôi muốn biết chính xác đoạn clip nằm ở đâu trong footage gốc (timecode) để có ngữ cảnh khi chỉnh sửa
- Là người dùng, tôi muốn trim bỏ dead time mà AI bỏ sót ở đầu/cuối clip
- Là người dùng, tôi muốn mở rộng clip để bao gồm thêm thời điểm ngay trước/sau rally đã phát hiện

**Luồng chính:**
```
Upload video → [tự động xử lý] → Xem gallery rally → [tuỳ chọn] Chỉnh sửa clip → Chia sẻ qua link
```

**Luồng clip editor:**
```
Mở clip → Xem clip đang phát với ±30s ngữ cảnh từ footage gốc
         → Kéo tay cầm in-point / out-point để điều chỉnh
         → Xem timecode vị trí hiện tại trong footage gốc
         → Lưu → worker cắt lại clip → clip đã cập nhật sẵn sàng
```

**Edge cases:**
- Rally rất ngắn (1–2 cú) — thời lượng tối thiểu có thể cấu hình
- Nghỉ dài (timeout chấn thương, changeover) — phải được coi là dead time
- Nhiều trận đấu trong một lần upload (không hỗ trợ MVP — một trận mỗi lần upload)
- Ánh sáng kém / sân trong nhà — độ chính xác nhận diện có thể giảm

## Tiêu chí thành công

- [ ] Upload video trận đấu 1080p 2 giờ qua trình duyệt web
- [ ] App phát hiện ≥ 80% rally chính xác (kiểm tra thủ công 20 rally)
- [ ] Dead time được loại bỏ — mỗi clip bắt đầu ≤ 2s trước chuyển động đầu tiên và kết thúc ≤ 2s sau chuyển động cuối
- [ ] Tất cả clip xem được trên trình duyệt không cần tải về
- [ ] Link chia sẻ hoạt động không cần đăng nhập với người nhận
- [ ] Xử lý end-to-end hoàn thành trong < 2× thời lượng video trên máy local (ví dụ: video 2 giờ → < 4 giờ xử lý)
- [ ] Chi phí hạ tầng tổng cộng < $5/tháng
- [ ] Clip editor tải footage gốc và hiển thị ±30s ngữ cảnh quanh clip
- [ ] Người dùng có thể kéo in/out point và xem trước đoạn đã điều chỉnh
- [ ] Timecode footage gốc được hiển thị khi scrub
- [ ] Sau khi lưu chỉnh sửa, clip đã cắt lại sẵn sàng trong vòng 30 giây

## Ràng buộc & Giả định

**Ràng buộc kỹ thuật**
- Xử lý chạy trên máy local của người dùng (không cần GPU cho MVP — CPU inference với YOLOv8-nano hoặc motion detection thuần túy)
- Lưu trữ video trên Cloudflare R2 (10GB miễn phí, sau đó $0.015/GB)
- Cơ sở dữ liệu trên Supabase free tier (500MB, 2 project)

**Giả định**
- Video được quay bằng camera cố định (tripod, bên sân), không phải action-cam
- Nền sân tennis tương đối tĩnh (nhận diện dựa vào chuyển động của người và bóng)
- Một người dùng duy nhất — không cần hàng đợi xử lý song song lúc mới ra mắt
- Có kết nối internet để upload/download (không có chế độ offline)

## Câu hỏi & Vấn đề cần làm rõ

- [ ] Hỗ trợ định dạng video nào? (Mặc định MP4, nhưng GoPro quay .mp4 / .mov)
- [ ] Ngưỡng thời lượng rally tối thiểu? (Mặc định: 3 giây)
- [ ] Clip có nên thêm 1–2s padding trước/sau rally để có ngữ cảnh không? (Có, có thể cấu hình)
- [ ] Lưu video trên R2 bao lâu? (Người dùng tự xoá cho đến nay)
