import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
import { trainingLink, trainingMessage, trainingError } from "@/lib/training";

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
});
