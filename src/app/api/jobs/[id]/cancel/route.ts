import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { deleteObject, deleteByPrefix, BUCKET_RAW, BUCKET_CLIPS } from "@/lib/r2";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Lấy job để biết raw_video_key
  const { data: job, error: fetchError } = await supabaseAdmin
    .from("jobs")
    .select("raw_video_key")
    .eq("id", id)
    .single();

  if (fetchError || !job) {
    return NextResponse.json({ error: "Job không tồn tại" }, { status: 404 });
  }

  // Xóa song song: raw video + toàn bộ clips/thumbs trên R2
  await Promise.allSettled([
    deleteObject(BUCKET_RAW, job.raw_video_key),
    deleteByPrefix(BUCKET_CLIPS, `clips/${id}/`),
    deleteByPrefix(BUCKET_CLIPS, `thumbs/${id}/`),
  ]);

  // Xóa job trong Supabase (clips cascade tự xóa theo foreign key)
  const { error: deleteError } = await supabaseAdmin
    .from("jobs")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
