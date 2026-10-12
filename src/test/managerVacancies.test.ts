import { describe, it, expect, vi, beforeEach } from "vitest";

// Programmable Supabase mock: insert outcome + rows returned for batch reconciliation / active scan.
const state: {
  insertResult: () => Promise<{ data: unknown; error: unknown }>;
  inserted: unknown[][];
  selectRows: unknown[];
  selectCalls: number;
} = { insertResult: async () => ({ data: [], error: null }), inserted: [], selectRows: [], selectCalls: 0 };

vi.mock("@/integrations/supabase/client", () => {
  const selectChain = () => {
    const c: Record<string, unknown> = {};
    ["eq", "gt"].forEach((k) => (c[k] = () => c));
    c.then = (res: (v: unknown) => unknown) => { state.selectCalls++; return Promise.resolve({ data: state.selectRows, error: null }).then(res); };
    return c;
  };
  return {
    supabase: {
      from: () => ({
        select: () => selectChain(),
        insert: (payload: unknown[]) => ({
          select: () => {
            state.inserted.push(payload);
            const p = { then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => state.insertResult().then(res, rej) };
            return p;
          },
        }),
      }),
    },
  };
});

import {
  classifyDuplicates, findIntraBatchDuplicates, computeExpiresAt, NO_EXPIRY_COMPAT, isValidEmail,
  decidePermanentDelete, canTransition, filterByMinAge, parseCustomDays, postingAgeLabel, AGE_PRESETS, DAY_MS, toRow, publishVacancyBatch,
  reconcileBatch, isBatchUncertain, _resetUncertainBatches, toPreviewVacancy, validateAttribution, loadUncertainMarker,
  type PreviewVacancy, type ActiveRow, type ManagerIdentity,
} from "@/lib/managerVacancies";
import { resolveApplyRoute } from "@/lib/applicationRouter";
import type { UnifiedVacancy } from "@/lib/vacancyFeed";

const identity: ManagerIdentity = { userId: "mgr-1", companyName: "Synergy Marine", approved: true };
const row = (o: Partial<PreviewVacancy> = {}): PreviewVacancy => ({
  ...toPreviewVacancy({
    rank_required: "Master", vessel_type: "Bulk Carrier", joining_port: "Singapore", joining_date: "2026-11-01",
    contract_duration: "6 months", monthly_salary: "USD 9000", contact_whatsapp: "+6512345678", contact_email: "hr@a.com",
    recruiter_name: "Agency A", positions: 1,
  }),
  ...o,
});
const active = (o: Partial<ActiveRow> = {}): ActiveRow => ({
  id: "a1", rank_required: "Master", vessel_type: "Bulk Carrier", joining_port: "Singapore", joining_date: "2026-11-01",
  contract_duration: "6 months", monthly_salary: "USD 9000", positions: 1, recruiter_name: "Agency A",
  contact_whatsapp: "+6512345678", contact_email: "hr@a.com", created_at: "2026-10-01", ...o,
});

const vac: UnifiedVacancy = {
  id: "1", kind: "direct", rank: "Master", vessel: "Bulk", port: null, joiningDate: null, contractDuration: null,
  salaryText: null, company: "X", publisherName: "Synergy Marine", recruiterName: null, verified: true, qualityScore: null,
  postedAt: null, expiresAt: null, notes: null, email: null, whatsapp: "+6512345678", applyUrl: null, positions: 1,
  flierUrl: null, postingBatchId: null, source: null, isNew: false,
};

beforeEach(() => {
  state.insertResult = async () => ({ data: [{ id: "n1" }], error: null });
  state.inserted = []; state.selectRows = []; state.selectCalls = 0;
  _resetUncertainBatches();
  localStorage.clear();
});

