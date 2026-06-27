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

interface Props {
  token: string;
  rallyIndex: number;
}

export function ShareDialog({ token, rallyIndex }: Props) {
  const [open, setOpen] = useState(false);
  const url = typeof window !== "undefined"
    ? `${window.location.origin}/share/${token}`
    : `/share/${token}`;

  function copy() {
    navigator.clipboard.writeText(url);
    toast.success("Đã copy link");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="sm" className="h-7 px-2 text-xs" />}
      >
        Chia sẻ
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Chia sẻ Rally #{rallyIndex}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Link này có thể xem mà không cần đăng nhập.
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
