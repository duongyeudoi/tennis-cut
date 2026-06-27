"use client";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { EditStatus } from "@/types/database";

interface Props {
  editStatus: EditStatus;
  hasChanges: boolean;
  isSaving: boolean;
  error: string | null;
  onSave: () => void;
  onResetToAI: () => void;
  onCancel: () => void;
}

const recutLabel: Partial<Record<EditStatus, string>> = {
  pending_recut: "Đang cắt lại...",
  recut: "Đã chỉnh sửa",
};

export function EditControls({
  editStatus,
  hasChanges,
  isSaving,
  error,
  onSave,
  onResetToAI,
  onCancel,
}: Props) {
  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Button
          onClick={onSave}
          disabled={!hasChanges || isSaving || editStatus === "pending_recut"}
          className="min-w-24"
        >
          {isSaving || editStatus === "pending_recut" ? "Đang lưu..." : "Lưu"}
        </Button>

        <Button
          variant="outline"
          onClick={onResetToAI}
          disabled={isSaving || editStatus === "pending_recut"}
        >
          Reset về AI
        </Button>

        <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
          Huỷ
        </Button>

        {recutLabel[editStatus] && (
          <Badge variant={editStatus === "pending_recut" ? "secondary" : "outline"}>
            {recutLabel[editStatus]}
          </Badge>
        )}
      </div>
    </div>
  );
}