describe("Stage 2 corrective: refresh-safe uncertain batches", () => {
  it("after refresh (memory lost) a new publish is blocked by the saved marker and never inserts", async () => {
    state.insertResult = async () => { throw new TypeError("Failed to fetch"); };
    const r = await publishVacancyBatch([row()], identity, "text", { skipDuplicateScan: true });
    _resetUncertainBatches(); // simulate refresh
    expect(loadUncertainMarker("mgr-1")?.batchId).toBe(r.batchId);
    state.insertResult = async () => ({ data: [{ id: "x" }], error: null });
    const again = await publishVacancyBatch([row({ rank_required: "Bosun" })], identity, "text", { skipDuplicateScan: true });
    expect(again.status).toBe("uncertain");
    expect(again.batchId).toBe(r.batchId);
    expect(state.inserted).toHaveLength(1);
  });
  it("marker stores only minimal metadata", async () => {
    state.insertResult = async () => { throw new TypeError("Failed to fetch"); };
    await publishVacancyBatch([row()], identity, "text", { skipDuplicateScan: true });
    expect(Object.keys(loadUncertainMarker("mgr-1")!).sort()).toEqual(["at", "batchId", "expected", "managerId"]);
  });
  it("partial reconciliation is not a full publication and keeps the marker", async () => {
    state.insertResult = async () => { throw new TypeError("Failed to fetch"); };
    const r = await publishVacancyBatch([row(), row({ rank_required: "Bosun" })], identity, "text", { skipDuplicateScan: true });
    state.selectRows = [{ id: "one" }];
    const rec = await reconcileBatch(r.batchId!, "mgr-1", 2);
    expect(rec.state).toBe("partial");
    expect(loadUncertainMarker("mgr-1")?.batchId).toBe(r.batchId);
    const retry = await publishVacancyBatch([row()], identity, "text", { skipDuplicateScan: true, batchId: r.batchId! });
    expect(retry.status).toBe("uncertain");
  });
  it("marker is cleared only after verified full resolution", async () => {
    state.insertResult = async () => { throw new TypeError("Failed to fetch"); };
    const r = await publishVacancyBatch([row()], identity, "text", { skipDuplicateScan: true });
    state.selectRows = [];
    await reconcileBatch(r.batchId!, "mgr-1", 1);
    expect(loadUncertainMarker("mgr-1")).not.toBeNull();
    state.selectRows = [{ id: "landed" }];
    expect((await reconcileBatch(r.batchId!, "mgr-1", 1)).state).toBe("complete");
    expect(loadUncertainMarker("mgr-1")).toBeNull();
  });
  it("marker is manager-scoped", async () => {
    state.insertResult = async () => { throw new TypeError("Failed to fetch"); };
    await publishVacancyBatch([row()], identity, "text", { skipDuplicateScan: true });
    expect(loadUncertainMarker("mgr-2")).toBeNull();
  });
});

describe("routing: own vs third-party", () => {
  it("A: own-company posting (recruiter = company) routes internally", () => {
    expect(resolveApplyRoute({ ...vac, recruiterName: "synergy  marine" }, null).channel).toBe("seaminds");
  });
  it("B: SeaMinds third-party posting routes to recruiter WhatsApp", () => {
    expect(resolveApplyRoute({ ...vac, publisherName: "SeaMinds Operations", recruiterName: "PT Aslan" }, null).channel).toBe("whatsapp");
  });
  it("C: non-SeaMinds manager third-party posting routes to recruiter, email when no WhatsApp", () => {
    expect(resolveApplyRoute({ ...vac, recruiterName: "PT Aslan" }, null).channel).toBe("whatsapp");
    expect(resolveApplyRoute({ ...vac, recruiterName: "PT Aslan", whatsapp: null, email: "hr@aslan.id" }, null).channel).toBe("email");
  });
  it("C: third-party with no contact never falls back to SeaMinds", () => {
    expect(resolveApplyRoute({ ...vac, recruiterName: "PT Aslan", whatsapp: null }, null).channel).toBe("none");
  });
  it("legacy NULL recruiter keeps previous behaviour", () => {
    expect(resolveApplyRoute(vac, null).channel).toBe("seaminds");
    expect(resolveApplyRoute({ ...vac, publisherName: "Seaminds.life" }, null).channel).toBe("whatsapp");
  });
  it("own row is stored with recruiter_name = verified company; third-party keeps agency", () => {
    expect(toRow(row({ ownership: "own", recruiter_name: "Typo Name" }), identity, "text", "b", "e").recruiter_name).toBe("Synergy Marine");
    expect(toRow(row({ ownership: "third_party" }), identity, "text", "b", "e").recruiter_name).toBe("Agency A");
  });
  it("third-party without distinct recruiter or contact is blocked", () => {
    expect(validateAttribution([row({ ownership: "third_party", recruiter_name: "" })], "Synergy Marine").ok).toBe(false);
    expect(validateAttribution([row({ ownership: "third_party", recruiter_name: "Synergy Marine" })], "Synergy Marine").ok).toBe(false);
    expect(validateAttribution([row({ ownership: "third_party", contact_whatsapp: "", contact_email: "" })], "Synergy Marine").ok).toBe(false);
    expect(validateAttribution([row({ ownership: "third_party" })], "Synergy Marine").ok).toBe(true);
  });
});

