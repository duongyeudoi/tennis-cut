---
phase: testing
title: Chiến lược kiểm thử
description: Định nghĩa cách tiếp cận kiểm thử, test cases và đảm bảo chất lượng
---

# Chiến lược kiểm thử

## Mục tiêu độ phủ kiểm thử
**Mức độ kiểm thử cần đạt?**

- Mục tiêu độ phủ unit test (mặc định: 100% code mới/đã thay đổi)
- Phạm vi integration test (critical paths + xử lý lỗi)
- Các kịch bản end-to-end (luồng người dùng chính)
- Căn chỉnh với tiêu chí chấp nhận trong requirements/design

## Unit Tests
**Những thành phần nào cần kiểm thử riêng lẻ?**

### Component/Module 1
- [ ] Test case 1: [Mô tả] (bao gồm kịch bản / nhánh)
- [ ] Test case 2: [Mô tả] (bao gồm edge case / xử lý lỗi)
- [ ] Độ phủ bổ sung: [Mô tả]

### Component/Module 2
- [ ] Test case 1: [Mô tả]
- [ ] Test case 2: [Mô tả]
- [ ] Độ phủ bổ sung: [Mô tả]

## Integration Tests
**Kiểm thử tương tác giữa các thành phần như thế nào?**

- [ ] Kịch bản tích hợp 1
- [ ] Kịch bản tích hợp 2
- [ ] Test API endpoint
- [ ] Kịch bản tích hợp 3 (chế độ lỗi / rollback)

## End-to-End Tests
**Những luồng người dùng nào cần xác thực?**

- [ ] Luồng người dùng 1: [Mô tả]
- [ ] Luồng người dùng 2: [Mô tả]
- [ ] Kiểm thử critical path
- [ ] Kiểm tra regression các tính năng liền kề

## Dữ liệu kiểm thử
**Dùng dữ liệu gì để kiểm thử?**

- Test fixtures và mocks
- Yêu cầu seed data
- Cài đặt test database

## Báo cáo & Độ phủ kiểm thử
**Xác minh và truyền đạt kết quả kiểm thử như thế nào?**

- Lệnh chạy coverage và ngưỡng (`npm run test -- --coverage`)
- Khoảng trống độ phủ (file/function dưới 100% và lý do)
- Link đến báo cáo kiểm thử hoặc dashboard
- Kết quả kiểm thử thủ công và ký duyệt

## Kiểm thử thủ công
**Những gì cần người xác nhận?**

- Checklist kiểm thử UI/UX (bao gồm khả năng tiếp cận)
- Tương thích trình duyệt/thiết bị
- Smoke test sau khi deploy

## Kiểm thử hiệu suất
**Xác thực hiệu suất như thế nào?**

- Kịch bản load testing
- Cách tiếp cận stress testing
- Benchmark hiệu suất

## Theo dõi lỗi
**Quản lý vấn đề như thế nào?**

- Quy trình theo dõi issue
- Mức độ nghiêm trọng của bug
- Chiến lược regression testing
