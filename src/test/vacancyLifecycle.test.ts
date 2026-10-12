import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// Recording Supabase mock: every chain call is captured; results are programmable.
const log: { table: string; op: string; args: unknown[] }[] = [];
const rpc = vi.fn();
let pageResults: { data: unknown[]; error: unknown; count?: number }[] = [];
vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string) => {
    const c: Record<string, unknown> = {};
    ["select", "eq", "gt", "lte", "gte", "or", "ilike", "in", "order", "range", "limit", "insert"].forEach((k) => {
      c[k] = (...args: unknown[]) => { log.push({ table, op: k, args }); return c; };
    });
    c.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(pageResults.shift() ?? { data: [], error: null, count: 0 }).then(res, rej);
    return c;
  };
  return { supabase: { from: (t: string) => chain(t), rpc: (...a: unknown[]) => rpc(...a), auth: { onAuthStateChange: () => ({}) } } };
});

import {
  pageRange, ageCutoffIso, sanitizeSearch, searchOr, totalPages, loadManagerVacancyPage,
  loadAdminVacancyPage, requestLifecycleAction, LIFECYCLE_BACKEND, PENDING_LABEL,
} from "@/lib/vacancyLifecycle";
import { loadActivePostings, scanDuplicates, publishVacancyBatch, loadUncertainMarker, _resetUncertainBatches, toPreviewVacancy } from "@/lib/managerVacancies";
import { isHistoricalListing, mergeVacancyPage, START_CURSOR, type UnifiedVacancy } from "@/lib/vacancyFeed";

beforeEach(() => { log.length = 0; pageResults = []; rpc.mockReset(); localStorage.clear(); _resetUncertainBatches(); });

describe("server-side paging helpers", () => {
  it("page ranges are contiguous and non-overlapping", () => {
    expect(pageRange(0, 50)).toEqual([0, 49]);
    expect(pageRange(40, 50)).toEqual([2000, 2049]);
  });
  it("2,100 vacancies make 42 pages of 50", () => expect(totalPages(2100, 50)).toBe(42));
  it("age cutoff is exact days before now", () => {
    expect(ageCutoffIso(30, Date.UTC(2026, 9, 31))).toBe(new Date(Date.UTC(2026, 9, 1)).toISOString());
    expect(ageCutoffIso(null)).toBeNull();
  });
  it("search input cannot inject PostgREST filter syntax", () => {
    expect(sanitizeSearch("Master,status.eq.active)")).not.toMatch(/[,()]/);
    expect(searchOr("", ["a"])).toBeNull();
  });
});

describe("manager inventory beyond 1,000 rows", () => {
  it("requests the exact page range with exact count, owner scope and filters", async () => {
    pageResults = [{ data: [{ id: "x" }], error: null, count: 2345 }];
    const r = await loadManagerVacancyPage({ managerId: "m1", page: 30, status: "archived", minAge: 60, search: "bosun" });
    expect(r.total).toBe(2345);
    expect(log).toContainEqual({ table: "job_postings", op: "range", args: [1500, 1549] });
    expect(log).toContainEqual({ table: "job_postings", op: "eq", args: ["manager_id", "m1"] });
    expect(log).toContainEqual({ table: "job_postings", op: "eq", args: ["status", "archived"] });
    expect(log.some((l) => l.op === "lte" && l.args[0] === "created_at")).toBe(true);
    expect(log.some((l) => l.op === "select" && (l.args[1] as { count?: string })?.count === "exact")).toBe(true);
  });
  it("a database error is surfaced, never shown as an empty list", async () => {
    pageResults = [{ data: null as never, error: { message: "boom" } }];
    await expect(loadManagerVacancyPage({ managerId: "m1", page: 0, status: "all", minAge: null, search: "" })).rejects.toBeTruthy();
  });
});

describe("admin inventory", () => {
  it("external page filters scam status server-side with exact count", async () => {
    pageResults = [{ data: [], error: null, count: 5000 }];
    const r = await loadAdminVacancyPage({ kind: "external", page: 2, company: "", rank: "", vessel: "", source: "", status: "scam_flagged", minAge: null });
    expect(r.total).toBe(5000);
    expect(log).toContainEqual({ table: "external_vacancies", op: "eq", args: ["is_scam_flagged", true] });
    expect(log).toContainEqual({ table: "external_vacancies", op: "range", args: [100, 149] });
  });
});

describe("duplicate scan completeness", () => {
  it("reads every page past 1,000 active rows", async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ id: `a${i}` }));
    pageResults = [{ data: full, error: null }, { data: [{ id: "last" }], error: null }];
    const rows = await loadActivePostings("m1");
    expect(rows).toHaveLength(1001);
    expect(log.filter((l) => l.op === "range").map((l) => l.args)).toEqual([[0, 999], [1000, 1999]]);
  });
  it("a database error fails the scan instead of silently passing", async () => {
    pageResults = [{ data: null as never, error: { message: "timeout" } }];
    await expect(scanDuplicates("m1", [])).rejects.toThrow(/duplicate check/);
  });
});

describe("uncertain batch marker is written before the INSERT", () => {
  it("marker exists at the moment the insert is sent; cleared after confirmed success", async () => {
    let markerAtInsert: unknown = "unset";
    const identity = { userId: "m1", companyName: "Acme", approved: true };
    const row = { ...toPreviewVacancy({ rank_required: "Master", contact_whatsapp: "+6512345678" }), ownership: "own" as const };
    pageResults = [];
    const orig = log.push.bind(log);
    log.push = (...items) => { if (items.some((i) => i.op === "insert")) markerAtInsert = loadUncertainMarker("m1"); return orig(...items); };
    pageResults = [{ data: [{ id: "n1" }], error: null }];
    const r = await publishVacancyBatch([row], identity, "text", { skipDuplicateScan: true });
    log.push = orig;
    expect(r.status).toBe("published");
    expect((markerAtInsert as { batchId?: string })?.batchId).toBe(r.batchId);
    expect(loadUncertainMarker("m1")).toBeNull();
  });
});

