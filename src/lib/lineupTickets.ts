// Two-way lineup issue tickets between crew and the hiring company.
// Categories must mirror SQL raise_lineup_ticket().
export type LineupRole = "crew" | "manager";

export const LINEUP_CATEGORIES: Record<LineupRole, { value: string; label: string }[]> = {
  crew: [
    { value: "delayed_joining", label: "Joining is delayed with no update" },
    { value: "contract_wage_dispute", label: "Contract or wage differs from the offer" },
    { value: "repatriation_assistance", label: "Stranded / repatriation help (urgent)" },
    { value: "unilateral_cancellation", label: "Company cancelled my joining" },
    { value: "other", label: "Other" },
  ],
  manager: [
    { value: "no_show", label: "Crew did not show up / not reachable" },
    { value: "medical_discrepancy", label: "Medical fitness issue" },
    { value: "double_commitment", label: "Crew committed to another company" },
    { value: "document_issue", label: "Document missing or incorrect" },
    { value: "other", label: "Other" },
  ],
};

export const ESCALATION_GRACE_HOURS = 48;

export const isValidCategory = (role: LineupRole, category: string) =>
  LINEUP_CATEGORIES[role].some((c) => c.value === category);

export const categoryLabel = (category: string) =>
  [...LINEUP_CATEGORIES.crew, ...LINEUP_CATEGORIES.manager].find((c) => c.value === category)?.label ?? category;

/** The raiser waits 48 h for the other side; the other side may escalate any time. */
export const canEscalate = (
  t: { status: string; created_at: string; raised_by_role: string },
  myRole: LineupRole | "admin",
  now = Date.now(),
) => {
  if (!["open", "in_dialogue"].includes(t.status)) return false;
  if (myRole !== t.raised_by_role) return true;
  return now - new Date(t.created_at).getTime() >= ESCALATION_GRACE_HOURS * 3600_000;
};

export const LINEUP_ERRORS: Record<string, string> = {
  not_a_party: "You are not part of this joining.",
  no_active_lineup: "Issues can only be raised on a shortlisted, offered or placed joining.",
  invalid_category: "Please choose a reason.",
  statement_too_short: "Please describe the issue (at least 10 characters).",
  already_open: "An issue with this reason is already open.",
  ticket_closed: "This issue is already closed.",
  grace_period: "Give the other side 48 hours to reply before escalating.",
  already_escalated: "Already with the SeaMinds team.",
};
export const lineupErrorText = (code?: string) => (code && LINEUP_ERRORS[code]) || "Could not complete that. Please try again.";
