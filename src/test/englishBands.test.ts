import { describe, it, expect } from "vitest";
import { englishBand } from "@/lib/englishBands";
describe("englishBand", () => {
  it("bands scores", () => {
    expect(englishBand(90)).toBe("fluent"); expect(englishBand(85)).toBe("fluent");
    expect(englishBand(84)).toBe("operational"); expect(englishBand(69)).toBe("developing");
    expect(englishBand(49)).toBe("under"); expect(englishBand(null)).toBe("none");
  });
});
