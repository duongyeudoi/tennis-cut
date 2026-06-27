"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ReextractButton({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleReextract() {
    if (!confirm("Xóa toàn bộ clips hiện tại và extract lại từ đầu?")) return;
    setLoading(true);
    await fetch(`/api/jobs/${jobId}/reextract`, { method: "POST" });
    router.refresh();
    setLoading(false);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleReextract} disabled={loading}>
      {loading ? "Đang reset..." : "Extract lại"}
    </Button>
  );
}
