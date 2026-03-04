import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shipments, emailSync } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    // Get all flagged shipments
    const flaggedShipments = await db
      .select()
      .from(shipments)
      .where(eq(shipments.isFlagged, true))
      .orderBy(desc(shipments.flaggedAt));

    // Enrich with email sync data (parser used, etc.)
    const enriched = await Promise.all(
      flaggedShipments.map(async (s) => {
        let parserUsed: string | null = null;
        let emailReceivedAt: string | null = null;

        if (s.emailId) {
          const syncRows = await db
            .select({
              parserUsed: emailSync.parserUsed,
              receivedAt: emailSync.receivedAt,
            })
            .from(emailSync)
            .where(eq(emailSync.gmailMessageId, s.emailId))
            .limit(1);

          if (syncRows.length > 0) {
            parserUsed = syncRows[0].parserUsed;
            emailReceivedAt = syncRows[0].receivedAt;
          }
        }

        return {
          ...s,
          parserUsed,
          emailReceivedAt,
        };
      })
    );

    return NextResponse.json({ flagged: enriched, total: enriched.length });
  } catch (error) {
    console.error("Flagged GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch flagged items" },
      { status: 500 }
    );
  }
}
