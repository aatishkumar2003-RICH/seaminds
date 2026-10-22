import { describe, it, expect } from "vitest";
import { normalizeCvDate } from "@/lib/cvDates";

describe("normalizeCvDate", () => {
  it("converts DD/MM/YYYY", () => expect(normalizeCvDate("05/03/1980")).toBe("1980-03-05"));
  it("keeps ISO", () => expect(normalizeCvDate("1980-03-05")).toBe("1980-03-05"));
  it("converts dotted", () => expect(normalizeCvDate("25.12.2019")).toBe("2019-12-25"));
  it("converts month names", () => expect(normalizeCvDate("12 Mar 2020")).toBe("2020-03-12"));
  it("converts Excel serial", () => expect(normalizeCvDate("29221")).toBe("1980-01-01"));
  it("rejects garbage", () => expect(normalizeCvDate("31/02/2020")).toBe(""));
});
