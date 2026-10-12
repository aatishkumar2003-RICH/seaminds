import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { applyAdminFilters, type AdminVacancyRow } from "@/components/admin/VacancyManagementPanel";

const now = Date.UTC(2026, 9, 12);
const r = (o: Partial<AdminVacancyRow>, days: number): AdminVacancyRow => ({
  id: Math.random().toString(), kind: "direct", company: "Acme Ship", recruiter: "Acme Ship", rank: "Chief Officer",
  vessel: "Bulk Carrier", source: "flier", status: "active", created_at: new Date(now - days * 86400000).toISOString(), ...o,
});
const base = { kind: "all" as const, company: "", recruiter: "", rank: "", vessel: "", source: "", status: "", minAge: null };

describe("admin vacancy filters", () => {
  const rows = [
    r({}, 10), r({ kind: "external", company: "Blue Crew", recruiter: "Blue Crew", source: "telegram" }, 50),
    r({ recruiter: "Agency X", status: "archived" }, 95),
  ];
  it("filters by type, company, recruiter, source, status", () => {
    expect(applyAdminFilters(rows, { ...base, kind: "external" }, now)).toHaveLength(1);
    expect(applyAdminFilters(rows, { ...base, company: "acme" }, now)).toHaveLength(2);
    expect(applyAdminFilters(rows, { ...base, recruiter: "agency x" }, now)).toHaveLength(1);
    expect(applyAdminFilters(rows, { ...base, source: "telegram" }, now)).toHaveLength(1);
    expect(applyAdminFilters(rows, { ...base, status: "archived" }, now)).toHaveLength(1);
  });
  it("filters by custom age", () => {
    expect(applyAdminFilters(rows, { ...base, minAge: 45 }, now)).toHaveLength(2);
    expect(applyAdminFilters(rows, { ...base, minAge: 90 }, now)).toHaveLength(1);
  });
});
