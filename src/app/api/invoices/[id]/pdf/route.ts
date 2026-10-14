import { requireAdmin } from "@/lib/auth";
import { loadInvoiceDoc } from "@/lib/documents";
import { renderDocumentPdf } from "@/lib/pdf";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const loaded = await loadInvoiceDoc(id);
  if (!loaded) return new Response("Not found", { status: 404 });
  const bytes = await renderDocumentPdf(loaded.doc);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${loaded.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
