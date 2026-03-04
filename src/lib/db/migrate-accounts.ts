import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { settings, gmailAccounts } from "@/lib/db/schema";
import { createOAuth2Client } from "@/lib/gmail/client";
import { getGmailProfile } from "@/lib/gmail/fetch";

/**
 * Fast schema migration — safe to await at startup.
 * Creates tables/columns without any external API calls.
 */
export async function migrateGmailAccountsSchema(): Promise<void> {
  // Core tables
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS shipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      retailer TEXT,
      order_number TEXT,
      item_name TEXT,
      item_description TEXT,
      purchase_date TEXT,
      status TEXT NOT NULL DEFAULT 'ordered',
      tracking_number TEXT,
      carrier TEXT,
      tracking_url TEXT,
      estimated_delivery TEXT,
      actual_delivery TEXT,
      last_status_update TEXT,
      origin_country TEXT,
      is_international INTEGER DEFAULT 0,
      email_id TEXT,
      email_subject TEXT,
      email_from TEXT,
      product_url TEXT,
      is_manual INTEGER DEFAULT 0,
      is_flagged INTEGER DEFAULT 0,
      flag_reason TEXT,
      flag_notes TEXT,
      flagged_at TEXT,
      notes TEXT,
      account_email TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS shipment_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      source_url TEXT,
      source TEXT NOT NULL DEFAULT 'email',
      is_primary INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS gmail_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      tokens TEXT NOT NULL,
      added_at TEXT DEFAULT (datetime('now')),
      last_sync_at TEXT
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS email_sync (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gmail_message_id TEXT NOT NULL UNIQUE,
      gmail_thread_id TEXT,
      subject TEXT,
      from_address TEXT,
      received_at TEXT,
      processed_at TEXT DEFAULT (datetime('now')),
      parser_used TEXT,
      result_status TEXT NOT NULL,
      error_message TEXT,
      shipment_id INTEGER REFERENCES shipments(id),
      account_email TEXT
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      emails_scanned INTEGER DEFAULT 0,
      shipments_created INTEGER DEFAULT 0,
      shipments_updated INTEGER DEFAULT 0,
      errors INTEGER DEFAULT 0,
      status TEXT NOT NULL,
      error_message TEXT
    )
  `);

  // Safe column additions for older databases
  try {
    await db.run(sql`ALTER TABLE email_sync ADD COLUMN account_email TEXT`);
  } catch {
    // Column already exists — ignore
  }

  try {
    await db.run(sql`ALTER TABLE shipments ADD COLUMN account_email TEXT`);
  } catch {
    // Column already exists — ignore
  }

  try {
    await db.run(sql`ALTER TABLE shipments ADD COLUMN is_flagged INTEGER DEFAULT 0`);
  } catch {
    // Column already exists — ignore
  }

  try {
    await db.run(sql`ALTER TABLE shipments ADD COLUMN flag_reason TEXT`);
  } catch {
    // Column already exists — ignore
  }

  try {
    await db.run(sql`ALTER TABLE shipments ADD COLUMN flag_notes TEXT`);
  } catch {
    // Column already exists — ignore
  }

  try {
    await db.run(sql`ALTER TABLE shipments ADD COLUMN flagged_at TEXT`);
  } catch {
    // Column already exists — ignore
  }
}

/**
 * Migrates legacy gmail_tokens from settings into the new gmail_accounts table.
 * Makes an external API call to discover the email — run in background, not blocking startup.
 */
export async function migrateLegacyTokens(): Promise<void> {
  try {
    // Check if migration already ran
    const existingAccount = await db
      .select()
      .from(gmailAccounts)
      .limit(1)
      .get();
    if (existingAccount) return;

    // Check for legacy tokens in settings table
    const legacyRow = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "gmail_tokens"))
      .get();

    if (!legacyRow) return;

    const tokens = JSON.parse(legacyRow.value);

    // Discover the email for these tokens
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials(tokens);
    const profile = await getGmailProfile(oauth2Client);
    const email = profile.emailAddress;

    if (email) {
      await db.insert(gmailAccounts).values({
        email,
        tokens: legacyRow.value,
      });
      console.log(`[Migration] Migrated Gmail account: ${email}`);
    }

    // Remove legacy row
    await db.delete(settings).where(eq(settings.key, "gmail_tokens"));
    console.log("[Migration] Removed legacy gmail_tokens from settings");
  } catch (error) {
    console.error("[Migration] Failed to migrate Gmail tokens:", error);
  }
}
