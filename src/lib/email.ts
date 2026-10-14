import "server-only";

export interface EmailAttachment {
  filename: string;
  content: Uint8Array;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  fromName: string;
  replyTo?: string | null;
  attachments?: EmailAttachment[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  // Local testing only: print the email instead of sending it.
  if (process.env.EMAIL_LOG_ONLY === "true") {
    console.log(`[email] to=${opts.to} subject=${JSON.stringify(opts.subject)}\n${opts.text}`);
    return { ok: true };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  if (!apiKey || !fromAddress) {
    return { ok: false, error: "Email sending isn't configured yet (missing RESEND_API_KEY / EMAIL_FROM_ADDRESS)." };
  }

  const safeName = opts.fromName.replace(/["<>\r\n]/g, "").trim() || "Crew & Grounds";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${safeName} <${fromAddress}>`,
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      attachments: (opts.attachments ?? []).map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") })),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    return { ok: false, error: body?.message ?? `Email provider returned ${res.status}.` };
  }
  return { ok: true };
}
