"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export function UserMenu({ email }: { email: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    setLoading(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[140px]">
        {email}
      </span>
      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={handleLogout} disabled={loading}>
        {loading ? "..." : "Đăng xuất"}
      </Button>
    </div>
  );
}
