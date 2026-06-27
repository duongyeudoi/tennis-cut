import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Xóa toàn bộ clips cũ (cascade từ DB không cần xóa R2 object)
  const { error: delError } = await supabaseAdmin
    .from("clips")
    .delete()
    .eq("job_id", id);

  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  // Reset job về pending để worker xử lý lại
  const { error: updateError } = await supabaseAdmin
    .from("jobs")
    .update({ status: "pending", clip_count: null, error_msg: null })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
