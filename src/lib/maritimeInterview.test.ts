import { describe, expect, it } from "vitest";
import { applyInterviewStep, completedReview, emptyInterview, requestTranscript } from "./maritimeInterview";
import type { ExamStep } from "../../supabase/functions/_shared/maritimeExaminer";
const start: ExamStep = { assessment: null, next_question: "What would you check first?", phase: "baseline", done: false };
const response: ExamStep = { assessment: { topic: "power", depth: 1, safety_flag: true, gap: "Isolation", feedback: "SECRET learning feedback" }, next_question: "How would you isolate safely?", phase: "baseline", done: false };
describe("private practice interview", () => {
  it("does not expose feedback until the interview ends", () => {
    const s = applyInterviewStep(applyInterviewStep(emptyInterview(), start), response, "My answer");
    expect(completedReview(s)).toBeNull();
    const final = applyInterviewStep(s, { ...response, done: true, next_question: null }, "Isolate");
    expect(completedReview(final)?.turns[0].feedback).toBe("SECRET learning feedback");
  });
  it("replays only questions and answers, never client scores", () => {
    const s = applyInterviewStep(applyInterviewStep(emptyInterview(), start), response, "Answer");
    expect(requestTranscript(s)).toEqual([{ question: start.next_question, answer: "Answer" }]);
  });
  it("preserves the answer and question when a response is invalid", () => {
    const s = applyInterviewStep(emptyInterview(), start);
    expect(() => applyInterviewStep(s, { ...response, assessment: null }, "Answer")).toThrow();
    expect(s.question).toBe(start.next_question);
    expect(s.turns).toHaveLength(0);
  });
  it("does not accept further turns after completion", () => {
    const s = applyInterviewStep(applyInterviewStep(emptyInterview(), start), { ...response, done: true }, "Answer");
    expect(() => applyInterviewStep(s, response, "Again")).toThrow("ended");
  });
});