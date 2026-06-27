---
phase: monitoring
title: Giám sát & Quan sát hệ thống
description: Định nghĩa chiến lược giám sát, metrics, alerts và xử lý sự cố
---

# Giám sát & Quan sát hệ thống

## Metrics chính
**Cần theo dõi những gì?**

### Metrics hiệu suất
- Thời gian phản hồi/độ trễ
- Throughput/request per second
- Sử dụng tài nguyên (CPU, bộ nhớ, ổ đĩa)

### Metrics nghiệp vụ
- Metrics tương tác người dùng
- Tỷ lệ chuyển đổi/thành công
- Mức độ sử dụng tính năng

### Metrics lỗi
- Tỷ lệ lỗi theo loại
- Request thất bại
- Theo dõi exception

## Công cụ giám sát
**Đang dùng công cụ gì?**

- Giám sát ứng dụng (APM)
- Giám sát hạ tầng
- Tổng hợp log
- Analytics người dùng

## Chiến lược logging
**Log gì và log như thế nào?**

- Mức độ và danh mục log
- Định dạng structured logging
- Chính sách lưu giữ log
- Xử lý dữ liệu nhạy cảm

## Alerts & Thông báo
**Khi nào và cách nào được thông báo?**

### Alerts nghiêm trọng
- Alert 1: [Điều kiện] → [Hành động]
- Alert 2: [Điều kiện] → [Hành động]

### Alerts cảnh báo
- Alert 1: [Điều kiện] → [Hành động]
- Alert 2: [Điều kiện] → [Hành động]

## Dashboards
**Trực quan hoá gì?**

- Dashboard sức khoẻ hệ thống
- Dashboard metrics nghiệp vụ
- View tuỳ chỉnh theo nhóm/vai trò

## Xử lý sự cố
**Xử lý vấn đề như thế nào?**

### Quy trình xử lý sự cố
1. Phát hiện và phân loại
2. Điều tra và chẩn đoán
3. Giải quyết và giảm thiểu
4. Post-mortem và rút kinh nghiệm

## Health Checks
**Xác minh sức khoẻ hệ thống như thế nào?**

- Kiểm tra health endpoint
- Kiểm tra dependency
- Smoke test tự động
