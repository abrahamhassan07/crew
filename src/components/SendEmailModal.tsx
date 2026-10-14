"use client";

import { useState } from "react";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MAX_BODY, MAX_SUBJECT, type EmailDraft } from "@/lib/emailTemplates";

/** "Review email" step shown before a quote or invoice is emailed; wording edits apply to this send only. */
export function SendEmailModal({
  draft,
  confirmLabel,
  pending,
  error,
  onSend,
  onCancel,
}: {
  draft: EmailDraft;
  confirmLabel: string;
  pending: boolean;
  error: string | null;
  onSend: (subject: string, body: string) => void;
  onCancel: () => void;
}) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);

  return (
    <>
      <div onClick={pending ? undefined : onCancel} className="fixed inset-0 bg-black/45 z-100" />
      <div className="fixed inset-0 z-101 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-card-bg rounded-xl w-full max-w-xl max-h-full overflow-y-auto p-5 pointer-events-auto">
          <h2 className="text-lg font-bold mb-3">Review email</h2>
          <div className="text-sm text-ink-secondary mb-3">
            To <strong className="text-ink-primary">{draft.clientName || draft.to}</strong> &lt;{draft.to}&gt;
          </div>
          <label className="block text-sm font-semibold text-ink-primary mb-1.5" htmlFor="email-subject">Subject</label>
          <input
            id="email-subject"
            value={subject}
            maxLength={MAX_SUBJECT}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-field-border text-sm bg-white text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand mb-3"
          />
          <label className="block text-sm font-semibold text-ink-primary mb-1.5" htmlFor="email-body">Message</label>
          <textarea
            id="email-body"
            value={body}
            rows={12}
            maxLength={MAX_BODY}
            onChange={(e) => setBody(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-field-border text-sm bg-white text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand leading-relaxed"
          />
          <div className="flex items-center gap-1.5 text-xs text-ink-muted mt-2">
            <Paperclip className="w-3.5 h-3.5" />
            {draft.attachmentName} is attached automatically.
          </div>
          {error && <p className="text-sm text-danger mt-3">{error}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={onCancel} disabled={pending}>Cancel</Button>
            <Button variant="primary" onClick={() => onSend(subject, body)} disabled={pending || !subject.trim() || !body.trim()}>
              {pending ? "Sending…" : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
