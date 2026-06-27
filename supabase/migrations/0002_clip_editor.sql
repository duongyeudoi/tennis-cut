-- Migration này chạy nếu bảng clips đã tồn tại từ migration 0001 (không cần nếu chạy 0001 từ đầu)
-- 0001 đã bao gồm tất cả cột cần thiết cho clip editor.
-- File này chỉ để ghi chú sự thay đổi schema so với thiết kế ban đầu.

-- Nếu cần migrate từ schema cũ chưa có ai_start_sec / edit_status:
-- ALTER TABLE clips ADD COLUMN IF NOT EXISTS ai_start_sec float;
-- ALTER TABLE clips ADD COLUMN IF NOT EXISTS ai_end_sec float;
-- ALTER TABLE clips ADD COLUMN IF NOT EXISTS edit_status text NOT NULL DEFAULT 'original'
--   CHECK (edit_status IN ('original', 'pending_recut', 'recut'));
-- ALTER TABLE clips ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
-- UPDATE clips SET ai_start_sec = start_sec, ai_end_sec = end_sec WHERE ai_start_sec IS NULL;
-- ALTER TABLE clips ALTER COLUMN ai_start_sec SET NOT NULL;
-- ALTER TABLE clips ALTER COLUMN ai_end_sec SET NOT NULL;

SELECT 1; -- no-op
