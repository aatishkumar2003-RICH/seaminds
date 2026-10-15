import { describe, it, expect } from "vitest";
import { buildJobPostingLd } from "@/lib/jobPostingLd";

describe("JobPosting structured data", () => {
  it("always includes description, title, datePosted and hiringOrganization even when fields are empty", () => {
    const ld = buildJobPostingLd({ rank: "Chief Officer", notes: "  ", company: null, source: null, postedAt: null });
    expect(typeof ld.description).toBe("string");
    expect((ld.description as string).length).toBeGreaterThan(20);
    expect(ld.title).toBe("Chief Officer");
    expect(ld.datePosted).toBeTruthy();
    expect((ld.hiringOrganization as { name: string }).name).toBe("SeaMinds");
  });

  it("uses the real notes when present", () => {
    const ld = buildJobPostingLd({ rank: "AB", notes: "Join in Manila" });
    expect(ld.description).toBe("Join in Manila");
  });
});
