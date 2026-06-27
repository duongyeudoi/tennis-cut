"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function CancelJobButton({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCancel() {
    if (!confirm("Xóa toàn bộ video gốc và các clip? Không thể hoàn tác.")) return;
    setLoading(true);
    await fetch(`/api/jobs/${jobId}/cancel`, { method: "DELETE" });
    router.push("/");
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive hover:text-destructive"
      onClick={handleCancel}
      disabled={loading}
    >
      {loading ? "Đang xóa..." : "Xóa"}
    </Button>
  );
}
