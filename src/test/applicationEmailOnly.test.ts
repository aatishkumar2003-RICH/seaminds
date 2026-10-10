import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a), functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));

import { applyToVacancy } from "@/lib/applicationRouter";
import type { UnifiedVacancy } from "@/lib/vacancyFeed";

// Email-only advert: no WhatsApp, no portal.
const v: UnifiedVacancy = {
  id: "22222222-2222-2222-2222-222222222222", kind: "external", rank: "2nd Engineer", vessel: "Bulk", port: null,
  joiningDate: null, contractDuration: null, salaryText: null, company: "PT XYZ", publisherName: null,
  verified: false, qualityScore: null, postedAt: null, expiresAt: null, notes: null, email: "crew@xyz.co.id",
  whatsapp: null, applyUrl: null, positions: 1, flierUrl: null, postingBatchId: null, source: null, isNew: false,
};

let exists = false;
beforeEach(() => {
  exists = false;
  rpc.mockReset(); invoke.mockReset();
  rpc.mockImplementation(async () => {
    const dup = exists; exists = true;
    return { data: { ok: true, duplicate: dup, application_id: "app-2" }, error: null };
  });
  vi.stubGlobal("open", vi.fn(() => null));
});

describe("email-only vacancy apply", () => {
  it("failed recruiter email is not success, so Apply stays available", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true, sent: false, attempts: [{ error: "provider_down" }] }, error: null });
    const out = await applyToVacancy(v, null);
    expect(out.route.channel).toBe("email");
    expect(out.ok).toBe(false);
    expect(out.emailSent).toBe(false);
  });

  it("retry with an existing application record attempts the email again and succeeds", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true, sent: false }, error: null });
    await applyToVacancy(v, null);
    invoke.mockResolvedValueOnce({ data: { ok: true, sent: true }, error: null });
    const retry = await applyToVacancy(v, null);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke.mock.calls[1][1].body.application_id).toBe("app-2");
    expect(retry.ok).toBe(true);
    expect(retry.emailSent).toBe(true);
  });
});
