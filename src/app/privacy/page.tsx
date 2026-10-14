import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy | Crew & Grounds" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={LEGAL.updated}>
      <p>
        {LEGAL.operator}
        {LEGAL.abn ? ` (ABN ${LEGAL.abn})` : ""} runs {LEGAL.product}. We handle personal information in line with the Privacy Act 1988 (Cth) and the Australian
        Privacy Principles. This policy explains what we collect, why, and your choices.
      </p>

      <h2>Two kinds of information</h2>
      <ul>
        <li>
          <strong>Account information</strong> about you and your staff (the people who log in). We decide how this is used.
        </li>
        <li>
          <strong>Customer Data</strong> that your business enters about its own clients and work. You decide what to enter and why; we store and process it on
          your behalf and only to run the Service.
        </li>
      </ul>

      <h2>What we collect</h2>
      <ul>
        <li>Account details: name, email address, business name and contact details, and your role.</li>
        <li>If you sign in with Google: your Google name and email address (we do not receive your Google password).</li>
        <li>
          Customer Data you enter: your clients&rsquo; names, addresses, phone numbers and emails, job, quote and invoice details, notes and payments you record.
        </li>
        <li>Feedback you send us from inside the app: your message, your name and email, the page you were on, and basic browser details.</li>
        <li>Technical data: sign-in sessions, IP address and basic logs needed to keep the Service secure and working.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To provide, secure, support and improve the Service.</li>
        <li>To send account emails (confirmation, password reset, invitations) and, when you ask, to email quotes and invoices to your clients on your behalf.</li>
        <li>To meet legal obligations and respond to your requests.</li>
      </ul>
      <p>We don&rsquo;t sell personal information or use Customer Data for advertising.</p>

      <h2>Who we share it with</h2>
      <p>We use trusted providers to run the Service. They may only handle data to provide their service to us:</p>
      <ul>
        <li>Supabase &mdash; database, file storage and sign-in (our database is hosted in Sydney, Australia).</li>
        <li>Vercel &mdash; application hosting.</li>
        <li>Resend &mdash; delivery of emails sent by the Service.</li>
        <li>Google &mdash; optional Google sign-in and address autocomplete.</li>
        <li>Stripe &mdash; subscription billing and card payments for your {LEGAL.product} plan (we never see or store your card number).</li>
        <li>Sentry &mdash; error monitoring, so we can find and fix faults. It receives technical error details, not your clients&rsquo; records.</li>
      </ul>
      <p>
        Some of these providers process data outside Australia (for example in the United States). We take reasonable steps to ensure they protect it
        appropriately. Your data is separated from other businesses using the Service and is only visible to people in your own business account.
      </p>

      <h2>Cookies</h2>
      <p>We use only the cookies required to keep you signed in and secure. We don&rsquo;t use advertising or tracking cookies.</p>

      <h2>Security and retention</h2>
      <p>
        We use access controls, encryption in transit and per-business data separation. No system is perfectly secure; if a breach is likely to cause serious harm
        we will notify affected people and the OAIC as required by law. We keep information while your account is active and delete or de-identify it after you
        close your account, unless we must keep it for legal reasons.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask to access or correct personal information we hold about you, or to delete your account, by emailing{" "}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>. If you are a client of a business that uses {LEGAL.product}, please contact that business
        first &mdash; they control your information and can action your request.
      </p>

      <h2>Complaints</h2>
      <p>
        If you think we have breached the Privacy Principles, contact us and we&rsquo;ll respond within a reasonable time. You can also complain to the Office of
        the Australian Information Commissioner at <a href="https://www.oaic.gov.au">oaic.gov.au</a>.
      </p>

      <h2>Changes</h2>
      <p>We may update this policy and will change the date above when we do. Material changes will be notified by email or in the app.</p>

      <h2>Contact</h2>
      <p>
        {LEGAL.operator} &mdash; <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
      </p>
    </LegalPage>
  );
}
