import { createHmac, timingSafeEqual } from "crypto";
import { after } from "next/server";
import { handleInvoiceEvents } from "@/lib/xero";

// Xero -> app: tells us an invoice changed (e.g. a payment was reconciled), so its payments can be pulled in.
// Public on purpose; every request must carry Xero's HMAC signature made with our webhook key. Xero's
// "intent to receive" check sends a bad signature on purpose and expects a 401 for it.
export async function POST(req: Request) {
  const key = process.env.XERO_WEBHOOK_KEY;
  const raw = await req.text();
  const given = req.headers.get("x-xero-signature") ?? "";
  if (!key) return new Response(null, { status: 401 });
  const expected = createHmac("sha256", key).update(raw).digest("base64");
  const ok = given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return new Response(null, { status: 401 });

  let events: { tenantId: string; resourceId: string; eventCategory: string }[] = [];
  try {
    events = JSON.parse(raw).events ?? [];
  } catch {
    return new Response(null, { status: 200 });
  }
  // Answer straight away (Xero wants a reply within 5 seconds) and do the work afterwards.
  if (events.length) after(() => handleInvoiceEvents(events));
  return new Response(null, { status: 200 });
}
