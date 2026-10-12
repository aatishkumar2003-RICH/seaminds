import { describe, it, expect } from "vitest";
import { EXAM_CONTRACT, requirementsFor, SCREENING_LABEL, CV_EVIDENCE_LABEL } from "@/lib/examContract";
import { gatewayErrorMessage } from "@/lib/assessmentGateway";

describe("frozen exam contract", () => {
  it("Sea Profile paper is 23 = 18 MCQ + 3 scenarios + 2 professional", () => {
    expect(EXAM_CONTRACT.PROFILE).toMatchObject({ mcq: 18, scenario: 3, behavioural: 2, total: 23 });
  });
  it("CV-Based paper is 27 = 22 + 3 + 2", () => {
    expect(EXAM_CONTRACT.CV_BASED).toMatchObject({ mcq: 22, scenario: 3, behavioural: 2, total: 27 });
  });
  it("Manager AI Interview paper is 31 = 24 + 4 + 3", () => {
    expect(EXAM_CONTRACT.MANAGER).toMatchObject({ mcq: 24, scenario: 4, behavioural: 3, total: 31 });
  });
  it("blueprint requirements add up to the advertised totals", () => {
    for (const k of ["PROFILE", "CV_BASED", "MANAGER"] as const) {
      expect(requirementsFor(k).reduce((s, r) => s + r.count, 0)).toBe(EXAM_CONTRACT[k].total);
    }
  });
  it("never claims verification or official certification", () => {
    expect(CV_EVIDENCE_LABEL).toMatch(/not independently verified/);
    expect(SCREENING_LABEL).toMatch(/not an official certificate/);
  });
  it("CV mode without a CV gives a clear message", () => {
    expect(gatewayErrorMessage("CV_REQUIRED")).toMatch(/Upload your CV/);
  });
});

import { saveOutcome, paperFraction, SKIP_ANSWER } from "@/lib/examContract";
describe("skip disposition", () => {
  it("uses the server skip sentinel", () => expect(SKIP_ANSWER).toBe("__SKIPPED__"));
  it("network failure is never a skip", () => {
    expect(saveOutcome(null)).toBeNull();
    expect(saveOutcome({ ok: false, error_code: "RATE_LIMITED" })).toBeNull();
  });
  it("classifies saved skip, timeout and answer", () => {
    expect(saveOutcome({ ok: true, disposition: "SKIPPED" })).toBe("skipped");
    expect(saveOutcome({ ok: true, disposition: "TIMED_OUT" })).toBe("timed_out");
    expect(saveOutcome({ ok: true, disposition: null })).toBe("answered");
  });
  it("first saved answer wins — no false confirmation", () => {
    expect(saveOutcome({ ok: true, disposition: "SKIPPED", original_answer_kept: true })).toBe("kept");
  });
  it("skips score zero and stay in the 23/27/31 denominator", () => {
    expect(paperFraction([10, null, 0], 23)).toBeCloseTo(10 / 230);
    expect(paperFraction(Array(27).fill(0), 27)).toBe(0);
    expect(paperFraction([10, 10], 31)).toBeCloseTo(20 / 310);
  });
});
