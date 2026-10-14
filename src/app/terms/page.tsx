import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of Service | Crew & Grounds" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated={LEGAL.updated}>
      <p>
        These terms apply to your use of {LEGAL.product} (the &ldquo;Service&rdquo;), provided by {LEGAL.operator}
        {LEGAL.abn ? ` (ABN ${LEGAL.abn})` : ""} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account or using the Service you agree to them on behalf of
        yourself and the business you represent. If you don&rsquo;t agree, please don&rsquo;t use the Service.
      </p>

      <h2>1. The Service</h2>
      <p>
        {LEGAL.product} is online software for running a field-service business: clients and properties, jobs and scheduling, staff and crews, quotes, invoices,
        payments tracking and reports. We may add, change or remove features over time.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must be able to form a binding contract and provide accurate sign-up details.</li>
        <li>You are responsible for activity under your account, for keeping your login secure, and for the people you invite as staff.</li>
        <li>Each business account is separate. You must not try to access another business&rsquo;s data.</li>
      </ul>

      <h2>3. Your data</h2>
      <p>
        You own the data you put into the Service, including information about your own clients, jobs and finances (&ldquo;Customer Data&rdquo;). You give us
        permission to store and process it only to provide and support the Service. You are responsible for having the right to enter that data, and for
        complying with privacy and consumer laws that apply to your business, including telling your own clients how you handle their information.
      </p>
      <p>See our <a href="/privacy">Privacy Policy</a> for how we handle personal information.</p>

      <h2>4. Acceptable use</h2>
      <p>You must not:</p>
      <ul>
        <li>use the Service for anything unlawful, misleading or harmful, or to send spam;</li>
        <li>attempt to break, probe or overload the Service, or bypass its security or access controls;</li>
        <li>resell or provide the Service to others without our written agreement;</li>
        <li>upload malicious code or content you don&rsquo;t have the right to share.</li>
      </ul>
      <p>We may suspend accounts that breach these terms or put the Service or other customers at risk.</p>

      <h2>5. Quotes, invoices and email</h2>
      <p>
        When you send a quote or invoice, the Service emails a PDF to the address you hold for your client on your behalf. You are responsible for the content of
        those documents, for their accuracy (including GST and pricing), and for sending only to people who expect to hear from you. The Service tracks payments you
        record manually; it does not process card payments unless and until we tell you otherwise.
      </p>

      <h2>6. Fees</h2>
      <p>
        The Service may be free during early access. If we introduce paid plans we will tell you in advance, and you will not be charged until you agree to a plan.
        Taxes such as GST are added where applicable.
      </p>

      <h2>7. Availability and backups</h2>
      <p>
        We work to keep the Service available and your data safe, but we don&rsquo;t promise it will be uninterrupted or error-free. You should keep your own copy
        of important records, and you can export your client list from the Clients page.
      </p>

      <h2>8. Liability</h2>
      <p>
        Nothing in these terms excludes rights you have under the Australian Consumer Law that cannot be excluded. Otherwise, to the extent the law allows, the
        Service is provided &ldquo;as is&rdquo;, we are not liable for indirect or consequential loss (including lost profits or lost business), and our total
        liability for any claim is limited to the fees you paid us in the 12 months before the claim (or AUD $100 if you paid nothing).
      </p>

      <h2>9. Ending your account</h2>
      <p>
        You can stop using the Service at any time and ask us to delete your business account and data by emailing <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
        We may suspend or end access if you breach these terms. Sections that by their nature should survive (such as liability) continue after termination.
      </p>

      <h2>10. Changes to these terms</h2>
      <p>
        We may update these terms. If a change is material we&rsquo;ll notify you by email or in the app before it takes effect. Continuing to use the Service after
        that means you accept the updated terms.
      </p>

      <h2>11. Governing law</h2>
      <p>These terms are governed by the laws of {LEGAL.governingState}, Australia, and the courts of that state have jurisdiction.</p>

      <h2>12. Contact</h2>
      <p>
        Questions? Email <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>
    </LegalPage>
  );
}
