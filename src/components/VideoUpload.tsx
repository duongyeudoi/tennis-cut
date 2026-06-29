"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-m4v"];
const MAX_SIZE_GB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_GB * 1024 ** 3;

type UploadState = "idle" | "uploading" | "creating-job" | "done" | "error";

export function VideoUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error("Chỉ hỗ trợ định dạng MP4 và MOV");
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        toast.error(`File quá lớn — tối đa ${MAX_SIZE_GB}GB`);
        return;
      }

      setState("uploading");
      setProgress(0);

      try {
        // 1. Lấy presigned PUT URL
        const res = await fetch(
          `/api/upload-url?filename=${encodeURIComponent(file.name)}`
        );
        if (!res.ok) throw new Error("Không lấy được upload URL");
        const { url, jobId, key } = await res.json();

        // 2. Upload trực tiếp lên R2 bằng XHR để có progress event
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setProgress(Math.round((e.loaded / e.total) * 100));
            }
          };
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error(`Upload thất bại: ${xhr.status}`));
          xhr.onerror = () => reject(new Error("Lỗi mạng khi upload"));
          xhr.open("PUT", url);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.send(file);
        });

        // 3. Tạo job trong Supabase
        setState("creating-job");
        const { error } = await supabase.from("jobs").insert({
          id: jobId,
          status: "pending",
          raw_video_key: key,
          metadata: { filename: file.name, size: file.size },
        });
        if (error) throw error;

        setState("done");
        toast.success("Upload thành công! Đang chuyển đến trang xử lý...");
        router.push(`/jobs/${jobId}`);
      } catch (err) {
        console.error(err);
        setState("error");
        toast.error(
          err instanceof Error ? err.message : "Đã xảy ra lỗi khi upload"
        );
      }
    },
    [router]
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) upload(file);
    },
    [upload]
  );

  const isLoading = state === "uploading" || state === "creating-job";

  return (
    <Card
      className={`border-2 border-dashed transition-colors cursor-pointer ${
        dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
      } ${isLoading ? "pointer-events-none" : ""}`}
      onClick={() => !isLoading && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <CardContent className="flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
        <input
          ref={inputRef}
          type="file"
          accept=".mp4,.mov,.avi,.m4v"
          className="hidden"
          onChange={onFileChange}
        />

        {!isLoading ? (
          <>
            <div className="text-4xl">🎾</div>
            <div>
              <p className="text-lg font-medium">Kéo thả video vào đây</p>
              <p className="text-sm text-muted-foreground mt-1">
                hoặc bấm để chọn file — MP4, MOV, tối đa {MAX_SIZE_GB}GB
              </p>
            </div>
            <Button variant="outline" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
              Chọn video
            </Button>
          </>
        ) : (
          <div className="w-full max-w-sm space-y-3">
            <p className="text-sm font-medium">
              {state === "uploading"
                ? `Đang upload... ${progress}%`
                : "Đang tạo job xử lý..."}
            </p>
            <Progress value={state === "uploading" ? progress : 100} />
            <p className="text-xs text-muted-foreground">
              Đừng đóng tab này trong khi upload
            </p>
          </div>
        )}

        {state === "error" && (
          <Button
            variant="outline"
            onClick={(e) => { e.stopPropagation(); setState("idle"); }}
          >
            Thử lại
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
