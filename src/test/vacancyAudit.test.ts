import { describe, it, expect, vi } from "vitest";
import { auditSource, toAuditLine, removeConfirmed, confirmAndDelete } from "@/lib/vacancyAudit";
import { LIFECYCLE_BACKEND } from "@/lib/vacancyLifecycle";

describe("audit source switching", () => {
  it("uses app_events while adminActions is off and never the V2 table", () => {
    expect(auditSource(false).table).toBe("app_events");
    expect(LIFECYCLE_BACKEND.adminActions).toBe(false);
  });
  it("uses only real V2 columns when on", () => {
    const s = auditSource(true);
    expect(s.table).toBe("vacancy_cleanup_audit");
    for (const bad of ["actor_role", "target_kind", "metadata"]) expect(s.columns).not.toContain(bad);
    expect(s.columns).toContain("blocked_applications");
  });
  it("formats a V2 row with blocked info", () => {
    const l = toAuditLine(true, { id: "1", created_at: "x", actor_scope: "admin", action: "delete", vacancy_kind: "external", affected_count: 2, blocked_ids: ["a"], blocked_applications: 3 });
    expect(l.text).toBe("admin · delete · external · 2 affected · 1 blocked (3 applications)");
  });
});

describe("delete confirmation and mixed results", () => {
  it("cancelling the confirmation sends no request", async () => {
    const req = vi.fn();
    const o = await confirmAndDelete(["a"], "sure?", () => false, req, "pending");
    expect(o.status).toBe("cancelled");
    expect(req).not.toHaveBeenCalled();
  });
  it("mixed bulk result removes only affected IDs and keeps blocked ones", async () => {
    const o = await confirmAndDelete(["a", "b", "c"], "sure?", () => true,
      async () => ({ ok: true, affectedIds: ["a", "c"], blockedIds: ["b"] }), "pending");
    expect(o).toEqual({ status: "done", affectedIds: ["a", "c"], blockedIds: ["b"] });
    expect(removeConfirmed([{ id: "a" }, { id: "b" }, { id: "c" }], ["a", "c"])).toEqual([{ id: "b" }]);
  });
  it("backend rejection is never reported as deleted", async () => {
    const o = await confirmAndDelete(["a"], "sure?", () => true, async () => ({ ok: false, message: "denied" }), "pending");
    expect(o).toEqual({ status: "rejected", message: "denied" });
  });
});
