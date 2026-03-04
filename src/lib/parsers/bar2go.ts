import type { EmailParser, ParsedShipmentData } from "./types";
import { cleanText } from "./index";

export const bar2goParser: EmailParser = {
  name: "bar2go",

  canParse(from: string, subject: string): boolean {
    const fromLower = from.toLowerCase();
    return (
      fromLower.includes("bar-ltd.co.il") ||
      fromLower.includes("bar2go.co.il") ||
      fromLower.includes("bar2go")
    );
  },

  parse(
    from: string,
    subject: string,
    htmlBody: string,
    textBody: string
  ): ParsedShipmentData | null {
    const body = textBody || htmlBody.replace(/<[^>]*>/g, " ");
    const combined = subject + " " + body;

    // Extract tracking number — Bar2Go uses format like BR004634645MG (2 letters + 9-12 chars)
    // Try subject first (often "משלוח מספר BR004634645MG")
    const subjectTrackingMatch = subject.match(/\b([A-Z]{2}\d{9,12}[A-Z]{0,2})\b/);
    let trackingNumber = subjectTrackingMatch?.[1];

    // Fallback: try body
    if (!trackingNumber) {
      const bodyMatch = combined.match(/\b([A-Z]{2}\d{9,12}[A-Z]{0,2})\b/);
      trackingNumber = bodyMatch?.[1];
    }

    if (!trackingNumber) return null;

    // Extract tracking/delivery URL from Bar2Go links
    let trackingUrl: string | undefined;
    const urlPatterns = [
      /href="(https?:\/\/bar2go\.co\.il\/[^"]+)"/i,
      /href="(https?:\/\/(?:www\.)?bar-ltd\.co\.il\/[^"]+)"/i,
      /(https?:\/\/bar2go\.co\.il\/\S+)/i,
      /(https?:\/\/(?:www\.)?bar-ltd\.co\.il\/\S+)/i,
    ];
    for (const pattern of urlPatterns) {
      const match = htmlBody.match(pattern) || body.match(pattern);
      if (match) {
        trackingUrl = match[1];
        break;
      }
    }

    // Extract pickup confirmation / delivery URL (pdc links)
    if (!trackingUrl) {
      const pdcMatch = htmlBody.match(/href="(https?:\/\/bar2go\.co\.il\/pdc\/[^"]+)"/i) ||
        body.match(/(https?:\/\/bar2go\.co\.il\/pdc\/\S+)/i);
      if (pdcMatch) trackingUrl = pdcMatch[1];
    }

    // Extract package number at store (מס. חבילה בחנות)
    const packageNumberMatch = combined.match(/מס\.?\s*חבילה\s*(?:בחנות)?\s*:?\s*(\d[\d-]+)/);
    const packageNumber = packageNumberMatch?.[1];

    // Extract pickup location
    const locationMatch = combined.match(/חנו(?:י)?ות?\s*:?\s*([^,.\n]+)/);
    const pickupLocation = locationMatch?.[1]?.trim();

    // Determine status from Hebrew keywords
    let status: ParsedShipmentData["status"] = "in_transit";

    if (/נמסר|delivered/i.test(combined)) {
      status = "delivered";
    } else if (/ממתין לאיסוף|לאיסופך|מוכן לאיסוף|ready.*pickup|איסוף/i.test(combined)) {
      status = "ready_for_pickup";
    } else if (/יצא לחלוקה|out.*delivery|שליח בדרך/i.test(combined)) {
      status = "out_for_delivery";
    } else if (/בדרך|in.*transit|משלוח/i.test(combined)) {
      status = "in_transit";
    } else if (/נשלח|shipped|dispatched/i.test(combined)) {
      status = "shipped";
    }

    // Build item name with context
    let itemName = `Shipment ${trackingNumber}`;
    if (pickupLocation) {
      itemName = `Pickup at ${pickupLocation} — ${trackingNumber}`;
    }

    return {
      retailer: "Unknown",
      itemName: cleanText(itemName),
      trackingNumber,
      trackingUrl,
      carrier: "Bar2Go",
      originCountry: "IL",
      status,
    };
  },
};
