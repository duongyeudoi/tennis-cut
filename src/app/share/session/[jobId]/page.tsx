import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getPublicClipUrl } from "@/lib/r2";
import { SessionGallery } from "@/components/SessionGallery";
import type { Job, Clip } from "@/types/database";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ jobId: string }>;
}

export default async function ShareSessionPage({ params }: Props) {
  const { jobId } = await params;

  const [jobRes, clipsRes] = await Promise.all([
    supabase.from("jobs").select("*").eq("id", jobId).single(),
    supabase.from("clips").select("*").eq("job_id", jobId).order("clip_index"),
  ]);

  if (!jobRes.data || jobRes.data.status !== "done") notFound();

  const job = jobRes.data as Job;
  const clips = (clipsRes.data ?? []) as Clip[];
  const filename = (job.metadata as { filename?: string }).filename ?? "Video";

  const clipsWithUrls = clips.map((c) => ({
    ...c,
    clipUrl: getPublicClipUrl(c.clip_key),
    thumbUrl: c.thumbnail_key ? getPublicClipUrl(c.thumbnail_key) : null,
  }));

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold truncate">{filename}</h1>
        <p className="text-sm text-muted-foreground">
          {new Date(job.created_at).toLocaleString("vi-VN")} · {clips.length} rally
        </p>
      </div>

      <SessionGallery clips={clipsWithUrls} />

      <p className="text-xs text-muted-foreground text-center pt-4">
        Chia sẻ bởi <span className="font-semibold" style={{ color: "var(--sport)" }}>RalliesCut</span>
      </p>
    </main>
  );
}
