import { describe, it, expect } from "vitest";
import { checkRest, monthCsv } from "@/lib/restHours";
const H = 3600000;
const now = Date.UTC(2026, 9, 16, 24);
const at = (hAgo: number, type: "work" | "rest") => ({ type, timestamp: new Date(now - hAgo * H).toISOString() });
describe("STCW / MLC rest rules", () => {
  it("10h rest in 24h passes the daily rule", () => {
    expect(checkRest([at(200, "rest"), at(24, "work"), at(10, "rest")], now).rest24).toBe(10);
  });
  it("less than 10h rest in 24h is flagged", () => {
    expect(checkRest([at(200, "rest"), at(24, "work"), at(9, "rest")], now).issues.some((i) => i.includes("minimum is 10h"))).toBe(true);
  });
  it("less than 77h rest in 7 days is flagged", () => {
    const logs = [at(168, "work"), at(160, "rest"), at(152, "work"), ...Array.from({ length: 6 }, (_, d) => [at(144 - d * 24, "rest"), at(134 - d * 24, "work")]).flat(), at(10, "rest")];
    expect(checkRest(logs, now).issues.some((i) => i.includes("77h"))).toBe(true);
  });
  it("rest split into three periods is flagged", () => {
    const logs = [at(200, "rest"), at(24, "work"), at(20, "rest"), at(16, "work"), at(12, "rest"), at(8, "work"), at(4, "rest")];
    expect(checkRest(logs, now).issues.some((i) => i.includes("maximum is 2"))).toBe(true);
  });
  it("two rest periods without one of 6h are flagged", () => {
    const logs = [at(200, "rest"), at(24, "work"), at(19, "rest"), at(14, "work"), at(5, "rest")];
    expect(checkRest(logs, now).issues).toContain("No rest period of at least 6h in the last 24h.");
  });
  it("monthly record has one row per day", () => {
    const csv = monthCsv([at(5, "rest")], 2026, 9);
    expect(csv.split("\n").filter((r) => /^2026-10-\d\d,/.test(r))).toHaveLength(31);
  });
});
