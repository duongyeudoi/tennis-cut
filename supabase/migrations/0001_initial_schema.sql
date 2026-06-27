-- Bảng jobs: mỗi row là một lần upload video để xử lý
CREATE TABLE jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz DEFAULT now(),
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  raw_video_key text NOT NULL,        -- R2 object key: raw/{id}/original.mp4
  duration_sec  integer,              -- thời lượng video (giây), điền sau khi xử lý
  clip_count    integer,              -- số clip tạo ra, điền sau khi xử lý
  error_msg     text,                 -- thông báo lỗi nếu thất bại
  metadata      jsonb DEFAULT '{}'    -- tên file gốc, kích thước, codec
);

-- Bảng clips: mỗi row là một đoạn rally đã được cắt
CREATE TABLE clips (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  clip_index      integer NOT NULL,   -- thứ tự trong buổi (bắt đầu từ 0)
  ai_start_sec    float NOT NULL,     -- timecode bắt đầu do AI phát hiện (bất biến)
  ai_end_sec      float NOT NULL,     -- timecode kết thúc do AI phát hiện (bất biến)
  start_sec       float NOT NULL,     -- timecode bắt đầu hiệu lực (user có thể chỉnh)
  end_sec         float NOT NULL,     -- timecode kết thúc hiệu lực (user có thể chỉnh)
  duration_sec    float GENERATED ALWAYS AS (end_sec - start_sec) STORED,
  clip_key        text NOT NULL,      -- R2 object key: clips/{job_id}/{index:03d}.mp4
  thumbnail_key   text,               -- R2 object key: thumbs/{job_id}/{index:03d}.jpg
  share_token     text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(12), 'base64url'),
  edit_status     text NOT NULL DEFAULT 'original'
                    CHECK (edit_status IN ('original', 'pending_recut', 'recut')),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Index để worker poll nhanh
CREATE INDEX idx_jobs_status ON jobs (status) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_clips_edit_status ON clips (edit_status) WHERE edit_status = 'pending_recut';
CREATE INDEX idx_clips_job_id ON clips (job_id);
CREATE INDEX idx_clips_share_token ON clips (share_token);

-- Tự động cập nhật updated_at khi clips được sửa
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clips_updated_at
  BEFORE UPDATE ON clips
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE clips ENABLE ROW LEVEL SECURITY;

-- Jobs: chỉ service role mới có thể thao tác (frontend dùng service key qua API route)
-- Tạm thời cho phép tất cả để dev (khoá lại khi có auth)
CREATE POLICY "allow_all_jobs" ON jobs FOR ALL USING (true);

-- Clips: public read khi biết share_token, còn lại qua service role
CREATE POLICY "allow_all_clips" ON clips FOR ALL USING (true);
CREATE POLICY "public_read_by_share_token" ON clips
  FOR SELECT USING (share_token IS NOT NULL);
