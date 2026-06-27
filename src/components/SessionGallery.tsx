"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/VideoPlayer";
import type { Clip } from "@/types/database";

type ClipWithUrl = Clip & { clipUrl: string; thumbUrl: string | null };

const DURATION_FILTERS = [
  { label: "Tất cả", min: 0 },
  { label: "≥ 5 giây", min: 5 },
  { label: "≥ 10 giây", min: 10 },
];

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `0:${String(s).padStart(2, "0")}`;
}

function formatTimecode(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SessionGallery({ clips }: { clips: ClipWithUrl[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [autoplayIndex, setAutoplayIndex] = useState<number | null>(null);
  const [minDuration, setMinDuration] = useState(0);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const visible = clips.filter((c) => c.duration_sec >= minDuration);
  const isAutoplaying = autoplayIndex !== null;

  function startAutoplay() {
    if (!visible.length) return;
    setAutoplayIndex(0);
    setActiveId(visible[0].id);
  }

  function stopAutoplay() {
    setAutoplayIndex(null);
    setActiveId(null);
  }

  function onEnded() {
    if (autoplayIndex === null) return;
    const next = autoplayIndex + 1;
    if (next < visible.length) {
      setAutoplayIndex(next);
      setActiveId(visible[next].id);
      cardRefs.current[visible[next].id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      stopAutoplay();
      toast.success("Đã phát hết tất cả rally");
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {isAutoplaying ? `Đang phát ${autoplayIndex! + 1} / ${visible.length}` : `${visible.length} rally`}
          </span>
          {isAutoplaying ? (
            <Button variant="outline" size="sm" onClick={stopAutoplay}>⏹ Dừng</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={startAutoplay} disabled={!visible.length}>
              ▶ Phát tất cả
            </Button>
          )}
        </div>
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Không có rally nào dài hơn {minDuration} giây.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {visible.map((clip, idx) => {
          const isActive = activeId === clip.id;
          const isCurrent = isAutoplaying && autoplayIndex === idx;

          return (
            <Card
              key={clip.id}
              ref={(el) => { cardRefs.current[clip.id] = el; }}
              className={`overflow-hidden transition-shadow ${isCurrent ? "ring-2 ring-[var(--sport)]" : ""}`}
            >
              <CardContent className="p-3 space-y-2">
                {isActive ? (
                  <VideoPlayer src={clip.clipUrl} autoPlay onEnded={isAutoplaying ? onEnded : undefined} />
                ) : (
                  <div
                    className="relative aspect-video bg-black rounded overflow-hidden cursor-pointer group"
                    onClick={() => { setActiveId(clip.id); setAutoplayIndex(null); }}
                  >
                    {clip.thumbUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={clip.thumbUrl} alt="" className="w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/30 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                        <svg className="w-5 h-5 text-black ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                    <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                      {formatDuration(clip.duration_sec)}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">Rally #{clip.clip_index + 1}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTimecode(clip.start_sec)} · {formatDuration(clip.duration_sec)}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
