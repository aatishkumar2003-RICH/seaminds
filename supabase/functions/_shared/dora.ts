// Pure DORA helpers (no imports) so vitest can test them.

const EXAM_PATTERNS: RegExp[] = [
  /\b(correct|right|best)\s+(answer|option|choice)\b/i,
  /\bwhich\s+(option|answer|choice)\b/i,
  /\bwhat\s+is\s+the\s+answer\b/i,
  /\banswer\s+(to|for|of)\s+(this|the|my|that)\s+(question|q\d*)\b/i,
  /\b(exam|test|assessment|interview|quiz)\s+answers?\b/i,
  /\bgive\s+me\s+(the\s+)?answers?\b/i,
  /\bsolve\s+(this|the|my)\b/i,
  /\boption\s+[a-d]\b/i,
  /\b(cheat|hint)\b/i,
];

/** True when the user is asking DORA to answer/interpret assessment content. */
export function isExamHelpRequest(text: string): boolean {
  const t = (text || "").slice(0, 2000);
  return EXAM_PATTERNS.some((p) => p.test(t));
}

const STOP = new Set([
  "the","and","for","you","your","are","was","can","cant","not","how","what","why","when","where","who",
  "does","did","have","has","with","this","that","there","from","into","about","please","help","seaminds",
  "dora","need","want","get","got","its","but","any","all","now","why","will","would","could","should","my",
]);

/** Loose OR query for Postgres websearch_to_tsquery when the strict AND search finds nothing. */
export function buildOrQuery(text: string): string {
  const words = Array.from(new Set(
    (text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP.has(w)),
  )).slice(0, 8);
  return words.join(" or ");
}

export const BLOCKED_SEALED_REPLY =
  "I can't help answer, interpret or solve assessment or interview questions. That protects the fairness of your SeaMinds score. " +
  "I can help with loading problems, lost connection, saved answers or resuming your assessment.";

export const UNANSWERED_REPLY =
  "⚠️ I couldn't confirm this from SeaMinds Help. Please raise a support case from Help & Support so the SeaMinds team can check it for you.";