describe("duplicates", () => {
  it("different recruiters with the same job are not merged", () => {
    const s = classifyDuplicates([row({ recruiter_name: "Agency B" })], [active()]);
    expect(s.toPublish).toHaveLength(1);
    expect(s.exactDuplicates).toHaveLength(0);
    expect(s.similar).toHaveLength(1);
  });
  it("same recruiter and identical details is an exact duplicate", () => {
    expect(classifyDuplicates([row()], [active()]).exactDuplicates).toHaveLength(1);
  });
  it("legacy NULL-recruiter active row never blocks a named recruiter", () => {
    const s = classifyDuplicates([row()], [active({ recruiter_name: null })]);
    expect(s.toPublish).toHaveLength(1);
    expect(s.similar).toHaveLength(1);
  });
  it.each([
    ["contract", { contract_duration: "4 months" }],
    ["salary", { monthly_salary: "USD 8500" }],
    ["positions", { positions: 2 }],
    ["joining date", { joining_date: "2026-12-01" }],
    ["contact", { contact_whatsapp: "+6599999999" }],
  ])("a genuine %s difference is kept, not skipped", (_n, diff) => {
    const s = classifyDuplicates([row(diff as Partial<PreviewVacancy>)], [active()]);
    expect(s.toPublish).toHaveLength(1);
    expect(s.exactDuplicates).toHaveLength(0);
  });
  it("identical rows inside one session are detected; first kept", () => {
    expect(findIntraBatchDuplicates([row(), row({ rank_required: "Bosun" }), row()])).toEqual([2]);
    const s = classifyDuplicates([row(), row()], []);
    expect(s.toPublish).toHaveLength(1);
    expect(s.intraBatchDuplicates).toHaveLength(1);
    expect(s.scope).toBe("manager");
  });
});

describe("per-row provenance", () => {
  it("flyer URL and contacts never cross between sources", () => {
    const a = toRow(row({ source_type: "flier", flier_url: "https://f/A.jpg", contact_whatsapp: "+6511111111" }), identity, "flier", "b", "e", "https://f/B.jpg");
    const b = toRow(row({ source_type: "flier", flier_url: "https://f/B.jpg", contact_whatsapp: "+6522222222" }), identity, "flier", "b", "e", "https://f/A.jpg");
    const t = toRow(row({ source_type: "text" }), identity, "flier", "b", "e", "https://f/A.jpg");
    expect([a.flier_url, a.contact_whatsapp]).toEqual(["https://f/A.jpg", "+6511111111"]);
    expect([b.flier_url, b.contact_whatsapp]).toEqual(["https://f/B.jpg", "+6522222222"]);
    expect([t.flier_url, t.source_type]).toEqual([null, "text"]);
  });
});

describe("no automatic expiry", () => {
  it("computeExpiresAt only returns the compatibility value", () => {
    expect(computeExpiresAt()).toBe(NO_EXPIRY_COMPAT);
    expect(NO_EXPIRY_COMPAT.startsWith("2099-")).toBe(true);
  });
  it("publisher writes the compatibility value, not a 30-day expiry", async () => {
    await publishVacancyBatch([row()], identity, "text", { skipDuplicateScan: true });
    expect((state.inserted[0][0] as { expires_at: string }).expires_at).toBe(NO_EXPIRY_COMPAT);
  });
});

