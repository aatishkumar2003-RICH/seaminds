import { describe, expect, it } from "vitest";
import { DEFAULT_REWARDS, reminderDue, validateCreditPlan, validateRewards } from "@/lib/creditProgram";

describe("owner credit program", () => {
  it("defaults completed referrals to one credit, not five or ten", () => expect(DEFAULT_REWARDS.referral_credits).toBe(1));
  it("defaults CV completion to five credits", () => expect(DEFAULT_REWARDS.profile_credits).toBe(5));
  it("defaults first scoring completion to five credits", () => expect(DEFAULT_REWARDS.score_credits).toBe(5));
  it("retains fifty welcome credits", () => expect(DEFAULT_REWARDS.welcome_credits).toBe(50));
  it("allows fifty credits for zero dollars", () => expect(validateCreditPlan({ audience: "crew", name: "Launch", price_usd: 0, credits: 50, interval: "once", active: true })).toBeNull());
  it("allows fifty credits for ten dollars without a fixed exchange rate", () => expect(validateCreditPlan({ audience: "fleet", name: "Fleet offer", price_usd: 10, credits: 50, interval: "month", active: true })).toBeNull());
  it("supports all three audiences", () => {
    for (const audience of ["crew", "manager", "fleet"] as const) expect(validateCreditPlan({ audience, name: "Custom", price_usd: 2.5, credits: 200, interval: "year", active: true })).toBeNull();
  });
  it("rejects negative prices and fractional credits", () => {
    const p = { audience: "manager" as const, name: "Custom", price_usd: -1, credits: 50, interval: "once" as const, active: true };
    expect(validateCreditPlan(p)).not.toBeNull();
    expect(validateCreditPlan({ ...p, price_usd: 10, credits: 1.5 })).not.toBeNull();
    expect(validateCreditPlan({ ...p, price_usd: NaN })).not.toBeNull();
  });
  it("zero disables future awards without rejecting the rule", () => expect(validateRewards({ ...DEFAULT_REWARDS, referral_credits: 0, score_credits: 0 })).toBeNull());
  it("reminds only after the owner selected interval", () => {
    const lastSeen = 1000;
    expect(reminderDue(DEFAULT_REWARDS, lastSeen, lastSeen + 23 * 3600000)).toBe(false);
    expect(reminderDue(DEFAULT_REWARDS, lastSeen, lastSeen + 24 * 3600000)).toBe(true);
    expect(reminderDue({ ...DEFAULT_REWARDS, reminders_enabled: false }, 0, Date.now())).toBe(false);
  });
});