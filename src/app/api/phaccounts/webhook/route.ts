import { after } from "next/server";
import { handlePhEvent } from "@/lib/phAccounts";
import { parsePhEvent, verifyPhSignature } from "@/lib/phAccountsCore";

// PH Accounts -> app: an invoice or payment changed in a connected business (e.g. a payment was recorded while
// reconciling the bank), so its payments can be pulled in. Public on purpose; every request must carry PH
// Accounts' signature made with our webhook signing secret (https://phaccounts.com/developers).
export async function POST(req: Request) {
  const secret = process.env.PH_ACCOUNTS_WEBHOOK_SECRET;
  const raw = await req.text();
  if (!secret || !verifyPhSignature(secret, req.headers.get("x-phaccounts-signature"), raw, Math.floor(Date.now() / 1000))) {
    return new Response(null, { status: 401 });
  }
  const event = parsePhEvent(raw);
  // Answer straight away (PH Accounts wants a reply within 10 seconds) and do the work afterwards. Pulling is
  // idempotent, so a repeated delivery of the same event is harmless.
  if (event) after(() => handlePhEvent(event));
  return new Response(null, { status: 200 });
}
