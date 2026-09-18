import { CERT_ITEMS, MASTER_ITEMS, SAFETY_ITEMS, SPARE_ITEMS, type GroupKey } from "./template";
import {
  answerKey,
  computeSafetyShortfall,
  computeShortfall,
  contradictsAssessment,
  isDeficiency,
  spareMinimumFor,
  validateQuantities,
  type AnswerMap,
  type AnyAnswer,
} from "./answers";

export type Severity = "deficiency" | "shortfall" | "expired" | "invalid" | "contradiction";

export interface Finding {
  key: string;
  group: GroupKey;
  ref: string;
  title: string;
  context: string;
  severity: Severity;
  detail: string;
  remarks?: string;
  action?: string;
  responsible?: string;
  due_date?: string;
  cost_usd?: number | null;
  bucket?: string;
  updated_at?: string;
}

export const BUCKET_LABELS: Record<string, string> = {
  immediate: "Immediate",
  "30d": "Within 30 days",
  "60d": "Within 60 days",
  "90d": "Within 90 days",
  drydock: "Next drydock",
  unplanned: "No planning bucket set",
};

export const titleOf = (g: GroupKey, ref: string) => {
  if (g === "master") return MASTER_ITEMS.find((i) => i.ref === ref)?.item || ref;
  if (g === "spares") return SPARE_ITEMS.find((i) => i.ref === ref)?.spare || ref;
  if (g === "safety") return SAFETY_ITEMS.find((i) => i.ref === ref)?.equipment || ref;
  return CERT_ITEMS.find((i) => i.ref === ref)?.certificate || ref;
};

export const contextOf = (g: GroupKey, ref: string) => {
  if (g === "master") return MASTER_ITEMS.find((i) => i.ref === ref)?.section || "";
  if (g === "spares") return SPARE_ITEMS.find((i) => i.ref === ref)?.system || "";
  if (g === "safety") return "Safety & Emergency";
  return "Certificates & Records";
};

/**
 * Derived view over the SAME answer rows — no second data entry, no closure
 * workflow. A measured shortfall becomes a finding whether or not the
 * inspector pressed the shortfall button.
 */
export function buildFindings(answers: AnswerMap): Finding[] {
  const out: Finding[] = [];
  const push = (group: GroupKey, ref: string, severity: Severity, detail: string, data: AnyAnswer, updated?: string) =>
    out.push({
      key: `${group}:${ref}:${severity}`,
      group,
      ref,
      title: titleOf(group, ref),
      context: contextOf(group, ref),
      severity,
      detail,
      remarks: data.remarks,
      action: data.action,
      responsible: data.responsible,
      due_date: data.due_date,
      cost_usd: data.cost_usd ?? null,
      bucket: data.bucket || "unplanned",
      updated_at: updated,
    });

  Object.values(answers).forEach((row) => {
    const g = row.group_key;
    const d = row.data || {};
    const min = g === "spares" ? spareMinimumFor(row.item_ref) : undefined;

    if (isDeficiency(g, d, min)) {
      if (g === "spares") {
        const sf = computeShortfall(d, min);
        push(
          g,
          row.item_ref,
          (sf ?? 0) > 0 ? "shortfall" : "deficiency",
          (sf ?? 0) > 0
            ? `Shortfall of ${sf} against the template recommended minimum of ${min} (serviceable ${d.serviceable_qty ?? "unknown"} of ${d.actual_qty ?? "unknown"} onboard). The minimum is a template recommendation, not a vessel-approved requirement.`
            : "Recorded as a shortfall by the inspector.",
          d,
          row.updated_at
        );
      } else if (g === "safety") {
        const sf = computeSafetyShortfall(d);
        push(
          g,
          row.item_ref,
          (sf ?? 0) > 0 ? "shortfall" : "deficiency",
          (sf ?? 0) > 0
            ? `Shortfall of ${sf} against the approved plan requirement of ${d.required_qty} (serviceable ${d.serviceable_qty ?? "unknown"}).`
            : "Recorded as a deficiency.",
          d,
          row.updated_at
        );
      } else if (g === "certificates") {
        push(g, row.item_ref, "expired", `Certificate status: ${d.status}.`, d, row.updated_at);
      } else {
        push(g, row.item_ref, "deficiency", `Condition grade ${d.grade ?? "not graded"}.`, d, row.updated_at);
      }
    }

    if (contradictsAssessment(g, d, min))
      push(g, row.item_ref, "contradiction", "Measured quantities contradict the recorded assessment.", d, row.updated_at);

    if (validateQuantities(d).length)
      push(
        g,
        row.item_ref,
        "invalid",
        validateQuantities(d)
          .map((x) => x.message)
          .join("; "),
        d,
        row.updated_at
      );
  });

  const order: Severity[] = ["invalid", "contradiction", "shortfall", "deficiency", "expired"];
  return out.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity) || a.group.localeCompare(b.group));
}

export const totalCost = (findings: Finding[]) =>
  findings.reduce((s, f) => s + (typeof f.cost_usd === "number" ? f.cost_usd : 0), 0);

/** Unanswered / unverified rows listed with their real titles. */
export function unverifiedRows(answers: AnswerMap, check: (g: GroupKey, d?: AnyAnswer) => boolean) {
  const groups: [GroupKey, { ref: string }[]][] = [
    ["master", MASTER_ITEMS],
    ["spares", SPARE_ITEMS],
    ["safety", SAFETY_ITEMS],
    ["certificates", CERT_ITEMS],
  ];
  const out: { group: GroupKey; ref: string; title: string }[] = [];
  groups.forEach(([g, items]) =>
    items.forEach((i) => {
      const d = answers[answerKey(g, i.ref)]?.data;
      if (check(g, d)) out.push({ group: g, ref: i.ref, title: titleOf(g, i.ref) });
    })
  );
  return out;
}
