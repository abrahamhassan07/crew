import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  Check,
  FileText,
  Flower2,
  Hammer,
  MailCheck,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sprout,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";
import { ANNUAL_DISCOUNT, PLAN, POPULAR_TEAM, TEAM_SIZES } from "@/lib/plans";

// The public marketing page. Signed-in people never see it: the proxy sends them to /dashboard.
// Every claim here is a feature that is live today; keep it that way (no weather, SMS is marked "Coming soon").

const TITLE = "Crew & Grounds | Scheduling and invoicing for gardening, lawn care and cleaning businesses";
const DESCRIPTION =
  "Run your business, not your paperwork. Scheduling, crew assignments, automatic client reminders, quotes, GST tax invoices and Xero, built for Australian gardening, lawn care, cleaning and property maintenance businesses.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Crew & Grounds",
    title: "Run your business. Not your paperwork.",
    description: DESCRIPTION,
    locale: "en_AU",
    images: [{ url: "/marketing/og.jpg", width: 1200, height: 630, alt: "Crew & Grounds dashboard" }],
  },
  twitter: { card: "summary_large_image", title: "Run your business. Not your paperwork.", description: DESCRIPTION, images: ["/marketing/og.jpg"] },
};

const SIGNUP = "/signup";
const SUPPORT = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@crewandgrounds.com";

const FEATURES: { icon: LucideIcon; title: string; text: string; soon?: boolean }[] = [
  { icon: CalendarDays, title: "Easy scheduling", text: "Day, week, month and crew views. Drag jobs onto the calendar, set up recurring work and keep unscheduled jobs in one list." },
  { icon: Users, title: "Crews and staff", text: "Group your team into crews, assign each job to the right person, and give everyone their own login." },
  { icon: BellRing, title: "Your team kept in the loop", text: "Staff are emailed when a job is assigned, moved or cancelled, plus a summary of their day's schedule." },
  { icon: MailCheck, title: "Reminders the day before", text: "Customers get an email reminder the day before you arrive, with the time and address. Fewer missed appointments." },
  { icon: FileText, title: "Quotes and tax invoices", text: "PDF quotes and tax invoices with your logo, ABN and GST, emailed in a couple of clicks. Finish a job and the invoice is filled in for you." },
  { icon: RefreshCw, title: "Xero integration", text: "Invoices you send are copied into Xero with the client, line items and GST. No double entry. Team plan and above." },
  { icon: Star, title: "Google review requests", text: "After a job is done, customers get a friendly email asking for a Google review, so more locals can find you." },
  { icon: MessageSquareText, title: "SMS reminders", text: "Text-message reminders for customers and staff are on the way. Until then, reminders go out by email.", soon: true },
];

const STEPS = [
  { title: "Add your clients and jobs", text: "Bring in your client list, their properties and the services you offer. Import clients from a spreadsheet if you have one." },
  { title: "Schedule and assign your team", text: "Drag jobs onto the calendar and assign them to staff or crews. They're emailed their schedule automatically." },
  { title: "Keep clients updated automatically", text: "Customers get a reminder the day before each visit, and a review request once the job is done." },
  { title: "Invoice and track your work", text: "Mark a job done and the invoice is ready to send. Track what's paid and overdue, with invoices copied into Xero." },
];

const AUDIENCES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Flower2, title: "Gardening businesses", text: "Garden clean-ups, pruning, planting and regular maintenance rounds." },
  { icon: Sparkles, title: "Cleaning companies", text: "House cleans, end-of-lease cleans, offices and recurring bookings." },
  { icon: Sprout, title: "Lawn care providers", text: "Mowing runs, edging and seasonal work across your service area." },
  { icon: Hammer, title: "Property maintenance teams", text: "Mixed jobs across many sites, with crews and staff on the road." },
];

