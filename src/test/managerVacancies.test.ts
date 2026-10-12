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
  classifyDuplicates, findIntraBatchDuplicates, computeExpiresAt, toRow, publishVacancyBatch,
  reconcileBatch, isBatchUncertain, _resetUncertainBatches, toPreviewVacancy, validateAttribution,
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

describe("expiry", () => {
  const now = Date.UTC(2026, 9, 12);
  it.each([[30], [45], [60]])("%i days", (d) => {
    expect(computeExpiresAt(d, now)).toBe(new Date(now + d * 86400000).toISOString());
  });
  it("defaults to 30 days and rejects other values", () => {
    expect(computeExpiresAt(undefined, now)).toBe(new Date(now + 30 * 86400000).toISOString());
    expect(computeExpiresAt(183, now)).toBe(new Date(now + 30 * 86400000).toISOString());
  });
  it("publisher sends an explicit 30-day expiry", async () => {
    await publishVacancyBatch([row()], identity, "text", { skipDuplicateScan: true });
    const exp = new Date((state.inserted[0][0] as { expires_at: string }).expires_at).getTime();
    expect(Math.round((exp - Date.now()) / 86400000)).toBe(30);
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
