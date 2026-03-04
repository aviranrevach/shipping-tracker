"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FLAG_REASONS,
  FLAG_REASON_LABELS,
  FLAG_REASON_DESCRIPTIONS,
  parseFlagReasons,
  serializeFlagReasons,
  type FlagReason,
} from "@/types/shipment";
import { toast } from "sonner";

interface FlagDialogProps {
  open: boolean;
  onClose: () => void;
  shipmentId: number;
  shipmentName?: string;
  currentReason?: string | null;
  currentNotes?: string | null;
  onSuccess: () => void;
  mode?: "shipment" | "email";
  emailId?: string;
  emailSubject?: string;
}

export function FlagDialog({
  open,
  onClose,
  shipmentId,
  shipmentName,
  currentReason,
  currentNotes,
  onSuccess,
  mode = "shipment",
  emailId,
  emailSubject,
}: FlagDialogProps) {
  const [reasons, setReasons] = useState<FlagReason[]>(
    parseFlagReasons(currentReason ?? null)
  );
  const [notes, setNotes] = useState(currentNotes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleReason(r: FlagReason) {
    setReasons((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  }

  async function handleSubmit() {
    if (reasons.length === 0) return;
    setIsSubmitting(true);
    try {
      let res: Response;

      if (mode === "email" && emailId) {
        res = await fetch(`/api/emails/${emailId}/flag`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isFlagged: true,
            flagReason: serializeFlagReasons(reasons),
            flagNotes: notes.trim() || null,
          }),
        });
      } else {
        res = await fetch(`/api/shipments/${shipmentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isFlagged: true,
            flagReason: serializeFlagReasons(reasons),
            flagNotes: notes.trim() || null,
            flaggedAt: new Date().toISOString(),
          }),
        });
      }

      if (res.ok) {
        toast.success(
          mode === "email" ? "Email flagged for review" : "Shipment flagged for review"
        );
        onSuccess();
        onClose();
      } else {
        toast.error("Failed to flag");
      }
    } catch {
      toast.error("Failed to flag");
    } finally {
      setIsSubmitting(false);
    }
  }

  const displayName = mode === "email" ? emailSubject : shipmentName;
  const notesRequired = reasons.includes("other");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {mode === "email" ? "Flag Email for Review" : "Flag for Review"}
          </DialogTitle>
          {displayName && (
            <DialogDescription className="truncate">
              {displayName}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Reasons *</label>
            <div className="mt-2 space-y-1">
              {FLAG_REASONS.map((r) => (
                <label
                  key={r}
                  className="flex items-start gap-3 rounded-md px-2 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={reasons.includes(r)}
                    onCheckedChange={() => toggleReason(r)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <span className="text-sm font-medium">
                      {FLAG_REASON_LABELS[r]}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {FLAG_REASON_DESCRIPTIONS[r]}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">
              Notes {notesRequired ? "*" : "(optional)"}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={
                reasons.includes("should_merge")
                  ? "Which shipment should this merge with?"
                  : reasons.includes("unidentified_carrier")
                    ? "What carrier is it? What was wrong?"
                    : reasons.includes("other")
                      ? "Describe the issue..."
                      : "Any additional details?"
              }
              className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                reasons.length === 0 ||
                (notesRequired && !notes.trim()) ||
                isSubmitting
              }
            >
              {isSubmitting ? "Flagging..." : "Flag"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
