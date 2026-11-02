import { describe, expect, it, vi } from "vitest";
import { adminSupportAlert, sendAdminSupportAlert } from "../../supabase/functions/_shared/supportAlert";

describe("Immediate support admin alerts", () => {
  it("uses the official admin destination and preserves the authorized sender", () => {
    const alert = adminSupportAlert("SM-SUP-TEST");
    expect(alert.to).toEqual(["admin@seaminds.life"]);
    expect(alert.from).toBe("SeaMinds Support <crew@seaminds.life>");
    expect(alert.reply_to).toBe("support@seaminds.life");
  });
  it("uses a stable ticket key on retries", async () => {
    const f = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    expect(await sendAdminSupportAlert("test-key", "SM-SUP-TEST", f)).toBe(true);
    expect(await sendAdminSupportAlert("test-key", "SM-SUP-TEST", f)).toBe(true);
    for (const call of f.mock.calls) expect(call[1].headers["Idempotency-Key"]).toBe("support-admin-SM-SUP-TEST");
  });
  it("never claims email acceptance after a provider failure", async () => {
    expect(await sendAdminSupportAlert("test-key", "SM-SUP-TEST", vi.fn().mockResolvedValue(new Response('{}', { status: 503 })))).toBe(false);
  });
});