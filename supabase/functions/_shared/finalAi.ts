// Pure, runtime-agnostic helpers (Deno + vitest). No imports.
export type Dims = { technical: number; judgment: number; english: number; behaviour: number };
export type FinalAiResult = { ok: true; dims: Dims; usage: unknown } | { ok: false; reason: string; status?: number; usage?: unknown };

const strict = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 5) ? Math.round(n * 100) / 100 : null;

/** Every dimension must be a finite number 0..5; technical may come from the frozen ledger instead. */
export function validateDims(parsed: any, technicalOverride: number | null = null): Dims | null {
  const t = technicalOverride !== null ? strict(technicalOverride) : strict(parsed?.technical);
  const j = strict(parsed?.judgment), e = strict(parsed?.english), b = strict(parsed?.behaviour);
  if (t === null || j === null || e === null || b === null) return null;
  return { technical: t, judgment: j, english: e, behaviour: b };
}

/** Calls the scoring model. The timeout covers headers AND body parsing; cleared in finally. */
export async function callFinalAi(opts: {
  fetchImpl: typeof fetch; apiKey: string; prompt: string; timeoutMs: number; model?: string; technicalOverride?: number | null;
}): Promise<FinalAiResult> {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), opts.timeoutMs);
  try {
    const res = await opts.fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST", signal: ctl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({ model: opts.model || "gpt-4o", messages: [{ role: "user", content: opts.prompt }], max_tokens: 300, temperature: 0.2 }),
    });
    const raw = await res.text(); // still under the same abort timer
    if (!res.ok) return { ok: false, reason: "ai_http_error", status: res.status };
    let data: any;
    try { data = JSON.parse(raw); } catch { return { ok: false, reason: "ai_malformed_json" }; }
    const text = String(data?.choices?.[0]?.message?.content || "").replace(/```json|```/g, "").trim();
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { return { ok: false, reason: "ai_malformed_json", usage: data?.usage }; }
    const dims = validateDims(parsed, opts.technicalOverride ?? null);
    if (!dims) return { ok: false, reason: "ai_invalid_dimensions", usage: data?.usage };
    return { ok: true, dims, usage: data?.usage };
  } catch (e) {
    return { ok: false, reason: (e as any)?.name === "AbortError" || ctl.signal.aborted ? "ai_timeout" : "ai_network" };
  } finally {
    clearTimeout(tm);
  }
}

/** Email provider adapter: bounded time, validated message id. */
export async function sendProviderEmail(opts: {
  fetchImpl: typeof fetch; apiKey: string; idempotencyKey: string; body: Record<string, unknown>; timeoutMs: number;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const ctl = new AbortController();
  const tm = setTimeout(() => ctl.abort(), opts.timeoutMs);
  try {
    const r = await opts.fetchImpl("https://api.resend.com/emails", {
      method: "POST", signal: ctl.signal,
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": opts.idempotencyKey },
      body: JSON.stringify(opts.body),
    });
    const raw = await r.text();
    if (!r.ok) return { ok: false, error: `provider_${r.status}` };
    let j: any; try { j = JSON.parse(raw); } catch { return { ok: false, error: "provider_malformed_response" }; }
    const id = typeof j?.id === "string" ? j.id.trim() : "";
    if (!id || id.length > 200) return { ok: false, error: "provider_response_missing_id" };
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: (e as any)?.name === "AbortError" || ctl.signal.aborted ? "provider_timeout" : "provider_unreachable" };
  } finally {
    clearTimeout(tm);
  }
}
