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
      {/* Hero */}
      <div className="space-y-3">
        <div className="flex items-end gap-3">
          <h1 className="text-7xl leading-none tracking-wider uppercase">
            Rallies
          </h1>
          <span
            className="text-7xl leading-none tracking-wider uppercase"
            style={{ color: "var(--sport)" }}
          >
            Cut
          </span>
        </div>
        <p className="text-muted-foreground text-base font-medium uppercase tracking-widest">
          AI tự động cắt rally · Loại bỏ dead time
        </p>
        <div
          className="h-0.5 w-16"
          style={{ background: "var(--sport)" }}
        />
      </div>

      <VideoUpload />

      {recentJobs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Buổi gần đây
          </h2>
          <div className="space-y-3">
            {recentJobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer border-border/60">
                  <CardContent className="flex items-center justify-between py-4 px-5">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold tracking-tight">
                        {(job.metadata as { filename?: string }).filename ?? "Video"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(job.created_at).toLocaleString("vi-VN")}
                        {job.clip_count != null && (
                          <span className="ml-2 font-semibold" style={{ color: "var(--sport)" }}>
                            {job.clip_count} rally
                          </span>
                        )}
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
