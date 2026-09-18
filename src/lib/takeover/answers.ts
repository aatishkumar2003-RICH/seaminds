import type { GroupKey } from "./template";
import {
  MASTER_ITEMS,
  SPARE_ITEMS,
  SAFETY_ITEMS,
  CERT_ITEMS,
  TOTAL_ITEMS,
} from "./template";

/** Shape of the per-item answer payload stored in takeover_answers.data */
export interface MasterAnswer {
  result?: "pass" | "deficiency" | "na" | "not_verified";
  grade?: 1 | 2 | 3 | 4 | null;
  remarks?: string;
  action?: string;
  cost_usd?: number | null;
  responsible?: string;
  due_date?: string;
}

export interface SpareAnswer {
  actual_qty?: number | null;
  serviceable_qty?: number | null;
  location?: string;
  remarks?: string;
  mitigation_accepted?: boolean;
  result?: "ok" | "shortfall" | "not_verified";
}

export interface SafetyAnswer {
  required_qty?: number | null;
  onboard_qty?: number | null;
  serviceable_qty?: number | null;
  last_test?: string;
  next_due?: string;
  status?: "satisfactory" | "deficiency" | "not_verified";
  remarks?: string;
}

export interface CertAnswer {
  issue_date?: string;
  expiry_date?: string;
  next_due?: string;
  status?: "valid" | "expired" | "missing" | "not_sighted";
  remarks?: string;
  evidence?: string;
}

export interface AnyAnswer
  extends Omit<MasterAnswer, "result">,
    Omit<SpareAnswer, "result" | "remarks">,
    Omit<SafetyAnswer, "status" | "remarks">,
    Omit<CertAnswer, "status" | "remarks"> {
  result?: MasterAnswer["result"] | SpareAnswer["result"];
  status?: SafetyAnswer["status"] | CertAnswer["status"];
  remarks?: string;
}

export interface AnswerRow {
  id?: string;
  group_key: GroupKey;
  item_ref: string;
  data: AnyAnswer;
  version: number;
  updated_at?: string;
}

export type AnswerMap = Record<string, AnswerRow>;

export const answerKey = (group: GroupKey, ref: string) => `${group}:${ref}`;

const has = (v: unknown) => v !== undefined && v !== null && v !== "";

/** Null and zero are distinct: 0 is an observation, null/blank is unknown. */
export const isBlank = (v: unknown) => v === undefined || v === null || v === "";

/** An item counts as answered only if a real observation exists. */
export function isAnswered(group: GroupKey, data?: AnyAnswer): boolean {
  if (!data) return false;
  switch (group) {
    case "master":
      return has(data.result);
    case "spares":
      return has(data.result) || has(data.actual_qty) || has(data.serviceable_qty);
    case "safety":
      return has(data.status) || has(data.onboard_qty) || has(data.serviceable_qty);
    case "certificates":
      return has(data.status);
  }
}

/** "Verified" excludes explicit not-verified / not-sighted outcomes. */
export function isVerified(group: GroupKey, data?: AnyAnswer): boolean {
  if (!isAnswered(group, data)) return false;
  switch (group) {
    case "master":
      return data!.result !== "not_verified";
    case "spares":
      return data!.result !== "not_verified";
    case "safety":
      return data!.status !== "not_verified";
    case "certificates":
      return data!.status !== "not_sighted";
  }
}

export function isDeficiency(group: GroupKey, data?: AnyAnswer): boolean {
  if (!data) return false;
  switch (group) {
    case "master":
      return data.result === "deficiency";
    case "spares":
      return data.result === "shortfall";
    case "safety":
      return data.status === "deficiency" || (computeSafetyShortfall(data) ?? 0) > 0;
    case "certificates":
      return data.status === "expired" || data.status === "missing";
  }
}

/**
 * Spares shortfall against the template recommended minimum.
 * Returns null (unknown) when either the recommendation or the serviceable
 * quantity is missing — mirrors the source workbook formula intent.
 * Uses serviceable quantity, never the actual count.
 */
