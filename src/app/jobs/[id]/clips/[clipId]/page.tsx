import { notFound } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getRawVideoPresignedUrl } from "@/lib/r2";
import { ClipEditor } from "@/components/ClipEditor/ClipEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Clip } from "@/types/database";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string; clipId: string }>;
}

function formatTimecode(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export default async function ClipEditorPage({ params }: Props) {
  const { id: jobId, clipId } = await params;

  const [{ data: clipData }, { data: jobData }] = await Promise.all([
    supabase.from("clips").select("*").eq("id", clipId).eq("job_id", jobId).single(),
    supabase.from("jobs").select("raw_video_key").eq("id", jobId).single(),
  ]);

  if (!clipData || !jobData) notFound();
  const clip = clipData as Clip;

  const rawVideoUrl = await getRawVideoPresignedUrl(jobData.raw_video_key);

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center gap-3">
        <Link href={`/jobs/${jobId}`}>
          <Button variant="ghost" size="sm">← Về gallery</Button>
        </Link>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">Rally #{clip.clip_index + 1}</h1>
          {clip.edit_status === "recut" && (
            <Badge variant="outline" className="text-xs">Đã chỉnh sửa</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          AI: {formatTimecode(clip.ai_start_sec)} – {formatTimecode(clip.ai_end_sec)}
          {(clip.start_sec !== clip.ai_start_sec || clip.end_sec !== clip.ai_end_sec) && (
            <span className="ml-2 text-primary">
              · Hiện tại: {formatTimecode(clip.start_sec)} – {formatTimecode(clip.end_sec)}
            </span>
          )}
        </p>
      </div>

      <Separator />

      <ClipEditor clip={clip} rawVideoUrl={rawVideoUrl} jobId={jobId} />
    </main>
  );
}
