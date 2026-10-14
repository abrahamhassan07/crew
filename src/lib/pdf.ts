import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { calcTotals } from "@/lib/gst";
import type { Client, GstMode, Organization } from "@/lib/supabase/types";

export interface DocLine {
  name: string;
  description: string;
  qty: number;
  unitPrice: number;
}

export interface DocData {
  kind: "Quote" | "Tax Invoice" | "Invoice";
  num: string;
  org: Organization | null;
  client: Pick<Client, "name" | "address" | "email"> | null;
  serviceAddress: string;
  dates: { label: string; value: string }[];
  mode: GstMode;
  lines: DocLine[];
  note: string;
  paid?: number;
  jobNum?: string | null;
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const INK = rgb(0.1, 0.13, 0.12);
const MUTED = rgb(0.4, 0.44, 0.42);
const FOREST = rgb(0.13, 0.42, 0.25);
const RULE = rgb(0.85, 0.87, 0.86);

// Standard PDF fonts only cover Latin-1; swap anything else for "?" rather than throw.
function safe(s: string): string {
  return (s ?? "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/−/g, "-")
    .replace(/[^\n -~ -ÿ–—•€]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of safe(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        line = next;
      } else {
        if (line) out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

const money = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function renderDocumentPdf(doc: DocData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const text = (s: string, x: number, size = 10, font = regular, color = INK) =>
    page.drawText(safe(s), { x, y, size, font, color });
  const textRight = (s: string, xRight: number, size = 10, font = regular, color = INK) => {
    const t = safe(s);
    page.drawText(t, { x: xRight - font.widthOfTextAtSize(t, size), y, size, font, color });
  };
  const rule = (thickness = 0.75, color = RULE) =>
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness, color });
  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  // Header: business on the left, document title on the right.
  const orgName = doc.org?.name ?? "Your business";
  text(orgName, MARGIN, 16, bold, FOREST);
  textRight(doc.kind, PAGE_W - MARGIN, 18, bold, FOREST);
  y -= 16;
  const bizLines = [
    doc.org?.abn ? `ABN ${doc.org.abn}` : "",
    doc.org?.address ?? "",
    [doc.org?.phone, doc.org?.email].filter(Boolean).join("  |  "),
  ].filter(Boolean);
  const metaLines = [doc.num, ...doc.dates.map((d) => `${d.label}: ${d.value}`), ...(doc.jobNum ? [`Job: ${doc.jobNum}`] : [])];
  const headerRows = Math.max(bizLines.length, metaLines.length);
  for (let i = 0; i < headerRows; i++) {
    if (bizLines[i]) text(bizLines[i], MARGIN, 9, regular, MUTED);
    if (metaLines[i]) textRight(metaLines[i], PAGE_W - MARGIN, 9, i === 0 ? bold : regular, i === 0 ? INK : MUTED);
    y -= 13;
  }

  y -= 14;
  const colMid = MARGIN + (PAGE_W - 2 * MARGIN) / 2;
  const blockTop = y;
  text(doc.kind === "Quote" ? "PREPARED FOR" : "BILL TO", MARGIN, 8, bold, MUTED);
  text("SERVICE ADDRESS", colMid, 8, bold, MUTED);
  y -= 14;
  text(doc.client?.name ?? "-", MARGIN, 11, bold);
  const addrLines = wrap(doc.serviceAddress || doc.client?.address || "-", regular, 10, PAGE_W - MARGIN - colMid);
  let addrY = y;
  for (const l of addrLines) {
    page.drawText(l, { x: colMid, y: addrY, size: 10, font: regular, color: INK });
    addrY -= 13;
  }
  y -= 14;
  if (doc.serviceAddress && doc.client?.address && doc.client.address !== doc.serviceAddress) {
    text(doc.client.address, MARGIN, 10, regular, MUTED);
    y -= 13;
  }
  y = Math.min(y, addrY) - 12;
  void blockTop;

  // Line items table.
  const qtyX = PAGE_W - MARGIN - 190;
  const unitX = PAGE_W - MARGIN - 100;
  const amtX = PAGE_W - MARGIN;
  const descWidth = qtyX - MARGIN - 50;
  text("Item", MARGIN, 9, bold);
  textRight("Qty", qtyX, 9, bold);
  textRight("Unit", unitX, 9, bold);
  textRight("Amount", amtX, 9, bold);
  y -= 6;
  rule(1.25, INK);
  y -= 14;

  for (const line of doc.lines) {
    const descLines = line.description ? wrap(line.description, regular, 8.5, descWidth) : [];
    const nameLines = wrap(line.name, bold, 10, descWidth);
    const rowHeight = nameLines.length * 13 + descLines.length * 11 + 10;
    ensureSpace(rowHeight + 20);
    const rowTop = y;
    for (const l of nameLines) {
      text(l, MARGIN, 10, bold);
      y -= 13;
    }
    for (const l of descLines) {
      text(l, MARGIN, 8.5, regular, MUTED);
      y -= 11;
    }
    const bottom = y;
    y = rowTop;
    textRight(String(line.qty), qtyX, 10);
    textRight(money(line.unitPrice), unitX, 10);
    textRight(money(line.qty * line.unitPrice), amtX, 10);
    y = bottom - 4;
    rule();
    y -= 12;
  }

  // Totals.
  const totals = calcTotals(doc.lines.map((l) => ({ qty: l.qty, unit_price: l.unitPrice })), doc.mode);
  ensureSpace(110);
  const labelX = PAGE_W - MARGIN - 190;
  const totalRow = (label: string, value: string, f = regular, size = 10, color = INK) => {
    text(label, labelX, size, f, color);
    textRight(value, amtX, size, f, color);
    y -= size + 6;
  };
  if (doc.mode !== "none") {
    totalRow("Subtotal", money(totals.sub));
    totalRow("GST (10%)", money(totals.gst));
    y += 2;
  }
  rule(1.25, INK);
  y -= 14;
  totalRow("Total AUD", money(totals.total), bold, 12);
  if (doc.paid !== undefined) {
    totalRow("Amount paid", `-${money(doc.paid)}`, regular, 10, FOREST);
    y += 2;
    rule();
    y -= 14;
    totalRow("Balance due", money(Math.max(0, totals.total - doc.paid)), bold, 12);
  }

  if (doc.note.trim()) {
    y -= 12;
    for (const l of wrap(doc.note, regular, 9, PAGE_W - 2 * MARGIN)) {
      ensureSpace(14);
      text(l, MARGIN, 9, regular, MUTED);
      y -= 12;
    }
  }

  return pdf.save();
}
