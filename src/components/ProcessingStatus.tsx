"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Job, JobStatus } from "@/types/database";

const statusLabel: Record<JobStatus, string> = {
  pending: "Đang chờ xử lý...",
  processing: "Đang phân tích video...",
  done: "Hoàn thành",
  failed: "Xử lý thất bại",
};

const statusVariant: Record<
  JobStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  processing: "default",
  done: "outline",
  failed: "destructive",
};

interface Props {
  job: Job;
  onDone?: () => void;
}

export function ProcessingStatus({ job: initialJob, onDone }: Props) {
  const [job, setJob] = useState<Job>(initialJob);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    await fetch(`/api/jobs/${job.id}/retry`, { method: "POST" });
    setJob((j) => ({ ...j, status: "pending", error_msg: null }));
    setRetrying(false);
  }

  // Realtime subscription theo dõi thay đổi job
  useEffect(() => {
    if (job.status === "done") return;

    const channel = supabase
      .channel(`job-${job.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${job.id}` },
        (payload) => {
          const updated = payload.new as Job;
          setJob(updated);
          if (updated.status === "done") onDone?.();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [job.id, job.status, onDone]);

  // Đồng hồ đếm thời gian đã chạy
  useEffect(() => {
    if (job.status !== "processing" && job.status !== "pending") return;
    const start = new Date(job.created_at).getTime();
    const tick = () => setElapsedSec(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [job.created_at, job.status]);

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}p ${s}s` : `${s}s`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Badge variant={statusVariant[job.status]}>{statusLabel[job.status]}</Badge>
        {(job.status === "pending" || job.status === "processing") && (
          <span className="text-sm text-muted-foreground">
            {formatElapsed(elapsedSec)}
          </span>
        )}
        {job.status === "done" && job.clip_count != null && (
          <span className="text-sm text-muted-foreground">
            Tìm thấy {job.clip_count} rally
          </span>
        )}
      </div>

      {job.status === "processing" && (
        <Progress value={null} className="animate-pulse" />
      )}

      {job.status === "pending" && (
        <p className="text-sm text-muted-foreground">
          Đang chờ worker khởi động... Đảm bảo <code className="font-mono text-xs bg-muted px-1 rounded">python worker/main.py</code> đang chạy trên máy của bạn.
        </p>
      )}

      {job.status === "processing" && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          disabled={retrying}
        >
          {retrying ? "Đang hủy..." : "Hủy"}
        </Button>
      )}

      {job.status === "failed" && (
        <div className="space-y-3">
          {job.error_msg && (
            <Alert variant="destructive">
              <AlertDescription>{job.error_msg}</AlertDescription>
            </Alert>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            disabled={retrying}
          >
            {retrying ? "Đang reset..." : "Thử lại"}
          </Button>
        </div>
      )}
    </div>
  );
}
