"use client";

import { useEffect, useRef } from "react";

interface Props {
  src: string;
  className?: string;
  autoPlay?: boolean;
}

export function VideoPlayer({ src, className, autoPlay = false }: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  // Phím tắt: space = play/pause, ← → = ±5s
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.target !== el && document.activeElement !== el) return;
      if (e.code === "Space") {
        e.preventDefault();
        el.paused ? el.play() : el.pause();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        el.currentTime = Math.max(0, el.currentTime - 5);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        el.currentTime = Math.min(el.duration, el.currentTime + 5);
      }
    };

    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      controls
      autoPlay={autoPlay}
      tabIndex={0}
      className={`w-full rounded-lg bg-black outline-none ${className ?? ""}`}
    />
  );
}
