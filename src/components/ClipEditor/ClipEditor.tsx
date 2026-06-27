"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { SourcePlayer, type SourcePlayerHandle } from "./SourcePlayer";
import { TrimTimeline } from "./TrimTimeline";
import { TimecodeDisplay } from "./TimecodeDisplay";
import { EditControls } from "./EditControls";
import { Separator } from "@/components/ui/separator";
import type { Clip } from "@/types/database";

const CONTEXT_WINDOW = 30;

interface Props {
  clip: Clip;
  rawVideoUrl: string;
  jobId: string;
}

export function ClipEditor({ clip, rawVideoUrl, jobId }: Props) {
  const router = useRouter();
  const playerRef = useRef<SourcePlayerHandle>(null);

  const [inPoint, setInPoint] = useState(clip.start_sec);
  const [outPoint, setOutPoint] = useState(clip.end_sec);
  const [currentTime, setCurrentTime] = useState(clip.start_sec);
  const [editStatus, setEditStatus] = useState(clip.edit_status);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const windowStart = Math.max(0, clip.start_sec - CONTEXT_WINDOW);
  const windowEnd = clip.end_sec + CONTEXT_WINDOW;

  const hasChanges =
    inPoint !== clip.start_sec || outPoint !== clip.end_sec;

  // Realtime: theo dõi khi recut xong
  useEffect(() => {
    if (editStatus !== "pending_recut") return;
    const channel = supabase
      .channel(`clip-${clip.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "clips", filter: `id=eq.${clip.id}` },
        (payload) => {
          const updated = payload.new as Clip;
          setEditStatus(updated.edit_status);
          if (updated.edit_status === "recut") {
            // Reload trang để lấy clip URL mới
            router.refresh();
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clip.id, editStatus, router]);

  // Phím tắt [ và ] đặt in/out point tại vị trí hiện tại
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "[") {
        const t = playerRef.current?.getCurrentTime() ?? currentTime;
        setInPoint(Math.min(t, outPoint - 1));
      } else if (e.key === "]") {
        const t = playerRef.current?.getCurrentTime() ?? currentTime;
        setOutPoint(Math.max(t, inPoint + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentTime, inPoint, outPoint]);

  const handleScrub = useCallback((time: number) => {
    playerRef.current?.seekTo(time);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from("clips")
      .update({ start_sec: inPoint, end_sec: outPoint, edit_status: "pending_recut" })
      .eq("id", clip.id);
    if (err) {
      setError(err.message);
      setIsSaving(false);
    } else {
      setEditStatus("pending_recut");
      setIsSaving(false);
    }
  };

  const handleResetToAI = () => {
    setInPoint(clip.ai_start_sec);
    setOutPoint(clip.ai_end_sec);
    playerRef.current?.seekTo(clip.ai_start_sec);
  };

  return (
    <div className="space-y-4">
      <SourcePlayer
        ref={playerRef}
        src={rawVideoUrl}
        inPoint={inPoint}
        outPoint={outPoint}
        onTimeUpdate={setCurrentTime}
      />

      <TimecodeDisplay
        inPoint={inPoint}
        outPoint={outPoint}
        currentTime={currentTime}
      />

      <TrimTimeline
        windowStart={windowStart}
        windowEnd={windowEnd}
        inPoint={inPoint}
        outPoint={outPoint}
        aiInPoint={clip.ai_start_sec}
        aiOutPoint={clip.ai_end_sec}
        onChange={(i, o) => { setInPoint(i); setOutPoint(o); }}
        onScrub={handleScrub}
      />

      <Separator />

      <EditControls
        editStatus={editStatus}
        hasChanges={hasChanges}
        isSaving={isSaving}
        error={error}
        onSave={handleSave}
        onResetToAI={handleResetToAI}
        onCancel={() => router.push(`/jobs/${jobId}`)}
      />
    </div>
  );
}
