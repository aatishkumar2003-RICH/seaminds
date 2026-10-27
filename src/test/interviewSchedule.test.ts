import { describe, it, expect } from "vitest";
import { schedulePhase, countdown } from "@/lib/interviewSchedule";

const now = new Date("2026-10-27T10:00:00Z");
const base = { proposed_slots: null, proposed_by: null, scheduled_at: null, window_ends_at: null } as const;

describe("interview scheduling", () => {
  it("crew must answer slots proposed by the manager", () => {
    const p = schedulePhase({ ...base, schedule_mode: "proposed", proposed_by: "manager", proposed_slots: ["2026-10-28T08:00:00Z"] }, "crew", now);
    expect(p.kind).toBe("your_turn");
  });
  it("crew waits after counter-proposing", () => {
    const p = schedulePhase({ ...base, schedule_mode: "proposed", proposed_by: "crew", proposed_slots: ["2026-10-28T08:00:00Z"] }, "crew", now);
    expect(p.kind).toBe("waiting_other");
  });
  it("join button opens 15 minutes before the agreed time", () => {
    const s = { ...base, schedule_mode: "confirmed" as const, scheduled_at: "2026-10-27T10:16:00Z" };
    expect(schedulePhase(s, "crew", now).kind).toBe("upcoming");
    expect(schedulePhase(s, "crew", new Date("2026-10-27T10:01:00Z")).kind).toBe("join_now");
  });
  it("agreed time is missed 2 hours after start", () => {
    const s = { ...base, schedule_mode: "confirmed" as const, scheduled_at: "2026-10-27T07:00:00Z", window_ends_at: "2026-10-27T09:00:00Z" };
    expect(schedulePhase(s, "crew", now).kind).toBe("missed");
  });
  it("flex window expires at its end", () => {
    expect(schedulePhase({ ...base, schedule_mode: "flex", window_ends_at: "2026-10-27T09:00:00Z" }, "crew", now).kind).toBe("flex_expired");
    expect(schedulePhase({ ...base, schedule_mode: "flex", window_ends_at: "2026-10-29T09:00:00Z" }, "crew", now).kind).toBe("flex_open");
  });
  it("countdown labels", () => {
    expect(countdown(26 * 3600_000)).toBe("1d 2h");
    expect(countdown(70 * 60_000)).toBe("1h 10m");
  });
});
