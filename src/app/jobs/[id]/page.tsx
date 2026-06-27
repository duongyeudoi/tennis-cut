import { notFound } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ProcessingStatus } from "@/components/ProcessingStatus";
import { RallyGallery } from "@/components/RallyGallery";
import { ReextractButton } from "@/components/ReextractButton";
import { CancelJobButton } from "@/components/CancelJobButton";
import { ShareSessionButton } from "@/components/ShareSessionButton";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Job } from "@/types/database";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function JobPage({ params }: Props) {
  const { id } = await params;

  const { data } = await supabase.from("jobs").select("*").eq("id", id).single();
  if (!data) notFound();

  const job = data as Job;
  const filename = (job.metadata as { filename?: string }).filename ?? "Video";

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="sm">← Trang chủ</Button>
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{filename}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(job.created_at).toLocaleString("vi-VN")}
          </p>
        </div>
        <CancelJobButton jobId={job.id} />
      </div>

      <ProcessingStatus job={job} />

      {job.status === "done" && (
        <>
          <Separator />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {job.clip_count ?? 0} rally được tìm thấy
            </p>
            <div className="flex gap-2">
              <ShareSessionButton jobId={job.id} />
              <ReextractButton jobId={job.id} />
            </div>
          </div>
          <RallyGallery jobId={job.id} />
        </>
      )}
    </main>
  );
}
