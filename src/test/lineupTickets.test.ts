import { describe, it, expect } from "vitest";
import { canEscalate, isValidCategory } from "@/lib/lineupTickets";

describe("lineup tickets", () => {
  it("crew cannot use manager-only reasons", () => {
    expect(isValidCategory("crew", "no_show")).toBe(false);
    expect(isValidCategory("crew", "delayed_joining")).toBe(true);
  });
  it("manager cannot use crew-only reasons", () => {
    expect(isValidCategory("manager", "contract_wage_dispute")).toBe(false);
    expect(isValidCategory("manager", "double_commitment")).toBe(true);
  });
  it("raiser must wait 48 hours before escalating", () => {
    const now = Date.parse("2026-10-23T12:00:00Z");
    const t = { status: "open", raised_by_role: "manager", created_at: "2026-10-22T13:00:00Z" };
    expect(canEscalate(t, "manager", now)).toBe(false);
    expect(canEscalate({ ...t, created_at: "2026-10-21T12:00:00Z" }, "manager", now)).toBe(true);
  });
  it("the other side may escalate immediately", () => {
    const t = { status: "open", raised_by_role: "manager", created_at: new Date().toISOString() };
    expect(canEscalate(t, "crew")).toBe(true);
  });
  it("closed tickets cannot be escalated", () => {
    expect(canEscalate({ status: "mutually_resolved", raised_by_role: "crew", created_at: "2020-01-01" }, "manager")).toBe(false);
  });
});
