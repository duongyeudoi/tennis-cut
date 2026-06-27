"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ShareDialog } from "@/components/ShareDialog";
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

const DURATION_FILTERS = [
  { label: "Tất cả", min: 0 },
  { label: "≥ 5 giây", min: 5 },
  { label: "≥ 10 giây", min: 10 },
];

interface Props {
  jobId: string;
}

export function RallyGallery({ jobId }: Props) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeClip, setActiveClip] = useState<string | null>(null);
  const [autoplayIndex, setAutoplayIndex] = useState<number | null>(null);
  const [minDuration, setMinDuration] = useState(0);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

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

  useEffect(() => {
    if (autoplayIndex === null) return;
    const clip = visibleClips[autoplayIndex];
    if (!clip) return;
    cardRefs.current[clip.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplayIndex]);

  const visibleClips = clips.filter((c) => c.duration_sec >= minDuration);
  const isAutoplaying = autoplayIndex !== null;

  function startAutoplay() {
    if (visibleClips.length === 0) return;
    setAutoplayIndex(0);
    setActiveClip(visibleClips[0].id);
  }

  function stopAutoplay() {
    setAutoplayIndex(null);
    setActiveClip(null);
  }

  function onClipEnded() {
    if (autoplayIndex === null) return;
    const next = autoplayIndex + 1;
    if (next < visibleClips.length) {
      setAutoplayIndex(next);
      setActiveClip(visibleClips[next].id);
    } else {
      setAutoplayIndex(null);
      setActiveClip(null);
      toast.success("Đã phát hết tất cả rally");
    }
  }

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
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Duration filter */}
        <div className="flex items-center gap-1 rounded-lg border p-1">
          {DURATION_FILTERS.map((f) => (
            <button
              key={f.min}
              onClick={() => { setMinDuration(f.min); stopAutoplay(); }}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                minDuration === f.min
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Autoplay + count */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {isAutoplaying
              ? `Đang phát ${autoplayIndex! + 1} / ${visibleClips.length}`
              : `${visibleClips.length} rally${visibleClips.length < clips.length ? ` / ${clips.length}` : ""}`}
          </span>
          {isAutoplaying ? (
            <Button variant="outline" size="sm" onClick={stopAutoplay}>⏹ Dừng</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={startAutoplay} disabled={visibleClips.length === 0}>
              ▶ Phát tất cả
            </Button>
          )}
        </div>
      </div>

      {/* Empty state after filter */}
      {visibleClips.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Không có rally nào dài hơn {minDuration} giây.
        </p>
      )}

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {visibleClips.map((clip, idx) => {
          const clipUrl = getPublicClipUrl(clip.clip_key);
          const thumbUrl = clip.thumbnail_key ? getPublicClipUrl(clip.thumbnail_key) : null;
          const isActive = activeClip === clip.id;
          const isCurrentAutoplay = isAutoplaying && autoplayIndex === idx;
          const isRecutting = clip.edit_status === "pending_recut";

          return (
            <Card
              key={clip.id}
              ref={(el) => { cardRefs.current[clip.id] = el; }}
              className={`overflow-hidden transition-shadow ${isCurrentAutoplay ? "ring-2 ring-[var(--sport)]" : ""}`}
            >
              <CardContent className="p-3 space-y-2">
                {isActive ? (
                  <VideoPlayer
                    src={clipUrl}
                    autoPlay
                    onEnded={isAutoplaying ? onClipEnded : undefined}
                  />
                ) : (
                  <div
                    className="relative aspect-video bg-black rounded overflow-hidden cursor-pointer group"
                    onClick={() => { setActiveClip(clip.id); setAutoplayIndex(null); }}
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
                    {/* Duration badge */}
                    <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                      {formatDuration(clip.duration_sec)}
                    </span>
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
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">Sửa</Button>
                    </Link>
                    <ShareDialog token={clip.share_token} rallyIndex={clip.clip_index + 1} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
