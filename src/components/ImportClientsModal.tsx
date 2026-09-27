"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, X } from "lucide-react";
import { importClients, type ClientImportRow } from "@/app/(app)/actions";
import { Button } from "@/components/ui/Button";
import { parseCsv } from "@/lib/csv";
import type { ClientStatus } from "@/lib/supabase/types";

const TEMPLATE_HEADERS = ["Name", "Company", "Phone", "Email", "Address", "Status", "Tags"];
const VALID_STATUSES: ClientStatus[] = ["Lead", "Active", "Inactive", "Archived"];

function downloadTemplate() {
  const example = ["Jane Smith", "Smith Property Group", "0412 345 678", "jane@example.com", "12 Example St, Melbourne VIC 3000", "Lead", "Weekly mow; Gate code"];
  const csv = [TEMPLATE_HEADERS, example].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "client-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function normalizeHeader(h: string) {
  return h.trim().toLowerCase();
}

function parseRows(text: string): { rows: ClientImportRow[]; invalidCount: number } {
  const table = parseCsv(text);
  if (!table.length) return { rows: [], invalidCount: 0 };

  const header = table[0].map(normalizeHeader);
  const idx = (name: string) => header.indexOf(name);
  const iName = idx("name");
  const iCompany = idx("company");
  const iPhone = idx("phone");
  const iEmail = idx("email");
  const iAddress = idx("address");
  const iStatus = idx("status");
  const iTags = idx("tags");

  const rows: ClientImportRow[] = [];
  let invalidCount = 0;

  for (const line of table.slice(1)) {
    const name = (iName >= 0 ? line[iName] : "")?.trim() ?? "";
    if (!name) {
      invalidCount++;
      continue;
    }
    const statusRaw = (iStatus >= 0 ? line[iStatus] : "")?.trim() ?? "";
    const status = (VALID_STATUSES.find((s) => s.toLowerCase() === statusRaw.toLowerCase()) ?? "Lead") as ClientStatus;
    const tags = (iTags >= 0 ? line[iTags] : "")
      ?.split(";")
      .map((t) => t.trim())
      .filter(Boolean) ?? [];

    rows.push({
      name,
      company: (iCompany >= 0 ? line[iCompany] : "") ?? "",
      phone: (iPhone >= 0 ? line[iPhone] : "") ?? "",
      email: (iEmail >= 0 ? line[iEmail] : "") ?? "",
      address: (iAddress >= 0 ? line[iAddress] : "") ?? "",
      status,
      tags,
    });
  }

  return { rows, invalidCount };
}

export function ImportClientsModal({ onClose }: { onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ClientImportRow[]>([]);
  const [invalidCount, setInvalidCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const handleFile = async (file: File) => {
    setError(null);
    setDone(null);
    setFileName(file.name);
    const text = await file.text();
    const { rows: parsed, invalidCount: bad } = parseRows(text);
    setRows(parsed);
    setInvalidCount(bad);
    if (!parsed.length) setError("No importable rows found — check the file matches the template's Name column.");
  };

  const runImport = () => {
    setError(null);
    startTransition(async () => {
      const result = await importClients(rows);
      if (!result.ok) {
        setError(result.error ?? "Could not import clients.");
        return;
      }
      setDone(result.count ?? 0);
    });
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/45 z-100" />
      <div className="fixed inset-0 z-101 flex items-center justify-center p-4">
        <div className="bg-card-bg rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <span className="text-lg font-bold text-ink-primary">Import clients</span>
            <button onClick={onClose} aria-label="Close">
              <X className="w-5 h-5 text-ink-muted" />
            </button>
          </div>

          <div className="p-5 flex flex-col gap-4">
            {done != null ? (
              <p className="text-sm text-ok-fg font-semibold">
                Imported {done} client{done === 1 ? "" : "s"}.
              </p>
            ) : (
              <>
                <div>
                  <p className="text-sm text-ink-secondary mb-2">
                    Upload a CSV of your client list. Not sure of the format? Download the template first and fill it in — the columns will line up automatically.
                  </p>
                  <Button variant="secondary" size="sm" onClick={downloadTemplate}>
                    Download CSV template
                  </Button>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-6 rounded-lg border-2 border-dashed border-field-border text-sm font-semibold text-ink-secondary hover:bg-page-bg hover:border-brand transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    {fileName ?? "Choose a CSV file…"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                  />
                </div>

                {rows.length > 0 && (
                  <div className="text-sm text-ink-secondary">
                    Found <span className="font-semibold text-ink-primary">{rows.length}</span> client{rows.length === 1 ? "" : "s"} to import
                    {invalidCount > 0 && <span className="text-ink-muted"> ({invalidCount} row{invalidCount === 1 ? "" : "s"} skipped — missing a name)</span>}
                    .
                  </div>
                )}

                {error && <p className="text-sm text-danger-red">{error}</p>}
              </>
            )}
          </div>

          <div className="flex justify-end gap-2.5 px-5 py-4 border-t border-line">
            <Button variant="secondary" onClick={onClose}>
              {done != null ? "Close" : "Cancel"}
            </Button>
            {done == null && (
              <Button variant="primary" onClick={runImport} disabled={pending || !rows.length}>
                {pending ? "Importing…" : `Import ${rows.length || ""} client${rows.length === 1 ? "" : "s"}`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