const SHOWCASE = [
  {
    image: "/marketing/schedule.jpg",
    size: [1920, 1200],
    alt: "Weekly schedule with jobs for each day and a list of unscheduled jobs",
    eyebrow: "Scheduling",
    title: "Your whole week at a glance",
    text: "See every job by day, week, month or crew. Drag unscheduled work onto the calendar, and move jobs when plans change. Your staff are told automatically.",
  },
  {
    image: "/marketing/job-completed.jpg",
    size: [1920, 1200],
    alt: "A job marked completed, with a prompt asking whether to create the invoice",
    eyebrow: "Invoicing",
    title: "Job done. Invoice ready.",
    text: "Mark a job completed and Crew & Grounds offers to create the invoice, with the client, address and job details already filled in. Check it, then send it as a PDF.",
  },
  {
    image: "/marketing/email-remind.jpg",
    size: [1300, 813],
    alt: "A reminder email telling a customer when the business is visiting tomorrow",
    eyebrow: "Client reminders",
    title: "Reminders that send themselves",
    text: "Turn on reminders once and every customer with an email address hears from you the day before their visit. You can edit the wording to sound like you.",
  },
  {
    image: "/marketing/invoice-xero.jpg",
    size: [1920, 1200],
    alt: "A tax invoice marked as copied into Xero",
    eyebrow: "Xero",
    title: "Invoices in Xero, without retyping",
    text: "Connect Xero and every invoice you send is created there too, matched to the right contact, with GST and line items. Available on the Team plan and above.",
  },
  {
    image: "/marketing/mobile-dashboard.jpg",
    size: [585, 1266],
    narrow: true,
    alt: "The Crew & Grounds dashboard on a phone",
    eyebrow: "On the go",
    title: "Works on your phone",
    text: "Crew & Grounds runs in the browser on any phone, so you can check today's jobs, update a job on site or send an invoice from the ute. Nothing to install.",
  },
];

const BENEFITS = [
  { title: "Less paperwork", text: "No more notebooks, whiteboards and copied-out invoices." },
  { title: "Fewer missed appointments", text: "Automatic reminders mean customers know you're coming." },
  { title: "Better communication", text: "Staff and clients are told what they need to know, without the phone calls." },
  { title: "Smarter scheduling", text: "See who's free, balance the week and fit in the extra job." },
  { title: "More time to grow", text: "Spend your evenings on the business, not the admin." },
];

const FAQ = [
  {
    q: "How does scheduling work?",
    a: "Jobs live on a calendar you can view by day, week, month or crew. Drag a job to a new time or day, assign it to a staff member or crew, and set it to repeat for regular clients. Jobs without a date wait in an unscheduled list until you're ready.",
  },
  {
    q: "How do the email reminders work?",
    a: "Turn on customer reminders in Settings and, every morning, Crew & Grounds emails each customer who has a job the next day, with the date, time and address. Each customer is reminded once per job, and you can edit the wording.",
  },
  {
    q: "Does it work with Xero?",
    a: "Yes. On the Team plan and above, connect your Xero organisation and every invoice you send is copied into Xero with the client, line items and GST. Edits and voids are kept in step. Payments are still recorded in Crew & Grounds for now.",
  },
  {
    q: "Can I use it on my phone?",
    a: "Yes. Crew & Grounds runs in the web browser on any phone, tablet or computer, so you and your team can check the schedule and update jobs on site. There's nothing to download from an app store.",
  },
  {
    q: "Can I send SMS reminders?",
    a: "Not yet. SMS reminders are coming soon. Today, reminders and notifications are sent by email.",
  },
  {
    q: "Do I need a credit card to try it?",
    a: "No. Start a free trial without a card. When you're ready, choose a plan by team size. Plans renew monthly or yearly and you can cancel any time.",
  },
  {
    q: "Is my data secure?",
    a: "Your data is stored in Australia (Sydney) and kept separate from every other business. Sign-in supports two-factor authentication with an authenticator app, and you can sign out of every device at once.",
  },
];

