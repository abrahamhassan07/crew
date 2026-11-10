import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { checkAiAccess, logAiRequest } from "@/lib/ai/access";
import { AiProviderError, extractJson, llmModel, transcribe } from "@/lib/ai/providers";
import { buildDraft, EXTRACTION_SCHEMA, EXTRACTION_SYSTEM, type Extraction } from "@/lib/ai/voiceDraft";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 6 * 1024 * 1024;
const MAX_SECONDS = 120;
// OpenAI decides the audio format from the file extension, so it must match what the browser recorded.
const extensionFor = (mime: string) => (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac") ? "mp4" : mime.includes("ogg") ? "ogg" : mime.includes("mpeg") || mime.includes("mp3") ? "mp3" : mime.includes("wav") ? "wav" : "webm");
const KINDS = { quote: "voice_quote", invoice: "voice_invoice" } as const;

/**
 * Voice-to-Quote / Voice-to-Invoice. Takes one short recording, returns a DRAFT (customer match, line items) for the
 * person to review in the normal editor. Nothing is saved or sent here, and the audio is processed in memory and
 * never stored. The plan, the business's switch, the monthly allowance and the rate limit are checked on the server.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const viewer = await getViewer();
  if (viewer.profile.role !== "admin") return NextResponse.json({ error: "Only owners and admins can use voice drafts." }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "That recording couldn't be read." }, { status: 400 });
  }
  const kind = form.get("kind") === "invoice" ? "invoice" : form.get("kind") === "quote" ? "quote" : null;
  const audio = form.get("audio");
  if (!kind) return NextResponse.json({ error: "Unknown request." }, { status: 400 });
  if (!(audio instanceof File) || !audio.type.startsWith("audio/")) return NextResponse.json({ error: "No recording received." }, { status: 400 });
  if (audio.size < 1500) return NextResponse.json({ error: "That recording was too short. Hold the button a little longer and try again." }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "That recording is too long. Keep it under two minutes." }, { status: 413 });
  const seconds = Math.min(Math.max(Number(form.get("seconds")) || 0, 0), MAX_SECONDS);

  const feature = KINDS[kind];
  const access = await checkAiAccess(viewer.orgId, viewer.userId, feature);
  if (!access.ok) {
    await logAiRequest({ orgId: viewer.orgId, userId: viewer.userId, feature, status: "blocked", detail: access.code });
    return NextResponse.json({ error: access.message, upgrade: access.upgrade }, { status: access.code === "rate" ? 429 : 403 });
  }

  const [{ data: clients }, { data: services }] = await Promise.all([
    supabase.from("clients").select("id, name").neq("status", "Archived").order("name").limit(2000),
    supabase.from("services").select("id, name, description, price").eq("active", true).order("name").limit(500),
  ]);

  try {
    const bytes = new Uint8Array(await audio.arrayBuffer());
    const hint = (services ?? []).slice(0, 25).map((s) => s.name).join(", ");
    const heard = await transcribe({ bytes, mime: audio.type, name: `recording.${extensionFor(audio.type)}` }, hint);
    const extracted = await extractJson<Extraction>({
      system: EXTRACTION_SYSTEM,
      user: `PRICE LIST (exact names): ${(services ?? []).slice(0, 80).map((s) => s.name).join(" | ") || "(none)"}\n\nTranscript:\n"""\n${heard.text.slice(0, 4000)}\n"""`,
      toolName: "draft_document",
      toolDescription: `Structured details for a ${kind} draft`,
      schema: EXTRACTION_SCHEMA as unknown as Record<string, unknown>,
    });
    const draft = buildDraft(heard.text, extracted.data, clients ?? [], (services ?? []).map((s) => ({ ...s, price: Number(s.price) })));
    await logAiRequest({ orgId: viewer.orgId, userId: viewer.userId, feature, status: "ok", provider: "openai", model: extracted.model, audioSeconds: seconds, inputTokens: extracted.inputTokens, outputTokens: extracted.outputTokens });
    return NextResponse.json({ draft });
  } catch (e) {
    const code = e instanceof AiProviderError ? e.code : "unknown";
    await logAiRequest({ orgId: viewer.orgId, userId: viewer.userId, feature, status: "error", provider: "openai", model: llmModel(), audioSeconds: seconds, detail: code });
    const message = e instanceof AiProviderError ? e.message : "Something went wrong. Please try again, or enter the details by hand.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
