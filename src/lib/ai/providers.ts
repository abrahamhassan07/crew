import "server-only";

// Thin wrappers around the AI providers, using plain fetch (no SDKs). Keys come from the server environment only:
//   OPENAI_API_KEY     - speech-to-text for voice recordings, structured extraction and report summaries
// Optional: AI_MODEL (default below), OPENAI_TRANSCRIBE_MODEL. Nothing here ever logs prompts, transcripts or audio.
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";
const DEFAULT_MODEL = "gpt-4o-mini";
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

export const aiConfigured = () => ({ llm: !!process.env.OPENAI_API_KEY, stt: !!process.env.OPENAI_API_KEY });
export const llmModel = () => process.env.AI_MODEL || DEFAULT_MODEL;

// Rough price list for the usage log (estimates only; check the providers' current pricing before relying on them).
const STT_USD_PER_MINUTE = 0.006;
const LLM_USD_PER_MTOK = { input: 0.15, output: 0.6 };
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

/** Asks the model to answer by filling in a JSON schema (function call), so the output is structured, never free text. */
export async function extractJson<T>(opts: { system: string; user: string; toolName: string; toolDescription: string; schema: Record<string, unknown>; maxTokens?: number }): Promise<LlmResult<T>> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AiProviderError("AI isn't set up yet. Please contact support.", "not_configured");
  const model = llmModel();
  const res = await call(
    OPENAI_CHAT_URL,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: 0,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        tools: [{ type: "function", function: { name: opts.toolName, description: opts.toolDescription, parameters: opts.schema } }],
        tool_choice: { type: "function", function: { name: opts.toolName } },
      }),
    },
    "extract"
  );
  const body = (await res.json().catch(() => null)) as { choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } } | null;
  const args = body?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  let data: unknown = null;
  try {
    data = args ? JSON.parse(args) : null;
  } catch {
    data = null;
  }
  if (!data || typeof data !== "object") throw new AiProviderError("The AI gave an unusable answer. Please try again.", "bad_output");
  return { data: data as T, inputTokens: body?.usage?.prompt_tokens ?? 0, outputTokens: body?.usage?.completion_tokens ?? 0, model };
}

/** A short plain-text answer (used for report summaries written from verified numbers). */
export async function writeText(opts: { system: string; user: string; maxTokens?: number }): Promise<LlmResult<string>> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AiProviderError("AI isn't set up yet. Please contact support.", "not_configured");
  const model = llmModel();
  const res = await call(
    OPENAI_CHAT_URL,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: opts.maxTokens ?? 400, temperature: 0.2, messages: [{ role: "system", content: opts.system }, { role: "user", content: opts.user }] }),
    },
    "write"
  );
  const body = (await res.json().catch(() => null)) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } } | null;
  const text = (body?.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new AiProviderError("The AI gave an empty answer.", "bad_output");
  return { data: text, inputTokens: body?.usage?.prompt_tokens ?? 0, outputTokens: body?.usage?.completion_tokens ?? 0, model };
}
