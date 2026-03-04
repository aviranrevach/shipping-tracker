"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Flag,
  ExternalLink,
  X,
  Download,
  Mail,
  PackageSearch,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FLAG_REASON_LABELS,
  FLAG_REASON_DESCRIPTIONS,
  STATUS_LABELS,
  STATUS_COLORS,
  type FlagReason,
  type ShipmentStatus,
} from "@/types/shipment";
import { FlagDialog } from "@/components/shipment/flag-dialog";
import { toast } from "sonner";

interface FlaggedItem {
  id: number;
  itemName: string | null;
  retailer: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: ShipmentStatus;
  emailSubject: string | null;
  emailFrom: string | null;
  emailId: string | null;
  flagReason: string | null;
  flagNotes: string | null;
  flaggedAt: string | null;
  createdAt: string | null;
  parserUsed: string | null;
  emailReceivedAt: string | null;
  orderNumber: string | null;
  originCountry: string | null;
}

export default function FlaggedReviewPage() {
  const router = useRouter();
  const [items, setItems] = useState<FlaggedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterReason, setFilterReason] = useState<FlagReason | "all">("all");

  const fetchFlagged = useCallback(async () => {
    try {
      const res = await fetch("/api/flagged");
      const data = await res.json();
      setItems(data.flagged || []);
    } catch {
      toast.error("Failed to load flagged items");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlagged();
  }, [fetchFlagged]);

  async function handleUnflag(id: number) {
    try {
      const res = await fetch(`/api/shipments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isFlagged: false,
          flagReason: null,
          flagNotes: null,
          flaggedAt: null,
        }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        toast.success("Flag removed");
      }
    } catch {
      toast.error("Failed to remove flag");
    }
  }

  function handleExportJson() {
    const data = JSON.stringify(filtered, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flagged-items-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered =
    filterReason === "all"
      ? items
      : items.filter((i) => i.flagReason === filterReason);

  const reasonCounts = items.reduce(
    (acc, i) => {
      const r = (i.flagReason || "other") as string;
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading flagged items...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold font-poppins flex items-center gap-2">
                <Flag className="h-5 w-5 text-amber-500" />
                Flagged for Review
              </h1>
              <p className="text-sm text-muted-foreground">
                {items.length} item{items.length !== 1 ? "s" : ""} flagged for study
              </p>
            </div>
          </div>
          {items.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportJson}>
              <Download className="h-4 w-4 mr-1.5" />
              Export JSON
            </Button>
          )}
        </div>

        {/* Reason filter pills */}
        {items.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            <button
              onClick={() => setFilterReason("all")}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filterReason === "all"
                  ? "bg-foreground text-background border-foreground"
                  : "bg-muted text-muted-foreground border-border hover:bg-accent"
              }`}
            >
              All ({items.length})
            </button>
            {(Object.keys(FLAG_REASON_LABELS) as FlagReason[]).map((r) =>
              reasonCounts[r] ? (
                <button
                  key={r}
                  onClick={() => setFilterReason(r)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    filterReason === r
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                  }`}
                >
                  {FLAG_REASON_LABELS[r]} ({reasonCounts[r]})
                </button>
              ) : null
            )}
          </div>
        )}

        {/* Empty state */}
        {items.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Flag className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No flagged items</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Flag shipments from the dashboard to review them here
              </p>
            </CardContent>
          </Card>
        )}

        {/* Flagged items list */}
        <div className="space-y-3">
          {filtered.map((item) => (
            <Card key={item.id} className="border-amber-200 bg-amber-50/30">
              <CardContent className="p-4">
                {/* Top row: name + actions */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => router.push(`/shipments/${item.id}`)}
                      className="text-sm font-semibold text-left hover:underline truncate block"
                    >
                      {item.itemName || "Unnamed Shipment"}
                    </button>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge
                        className={`text-[10px] ${STATUS_COLORS[item.status]}`}
                      >
                        {STATUS_LABELS[item.status]}
                      </Badge>
                      {item.flagReason && (
                        <span className="text-[10px] font-medium text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full">
                          {FLAG_REASON_LABELS[item.flagReason as FlagReason]}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Edit flag"
                      onClick={() => setEditingId(item.id)}
                    >
                      <Flag className="h-3.5 w-3.5 text-amber-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Remove flag"
                      onClick={() => handleUnflag(item.id)}
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="View shipment"
                      onClick={() => router.push(`/shipments/${item.id}`)}
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>

                {/* Flag notes */}
                {item.flagNotes && (
                  <div className="bg-amber-100/50 border border-amber-200 rounded-md px-3 py-2 mb-3 text-xs text-amber-800">
                    {item.flagNotes}
                  </div>
                )}

                {/* Detail grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  {item.retailer && item.retailer !== "Unknown" && (
                    <div className="flex items-center gap-1.5">
                      <PackageSearch className="h-3 w-3 shrink-0" />
                      <span className="truncate">{item.retailer}</span>
                    </div>
                  )}
                  {item.carrier && (
                    <div className="flex items-center gap-1.5">
                      <Truck className="h-3 w-3 shrink-0" />
                      <span className="truncate">{item.carrier}</span>
                    </div>
                  )}
                  {item.trackingNumber && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono truncate">{item.trackingNumber}</span>
                    </div>
                  )}
                  {item.emailFrom && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{item.emailFrom}</span>
                    </div>
                  )}
                  {item.parserUsed && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                        {item.parserUsed}
                      </span>
                    </div>
                  )}
                  {item.flaggedAt && (
                    <div className="text-muted-foreground/60">
                      Flagged {new Date(item.flaggedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {/* Email subject */}
                {item.emailSubject && (
                  <div className="mt-2 pt-2 border-t border-amber-200/50">
                    <p className="text-[11px] text-muted-foreground/70 truncate">
                      <span className="font-medium">Subject:</span> {item.emailSubject}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Edit flag dialog */}
      {editingId !== null && (
        <FlagDialog
          open
          onClose={() => setEditingId(null)}
          shipmentId={editingId}
          shipmentName={items.find((i) => i.id === editingId)?.itemName || undefined}
          currentReason={items.find((i) => i.id === editingId)?.flagReason}
          currentNotes={items.find((i) => i.id === editingId)?.flagNotes}
          onSuccess={() => {
            setEditingId(null);
            fetchFlagged();
          }}
        />
      )}
    </div>
  );
}
