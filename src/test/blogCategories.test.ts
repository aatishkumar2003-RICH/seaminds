import { describe, it, expect } from "vitest";
import { blogCategoryOf } from "@/lib/blogCategories";

describe("blogCategoryOf", () => {
  it("puts DG Shipping / MARINA oral prep in Orals", () => {
    expect(blogCategoryOf("How to clear DG Shipping MMD orals with AI")).toBe("orals");
    expect(blogCategoryOf("MARINA promotion assessment tips")).toBe("orals");
  });
  it("puts LPG reliquefaction in Technical", () => {
    expect(blogCategoryOf("LPG reliquefaction plant troubleshooting")).toBe("technical");
  });
  it("puts SIRE vetting in Managers", () => {
    expect(blogCategoryOf("SIRE 2.0 crew vetting for fleet managers")).toBe("managers");
  });
  it("puts vacancies in Jobs", () => {
    expect(blogCategoryOf("New vacancies this week in Manila")).toBe("jobs");
  });
});