export function computeShortfall(
  data?: SpareAnswer,
  recommendedMinimum?: string
): number | null {
  const min = Number(recommendedMinimum);
  if (!recommendedMinimum || Number.isNaN(min)) return null;
  if (isBlank(data?.serviceable_qty) || isBlank(data?.actual_qty)) return null;
  return Math.max(0, min - Number(data!.serviceable_qty));
}

/** Safety shortfall = required per approved plan − serviceable. Unknown required ≠ zero. */
export function computeSafetyShortfall(data?: SafetyAnswer): number | null {
  if (!data) return null;
  if (isBlank(data.required_qty) || isBlank(data.serviceable_qty)) return null;
  return Math.max(0, Number(data.required_qty) - Number(data.serviceable_qty));
}

export interface QtyIssue {
  field: string;
  message: string;
}

/** Reject nonsensical quantities; null and zero stay distinct. */
export function validateQuantities(data: {
  actual_qty?: number | null;
  serviceable_qty?: number | null;
  onboard_qty?: number | null;
  required_qty?: number | null;
}): QtyIssue[] {
  const issues: QtyIssue[] = [];
  const check = (field: string, v: unknown) => {
    if (isBlank(v)) return;
    const n = Number(v);
    if (Number.isNaN(n) || n < 0 || !Number.isInteger(n))
      issues.push({ field, message: "Must be a whole number of 0 or more" });
  };
  check("actual_qty", data.actual_qty);
  check("serviceable_qty", data.serviceable_qty);
  check("onboard_qty", data.onboard_qty);
  check("required_qty", data.required_qty);
  const base = !isBlank(data.actual_qty) ? data.actual_qty : data.onboard_qty;
  if (!isBlank(base) && !isBlank(data.serviceable_qty) && Number(data.serviceable_qty) > Number(base)) {
    issues.push({ field: "serviceable_qty", message: "Serviceable cannot exceed the quantity found onboard" });
  }
  return issues;
}

export interface InspectionStats {
  total: number;
  answered: number;
  unanswered: number;
  verified: number;
  notVerified: number;
  deficiencies: number;
  missingPhotos: number;
  byGroup: Record<GroupKey, { total: number; answered: number; deficiencies: number }>;
}

const GROUPED: { key: GroupKey; refs: string[] }[] = [
  { key: "master", refs: MASTER_ITEMS.map((i) => i.ref) },
  { key: "spares", refs: SPARE_ITEMS.map((i) => i.ref) },
  { key: "safety", refs: SAFETY_ITEMS.map((i) => i.ref) },
  { key: "certificates", refs: CERT_ITEMS.map((i) => i.ref) },
];

/** Counts EVERY template row. Blank rows count as unanswered. */
export function computeStats(answers: AnswerMap, photoRefs: Set<string> = new Set()): InspectionStats {
  const stats: InspectionStats = {
    total: TOTAL_ITEMS,
    answered: 0,
    unanswered: 0,
    verified: 0,
    notVerified: 0,
    deficiencies: 0,
    missingPhotos: 0,
    byGroup: {
      master: { total: MASTER_ITEMS.length, answered: 0, deficiencies: 0 },
      spares: { total: SPARE_ITEMS.length, answered: 0, deficiencies: 0 },
      safety: { total: SAFETY_ITEMS.length, answered: 0, deficiencies: 0 },
      certificates: { total: CERT_ITEMS.length, answered: 0, deficiencies: 0 },
    },
  };

  for (const g of GROUPED) {
    for (const ref of g.refs) {
      const data = answers[answerKey(g.key, ref)]?.data;
      if (isAnswered(g.key, data)) {
        stats.answered++;
        stats.byGroup[g.key].answered++;
        if (isVerified(g.key, data)) stats.verified++;
        else stats.notVerified++;
      }
      if (isDeficiency(g.key, data)) {
        stats.deficiencies++;
        stats.byGroup[g.key].deficiencies++;
      }
    }
  }

  for (const item of MASTER_ITEMS) {
    if (item.photoRequired && !photoRefs.has(answerKey("master", item.ref))) stats.missingPhotos++;
  }

  stats.unanswered = stats.total - stats.answered;
  return stats;
}
