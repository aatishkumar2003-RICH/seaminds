import { describe, it, expect } from "vitest";
import { callFinalAi, validateDims, sendProviderEmail } from "../../supabase/functions/_shared/finalAi";

const okBody = (content: string) => JSON.stringify({ choices: [{ message: { content } }], usage: { total_tokens: 1 } });
const res = (status: number, body: string) => ({ ok: status >= 200 && status < 300, status, text: async () => body }) as any;
const call = (f: any, extra: any = {}) => callFinalAi({ fetchImpl: f, apiKey: "k", prompt: "p", timeoutMs: 50, ...extra });

describe("final AI validation", () => {
  it("accepts valid dims", async () => {
    const r = await call(async () => res(200, okBody('{"technical":3.1,"judgment":4,"english":2.5,"behaviour":5}')));
    expect(r).toEqual({ ok: true, dims: { technical: 3.1, judgment: 4, english: 2.5, behaviour: 5 }, usage: { total_tokens: 1 } });
  });
  it("non-2xx stays retryable", async () => {
    expect(await call(async () => res(502, "bad gateway"))).toMatchObject({ ok: false, reason: "ai_http_error", status: 502 });
  });
  it("malformed envelope and content", async () => {
    expect(await call(async () => res(200, "<html>"))).toMatchObject({ ok: false, reason: "ai_malformed_json" });
    expect(await call(async () => res(200, okBody("not json")))).toMatchObject({ ok: false, reason: "ai_malformed_json" });
  });
  it("missing / out-of-range / non-numeric dims rejected", async () => {
    expect(await call(async () => res(200, okBody('{"technical":3,"judgment":4,"english":2}')))).toMatchObject({ reason: "ai_invalid_dimensions" });
    expect(await call(async () => res(200, okBody('{"technical":3,"judgment":7,"english":2,"behaviour":1}')))).toMatchObject({ reason: "ai_invalid_dimensions" });
    expect(await call(async () => res(200, okBody('{"technical":3,"judgment":"4","english":2,"behaviour":1}')))).toMatchObject({ reason: "ai_invalid_dimensions" });
    expect(validateDims({ judgment: 1, english: 1, behaviour: 1 }, null)).toBeNull();
    expect(validateDims({ judgment: 1, english: 1, behaviour: 1 }, 2.5)).toEqual({ technical: 2.5, judgment: 1, english: 1, behaviour: 1 });
  });
  it("aborts when headers never arrive", async () => {
    const f = (_u: string, init: any) => new Promise((_r, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("a"), { name: "AbortError" }))));
    expect(await call(f)).toMatchObject({ ok: false, reason: "ai_timeout" });
  });
  it("aborts when the response BODY stalls after headers", async () => {
    const f = async (_u: string, init: any) => ({ ok: true, status: 200,
      text: () => new Promise((_r, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("a"), { name: "AbortError" })))) });
    expect(await call(f)).toMatchObject({ ok: false, reason: "ai_timeout" });
  });
  it("network error is retryable, not zero", async () => {
    expect(await call(async () => { throw new TypeError("fetch failed"); })).toMatchObject({ ok: false, reason: "ai_network" });
  });
});

describe("email provider adapter", () => {
  const send = (f: any) => sendProviderEmail({ fetchImpl: f, apiKey: "k", idempotencyKey: "recovery-x-1", body: {}, timeoutMs: 50 });
  it("accepted only with a message id; idempotency key forwarded", async () => {
    let key = "";
    const r = await send(async (_u: string, i: any) => { key = i.headers["Idempotency-Key"]; return res(200, '{"id":"msg_1"}'); });
    expect(r).toEqual({ ok: true, id: "msg_1" }); expect(key).toBe("recovery-x-1");
  });
  it("rejection / malformed / missing id / timeout", async () => {
    expect(await send(async () => res(422, "{}"))).toEqual({ ok: false, error: "provider_422" });
    expect(await send(async () => res(200, "oops"))).toEqual({ ok: false, error: "provider_malformed_response" });
    expect(await send(async () => res(200, "{}"))).toEqual({ ok: false, error: "provider_response_missing_id" });
    const stall = async (_u: string, i: any) => ({ ok: true, status: 200, text: () => new Promise((_r, rej) => i.signal.addEventListener("abort", () => rej(Object.assign(new Error(), { name: "AbortError" })))) });
    expect(await send(stall)).toEqual({ ok: false, error: "provider_timeout" });
  });
});
