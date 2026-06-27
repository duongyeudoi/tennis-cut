export const dynamic = "force-dynamic";

import { VideoUpload } from "@/components/VideoUpload";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Job } from "@/types/database";

async function getRecentJobs(): Promise<Job[]> {
  const { data } = await supabase
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);
  return data ?? [];
}

const statusLabel: Record<Job["status"], string> = {
  pending: "Đang chờ",
  processing: "Đang xử lý",
  done: "Hoàn thành",
  failed: "Thất bại",
};

const statusVariant: Record<
  Job["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  processing: "default",
  done: "outline",
  failed: "destructive",
};

export default async function HomePage() {
  const recentJobs = await getRecentJobs();

  return (
    <main className="max-w-2xl mx-auto px-4 py-12 space-y-10">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Rallies Cut</h1>
        <p className="text-muted-foreground">
          Upload video trận đấu — AI tự động cắt các đoạn rally và loại bỏ dead time
        </p>
      </div>

      <VideoUpload />

      {recentJobs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Video gần đây
          </h2>
          <div className="space-y-2">
            {recentJobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardContent className="flex items-center justify-between py-3 px-4">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">
                        {(job.metadata as { filename?: string }).filename ?? "Video"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(job.created_at).toLocaleString("vi-VN")}
                        {job.clip_count != null && ` · ${job.clip_count} rally`}
                      </p>
                    </div>
                    <Badge variant={statusVariant[job.status]}>
                      {statusLabel[job.status]}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
