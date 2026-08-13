// Shared auth gate, AI kill switch and usage metering for the scoring endpoint stack.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type GateResult =
  | { ok: true; userId: string | null; isWorker: boolean }
  | { ok: false; response: Response };

export async function authGate(
  req: Request,
  admin: SupabaseClient,
  cors: Record<string, string>,
): Promise<GateResult> {
  const jsonHeaders = { ...cors, "Content-Type": "application/json" };

  // (a) internal retry queue / worker calls
  const workerSecret = req.headers.get("x-worker-secret");
  if (workerSecret) {
    try {
      const { data } = await admin
        .from("admin_settings")
        .select("value")
        .eq("key", "scoring_worker_secret")
        .maybeSingle();
      const expected = (data?.value ?? "").toString();
      if (expected && workerSecret === expected) {
        return { ok: true, userId: null, isWorker: true };
      }
    } catch (_e) { /* fall through to user auth */ }
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "auth_required" }), { status: 401, headers: jsonHeaders }),
    };
  }

  // (b) real signed-in user required — publishable key alone must not pass
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "auth_required" }), { status: 401, headers: jsonHeaders }),
    };
  }

  try {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data, error } = await userClient.auth.getUser();
    if (error || !data?.user?.id) {
      return {
        ok: false,
        response: new Response(JSON.stringify({ error: "auth_required" }), { status: 401, headers: jsonHeaders }),
      };
    }
    return { ok: true, userId: data.user.id, isWorker: false };
  } catch (_e) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "auth_required" }), { status: 401, headers: jsonHeaders }),
    };
  }
}

export async function aiPaused(admin: SupabaseClient): Promise<boolean> {
  try {
    const { data } = await admin
      .from("admin_settings")
      .select("value")
      .eq("key", "ai_kill_switch")
      .maybeSingle();
    return (data?.value ?? "").toString().trim().toLowerCase() === "true";
  } catch (_e) {
    return false;
  }
}

export function aiPausedResponse(cors: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: "ai_paused", message: "AI features are temporarily paused. Please try again later." }),
    { status: 503, headers: { ...cors, "Content-Type": "application/json" } },
  );
}

const RATES: Record<string, { in: number; out: number }> = {
  "gpt-4o": { in: 0.0000025, out: 0.00001 },
  "gpt-4o-mini": { in: 0.00000015, out: 0.0000006 },
};

export async function meterAi(
  admin: SupabaseClient,
  opts: {
    userId: string | null;
    feature: string;
    model: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
    success: boolean;
    latencyMs: number;
  },
): Promise<void> {
  try {
    const inTok = Number(opts.usage?.prompt_tokens ?? 0) || 0;
    const outTok = Number(opts.usage?.completion_tokens ?? 0) || 0;
    const rate = RATES[opts.model] ?? RATES["gpt-4o-mini"];
    const cost = Math.round((inTok * rate.in + outTok * rate.out) * 100000) / 100000;
    await admin.from("ai_usage").insert({
      user_id: opts.userId,
      feature: opts.feature,
      model: opts.model,
      input_tokens: inTok || null,
      output_tokens: outTok || null,
      est_cost_usd: cost,
      success: opts.success,
      latency_ms: opts.latencyMs,
    });
  } catch (_e) { /* metering must never block a response */ }
}
