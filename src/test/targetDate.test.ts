import { describe, it, expect } from "vitest";
import { dueStatus, rangeFor, inRange } from "@/lib/targetDate";

const now = new Date("2026-11-13T10:00:00");
describe("target date", () => {
  it("marks a past target as overdue", () => expect(dueStatus("2026-11-12", false, now)?.key).toBe("overdue"));
  it("marks today and tomorrow as due soon", () => {
    expect(dueStatus("2026-11-13", false, now)?.key).toBe("soon");
    expect(dueStatus("2026-11-14", false, now)?.key).toBe("soon");
  });
  it("marks later dates on track", () => expect(dueStatus("2026-11-20", false, now)?.key).toBe("ontrack"));
  it("completed is never overdue", () => expect(dueStatus("2026-11-01", true, now)?.key).toBe("done"));
  it("this week covers the last 7 days", () => {
    const r = rangeFor("week", "", "", now);
    expect(inRange("2026-11-07T08:00:00Z", r)).toBe(true);
    expect(inRange("2026-11-06T08:00:00Z", r)).toBe(false);
  });
});
