import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(), functions: { invoke: vi.fn() } } }));
import { applyToVacancy } from "@/lib/applicationRouter";

describe("apply requires a profile", () => {
  it("blocks applying when no Quick Profile or CV profile is confirmed", async () => {
    const out = await applyToVacancy({ id: "v1", kind: "direct", whatsapp: "+6281234567890", company: "X" } as any, null);
    expect(out.needsProfile).toBe(true);
    expect(out.ok).toBe(false);
  });
});
