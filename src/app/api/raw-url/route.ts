import { NextRequest, NextResponse } from "next/server";
import { getRawVideoPresignedUrl } from "@/lib/r2";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "jobId là bắt buộc" }, { status: 400 });
  }

  const url = await getRawVideoPresignedUrl(jobId);
  return NextResponse.json({ url });
}
