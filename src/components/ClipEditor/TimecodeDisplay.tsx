"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function toTimecode(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const f = Math.floor((sec % 1) * 10);
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${hh}:${mm}:${ss}.${f}` : `${mm}:${ss}.${f}`;
}

interface Props {
  inPoint: number;
  outPoint: number;
  currentTime: number;
}

export function TimecodeDisplay({ inPoint, outPoint, currentTime }: Props) {
  return (
    <div className="flex items-center justify-between text-xs font-mono text-muted-foreground px-1">
      <Tooltip>
        <TooltipTrigger className="flex items-center gap-1 cursor-default">
          <span className="text-primary font-semibold">▶ VÀO</span>
          <span>{toTimecode(inPoint)}</span>
        </TooltipTrigger>
        <TooltipContent>Điểm bắt đầu clip trong footage gốc</TooltipContent>
      </Tooltip>

      <span className="text-foreground/50">📍 {toTimecode(currentTime)}</span>

      <Tooltip>
        <TooltipTrigger className="flex items-center gap-1 cursor-default">
          <span>{toTimecode(outPoint)}</span>
          <span className="text-primary font-semibold">RA ◀</span>
        </TooltipTrigger>
        <TooltipContent>Điểm kết thúc clip trong footage gốc</TooltipContent>
      </Tooltip>
    </div>
  );
}