describe("secure lifecycle integration point", () => {
  it("delete and admin actions stay pending and never call the backend", async () => {
    expect(LIFECYCLE_BACKEND.managerDelete).toBe(false);
    expect(LIFECYCLE_BACKEND.adminActions).toBe(false);
    for (const scope of ["manager", "admin"] as const) {
      const r = await requestLifecycleAction(scope, "direct", ["a"], "delete");
      expect(r).toEqual({ ok: false, pending: true, message: PENDING_LABEL });
    }
    expect(rpc).not.toHaveBeenCalled();
  });
  it("no vacancy UI deletes rows directly from the browser", () => {
    for (const f of ["components/manager/VacancyCleanupPanel.tsx", "components/admin/VacancyManagementPanel.tsx", "components/admin/VacancyIntelTab.tsx"]) {
      expect(readFileSync(resolve(__dirname, "..", f), "utf8")).not.toMatch(/\.delete\(\)/);
    }
  });
});

describe("historical external listings", () => {
  const NOW = new Date("2026-10-12T00:00:00Z");
  const vac = (id: string, kind: "direct" | "external", postedAt: string, joiningDate: string | null = null) =>
    ({ id, kind, postedAt, joiningDate } as unknown as UnifiedVacancy);
  it("old external vacancies are not hidden by age or past joining date", () => {
    const p = mergeVacancyPage([], [vac("e1", "external", "2025-01-01T00:00:00Z", "2025-02-01")], 5, START_CURSOR, NOW);
    expect(p.items.map((v) => v.id)).toEqual(["e1"]);
  });
  it("listings older than 45 days are labelled historical", () => {
    expect(isHistoricalListing("2026-08-01T00:00:00Z", NOW.getTime())).toBe(true);
    expect(isHistoricalListing("2026-10-01T00:00:00Z", NOW.getTime())).toBe(false);
  });
});

import { parseLifecycleResponse, summarizeLifecycle, loadApplicationCounts, withoutArchivedExternal } from "@/lib/vacancyLifecycle";
import { loadVacancyPage } from "@/lib/vacancyFeed";

describe("backend lifecycle contract", () => {
  it("mixed bulk delete reports real deletions and protected ids", () => {
    const r = parseLifecycleResponse({ ok: true, affected: 3, affected_ids: ["a", "b", "c"], blocked_ids: ["d", "e"], blocked_applications: 4 });
    expect(r.ok).toBe(true);
    expect(r.affected).toBe(3);
    expect(r.blockedIds).toEqual(["d", "e"]);
    expect(summarizeLifecycle(r)).toBe("3 vacancies deleted · 2 protected because seafarers have applied");
  });
  it("ok:false is never reported as success, even with an affected count", () => {
    const r = parseLifecycleResponse({ ok: false, affected: 2, reason: "has_applications", blocked_ids: ["x"], blocked_applications: 1 });
    expect(r.ok).toBe(false);
    expect(r.blockedIds).toEqual(["x"]);
    expect(r.reason).toBe("has_applications");
  });
  it("a missing ok flag is treated as failure", () => {
    expect(parseLifecycleResponse({ affected: 5 }).ok).toBe(false);
    expect(parseLifecycleResponse(null).ok).toBe(false);
  });
});

describe("pending backend features never query missing objects", () => {
  it("applicant counts are unavailable (null), not zero, and the RPC is not called", async () => {
    expect(await loadApplicationCounts(["a", "b"])).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("archived_at is not queried before activation", async () => {
    const q = { is: vi.fn(), not: vi.fn() };
    expect(withoutArchivedExternal(q)).toBe(q);
    expect(q.is).not.toHaveBeenCalled();
    await loadVacancyPage();
    expect(log.some((l) => l.args.includes("archived_at"))).toBe(false);
    expect(log).toContainEqual({ table: "external_vacancies", op: "eq", args: ["is_scam_flagged", false] });
  });
  it("feed reads source-posted and collected dates separately", async () => {
    await loadVacancyPage();
    const sel = log.find((l) => l.table === "external_vacancies" && l.op === "select");
    expect(String(sel?.args[0])).toMatch(/source_posted_at/);
    expect(String(sel?.args[0])).toMatch(/fetched_at/);
  });
});

describe("unpersistable batch marker blocks the INSERT", () => {
  it("no insert is sent when storage fails", async () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("QuotaExceeded"); });
    const identity = { userId: "m9", companyName: "Acme", approved: true };
    const row = { ...toPreviewVacancy({ rank_required: "Master", contact_whatsapp: "+6512345678" }), ownership: "own" as const };
    const r = await publishVacancyBatch([row], identity, "text", { skipDuplicateScan: true });
    spy.mockRestore();
    expect(r.status).toBe("blocked");
    expect(r.failures[0]).toMatch(/nothing was sent/);
    expect(log.some((l) => l.op === "insert")).toBe(false);
  });
});

import { EXTERNAL_SOURCES } from "@/components/admin/VacancyManagementPanel";
describe("admin source filters", () => {
  it("include the live scraper sources", () => {
    for (const src of ["career_page", "rss_feed", "telegram"]) expect(EXTERNAL_SOURCES).toContain(src);
  });
});
