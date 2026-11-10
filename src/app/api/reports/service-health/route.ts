import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { auditCsv, FREQUENCY_LABEL, STATUS_LABEL } from "@/lib/audit/summary";

export const dynamic = "force-dynamic";

// pdf-lib's built-in fonts only draw basic Latin; anything else becomes "?" instead of throwing.
const latin = (s: string) => s.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");

export async function GET(req: Request) {
  const viewer = await getViewer();
  if (viewer.profile.role !== "admin") return new Response("Not allowed", { status: 403 });
  const url = new URL(req.url);
  const id = url.searchParams.get("audit") ?? "";
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "csv";
  const supabase = await createClient(); // row-level security keeps this to the viewer's own business
  const { data: audit } = await supabase.from("service_audits").select("*").eq("id", id).maybeSingle();
  if (!audit) return new Response("Report not found", { status: 404 });
  const { data: items } = await supabase.from("service_audit_items").select("*").eq("audit_id", id);
  const order = ["overdue", "not_scheduled", "needs_review", "upcoming", "on_track"];
  const rows = (items ?? []).slice().sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || b.days_overdue - a.days_overdue || a.client_name.localeCompare(b.client_name));

  if (format === "csv") {
    return new Response(auditCsv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="service-health-${audit.as_of}.csv"` } });
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 40;
  let page = pdf.addPage([W, H]);
  let y = H - M;
  const text = (s: string, x: number, size: number, f = font, color = rgb(0.09, 0.19, 0.24)) => page.drawText(latin(s), { x, y, size, font: f, color });
  const newPage = () => { page = pdf.addPage([W, H]); y = H - M; };
  text("Client Service Health report", M, 18, bold); y -= 20;
  text(`As of ${audit.as_of}`, M, 10, font, rgb(0.39, 0.45, 0.55)); y -= 22;
  const t = audit.totals as unknown as Record<string, number>;
  text(`Overdue ${t.overdue ?? 0}   Not scheduled ${t.notScheduled ?? 0}   Needs review ${t.needsReview ?? 0}   Upcoming ${t.upcoming ?? 0}   On track ${t.onTrack ?? 0}`, M, 10, bold); y -= 20;
  if (audit.summary) {
    const words = latin(audit.summary).split(/\s+/);
    let line = "";
    for (const w of words) {
      if (font.widthOfTextAtSize(`${line} ${w}`, 10) > W - 2 * M) { text(line, M, 10); y -= 14; line = w; } else line = line ? `${line} ${w}` : w;
    }
    if (line) { text(line, M, 10); y -= 14; }
    y -= 8;
  }
  const cols = [M, 150, 260, 340, 420, 490];
  const head = ["Client", "Service", "Frequency", "Last done", "Expected", "Status"];
  const header = () => { head.forEach((h, i) => text(h, cols[i], 9, bold)); y -= 14; };
  header();
  const clip = (s: string, w: number) => { let o = latin(s); while (o.length > 1 && font.widthOfTextAtSize(o, 9) > w) o = o.slice(0, -2) + "."; return o; };
  for (const r of rows) {
    if (y < M + 20) { newPage(); header(); }
    const cells = [r.client_name, r.service_title, FREQUENCY_LABEL(r.frequency, r.interval_days), r.last_completed ?? "-", r.next_expected ?? "-", `${STATUS_LABEL[r.status] ?? r.status}${r.status === "overdue" ? ` (${r.days_overdue}d)` : ""}`];
    cells.forEach((c, i) => text(clip(c, (cols[i + 1] ?? W - M) - cols[i] - 6), cols[i], 9));
    y -= 13;
  }
  const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="service-health-${audit.as_of}.pdf"` } });
}
