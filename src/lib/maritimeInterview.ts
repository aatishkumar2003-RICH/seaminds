// Candidate-only practice state. Never writes assessment scores or manager records.
import { MAX_TURNS, MAX_ANSWER_CHARS, summarise, type ExamStep, type Turn, type Assessment } from "../../supabase/functions/_shared/maritimeExaminer";
export { MAX_TURNS, MAX_ANSWER_CHARS };
export interface InterviewTurn extends Turn { feedback?: string }
export interface InterviewSession { turns: InterviewTurn[]; question: string | null; done: boolean }
export const emptyInterview = (): InterviewSession => ({ turns: [], question: null, done: false });

export function applyInterviewStep(session: InterviewSession, step: ExamStep, answer?: string): InterviewSession {
  if (session.done) throw new Error("This interview has ended.");
  if (!step.done && !step.next_question?.trim()) throw new Error("No question received. Please try again.");
  let turns = session.turns;
  if (session.question) {
    if (answer === undefined || !step.assessment) throw new Error("Your answer was not checked. Please try again.");
    const a: Assessment = step.assessment;
    if (!Number.isFinite(a.depth) || a.depth < 0 || a.depth > 4) throw new Error("Invalid result received. Please try again.");
    turns = [...turns, { question: session.question, answer, ...a }];
  } else if (step.done) throw new Error("The interview could not start. Please try again.");
  return { turns, question: step.done ? null : step.next_question, done: step.done };
}

// Do not expose learning feedback in the active interview presentation.
export function completedReview(session: InterviewSession) {
  return session.done && session.turns.length ? { ...summarise(session.turns), turns: session.turns } : null;
}

export function requestTranscript(session: InterviewSession) {
  return session.turns.map(({ question, answer }) => ({ question, answer }));
}
export function verdictLabel(v: string | null | undefined) {
  return v === "ready" ? "Ready" : v === "ready_with_training" ? "Ready with training" : v === "not_ready" ? "Not ready yet" : "—";
}
