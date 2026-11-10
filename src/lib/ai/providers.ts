import "server-only";

// Thin wrappers around the AI providers, using plain fetch (no SDKs). Keys come from the server environment only:
//   ANTHROPIC_API_KEY  - structured extraction and report summaries (Claude)
//   OPENAI_API_KEY     - speech-to-text for voice recordings
// Optional: AI_MODEL (default below), OPENAI_TRANSCRIBE_MODEL. Nothing here ever logs prompts, transcripts or audio.
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";
const DEFAULT_MODEL = "claude-haiku-5-5";
const DEFAULT_TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";

export type AiErrorCode = "not_configured" | "provider" | "timeout" | "bad_output";

/** An AI failure with a safe, user-showable message. The report/draft flows treat it as "AI unavailable". */
export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly code: AiErrorCode
  ) {
    super(message);
  }
}

export const aiConfigured = () => ({ llm: !!process.env.ANTHROPIC_API_KEY, stt: !!process.env.OPENAI_API_KEY });
export const llmModel = () => process.env.AI_MODEL || DEFAULT_MODEL;

// Rough price list for the usage log (estimates only; check the providers' current pricing before relying on them).
const STT_USD_PER_MINUTE = 0.006;
const LLM_USD_PER_MTOK = { input: 1, output: 5 };
export function estimateCostUsd(u: { audioSeconds?: number; inputTokens?: number; outputTokens?: number }): number {
  const stt = ((u.audioSeconds ?? 0) / 60) * STT_USD_PER_MINUTE;
  const llm = ((u.inputTokens ?? 0) * LLM_USD_PER_MTOK.input + (u.outputTokens ?? 0) * LLM_USD_PER_MTOK.output) / 1_000_000;
  return Math.round((stt + llm) * 100000) / 100000;
}

async function call(url: string, init: RequestInit, label: string): Promise<Response> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(45_000), cache: "no-store" });
    if (!res.ok) {
      console.error(`[ai] ${label} returned ${res.status}`);
      throw new AiProviderError("The AI service couldn't process that right now. Please try again.", "provider");
    }
    return res;
  } catch (e) {
    if (e instanceof AiProviderError) throw e;
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    console.error(`[ai] ${label} failed: ${timeout ? "timeout" : "network"}`);
    throw new AiProviderError(timeout ? "The AI service took too long. Please try again." : "Couldn't reach the AI service. Please try again.", timeout ? "timeout" : "provider");
  }
}

/** Speech to text. `hint` is a short list of words (service names) that helps spelling; it contains no customer data. */
export async function transcribe(file: { bytes: Uint8Array; mime: string; name: string }, hint?: string): Promise<{ text: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AiProviderError("Voice isn't set up yet. Please contact support.", "not_configured");
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(file.bytes)], { type: file.mime }), file.name);
  form.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || DEFAULT_TRANSCRIBE_MODEL);
  form.append("response_format", "json");
  if (hint) form.append("prompt", hint.slice(0, 600));
  const res = await call(OPENAI_TRANSCRIBE_URL, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form }, "transcribe");
  const data = (await res.json().catch(() => null)) as { text?: string } | null;
  const text = (data?.text ?? "").trim();
  if (!text) throw new AiProviderError("We couldn't hear anything in that recording. Please try again.", "bad_output");
  return { text };
}

interface LlmResult<T> {
  data: T;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

/** Asks the model to answer by filling in a JSON schema (tool use), so the output is structured, never free text. */
export async function extractJson<T>(opts: { system: string; user: string; toolName: string; toolDescription: string; schema: Record<string, unknown>; maxTokens?: number }): Promise<LlmResult<T>> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AiProviderError("AI isn't set up yet. Please contact support.", "not_configured");
  const model = llmModel();
  const res = await call(
    ANTHROPIC_URL,
    {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 1024,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
        tools: [{ name: opts.toolName, description: opts.toolDescription, input_schema: opts.schema }],
        tool_choice: { type: "tool", name: opts.toolName },
      }),
    },
    "extract"
  );
  const body = (await res.json().catch(() => null)) as { content?: { type: string; input?: unknown }[]; usage?: { input_tokens?: number; output_tokens?: number } } | null;
  const block = body?.content?.find((c) => c.type === "tool_use");
  if (!block?.input || typeof block.input !== "object") throw new AiProviderError("The AI gave an unusable answer. Please try again.", "bad_output");
  return { data: block.input as T, inputTokens: body?.usage?.input_tokens ?? 0, outputTokens: body?.usage?.output_tokens ?? 0, model };
}

/** A short plain-text answer (used for report summaries written from verified numbers). */
export async function writeText(opts: { system: string; user: string; maxTokens?: number }): Promise<LlmResult<string>> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AiProviderError("AI isn't set up yet. Please contact support.", "not_configured");
  const model = llmModel();
  const res = await call(
    ANTHROPIC_URL,
    {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: opts.maxTokens ?? 400, system: opts.system, messages: [{ role: "user", content: opts.user }] }),
    },
    "write"
  );
  const body = (await res.json().catch(() => null)) as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } } | null;
  const text = (body?.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
  if (!text) throw new AiProviderError("The AI gave an empty answer.", "bad_output");
  return { data: text, inputTokens: body?.usage?.input_tokens ?? 0, outputTokens: body?.usage?.output_tokens ?? 0, model };
}
