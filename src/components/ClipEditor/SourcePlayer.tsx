"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

export interface SourcePlayerHandle {
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
}

interface Props {
  src: string;
  inPoint: number;
  outPoint: number;
  onTimeUpdate: (time: number) => void;
}

export const SourcePlayer = forwardRef<SourcePlayerHandle, Props>(
  function SourcePlayer({ src, inPoint, outPoint, onTimeUpdate }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useImperativeHandle(ref, () => ({
      seekTo: (time) => {
        if (videoRef.current) videoRef.current.currentTime = time;
      },
      getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    }));

    // Dừng ở out-point khi phát
    useEffect(() => {
      const el = videoRef.current;
      if (!el) return;
      const onTime = () => {
        onTimeUpdate(el.currentTime);
        if (el.currentTime >= outPoint) {
          el.pause();
          el.currentTime = outPoint;
        }
      };
      el.addEventListener("timeupdate", onTime);
      return () => el.removeEventListener("timeupdate", onTime);
    }, [outPoint, onTimeUpdate]);

    // Phím tắt [ và ] để đặt in/out point tại vị trí hiện tại
    // (được xử lý ở ClipEditor.tsx vì cần set state)

    // Seek đến in-point khi src thay đổi
    useEffect(() => {
      const el = videoRef.current;
      if (!el) return;
      const onLoaded = () => { el.currentTime = inPoint; };
      el.addEventListener("loadedmetadata", onLoaded);
      return () => el.removeEventListener("loadedmetadata", onLoaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src]);

    return (
      <video
        ref={videoRef}
        src={src}
        controls
        className="w-full rounded-lg bg-black"
        preload="metadata"
      />
    );
  }
);
