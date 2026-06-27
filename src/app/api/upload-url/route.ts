import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getUploadPresignedUrl, rawVideoKey } from "@/lib/r2";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const filename = searchParams.get("filename");

  if (!filename) {
    return NextResponse.json({ error: "filename là bắt buộc" }, { status: 400 });
  }

  const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : ".mp4";
  const jobId = randomUUID();
  const key = rawVideoKey(jobId, ext);

  const url = await getUploadPresignedUrl(key);

  return NextResponse.json({ url, jobId, key });
}
