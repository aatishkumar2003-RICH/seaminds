import { describe, it, expect, vi, beforeEach } from "vitest";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) }, auth: { getUser: async () => ({ data: { user: null } }) } },
}));

import { cacheHandlerFor, purgeLegacyCaches, LEGACY_CACHE_NAMES } from "@/lib/pwaCacheRules";
import {
  isStaleJoiningDate, parseJoiningDate, mergeVacancyPage, START_CURSOR,
  loadMyEmailDelivery, isEmailDelivered, type UnifiedVacancy,
} from "@/lib/vacancyFeed";
import { singleFlight, watchSentinel } from "@/lib/infiniteSentinel";

const B = "https://abc.supabase.co";
const NOW = new Date("2026-10-10T00:00:00Z");

const vac = (id: string, kind: "direct" | "external", postedAt: string, joiningDate: string | null = null): UnifiedVacancy => ({
  id, kind, rank: "Master", vessel: null, port: null, joiningDate, contractDuration: null, salaryText: null,
  company: "X", publisherName: null, verified: false, qualityScore: null, postedAt, expiresAt: null, notes: null,
  email: null, whatsapp: null, applyUrl: null, positions: 1, flierUrl: null, postingBatchId: null, source: null, isNew: false,
});

describe("PWA caching rules", () => {
  it("never caches personal or transactional backend calls", () => {
    for (const path of [
      "/auth/v1/token", "/rest/v1/job_applications?crew_id=eq.1", "/rest/v1/crew_profiles?id=eq.1",
      "/rest/v1/rpc/get_my_applications", "/functions/v1/notify-application", "/storage/v1/object/sign/x",
      "/rest/v1/takeover_answers",
    ]) expect(cacheHandlerFor(B + path)).toBe("NetworkOnly");
  });
  it("only public catalogue reads may use the cache", () => {
    expect(cacheHandlerFor(B + "/rest/v1/blog_posts?select=*")).toBe("NetworkFirst");
    expect(cacheHandlerFor(B + "/rest/v1/blog_postsx")).toBe("NetworkOnly");
  });
  it("deletes the old cache that held user data", async () => {
    const del = vi.fn(async () => true);
    await purgeLegacyCaches({ delete: del });
    expect(del).toHaveBeenCalledWith("supabase-api");
    expect(LEGACY_CACHE_NAMES).toContain("supabase-api");
  });
});

describe("stale joining dates (90 days)", () => {
  it("hides reliably parsed dates more than 90 days old", () => {
    expect(isStaleJoiningDate("2023-05-31", NOW)).toBe(true);
    expect(isStaleJoiningDate("31 May 2023", NOW)).toBe(true);
    expect(isStaleJoiningDate("May 31, 2023", NOW)).toBe(true);
    expect(isStaleJoiningDate("June 2026", NOW)).toBe(true);
  });
  it("keeps recent dates and the 90-day boundary", () => {
    expect(isStaleJoiningDate("2026-07-15", NOW)).toBe(false);
    expect(isStaleJoiningDate("2026-11-01", NOW)).toBe(false);
  });
  it("never treats ASAP, URGENT, ambiguous or junk text as stale", () => {
    for (const t of ["ASAP", "URGENT", "Immediate joining", "03/04/2023", "soon", "", null, "Ongoing recruitment 2023"]) {
      expect(isStaleJoiningDate(t as string | null, NOW)).toBe(false);
    }
    expect(parseJoiningDate("ASAP")).toBeNull();
  });
});

describe("pagination across direct + external", () => {
  it("orders deterministically and advances each source cursor", () => {
    const d = [vac("d2", "direct", "2026-10-09T00:00:00Z"), vac("d1", "direct", "2026-10-07T00:00:00Z")];
    const e = [vac("e2", "external", "2026-10-08T00:00:00Z"), vac("e1", "external", "2026-10-06T00:00:00Z")];
    const p = mergeVacancyPage(d, e, 2, START_CURSOR, NOW);
    expect(p.items.map((v) => v.id)).toEqual(["d2", "e2"]);
    expect(p.cursor.direct?.id).toBe("d2");
    expect(p.cursor.external?.id).toBe("e2");
    expect(p.done).toBe(false);
  });
  it("breaks equal timestamps by id so pages never overlap", () => {
    const t = "2026-10-09T00:00:00Z";
    const p = mergeVacancyPage([vac("a", "direct", t), vac("c", "direct", t)], [vac("b", "external", t)], 3, START_CURSOR, NOW);
    expect(p.items.map((v) => v.id)).toEqual(["c", "b", "a"]);
  });
  it("is done only when both short batches are fully consumed", () => {
    const p = mergeVacancyPage([vac("d1", "direct", "2026-10-01T00:00:00Z")], [], 5, START_CURSOR, NOW);
    expect(p.done).toBe(true);
  });
  it("drops stale external jobs but still moves past them", () => {
    const e = [vac("old", "external", "2026-10-08T00:00:00Z", "2023-05-31")];
    const p = mergeVacancyPage([], e, 5, START_CURSOR, NOW);
    expect(p.items).toHaveLength(0);
    expect(p.cursor.external?.id).toBe("old");
  });
});

describe("application delivery state after reload", () => {
  beforeEach(() => invoke.mockReset());
  it("marks only server-confirmed recruiter emails as delivered", async () => {
    invoke.mockResolvedValue({ data: { ok: true, emailed: ["job-1"] } });
    await loadMyEmailDelivery();
    expect(invoke).toHaveBeenCalledWith("notify-application", { body: { kind: "delivery_status" } });
    expect(isEmailDelivered("job-1")).toBe(true);
    expect(isEmailDelivered("job-2")).toBe(false);
  });
  it("keeps last known state when the network fails", async () => {
    invoke.mockRejectedValue(new Error("offline"));
    await loadMyEmailDelivery();
    expect(isEmailDelivered("job-1")).toBe(true);
  });
});

describe("infinite scroll trigger", () => {
  it("ignores overlapping loads (no duplicate pages)", async () => {
    let release!: () => void;
    const load = vi.fn(() => new Promise<void>((r) => { release = r; }));
    const run = singleFlight(load);
    const first = run();
    expect(await run()).toBe(false);
    release();
    expect(await first).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it("fires when the sentinel intersects", () => {
    let cb!: (e: { isIntersecting: boolean }[]) => void;
    class FakeIO { constructor(f: typeof cb) { cb = f; } observe() {} disconnect() {} }
    const onNear = vi.fn();
    watchSentinel(document.createElement("div"), onNear, 600, { IntersectionObserver: FakeIO as any });
    cb([{ isIntersecting: false }]);
    expect(onNear).not.toHaveBeenCalled();
    cb([{ isIntersecting: true }]);
    expect(onNear).toHaveBeenCalledTimes(1);
  });
  it("falls back to scroll events on old iOS without IntersectionObserver", () => {
    const el = document.createElement("div");
    let top = 2000;
    el.getBoundingClientRect = () => ({ top } as DOMRect);
    let scrollFn!: () => void;
    const onNear = vi.fn();
    const stop = watchSentinel(el, onNear, 600, {
      addScroll: (f) => { scrollFn = f; return () => {}; },
      viewportHeight: () => 800,
    });
    expect(onNear).not.toHaveBeenCalled();
    top = 1200; // momentum scroll brings sentinel within 600px
    scrollFn();
    expect(onNear).toHaveBeenCalledTimes(1);
    stop();
  });
});
