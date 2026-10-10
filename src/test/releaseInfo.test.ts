import { describe, it, expect } from "vitest";
import { formatWib, isNewerRelease, isUnsafeToInterrupt, fetchRemoteRelease } from "@/lib/releaseInfo";
import { runtimeCachingRules } from "@/lib/pwaCacheRules";

const cur = { buildId: "SM-abc-1", commit: "abc", buildTime: "2026-10-10T07:43:00.000Z" };

describe("release info", () => {
  it("formats build time in Jakarta (UTC+7)", () => {
    expect(formatWib("2026-10-10T07:43:00.000Z")).toBe("10 Oct 2026, 14:43 WIB");
  });
  it("detects a different published build only", () => {
    expect(isNewerRelease(cur, { buildId: "SM-def-2" })).toBe(true);
    expect(isNewerRelease(cur, { buildId: "SM-abc-1" })).toBe(false);
    expect(isNewerRelease(cur, null)).toBe(false);
    expect(isNewerRelease({ ...cur, buildId: "dev" }, { buildId: "x" })).toBe(false);
  });
  it("never interrupts assessments or forms", () => {
    expect(isUnsafeToInterrupt("/interview/abc")).toBe(true);
    expect(isUnsafeToInterrupt("/index?tab=smc")).toBe(true);
    expect(isUnsafeToInterrupt("/")).toBe(false);
  });
  it("fetches version.json with no-store", async () => {
    let opts: RequestInit | undefined;
    const f = (async (_u: string, o: RequestInit) => { opts = o; return { ok: true, json: async () => cur }; }) as unknown as typeof fetch;
    expect((await fetchRemoteRelease(f))?.buildId).toBe("SM-abc-1");
    expect(opts?.cache).toBe("no-store");
  });
  it("version.json is network-only in the service worker", () => {
    const rule = runtimeCachingRules.find((r) => r.urlPattern.test("https://seaminds.life/version.json?t=1"));
    expect(rule?.handler).toBe("NetworkOnly");
  });
});
