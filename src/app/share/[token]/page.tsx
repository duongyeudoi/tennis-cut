import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { VideoPlayer } from "@/components/VideoPlayer";
import { getPublicClipUrl } from "@/lib/r2";
import { Separator } from "@/components/ui/separator";
import type { Clip } from "@/types/database";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

function formatTimecode(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `0:${String(s).padStart(2, "0")}`;
}

export default async function SharePage({ params }: Props) {
  const { token } = await params;

  const { data } = await supabase
    .from("clips")
    .select("*")
    .eq("share_token", token)
    .single();

  if (!data) notFound();
  const clip = data as Clip;
  const clipUrl = getPublicClipUrl(clip.clip_key);

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Rally #{clip.clip_index + 1}</h1>
        <p className="text-sm text-muted-foreground">
          Vị trí trong video gốc: {formatTimecode(clip.start_sec)} –{" "}
          {formatTimecode(clip.end_sec)} · {formatDuration(clip.duration_sec)}
        </p>
      </div>

      <VideoPlayer src={clipUrl} />

      <Separator />

      <p className="text-xs text-muted-foreground text-center">
        Chia sẻ bởi Rallies Cut · Đặt làm bởi{" "}
        <a href="/" className="underline underline-offset-2">
          ralliescut.app
        </a>
      </p>
    </main>
  );
}
