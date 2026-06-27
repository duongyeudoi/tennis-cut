"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ShareSessionButton({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/share/session/${jobId}`
    : `/share/session/${jobId}`;

  function copy() {
    navigator.clipboard.writeText(url);
    toast.success("Đã copy link session");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" />}
      >
        Chia sẻ session
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Chia sẻ toàn bộ session</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Người nhận có thể xem tất cả rally mà không cần đăng nhập.
          </p>
          <div className="rounded-md border bg-muted/50 p-3 space-y-2">
            <p className="text-xs font-mono break-all select-all text-foreground">{url}</p>
            <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={copy}>
              Copy link
            </Button>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs text-muted-foreground hover:text-foreground py-1 transition-colors"
          >
            Mở link →
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