describe("Turn 2 safeguards", () => {
  it("retry when reconcile finds zero rows stays uncertain and never inserts again", async () => {
    state.insertResult = async () => { throw new TypeError("Failed to fetch"); };
    const r = await publishVacancyBatch([row()], identity, "text", { skipDuplicateScan: true });
    state.selectRows = [];
    const retry = await publishVacancyBatch([row()], identity, "text", { skipDuplicateScan: true, batchId: r.batchId! });
    expect(retry.status).toBe("uncertain");
    expect(retry.batchId).toBe(r.batchId);
    expect(state.inserted).toHaveLength(1);
    expect(isBatchUncertain(r.batchId!)).toBe(true);
  });
  it("partial reconciliation reports committed rows and never resubmits", async () => {
    state.insertResult = async () => { throw new TypeError("Failed to fetch"); };
    const r = await publishVacancyBatch([row(), row({ rank_required: "Bosun" })], identity, "text", { skipDuplicateScan: true });
    state.selectRows = [{ id: "one" }];
    const retry = await publishVacancyBatch([row(), row({ rank_required: "Bosun" })], identity, "text", { skipDuplicateScan: true, batchId: r.batchId! });
    expect(retry.published).toBe(1);
    expect(retry.failures.join(" ")).toMatch(/Do not resubmit/);
    expect(state.inserted).toHaveLength(1);
  });
  it("engine blocks a bad email even if the UI let it through", async () => {
    const r = await publishVacancyBatch([row({ contact_email: "not-an-email" })], identity, "text", { skipDuplicateScan: true });
    expect(r.status).toBe("blocked");
    expect(state.inserted).toHaveLength(0);
  });
  it("engine blocks a domestic WhatsApp number", async () => {
    const r = await publishVacancyBatch([row({ contact_whatsapp: "08123456789" })], identity, "text", { skipDuplicateScan: true });
    expect(r.status).toBe("blocked");
  });
  it("valid email formats pass, empty is allowed", () => {
    expect(isValidEmail("hr@agency.ph")).toBe(true);
    expect(isValidEmail("")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
  });
  it("deletion is blocked with applications and archive is only offered", () => {
    expect(decidePermanentDelete(0)).toEqual({ allowed: true });
    expect(decidePermanentDelete(3)).toEqual({ allowed: false, reason: "has_applications", applications: 3, archiveOffered: true });
  });
  it("manual transitions", () => {
    expect(canTransition("active", "archived")).toBe(true);
    expect(canTransition("archived", "active")).toBe(true);
    expect(canTransition("filled", "active")).toBe(true);
    expect(canTransition("archived", "filled")).toBe(false);
    expect(canTransition("expired", "active")).toBe(false);
  });
  it("age filters: 30/40/60/70/90 and custom days", () => {
    const now = Date.UTC(2026, 9, 12);
    const at = (d: number) => ({ created_at: new Date(now - d * DAY_MS).toISOString() });
    const rows = [at(5), at(35), at(45), at(65), at(75), at(95)];
    expect(AGE_PRESETS).toEqual([30, 40, 60, 70, 90]);
    expect(filterByMinAge(rows, 30, now)).toHaveLength(5);
    expect(filterByMinAge(rows, 40, now)).toHaveLength(4);
    expect(filterByMinAge(rows, 60, now)).toHaveLength(3);
    expect(filterByMinAge(rows, 90, now)).toHaveLength(1);
    expect(filterByMinAge(rows, null, now)).toHaveLength(6);
    expect(parseCustomDays("120")).toBe(120);
    expect(parseCustomDays("12a")).toBeNull();
  });
  it("posting age label never claims active hiring", () => {
    const now = Date.UTC(2026, 9, 12);
    expect(postingAgeLabel(new Date(now - 3 * DAY_MS).toISOString(), now)).toEqual({ text: "Posted 3 days ago", recurring: false });
    const old = postingAgeLabel(new Date(now - 60 * DAY_MS).toISOString(), now);
    expect(old.recurring).toBe(true);
    expect(old.text).toMatch(/confirm with recruiter/);
    expect(old.text).not.toMatch(/actively hiring/i);
  });
});

describe("atomic publish and reconciliation", () => {
  it("one INSERT for the whole batch with one batch id", async () => {
    state.insertResult = async () => ({ data: [{ id: "1" }, { id: "2" }], error: null });
    const r = await publishVacancyBatch([row(), row({ rank_required: "Bosun" })], identity, "text", { skipDuplicateScan: true });
    expect(state.inserted).toHaveLength(1);
    const ids = new Set((state.inserted[0] as { posting_batch_id: string }[]).map((x) => x.posting_batch_id));
    expect(ids.size).toBe(1);
    expect(r.status).toBe("published");
  });
  it("network timeout is uncertain, not failure, and does not auto-retry", async () => {
    state.insertResult = async () => ({ data: null, error: { message: "AbortError: signal timed out" } });
    const r = await publishVacancyBatch([row()], identity, "text", { skipDuplicateScan: true });
    expect(r.status).toBe("uncertain");
    expect(state.inserted).toHaveLength(1);
    expect(isBatchUncertain(r.batchId!)).toBe(true);
  });
  it("retry of a batch already committed is never resubmitted", async () => {
    state.insertResult = async () => { throw new TypeError("Failed to fetch"); };
    const r = await publishVacancyBatch([row()], identity, "text", { skipDuplicateScan: true });
    state.selectRows = [{ id: "landed" }];
    const retry = await publishVacancyBatch([row()], identity, "text", { skipDuplicateScan: true, batchId: r.batchId! });
    expect(retry.status).toBe("published");
    expect(retry.published).toBe(1);
    expect(state.inserted).toHaveLength(1);
  });
  it("reconcile with zero rows stays unresolved", async () => {
    const rec = await reconcileBatch("b-x", "mgr-1", 2);
    expect(rec.state).toBe("absent");
    expect(rec.message).toMatch(/may still finish/);
  });
  it("a real database error is a definite failure", async () => {
    state.insertResult = async () => ({ data: null, error: { code: "23502", message: "null value" } });
    const r = await publishVacancyBatch([row()], identity, "text", { skipDuplicateScan: true });
    expect(r.status).toBe("failed");
  });
});
