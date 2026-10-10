import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a), functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));

import { applyToVacancy, applyByEmail } from "@/lib/applicationRouter";
import type { UnifiedVacancy } from "@/lib/vacancyFeed";

const v: UnifiedVacancy = {
  id: "11111111-1111-1111-1111-111111111111", kind: "direct", rank: "Chief Officer", vessel: "Tanker", port: null,
  joiningDate: null, contractDuration: null, salaryText: null, company: "PT ABC Crewing", publisherName: "Seaminds.life",
  verified: false, qualityScore: null, postedAt: null, expiresAt: null, notes: null, email: "hr@abc.co.id",
  whatsapp: "+6281234567890", applyUrl: null, positions: 1, flierUrl: null, postingBatchId: null, source: null, isNew: false,
};

const APP = "app-1";
let exists = false;
beforeEach(() => {
  exists = false;
  rpc.mockReset(); invoke.mockReset();
  rpc.mockImplementation(async () => {
    const dup = exists; exists = true;
    return { data: { ok: true, duplicate: dup, application_id: APP }, error: null };
  });
  vi.stubGlobal("open", vi.fn(() => null));
  vi.stubGlobal("location", { href: "" });
});

describe("WhatsApp then email on the same application", () => {
  it("opening WhatsApp records the application but sends no email", async () => {
    const out = await applyToVacancy(v, null);
    expect(out.route.channel).toBe("whatsapp");
    expect(out.ok).toBe(true);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("email after WhatsApp is still attempted on the same record and reports delivery", async () => {
    await applyToVacancy(v, null);
    invoke.mockResolvedValue({ data: { ok: true, sent: true }, error: null });
    const out = await applyByEmail(v);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][1].body.application_id).toBe(APP);
    expect(out.emailSent).toBe(true);
    expect(out.toast.title).toBe("Emailed ✓");
  });

  it("failed email is not shown as delivered, and a retry attempts again", async () => {
    await applyToVacancy(v, null);
    invoke.mockResolvedValueOnce({ data: { ok: true, sent: false, attempts: [{ error: "provider_down" }] }, error: null });
    const fail = await applyByEmail(v);
    expect(fail.emailSent).toBe(false);
    expect(fail.toast.tone).toBe("warning");

    invoke.mockResolvedValueOnce({ data: { ok: true, sent: true }, error: null });
    const retry = await applyByEmail(v);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(retry.emailSent).toBe(true);
  });

  it("re-opening WhatsApp never records another application", async () => {
    const { reopenWhatsApp } = await import("@/lib/applicationRouter");
    await applyToVacancy(v, null);
    rpc.mockClear();
    expect(reopenWhatsApp(v, null)).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });
});
