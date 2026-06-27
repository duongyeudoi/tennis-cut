---
phase: deployment
title: Chiến lược triển khai
description: Định nghĩa quy trình deploy, hạ tầng và thủ tục phát hành
---

# Chiến lược triển khai

## Hạ tầng
**Ứng dụng sẽ chạy ở đâu?**

- Nền tảng hosting (Vercel cho frontend, local machine cho worker)
- Các thành phần hạ tầng (database Supabase, lưu trữ R2)
- Tách môi trường (dev local, production Vercel)

## Pipeline triển khai
**Triển khai thay đổi như thế nào?**

### Quy trình build
- Các bước build và lệnh
- Biên dịch/tối ưu assets
- Cấu hình môi trường

### CI/CD Pipeline
- Cổng kiểm thử tự động
- Tự động hoá build
- Tự động hoá deploy

## Cấu hình môi trường
**Các cài đặt nào khác nhau theo môi trường?**

### Development (local)
- Chi tiết cấu hình
- Cài đặt local

### Production (Vercel)
- Chi tiết cấu hình
- Cài đặt monitoring

## Các bước triển khai
**Quy trình phát hành là gì?**

1. Checklist trước khi deploy
2. Các bước thực hiện deploy
3. Xác nhận sau khi deploy
4. Thủ tục rollback (nếu cần)

## Database Migrations
**Xử lý thay đổi schema như thế nào?**

- Chiến lược migration
- Thủ tục backup
- Cách tiếp cận rollback

## Quản lý Secrets
**Xử lý dữ liệu nhạy cảm như thế nào?**

- Biến môi trường
- Giải pháp lưu trữ secret
- Chiến lược xoay vòng key

## Kế hoạch Rollback
**Nếu có sự cố thì làm gì?**

- Điều kiện kích hoạt rollback
- Các bước rollback
- Kế hoạch thông báo
