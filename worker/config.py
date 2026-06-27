import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env.local từ root project (cùng file với Next.js)
_root = Path(__file__).parent.parent
load_dotenv(_root / ".env.local")

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_KEY"]  # worker dùng service key

R2_ACCOUNT_ID      = os.environ["R2_ACCOUNT_ID"]
R2_ACCESS_KEY_ID   = os.environ["R2_ACCESS_KEY_ID"]
R2_SECRET_ACCESS_KEY = os.environ["R2_SECRET_ACCESS_KEY"]
R2_PUBLIC_URL      = os.environ["R2_PUBLIC_URL"]

R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
BUCKET_RAW   = "rallies-raw"
BUCKET_CLIPS = "rallies-clips"

# Thư mục tạm để lưu video khi xử lý
TMP_DIR = Path(os.environ.get("WORKER_TMP_DIR", "/tmp/rallies-cut"))
TMP_DIR.mkdir(parents=True, exist_ok=True)

# Tham số nhận diện rally
MIN_RALLY_SEC  = float(os.environ.get("MIN_RALLY_SEC", "3.0"))
PADDING_SEC    = float(os.environ.get("PADDING_SEC", "1.5"))
SAMPLE_FPS     = float(os.environ.get("SAMPLE_FPS", "2.0"))
MOTION_THRESH  = float(os.environ.get("MOTION_THRESH", "25.0"))

POLL_INTERVAL  = int(os.environ.get("POLL_INTERVAL", "10"))
