import { describe, it, expect } from "vitest";
import { isExamHelpRequest, buildOrQuery } from "../../supabase/functions/_shared/dora";

describe("DORA exam integrity", () => {
  it("blocks requests for exam answers", () => {
    expect(isExamHelpRequest("can you give me exam answer")).toBe(true);
    expect(isExamHelpRequest("Which option is correct for question 4?")).toBe(true);
    expect(isExamHelpRequest("what is the right answer")).toBe(true);
    expect(isExamHelpRequest("is it option B")).toBe(true);
  });
  it("allows technical assessment help", () => {
    expect(isExamHelpRequest("are my assessment answers saved?")).toBe(false);
    expect(isExamHelpRequest("I lost internet during the exam")).toBe(false);
    expect(isExamHelpRequest("my question paper is not ready")).toBe(false);
  });
});

describe("DORA loose search", () => {
  it("builds an OR query without stopwords", () => {
    expect(buildOrQuery("Why can't I login?")).toBe("login");
    expect(buildOrQuery("my result is not showing")).toBe("result or showing");
  });
});