export default function LandingPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Crew & Grounds",
      url: "https://www.crewandgrounds.com",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web browser",
      description: DESCRIPTION,
      areaServed: "AU",
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "AUD",
        lowPrice: Math.min(...TEAM_SIZES.map((t) => t.price)),
        highPrice: Math.max(...TEAM_SIZES.map((t) => t.price)),
        offerCount: TEAM_SIZES.length,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  return (
    <div className="bg-card-bg text-ink-primary">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-ok-bg/70 via-page-bg to-card-bg">
          <div className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-brand/10 blur-3xl" aria-hidden />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 sm:pt-20 sm:pb-24 grid lg:grid-cols-[1fr_1.1fr] gap-12 items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-card-bg border border-line px-3 py-1 text-xs font-semibold text-ink-secondary shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-brand" aria-hidden />
                For Australian gardening, lawn care and cleaning businesses
              </p>
              <h1 className="font-serif font-semibold text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight mt-5 text-forest">
                Run your business.
                <br />
                <span className="text-brand">Not your paperwork.</span>
              </h1>
              <p className="text-lg text-ink-secondary leading-relaxed mt-5 max-w-xl">
                Scheduling, client reminders, quotes and invoicing, with Xero built in. Everything you need to keep your team moving.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <CtaLink href={SIGNUP}>Get started</CtaLink>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 rounded-lg border border-field-border bg-card-bg px-5 py-3 text-base font-semibold text-ink-primary hover:bg-page-bg transition-colors"
                >
                  See how it works
                </a>
              </div>
              <p className="text-sm text-ink-muted mt-4">Free trial. No credit card needed.</p>
            </div>

            <div className="relative">
              <div className="rounded-2xl border border-line bg-card-bg shadow-lg overflow-hidden">
                <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-line bg-page-bg" aria-hidden>
                  <span className="w-2.5 h-2.5 rounded-full bg-line" />
                  <span className="w-2.5 h-2.5 rounded-full bg-line" />
                  <span className="w-2.5 h-2.5 rounded-full bg-line" />
                  <span className="ml-3 text-xs text-ink-muted">crewandgrounds.com</span>
                </div>
                <video
                  className="w-full aspect-video bg-forest"
                  controls
                  playsInline
                  preload="none"
                  poster="/marketing/promo-poster.jpg"
                  aria-label="40-second video tour of Crew & Grounds"
                >
                  <source src="/marketing/promo.mp4" type="video/mp4" />
                </video>
              </div>
            </div>
          </div>

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pb-12">
            <ul className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-ink-secondary">
              {[
                { icon: FileText, text: "GST tax invoices with your ABN" },
                { icon: Smartphone, text: "Works on any phone or computer" },
                { icon: ShieldCheck, text: "Data stored in Australia" },
                { icon: RefreshCw, text: "Xero integration" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2.5 rounded-lg bg-card-bg/80 border border-line px-3 py-2.5">
                  <Icon className="w-4 h-4 text-brand shrink-0" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 py-20 sm:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <SectionHeading eyebrow="Features" title="Everything your business runs on, in one place" text="Built for businesses with people on the road: the schedule, the team, the customers and the money." />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={(i % 4) * 80}>
                  <div className="h-full rounded-xl border border-line bg-card-bg p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${f.soon ? "bg-neutral-bg text-neutral-fg" : "bg-ok-bg text-brand"}`}>
                      <f.icon className="w-5 h-5" aria-hidden />
                    </div>
                    <h3 className="font-bold text-base mt-4 flex flex-wrap items-center gap-2">
                      {f.title}
                      {f.soon && <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-info-bg text-info-fg">Coming soon</span>}
                    </h3>
                    <p className="text-sm text-ink-secondary leading-relaxed mt-1.5">{f.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 py-20 sm:py-24 bg-forest text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <SectionHeading eyebrow="How it works" title="Four steps to an easier week" dark />
            <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
              {STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 100}>
                  <li className="h-full rounded-xl bg-white/[0.06] border border-white/10 p-5">
                    <span className="w-9 h-9 rounded-full bg-brand text-white font-bold flex items-center justify-center">{i + 1}</span>
                    <h3 className="font-bold text-lg mt-4">{s.title}</h3>
                    <p className="text-sm text-white/75 leading-relaxed mt-1.5">{s.text}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* Who it's for */}
        <section className="py-20 sm:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <SectionHeading eyebrow="Who it's for" title="Made for service businesses that work on site" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
              {AUDIENCES.map((a, i) => (
                <Reveal key={a.title} delay={i * 80}>
                  <div className="h-full rounded-xl bg-page-bg border border-line p-5 text-center">
                    <div className="w-12 h-12 rounded-full bg-card-bg border border-line text-brand flex items-center justify-center mx-auto">
                      <a.icon className="w-6 h-6" aria-hidden />
                    </div>
                    <h3 className="font-bold mt-4">{a.title}</h3>
                    <p className="text-sm text-ink-secondary mt-1.5 leading-relaxed">{a.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Product showcase */}
        <section className="py-20 sm:py-24 bg-page-bg border-y border-line">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <SectionHeading eyebrow="See it in action" title="Real screens from Crew & Grounds" text="Shown with a sample business. This is what you and your team use every day." />
            <div className="mt-14 flex flex-col gap-16 sm:gap-24">
              {SHOWCASE.map((s, i) => (
                <div key={s.title} className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
                  <Reveal className={i % 2 ? "lg:order-2" : ""}>
                    <div
                      className={
                        "narrow" in s
                          ? "max-w-[260px] mx-auto rounded-[2rem] border-[6px] border-forest bg-card-bg shadow-lg overflow-hidden"
                          : "rounded-xl border border-line bg-card-bg shadow-lg overflow-hidden"
                      }
                    >
                      <Image src={s.image} alt={s.alt} width={s.size[0]} height={s.size[1]} sizes={"narrow" in s ? "260px" : "(min-width: 1024px) 560px, 100vw"} className="w-full h-auto" />
                    </div>
                  </Reveal>
                  <Reveal delay={120}>
                    <p className="text-xs font-bold uppercase tracking-wider text-brand">{s.eyebrow}</p>
                    <h3 className="font-serif font-semibold text-3xl text-forest mt-2 leading-tight">{s.title}</h3>
                    <p className="text-ink-secondary leading-relaxed mt-3 text-base sm:text-lg">{s.text}</p>
                  </Reveal>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-20 sm:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <SectionHeading eyebrow="Why Crew & Grounds" title="Less admin. More jobs done." />
            <ul className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-12">
              {BENEFITS.map((b, i) => (
                <Reveal key={b.title} delay={i * 70}>
                  <li className="h-full rounded-xl border border-line p-5">
                    <Check className="w-5 h-5 text-brand" aria-hidden />
                    <h3 className="font-bold mt-3">{b.title}</h3>
                    <p className="text-sm text-ink-secondary mt-1 leading-relaxed">{b.text}</p>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 py-20 sm:py-24 bg-page-bg border-y border-line">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <SectionHeading
              eyebrow="Pricing"
              title="Simple pricing by team size"
              text={`Start with a free trial, no card needed. Prices in AUD per month. Save ${Math.round(ANNUAL_DISCOUNT * 100)}% when you pay yearly.`}
            />
            <div className="grid md:grid-cols-3 gap-4 mt-12 max-w-5xl mx-auto">
              {TEAM_SIZES.map((t) => {
                const popular = t.k === POPULAR_TEAM;
                const xero = t.k !== "1";
                return (
                  <div key={t.k} className={`relative rounded-2xl bg-card-bg p-6 border ${popular ? "border-brand shadow-lg" : "border-line shadow-sm"}`}>
                    {popular && <span className="absolute -top-3 left-6 rounded-full bg-brand text-white text-xs font-bold px-3 py-1">Most popular</span>}
                    <h3 className="font-bold text-lg">{t.name}</h3>
                    <p className="text-sm text-ink-muted">{t.label}</p>
                    <p className="mt-4">
                      <span className="text-4xl font-extrabold text-forest">${t.price}</span>
                      <span className="text-ink-secondary">/mo</span>
                    </p>
                    <ul className="mt-5 space-y-2 text-sm">
                      <li className="flex gap-2"><Check className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />{t.users === 1 ? "1 user" : `Up to ${t.users} users`}</li>
                      <li className="flex gap-2"><Check className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />Every feature below</li>
                      <li className={`flex gap-2 ${xero ? "" : "text-ink-muted"}`}>
                        {xero ? <Check className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden /> : <span className="w-4 shrink-0 text-center" aria-hidden>–</span>}
                        {xero ? "Xero integration" : "Xero not included"}
                      </li>
                    </ul>
                    <Link
                      href={SIGNUP}
                      className={`mt-6 w-full inline-flex justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${popular ? "bg-brand text-white hover:bg-brand-hover" : "border border-field-border hover:bg-page-bg"}`}
                    >
                      Start free trial
                    </Link>
                  </div>
                );
              })}
            </div>
            <div className="max-w-5xl mx-auto mt-8 rounded-xl border border-line bg-card-bg p-6">
              <p className="text-sm font-bold">Every plan includes</p>
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 mt-3 text-sm text-ink-secondary">
                {PLAN.features
                  .filter((f) => !f.startsWith("Xero"))
                  .concat(["Customer reminders and staff notifications", "Google review requests"])
                  .map((f) => (
                    <li key={f} className="flex gap-2"><Check className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />{f}</li>
                  ))}
              </ul>
              <p className="text-xs text-ink-muted mt-4">Plans renew monthly or yearly and can be cancelled any time.</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 py-20 sm:py-24">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <SectionHeading eyebrow="FAQ" title="Questions, answered" />
            <div className="mt-10 divide-y divide-line border-y border-line">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-base [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span className="w-6 h-6 shrink-0 rounded-full border border-line flex items-center justify-center text-brand transition-transform group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="text-ink-secondary leading-relaxed mt-3">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 sm:px-6 pb-20 sm:pb-24">
          <div className="max-w-6xl mx-auto rounded-3xl bg-forest text-white px-6 py-14 sm:px-14 sm:py-16 text-center relative overflow-hidden">
            <div className="absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-brand/30" aria-hidden />
            <div className="absolute -top-20 -left-20 w-56 h-56 rounded-full bg-white/5" aria-hidden />
            <div className="relative">
              <h2 className="font-serif font-semibold text-3xl sm:text-5xl leading-tight">Less admin. More jobs done.</h2>
              <p className="text-white/75 mt-4 text-lg max-w-xl mx-auto">Start your free trial today. No credit card needed. Add your clients and start scheduling straight away.</p>
              <div className="mt-8 flex justify-center">
                <Link href={SIGNUP} className="inline-flex items-center gap-2 rounded-lg bg-white text-forest px-6 py-3 text-base font-bold hover:bg-ok-bg transition-colors">
                  Get started with Crew &amp; Grounds <ArrowRight className="w-4 h-4" aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-card-bg/85 backdrop-blur border-b border-line">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3 sm:gap-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="Crew & Grounds home">
          <Image src="/marketing/logo-icon.svg" alt="" width={32} height={32} className="rounded-lg" priority />
          <span className="font-serif font-semibold text-base sm:text-lg text-forest whitespace-nowrap">Crew &amp; Grounds</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-ink-secondary" aria-label="Main">
          <a href="#features" className="hover:text-ink-primary">Features</a>
          <a href="#how-it-works" className="hover:text-ink-primary">How it works</a>
          <a href="#pricing" className="hover:text-ink-primary">Pricing</a>
          <a href="#faq" className="hover:text-ink-primary">FAQ</a>
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-3 whitespace-nowrap">
          <Link href="/login" className="text-sm font-semibold text-ink-secondary hover:text-ink-primary px-2 py-2">
            Log in
          </Link>
          <Link href={SIGNUP} className="inline-flex items-center rounded-lg bg-brand text-white px-3 sm:px-4 py-2 text-sm font-semibold hover:bg-brand-hover transition-colors">
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-line bg-page-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row gap-6 sm:items-center justify-between text-sm text-ink-secondary">
        <div className="flex items-center gap-2.5">
          <Image src="/marketing/logo-icon.svg" alt="" width={28} height={28} className="rounded-md" />
          <span className="font-serif font-semibold text-forest">Crew &amp; Grounds</span>
          <span className="text-ink-muted">© {new Date().getFullYear()}</span>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer">
          <Link href="/signup" className="hover:text-ink-primary">Start free trial</Link>
          <Link href="/login" className="hover:text-ink-primary">Log in</Link>
          <Link href="/terms" className="hover:text-ink-primary">Terms</Link>
          <Link href="/privacy" className="hover:text-ink-primary">Privacy</Link>
          <a href={`mailto:${SUPPORT}`} className="hover:text-ink-primary">{SUPPORT}</a>
        </nav>
      </div>
    </footer>
  );
}

function SectionHeading({ eyebrow, title, text, dark }: { eyebrow: string; title: string; text?: string; dark?: boolean }) {
  return (
    <div className="max-w-2xl mx-auto text-center">
      <p className={`text-xs font-bold uppercase tracking-wider ${dark ? "text-ok-bg/80" : "text-brand"}`}>{eyebrow}</p>
      <h2 className={`font-serif font-semibold text-3xl sm:text-4xl leading-tight mt-2 ${dark ? "text-white" : "text-forest"}`}>{title}</h2>
      {text && <p className={`mt-3 text-base sm:text-lg leading-relaxed ${dark ? "text-white/75" : "text-ink-secondary"}`}>{text}</p>}
    </div>
  );
}

function CtaLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-lg bg-brand text-white px-5 py-3 text-base font-semibold shadow-md hover:bg-brand-hover transition-colors">
      {children} <ArrowRight className="w-4 h-4" aria-hidden />
    </Link>
  );
}
