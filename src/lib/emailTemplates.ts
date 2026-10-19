// Wording for the quote/invoice emails. Shared by the server (sending) and the
// Settings page (editing), so this file must stay free of server-only imports.

export type EmailKind = "quote" | "invoice";
export type TemplateKind = EmailKind | "reminder" | "review";

export interface EmailTemplate {
  subject: string;
  body: string;
}

export const DEFAULT_TEMPLATES: Record<TemplateKind, EmailTemplate> = {
  quote: {
    subject: "{document} {number} from {business}",
    body: "Hi {first_name},\n\nPlease find attached quote {number} for {total}, valid until {valid_until}.\n\n{message}\n\nTo accept this quote, just reply to this email.\n\nThanks,\n{signature}",
  },
  reminder: {
    subject: "Reminder: {business} is visiting {date}",
    body: "Hi {first_name},\n\nThis is a friendly reminder that {business} is booked to visit {address} tomorrow, {date}, at {time}.\n\nIf you need to change or cancel, just reply to this email.\n\nThanks,\n{signature}",
  },
  review: {
    subject: "How did we do, {first_name}?",
    body: "Hi {first_name},\n\nThanks for choosing {business}. We hope you're happy with the work.\n\nIf you have a minute, we'd really appreciate a quick Google review. It helps other locals find us:\n{review_link}\n\nThanks,\n{signature}",
  },
  invoice: {
    subject: "{document} {number} from {business}",
    body: "Hi {first_name},\n\nPlease find attached {document} {number} for {total}, due {due_date}.\n\nPlease get in touch if you have any questions about this invoice.\n\nThanks,\n{signature}",
  },
};

export const PLACEHOLDERS: Record<TemplateKind, { key: string; help: string }[]> = {
  quote: [
    { key: "first_name", help: "client's first name" },
    { key: "number", help: "quote number" },
    { key: "total", help: "total amount" },
    { key: "valid_until", help: "expiry date" },
    { key: "message", help: "the message on the quote" },
    { key: "business", help: "your business name" },
    { key: "signature", help: "your name, phone and email" },
  ],
  reminder: [
    { key: "first_name", help: "client's first name" },
    { key: "date", help: "visit date" },
    { key: "time", help: "start time" },
    { key: "address", help: "job address" },
    { key: "service", help: "the job's title" },
    { key: "business", help: "your business name" },
    { key: "signature", help: "your name, phone and email" },
  ],
  review: [
    { key: "first_name", help: "client's first name" },
    { key: "review_link", help: "your review link" },
    { key: "service", help: "the job's title" },
    { key: "business", help: "your business name" },
    { key: "signature", help: "your name, phone and email" },
  ],
  invoice: [
    { key: "first_name", help: "client's first name" },
    { key: "number", help: "invoice number" },
    { key: "document", help: "“tax invoice” or “invoice”" },
    { key: "total", help: "total amount" },
    { key: "due_date", help: "due date" },
    { key: "business", help: "your business name" },
    { key: "signature", help: "your name, phone and email" },
  ],
};

export const MAX_SUBJECT = 200;
export const MAX_BODY = 5000;

/** Fills {placeholders}; unknown ones are left as typed. Blank lines left by empty values are collapsed. */
export function renderTemplate(text: string, values: Record<string, string>): string {
  return text
    .replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? values[key] : match))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface EmailDraft {
  to: string;
  /** Set so the review step can ask for a missing address and save it on the client. */
  clientId: string | null;
  clientName: string;
  subject: string;
  body: string;
  attachmentName: string;
}

export interface OrgEmailTemplates {
  quote_email_subject?: string | null;
  quote_email_body?: string | null;
  invoice_email_subject?: string | null;
  invoice_email_body?: string | null;
  reminder_email_subject?: string | null;
  reminder_email_body?: string | null;
  review_email_subject?: string | null;
  review_email_body?: string | null;
}

export function templateFor(org: OrgEmailTemplates | null | undefined, kind: TemplateKind): EmailTemplate {
  const d = DEFAULT_TEMPLATES[kind];
  return {
    subject: org?.[`${kind}_email_subject`]?.trim() || d.subject,
    body: org?.[`${kind}_email_body`]?.trim() || d.body,
  };
}
