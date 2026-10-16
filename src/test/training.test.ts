import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
import { trainingLink, trainingMessage, trainingError, trainingDossier } from "@/lib/training";

describe("training links", () => {
  it("builds a per-crew tokenized link", () => {
    expect(trainingLink("abc123")).toBe("https://seaminds.life/training/abc123");
  });
  it("WhatsApp message lists every assigned module with its own link", () => {
    const m = trainingMessage("Aris", "Acme Shipping", [{ title: "Mooring Safety", token: "t1" }, { title: "COLREG", token: "t2" }]);
    expect(m).toContain("1. Mooring Safety\nhttps://seaminds.life/training/t1");
    expect(m).toContain("2. COLREG\nhttps://seaminds.life/training/t2");
  });
  it("too-fast completion explains the remaining reading time", () => {
    expect(trainingError("TOO_FAST", 42)).toContain("42s left");
  });
  it("dossier counts only completed modules as verified and lists open ones", () => {
    const base = { slug: "", reasons: [], assigned_at: "", opened_at: null, concepts: [], token: null };
    const d = trainingDossier("Aris", [
      { ...base, slug: "a", title: "Mooring Safety", status: "completed", completed_at: "2026-10-16T07:05:00Z", dwell_seconds: 142, quiz_correct: 3, quiz_total: 3 },
      { ...base, slug: "b", title: "COLREG", status: "opened", completed_at: null, dwell_seconds: null, quiz_correct: null, quiz_total: null },
    ] as any);
    expect(d).toContain("Verified: 1 of 2 assigned");
    expect(d).toContain("Completed 2026-10-16 07:05 UTC · Reading time 142s · Quiz 3/3");
    expect(d).toContain("- COLREG (opened)");
  });
});
