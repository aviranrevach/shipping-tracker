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
  STATUS_LABELS,
  STATUS_COLORS,
  parseFlagReasons,
  type FlagReason,
  type ShipmentStatus,
} from "@/types/shipment";
import { FlagDialog } from "@/components/shipment/flag-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FlaggedShipment {
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

interface FlaggedEmail {
  gmailMessageId: string;
  subject: string | null;
  fromAddress: string | null;
  receivedAt: string | null;
  parserUsed: string | null;
  resultStatus: string | null;
  errorMessage: string | null;
  shipmentId: number | null;
  flagReason: string | null;
  flagNotes: string | null;
  flaggedAt: string | null;
  accountEmail: string | null;
}

export default function FlaggedReviewPage() {
  const router = useRouter();
  const [shipmentItems, setShipmentItems] = useState<FlaggedShipment[]>([]);
  const [emailItems, setEmailItems] = useState<FlaggedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingShipmentId, setEditingShipmentId] = useState<number | null>(null);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [filterReason, setFilterReason] = useState<FlagReason | "all">("all");
  const [activeTab, setActiveTab] = useState<"shipments" | "emails">("shipments");

  const fetchFlagged = useCallback(async () => {
    try {
      const res = await fetch("/api/flagged");
      const data = await res.json();
      setShipmentItems(data.flaggedShipments || []);
      setEmailItems(data.flaggedEmails || []);
    } catch {
      toast.error("Failed to load flagged items");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlagged();
  }, [fetchFlagged]);

  async function handleUnflagShipment(id: number) {
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
        setShipmentItems((prev) => prev.filter((i) => i.id !== id));
        toast.success("Flag removed");
      }
    } catch {
      toast.error("Failed to remove flag");
    }
  }

  async function handleUnflagEmail(messageId: string) {
    try {
      const res = await fetch(`/api/emails/${messageId}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isFlagged: false,
          flagReason: null,
          flagNotes: null,
        }),
      });
      if (res.ok) {
        setEmailItems((prev) => prev.filter((e) => e.gmailMessageId !== messageId));
        toast.success("Email flag removed");
      }
    } catch {
      toast.error("Failed to remove flag");
    }
  }

  async function handleExportJson() {
    try {
      const res = await fetch("/api/flagged?format=claude");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flagged-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export");
    }
  }

  // Filter logic for multi-reason
  const currentItems = activeTab === "shipments" ? shipmentItems : emailItems;
  const filteredShipments =
    filterReason === "all"
      ? shipmentItems
      : shipmentItems.filter((i) => parseFlagReasons(i.flagReason).includes(filterReason));
  const filteredEmails =
    filterReason === "all"
      ? emailItems
      : emailItems.filter((e) => parseFlagReasons(e.flagReason).includes(filterReason));

  // Reason counts across both shipments and emails
  const reasonCounts: Record<string, number> = {};
  for (const item of [...shipmentItems, ...emailItems]) {
    for (const r of parseFlagReasons(item.flagReason)) {
      reasonCounts[r] = (reasonCounts[r] || 0) + 1;
    }
  }

  const totalCount = shipmentItems.length + emailItems.length;

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
                {totalCount} item{totalCount !== 1 ? "s" : ""} flagged for study
              </p>
            </div>
          </div>
          {totalCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportJson}>
              <Download className="h-4 w-4 mr-1.5" />
              Export JSON
            </Button>
          )}
        </div>

        {/* Tabs */}
        {totalCount > 0 && (
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => setActiveTab("shipments")}
              className={cn(
                "text-sm font-medium pb-1 border-b-2 transition-colors",
                activeTab === "shipments"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Shipments ({shipmentItems.length})
            </button>
            <button
              onClick={() => setActiveTab("emails")}
              className={cn(
                "text-sm font-medium pb-1 border-b-2 transition-colors",
                activeTab === "emails"
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Emails ({emailItems.length})
            </button>
          </div>
        )}

        {/* Reason filter pills */}
        {totalCount > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            <button
              onClick={() => setFilterReason("all")}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                filterReason === "all"
                  ? "bg-foreground text-background border-foreground"
                  : "bg-muted text-muted-foreground border-border hover:bg-accent"
              )}
            >
              All ({totalCount})
            </button>
            {(Object.keys(FLAG_REASON_LABELS) as FlagReason[]).map((r) =>
              reasonCounts[r] ? (
                <button
                  key={r}
                  onClick={() => setFilterReason(r)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                    filterReason === r
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                  )}
                >
                  {FLAG_REASON_LABELS[r]} ({reasonCounts[r]})
                </button>
              ) : null
            )}
          </div>
        )}

        {/* Empty state */}
        {totalCount === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Flag className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No flagged items</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Flag shipments or emails from the dashboard to review them here
              </p>
            </CardContent>
          </Card>
        )}

        {/* Shipments list */}
        {activeTab === "shipments" && (
          <div className="space-y-3">
            {filteredShipments.map((item) => (
              <Card key={item.id} className="border-amber-200 bg-amber-50/30">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => router.push(`/shipments/${item.id}`)}
                        className="text-sm font-semibold text-left hover:underline truncate block"
                      >
                        {item.itemName || "Unnamed Shipment"}
                      </button>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge className={`text-[10px] ${STATUS_COLORS[item.status]}`}>
                          {STATUS_LABELS[item.status]}
                        </Badge>
                        {parseFlagReasons(item.flagReason).map((r) => (
                          <span
                            key={r}
                            className="text-[10px] font-medium text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full"
                          >
                            {FLAG_REASON_LABELS[r]}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Edit flag"
                        onClick={() => setEditingShipmentId(item.id)}
                      >
                        <Flag className="h-3.5 w-3.5 text-amber-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Remove flag"
                        onClick={() => handleUnflagShipment(item.id)}
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

                  {item.flagNotes && (
                    <div className="bg-amber-100/50 border border-amber-200 rounded-md px-3 py-2 mb-3 text-xs text-amber-800">
                      {item.flagNotes}
                    </div>
                  )}

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
            {filteredShipments.length === 0 && shipmentItems.length > 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                No shipments match this filter
              </p>
            )}
          </div>
        )}

        {/* Emails list */}
        {activeTab === "emails" && (
          <div className="space-y-3">
            {filteredEmails.length === 0 && emailItems.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Mail className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No flagged emails yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Flag individual emails from the shipment panel email view
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredEmails.map((email) => (
                <Card key={email.gmailMessageId} className="border-amber-200 bg-amber-50/30">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">
                          {email.subject || "No subject"}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {parseFlagReasons(email.flagReason).map((r) => (
                            <span
                              key={r}
                              className="text-[10px] font-medium text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full"
                            >
                              {FLAG_REASON_LABELS[r]}
                            </span>
                          ))}
                          {email.resultStatus && (
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded-full border",
                              email.resultStatus === "matched"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : email.resultStatus === "error"
                                  ? "bg-red-50 text-red-700 border-red-200"
                                  : "bg-gray-50 text-gray-600 border-gray-200"
                            )}>
                              {email.resultStatus}
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
                          onClick={() => setEditingEmailId(email.gmailMessageId)}
                        >
                          <Flag className="h-3.5 w-3.5 text-amber-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Remove flag"
                          onClick={() => handleUnflagEmail(email.gmailMessageId)}
                        >
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        {email.shipmentId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="View shipment"
                            onClick={() => router.push(`/shipments/${email.shipmentId}`)}
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {email.flagNotes && (
                      <div className="bg-amber-100/50 border border-amber-200 rounded-md px-3 py-2 mb-2 text-xs text-amber-800">
                        {email.flagNotes}
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs text-muted-foreground">
                      {email.fromAddress && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{email.fromAddress}</span>
                        </div>
                      )}
                      {email.parserUsed && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                            {email.parserUsed}
                          </span>
                        </div>
                      )}
                      {email.receivedAt && (
                        <div className="text-muted-foreground/60">
                          {new Date(email.receivedAt).toLocaleDateString()}
                        </div>
                      )}
                      {email.flaggedAt && (
                        <div className="text-muted-foreground/60">
                          Flagged {new Date(email.flaggedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    {email.errorMessage && (
                      <div className="mt-2 pt-2 border-t border-amber-200/50">
                        <p className="text-[11px] text-red-600 truncate">
                          <span className="font-medium">Error:</span> {email.errorMessage}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
            {filteredEmails.length === 0 && emailItems.length > 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                No emails match this filter
              </p>
            )}
          </div>
        )}
      </div>

      {/* Edit shipment flag dialog */}
      {editingShipmentId !== null && (
        <FlagDialog
          open
          onClose={() => setEditingShipmentId(null)}
          shipmentId={editingShipmentId}
          shipmentName={shipmentItems.find((i) => i.id === editingShipmentId)?.itemName || undefined}
          currentReason={shipmentItems.find((i) => i.id === editingShipmentId)?.flagReason}
          currentNotes={shipmentItems.find((i) => i.id === editingShipmentId)?.flagNotes}
          onSuccess={() => {
            setEditingShipmentId(null);
            fetchFlagged();
          }}
        />
      )}

      {/* Edit email flag dialog */}
      {editingEmailId !== null && (
        <FlagDialog
          open
          onClose={() => setEditingEmailId(null)}
          shipmentId={emailItems.find((e) => e.gmailMessageId === editingEmailId)?.shipmentId || 0}
          mode="email"
          emailId={editingEmailId}
          emailSubject={emailItems.find((e) => e.gmailMessageId === editingEmailId)?.subject || undefined}
          currentReason={emailItems.find((e) => e.gmailMessageId === editingEmailId)?.flagReason}
          currentNotes={emailItems.find((e) => e.gmailMessageId === editingEmailId)?.flagNotes}
          onSuccess={() => {
            setEditingEmailId(null);
            fetchFlagged();
          }}
        />
      )}
    </div>
  );
}
