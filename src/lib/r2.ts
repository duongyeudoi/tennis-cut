import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const BUCKET_RAW = "rallies-raw";
export const BUCKET_CLIPS = "rallies-clips";

// Key conventions
export const rawVideoKey = (jobId: string, ext = ".mp4") =>
  `raw/${jobId}/original${ext}`;
export const clipKey = (jobId: string, index: number) =>
  `clips/${jobId}/${String(index).padStart(3, "0")}.mp4`;
export const thumbKey = (jobId: string, index: number) =>
  `thumbs/${jobId}/${String(index).padStart(3, "0")}.jpg`;

// Presigned URL để browser PUT trực tiếp lên R2 (upload video gốc)
export async function getUploadPresignedUrl(
  key: string,
  expiresIn = 7200 // 2 giờ
): Promise<string> {
  const cmd = new PutObjectCommand({ Bucket: BUCKET_RAW, Key: key });
  return getSignedUrl(r2, cmd, { expiresIn });
}

// Presigned URL để browser GET video gốc (dùng trong clip editor)
export async function getRawVideoPresignedUrl(
  jobId: string,
  expiresIn = 7200 // 2 giờ
): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: BUCKET_RAW,
    Key: rawVideoKey(jobId),
  });
  return getSignedUrl(r2, cmd, { expiresIn });
}

// URL công khai cho clip (bucket rallies-clips là public)
export function getPublicClipUrl(key: string): string {
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}
