import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shipments, emailSync } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const format = request.nextUrl.searchParams.get("format");

    // 1. Flagged shipments with all related emails
    const flaggedShipments = await db
      .select()
      .from(shipments)
      .where(eq(shipments.isFlagged, true))
      .orderBy(desc(shipments.flaggedAt));

    const enrichedShipments = await Promise.all(
      flaggedShipments.map(async (s) => {
        const emails = await db
          .select({
            gmailMessageId: emailSync.gmailMessageId,
            subject: emailSync.subject,
            fromAddress: emailSync.fromAddress,
            receivedAt: emailSync.receivedAt,
            parserUsed: emailSync.parserUsed,
            resultStatus: emailSync.resultStatus,
            errorMessage: emailSync.errorMessage,
            isFlagged: emailSync.isFlagged,
            flagReason: emailSync.flagReason,
            flagNotes: emailSync.flagNotes,
          })
          .from(emailSync)
          .where(eq(emailSync.shipmentId, s.id))
          .orderBy(desc(emailSync.receivedAt));

        return {
          ...s,
          parserUsed: emails[0]?.parserUsed ?? null,
          emailReceivedAt: emails[0]?.receivedAt ?? null,
          emails,
        };
      })
    );

    // 2. Flagged emails (email-level flags)
    const flaggedEmails = await db
      .select({
        gmailMessageId: emailSync.gmailMessageId,
        subject: emailSync.subject,
        fromAddress: emailSync.fromAddress,
        receivedAt: emailSync.receivedAt,
        parserUsed: emailSync.parserUsed,
        resultStatus: emailSync.resultStatus,
        errorMessage: emailSync.errorMessage,
        shipmentId: emailSync.shipmentId,
        flagReason: emailSync.flagReason,
        flagNotes: emailSync.flagNotes,
        flaggedAt: emailSync.flaggedAt,
        accountEmail: emailSync.accountEmail,
      })
      .from(emailSync)
      .where(eq(emailSync.isFlagged, true))
      .orderBy(desc(emailSync.flaggedAt));

    // 3. Research-friendly export format
    if (format === "claude") {
      return NextResponse.json({
        exportedAt: new Date().toISOString(),
        summary: {
          totalFlaggedShipments: enrichedShipments.length,
          totalFlaggedEmails: flaggedEmails.length,
        },
        flaggedShipments: enrichedShipments.map((s) => ({
          shipmentId: s.id,
          itemName: s.itemName,
          retailer: s.retailer,
          carrier: s.carrier,
          trackingNumber: s.trackingNumber,
          status: s.status,
          originCountry: s.originCountry,
          flagReasons: s.flagReason,
          flagNotes: s.flagNotes,
          flaggedAt: s.flaggedAt,
          emailSubject: s.emailSubject,
          emailFrom: s.emailFrom,
          relatedEmails: s.emails.map((e) => ({
            messageId: e.gmailMessageId,
            subject: e.subject,
            from: e.fromAddress,
            receivedAt: e.receivedAt,
            parserUsed: e.parserUsed,
            resultStatus: e.resultStatus,
            error: e.errorMessage,
            isFlagged: e.isFlagged,
            flagReasons: e.flagReason,
            flagNotes: e.flagNotes,
          })),
        })),
        flaggedEmails: flaggedEmails.map((e) => ({
          messageId: e.gmailMessageId,
          subject: e.subject,
          from: e.fromAddress,
          receivedAt: e.receivedAt,
          parserUsed: e.parserUsed,
          resultStatus: e.resultStatus,
          error: e.errorMessage,
          shipmentId: e.shipmentId,
          flagReasons: e.flagReason,
          flagNotes: e.flagNotes,
          flaggedAt: e.flaggedAt,
        })),
        instructions:
          "This export contains flagged shipments and emails for research. " +
          "Flag reasons are JSON arrays. Common workflows: " +
          "1) 'unidentified_carrier' → examine parserUsed and create/fix parsers. " +
          "2) 'not_related' → examine email subject/from to improve filter logic. " +
          "3) 'should_merge' → check flagNotes for merge target, examine email threading.",
      });
    }

    return NextResponse.json({
      flaggedShipments: enrichedShipments,
      flaggedEmails,
      total: enrichedShipments.length + flaggedEmails.length,
    });
  } catch (error) {
    console.error("Flagged GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch flagged items" },
      { status: 500 }
    );
  }
}
