"use client";

import { useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const CONTEXT_WINDOW = 30;

interface Props {
  windowStart: number;
  windowEnd: number;
  inPoint: number;
  outPoint: number;
  aiInPoint: number;
  aiOutPoint: number;
  onChange: (inPoint: number, outPoint: number) => void;
  onScrub?: (time: number) => void;
}

export function TrimTimeline({
  windowStart,
  windowEnd,
  inPoint,
  outPoint,
  aiInPoint,
  aiOutPoint,
  onChange,
  onScrub,
}: Props) {
  const range = windowEnd - windowStart;

  const toPct = useCallback(
    (t: number) => Math.max(0, Math.min(100, ((t - windowStart) / range) * 100)),
    [windowStart, range]
  );

  const handleSliderChange = useCallback(
    (value: number | readonly number[]) => {
      const vals = Array.isArray(value) ? (value as number[]) : [value as number];
      const [newIn = inPoint, newOut = outPoint] = vals;
      const clampedIn = Math.max(windowStart, Math.min(newOut - 1, newIn));
      const clampedOut = Math.min(windowEnd, Math.max(newIn + 1, newOut));
      onChange(clampedIn, clampedOut);
      onScrub?.(clampedIn);
    },
    [windowStart, windowEnd, inPoint, outPoint, onChange, onScrub]
  );

  return (
    <div className="space-y-2 px-1">
      {/* Ghost markers cho AI bounds */}
      <div className="relative h-1.5 bg-muted rounded overflow-hidden">
        <Tooltip>
          <TooltipTrigger className="absolute top-0 h-full rounded bg-muted-foreground/30" style={{
            left: `${toPct(aiInPoint)}%`,
            width: `${toPct(aiOutPoint) - toPct(aiInPoint)}%`,
          }} />
          <TooltipContent>Bounds gốc do AI phát hiện</TooltipContent>
        </Tooltip>
      </div>

      {/* Slider dual handle cho in/out */}
      <Slider
        min={windowStart}
        max={windowEnd}
        step={0.1}
        value={[inPoint, outPoint]}
        onValueChange={handleSliderChange}
        minStepsBetweenValues={10}
        className="w-full"
      />

      <div className="flex justify-between text-xs text-muted-foreground/60 font-mono">
        <span>-{CONTEXT_WINDOW}s</span>
        <span className="text-xs text-muted-foreground text-center">
          Kéo để điều chỉnh · <kbd className="bg-muted px-1 rounded">[ ]</kbd> đặt điểm tại vị trí hiện tại
        </span>
        <span>+{CONTEXT_WINDOW}s</span>
      </div>
    </div>
  );
}
