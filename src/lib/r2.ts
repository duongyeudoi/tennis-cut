import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  // Tắt checksum tự động — R2 không cần và presigned URL sẽ bị reject nếu có placeholder CRC32
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
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
// rawKey: lấy từ jobs.raw_video_key trong DB (có thể là .MOV, .mp4, v.v.)
export async function getRawVideoPresignedUrl(
  rawKey: string,
  expiresIn = 7200 // 2 giờ
): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: BUCKET_RAW, Key: rawKey });
  return getSignedUrl(r2, cmd, { expiresIn });
}

// URL công khai cho clip (bucket rallies-clips là public)
export function getPublicClipUrl(key: string): string {
  return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;
}

// Xóa một object trong R2
export async function deleteObject(bucket: string, key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

// Xóa toàn bộ objects theo prefix (dùng để dọn clips/thumbs của 1 job)
export async function deleteByPrefix(bucket: string, prefix: string): Promise<void> {
  let continuationToken: string | undefined;
  do {
    const list = await r2.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken })
    );
    const objects = list.Contents ?? [];
    if (objects.length > 0) {
      await r2.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: objects.map((o) => ({ Key: o.Key! })) },
        })
      );
    }
    continuationToken = list.NextContinuationToken;
  } while (continuationToken);
}
