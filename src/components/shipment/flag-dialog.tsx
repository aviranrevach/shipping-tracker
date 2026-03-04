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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FLAG_REASONS, FLAG_REASON_LABELS, FLAG_REASON_DESCRIPTIONS, type FlagReason } from "@/types/shipment";
import { toast } from "sonner";

interface FlagDialogProps {
  open: boolean;
  onClose: () => void;
  shipmentId: number;
  shipmentName?: string;
  currentReason?: string | null;
  currentNotes?: string | null;
  onSuccess: () => void;
}

export function FlagDialog({
  open,
  onClose,
  shipmentId,
  shipmentName,
  currentReason,
  currentNotes,
  onSuccess,
}: FlagDialogProps) {
  const [reason, setReason] = useState<FlagReason | "">(
    (currentReason as FlagReason) || ""
  );
  const [notes, setNotes] = useState(currentNotes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!reason) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isFlagged: true,
          flagReason: reason,
          flagNotes: notes.trim() || null,
          flaggedAt: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        toast.success("Shipment flagged for review");
        onSuccess();
        onClose();
      } else {
        toast.error("Failed to flag shipment");
      }
    } catch {
      toast.error("Failed to flag shipment");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Flag for Review</DialogTitle>
          {shipmentName && (
            <DialogDescription className="truncate">
              {shipmentName}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Reason *</label>
            <Select value={reason} onValueChange={(v) => setReason(v as FlagReason)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {FLAG_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {FLAG_REASON_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {reason && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {FLAG_REASON_DESCRIPTIONS[reason]}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">
              Notes {reason === "other" ? "*" : "(optional)"}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={
                reason === "should_merge"
                  ? "Which shipment should this merge with?"
                  : reason === "unidentified_carrier"
                    ? "What carrier is it? What was wrong?"
                    : reason === "other"
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
              disabled={!reason || (reason === "other" && !notes.trim()) || isSubmitting}
            >
              {isSubmitting ? "Flagging..." : "Flag"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
