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
