import { jsPDF } from "jspdf";

export const CRITERIA = [
  { k: "safety", l: "Safety awareness & risk assessment" },
  { k: "technical", l: "Technical ability & seamanship" },
  { k: "emergency", l: "Emergency readiness & drills" },
  { k: "teamwork", l: "Teamwork, discipline & sobriety" },
  { k: "english", l: "Maritime English & communication" },
  { k: "leadership", l: "Leadership & initiative" },
] as const;
export type CriterionKey = typeof CRITERIA[number]["k"];
export type RehireVerdict = "rehire" | "rehire_with_training" | "do_not_rehire";
export type PromotionVerdict = "recommended" | "maintain_rank" | "not_ready";

export const REHIRE_LABEL: Record<RehireVerdict, string> = {
  rehire: "Recommended for re-employment", rehire_with_training: "Re-employ after training", do_not_rehire: "Not recommended",
};
export const PROMO_LABEL: Record<PromotionVerdict, string> = {
  recommended: "Recommended for promotion", maintain_rank: "Maintain present rank", not_ready: "Not ready for promotion",
};
export const ROLE_LABEL: Record<string, string> = { master: "Master", chief_engineer: "Chief Engineer", superintendent: "Superintendent" };
export const TRAINING_OPTIONS = ["Maritime English", "SIRE 2.0 / Vetting", "Safety & PPE", "Emergency drills", "Technical / equipment", "Leadership & BRM/ERM"];

export type Appraisal = {
  id?: string; contract_id: string; appraiser_name: string; appraiser_role: string;
  period_from: string | null; period_to: string | null;
  safety: number; technical: number; emergency: number; teamwork: number; english: number; leadership: number;
  overall?: number; rehire_verdict: RehireVerdict; promotion_verdict: PromotionVerdict;
  training_needs: string[]; remarks: string; status: "draft" | "finalized"; finalized_at?: string | null;
};

const clamp = (v: number) => Math.min(5, Math.max(1, Number(v) || 1));
/** Mirrors the database trigger: plain average of the six criteria, 2 decimals. */
export function overallScore(a: Pick<Appraisal, CriterionKey>): number {
  const sum = CRITERIA.reduce((s, c) => s + clamp(a[c.k]), 0);
  return Math.round((sum / CRITERIA.length) * 100) / 100;
}

/** Problems that block finalizing (same rules the database enforces). */
export function finalizeProblems(a: Appraisal): string[] {
  const p: string[] = [];
  if (a.appraiser_name.trim().length < 2) p.push("Enter the appraiser's name.");
  if (a.rehire_verdict === "rehire_with_training" && a.training_needs.length === 0) p.push("Pick at least one training need.");
  return p;
}

export function badgeFor(a: Pick<Appraisal, "rehire_verdict" | "status"> & { overall?: number }): { label: string; tone: "good" | "warn" | "bad" } | null {
  if (a.status !== "finalized") return null;
  if (a.rehire_verdict === "do_not_rehire") return { label: "Do not rehire", tone: "bad" };
  if (a.rehire_verdict === "rehire_with_training") return { label: "Training required", tone: "warn" };
  if ((a.overall ?? 0) >= 4.5) return { label: "Top performer", tone: "good" };
  return { label: "Rehire", tone: "good" };
}

export function buildAppraisalPdf(a: Appraisal, meta: { crew: string; rank: string; vessel: string; employer: string }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 18;
  doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text("CREW PERFORMANCE APPRAISAL", 105, y, { align: "center" }); y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(meta.employer || "", 105, y, { align: "center" }); y += 10;
  const row = (l: string, v: string) => { doc.setFont("helvetica", "bold"); doc.text(l, 15, y); doc.setFont("helvetica", "normal"); doc.text(v || "-", 60, y); y += 6; };
  row("Seafarer", meta.crew); row("Rank", meta.rank); row("Vessel", meta.vessel);
  row("Period", `${a.period_from || "-"} to ${a.period_to || "-"}`);
  row("Appraiser", `${a.appraiser_name} (${ROLE_LABEL[a.appraiser_role] || a.appraiser_role})`);
  y += 4; doc.setFont("helvetica", "bold"); doc.text("Criterion", 15, y); doc.text("Score (1-5)", 170, y); y += 2;
  doc.line(15, y, 195, y); y += 6; doc.setFont("helvetica", "normal");
  for (const c of CRITERIA) { doc.text(c.l, 15, y); doc.text(clamp(a[c.k]).toFixed(2), 175, y); y += 6; }
  doc.line(15, y - 3, 195, y - 3); doc.setFont("helvetica", "bold");
  doc.text("Overall", 15, y + 2); doc.text(overallScore(a).toFixed(2), 175, y + 2); y += 12;
  row("Re-employment", REHIRE_LABEL[a.rehire_verdict]);
  row("Promotion", PROMO_LABEL[a.promotion_verdict]);
  const tn: unknown = a.training_needs;
  const needs = Array.isArray(tn) ? tn.map(String).filter(Boolean).join(", ") : typeof tn === "string" ? tn.trim() : "";
  if (needs) { const tl = doc.splitTextToSize(needs, 135); doc.setFont("helvetica", "bold"); doc.text("Training needs", 15, y); doc.setFont("helvetica", "normal"); doc.text(tl, 60, y); y += tl.length * 5 + 1; }
  y += 2; doc.setFont("helvetica", "bold"); doc.text("Remarks", 15, y); y += 5; doc.setFont("helvetica", "normal");
  for (const ln of doc.splitTextToSize(a.remarks || "-", 180) as string[]) { if (y > 280) { doc.addPage(); y = 18; } doc.text(ln, 15, y); y += 5; }
  y += 15; if (y > 270) { doc.addPage(); y = 30; }
  doc.line(15, y, 85, y); doc.line(125, y, 195, y); y += 5; doc.setFontSize(8);
  doc.text("Appraiser signature", 15, y); doc.text("Seafarer signature", 125, y); y += 8;
  doc.text(a.status === "finalized" ? `Finalized ${a.finalized_at?.slice(0, 10) || ""}` : "DRAFT — not final", 15, y);
  doc.save(`Appraisal_${meta.crew.replace(/\s+/g, "_")}.pdf`);
}
