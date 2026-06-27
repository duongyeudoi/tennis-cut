"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { VideoPlayer } from "@/components/VideoPlayer";
import { getPublicClipUrl } from "@/lib/r2";
import { supabase } from "@/lib/supabase";
import type { Clip } from "@/types/database";

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `0:${String(s).padStart(2, "0")}`;
}

function formatTimecode(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

interface Props {
  jobId: string;
}

export function RallyGallery({ jobId }: Props) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeClip, setActiveClip] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("clips")
      .select("*")
      .eq("job_id", jobId)
      .order("clip_index")
      .then(({ data }) => {
        setClips((data as Clip[]) ?? []);
        setLoading(false);
      });
  }, [jobId]);

  // Realtime: cập nhật clip khi recut xong
  useEffect(() => {
    const channel = supabase
      .channel(`clips-${jobId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clips", filter: `job_id=eq.${jobId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setClips((prev) => [...prev, payload.new as Clip].sort((a, b) => a.clip_index - b.clip_index));
          } else if (payload.eventType === "UPDATE") {
            setClips((prev) => prev.map((c) => c.id === payload.new.id ? payload.new as Clip : c));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [jobId]);

  const copyShareLink = (token: string) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Đã copy link chia sẻ");
  };

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-3 space-y-2">
              <Skeleton className="aspect-video w-full rounded" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (clips.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Chưa có rally nào được tạo.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {clips.map((clip) => {
        const clipUrl = getPublicClipUrl(clip.clip_key);
        const thumbUrl = clip.thumbnail_key ? getPublicClipUrl(clip.thumbnail_key) : null;
        const isActive = activeClip === clip.id;
        const isRecutting = clip.edit_status === "pending_recut";

        return (
          <Card key={clip.id} className="overflow-hidden">
            <CardContent className="p-3 space-y-2">
              {isActive ? (
                <VideoPlayer src={clipUrl} autoPlay />
              ) : (
                <div
                  className="relative aspect-video bg-black rounded overflow-hidden cursor-pointer group"
                  onClick={() => setActiveClip(clip.id)}
                >
                  {thumbUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/30 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                      <svg className="w-5 h-5 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Rally #{clip.clip_index + 1}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTimecode(clip.start_sec)} · {formatDuration(clip.duration_sec)}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {isRecutting && (
                    <Badge variant="secondary" className="text-xs">Đang cắt lại...</Badge>
                  )}
                  <Link href={`/jobs/${jobId}/clips/${clip.id}`}>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                      Sửa
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => copyShareLink(clip.share_token)}
                  >
                    Chia sẻ
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
