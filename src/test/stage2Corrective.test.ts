import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const calls: { table: string; op: string; args: unknown[] }[] = [];
vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string) => {
    const c: Record<string, unknown> = {};
    ["select", "eq", "gt", "gte", "or", "order", "limit"].forEach((k) => {
      c[k] = (...args: unknown[]) => { calls.push({ table, op: k, args }); return c; };
    });
    c.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res);
    return c;
  };
  return { supabase: { from: (t: string) => chain(t), auth: { onAuthStateChange: () => ({}) } } };
});

import { loadVacancyPage } from "@/lib/vacancyFeed";
import { resolveApplyRoute } from "@/lib/applicationRouter";
import type { UnifiedVacancy } from "@/lib/vacancyFeed";
import { PERMANENT_DELETE_ENABLED, DELETE_PENDING } from "@/components/manager/VacancyCleanupPanel";

const base: UnifiedVacancy = {
  id: "1", kind: "direct", rank: "Master", vessel: null, port: null, joiningDate: null, contractDuration: null,
  salaryText: null, company: "X", publisherName: "SeaMinds", recruiterName: null, verified: true, qualityScore: null,
  postedAt: null, expiresAt: null, notes: null, email: null, whatsapp: "+6281234567890", applyUrl: null,
  positions: 1, flierUrl: null, postingBatchId: null, source: null, isNew: false,
};

describe("routing corrections", () => {
  it("SeaMinds-owned posting (recruiter = publisher) uses the internal flow", () => {
    expect(resolveApplyRoute({ ...base, recruiterName: "SeaMinds" }, null).channel).toBe("seaminds");
  });
  it("legacy NULL-recruiter SeaMinds advert keeps external contacts", () => {
    expect(resolveApplyRoute(base, null).channel).toBe("whatsapp");
  });
  it("third-party recruiter on a SeaMinds advert keeps external contacts", () => {
    expect(resolveApplyRoute({ ...base, recruiterName: "PT ABC Crewing" }, null).channel).toBe("whatsapp");
  });
});

describe("direct feed has no joining-date exclusion", () => {
  it("direct query filters status only; external keeps its own protections", async () => {
    calls.length = 0;
    await loadVacancyPage();
    const direct = calls.filter((c) => c.table === "job_postings");
    expect(direct.some((c) => c.op === "eq" && c.args[0] === "status" && c.args[1] === "active")).toBe(true);
    expect(direct.some((c) => c.op === "or" && String(c.args[0]).includes("joining_date"))).toBe(false);
    const ext = calls.filter((c) => c.table === "external_vacancies");
    expect(ext.some((c) => c.op === "eq" && c.args[0] === "is_scam_flagged")).toBe(true);
  });
});

describe("manager permanent deletion is disabled", () => {
  it("flag is off and the panel has no client delete call", () => {
    expect(PERMANENT_DELETE_ENABLED).toBe(false);
    expect(DELETE_PENDING).toBe("Pending secure backend activation");
    const src = readFileSync(resolve(__dirname, "../components/manager/VacancyCleanupPanel.tsx"), "utf8");
    expect(src).not.toMatch(/\.delete\(\)/);
    expect(src).not.toMatch(/onClick=\{\(\) => requestDelete/);
  });
});
