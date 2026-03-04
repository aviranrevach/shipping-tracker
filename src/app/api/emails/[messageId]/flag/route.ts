import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailSync } from "@/lib/db/schema";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
    const body = await request.json();

    const [updated] = await db
      .update(emailSync)
      .set({
        isFlagged: body.isFlagged ?? true,
        flagReason: body.flagReason ?? null,
        flagNotes: body.flagNotes ?? null,
        flaggedAt: body.isFlagged !== false ? new Date().toISOString() : null,
      })
      .where(eq(emailSync.gmailMessageId, messageId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Email flag error:", error);
    return NextResponse.json(
      { error: "Failed to flag email" },
      { status: 500 }
    );
  }
}
