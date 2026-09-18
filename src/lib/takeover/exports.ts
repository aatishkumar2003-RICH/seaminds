import {
  MASTER_ITEMS,
  SPARE_ITEMS,
  SAFETY_ITEMS,
  CERT_ITEMS,
  TEMPLATE_ID,
  TEMPLATE_VERSION,
  GRADE_LABELS,
  type GroupKey,
} from "./template";
import {
  answerKey,
  computeShortfall,
  computeSafetyShortfall,
  hasAssessment,
  methodLabel,
  type AnswerMap,
} from "./answers";

/**
 * Spreadsheet formula injection guard: a cell that a spreadsheet would treat
 * as a formula is prefixed so it stays literal text.
 */
const sanitize = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);

const esc = (v: unknown) => {
  const raw = v === undefined || v === null ? "" : String(v);
  const s = sanitize(raw);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export interface InspectionHeader {
  id: string;
  vessel_name: string;
  imo?: string | null;
  flag?: string | null;
  class_society?: string | null;
  port_of_registry?: string | null;
  inspector_name?: string | null;
  started_on?: string | null;
  status?: string;
  is_partial?: boolean;
  submitted_at?: string | null;
  submitted_by?: string | null;
  limitation_note?: string | null;
  template_id?: string;
  template_version?: number;
}

export interface EvidenceMeta {
  id: string;
  photo_no: number | null;
  group_key: string | null;
  item_ref: string | null;
  caption: string | null;
  source_type: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  created_at: string;
}

const kindOf = (m?: string | null) => (m && m.startsWith("image/") ? "photograph" : "document");

/** Flat CSV of every template row plus any recorded observation. */
export function buildCsv(header: InspectionHeader, answers: AnswerMap, evidence: EvidenceMeta[] = []): string {
  const evidenceCount = (g: GroupKey, ref: string, imagesOnly: boolean) =>
    evidence.filter(
      (e) => e.group_key === g && e.item_ref === ref && (!imagesOnly || kindOf(e.mime_type) === "photograph")
    ).length;

  const rows: string[][] = [
    [
      "group",
      "source_ref",
      "section_or_system",
      "item",
      "template_recommendation",
      "result_or_status",
      "assessment_recorded",
      "grade",
      "grade_meaning",
      "evidence_method",
      "test_reading",
      "actual_qty",
      "serviceable_qty",
      "required_qty",
      "shortfall",
      "issue_date",
      "expiry_or_next_due",
      "last_test",
      "remarks",
      "action",
      "planning_bucket",
      "cost_usd",
      "responsible",
      "due_date",
      "location",
      "na_reason",
      "photographs",
      "documents",
      "last_updated",
    ],
  ];

  const get = (g: GroupKey, ref: string) => answers[answerKey(g, ref)];

  for (const i of MASTER_ITEMS) {
    const row = get("master", i.ref);
    const d: any = row?.data || {};
    rows.push([
      "Master",
      i.ref,
      i.section,
      i.item,
      i.acceptance || "",
      d.result || "",
      hasAssessment("master", d) ? "yes" : "no",
      d.grade ?? "",
      d.grade ? GRADE_LABELS[d.grade as 1 | 2 | 3 | 4] : "",
      (d.methods || []).map(methodLabel).join(" / "),
      d.test_reading || "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      d.remarks || "",
      d.action || "",
      d.bucket || "",
      d.cost_usd ?? "",
      d.responsible || "",
      d.due_date || "",
      "",
      d.na_reason || "",
      evidenceCount("master", i.ref, true),
      evidenceCount("master", i.ref, false) - evidenceCount("master", i.ref, true),
      row?.updated_at || "",
    ].map(String));
  }
  for (const i of SPARE_ITEMS) {
    const row = get("spares", i.ref);
    const d: any = row?.data || {};
    const sf = computeShortfall(d, i.recommendedMinimum);
    rows.push([
      "Spares",
      i.ref,
      i.system,
      i.spare,
      i.recommendedMinimum ? `template recommendation: min ${i.recommendedMinimum}` : "",
      d.result || "",
      hasAssessment("spares", d) ? "yes" : "no",
      "",
      "",
      "",
      "",
      d.actual_qty ?? "",
      d.serviceable_qty ?? "",
      "",
      sf ?? "unknown",
      "",
      "",
      "",
      d.remarks || "",
      d.action || "",
      d.bucket || "",
      d.cost_usd ?? "",
      d.responsible || "",
      d.due_date || "",
      d.location || "",
      d.na_reason || "",
      evidenceCount("spares", i.ref, true),
      evidenceCount("spares", i.ref, false) - evidenceCount("spares", i.ref, true),
      row?.updated_at || "",
    ].map(String));
  }
  for (const i of SAFETY_ITEMS) {
    const row = get("safety", i.ref);
    const d: any = row?.data || {};
    const sf = computeSafetyShortfall(d);
    rows.push([
      "Safety",
      i.ref,
      i.equipment,
      i.check || "",
      i.takeoverMinimum || "",
      d.status || "",
      hasAssessment("safety", d) ? "yes" : "no",
      "",
      "",
      (d.methods || []).map(methodLabel).join(" / "),
      d.test_reading || "",
      d.onboard_qty ?? "",
      d.serviceable_qty ?? "",
      d.required_qty ?? "",
      sf ?? "unknown",
      "",
      d.next_due || "",
      d.last_test || "",
      d.remarks || "",
      d.action || "",
      d.bucket || "",
      d.cost_usd ?? "",
      d.responsible || "",
      d.due_date || "",
      "",
      d.na_reason || "",
      evidenceCount("safety", i.ref, true),
      evidenceCount("safety", i.ref, false) - evidenceCount("safety", i.ref, true),
      row?.updated_at || "",
    ].map(String));
  }
  for (const i of CERT_ITEMS) {
    const row = get("certificates", i.ref);
    const d: any = row?.data || {};
    rows.push([
      "Certificates",
      i.ref,
      "Certificates & Records",
      i.certificate,
      "",
      d.status || "",
      hasAssessment("certificates", d) ? "yes" : "no",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      d.issue_date || "",
      d.expiry_date || d.next_due || "",
      "",
      d.remarks || "",
      d.action || "",
      d.bucket || "",
      d.cost_usd ?? "",
      d.responsible || "",
      d.due_date || "",
      "",
      "",
      evidenceCount("certificates", i.ref, true),
      evidenceCount("certificates", i.ref, false) - evidenceCount("certificates", i.ref, true),
      row?.updated_at || "",
    ].map(String));
  }

  const tid = header.template_id || TEMPLATE_ID;
  const tver = header.template_version ?? TEMPLATE_VERSION;
  const meta =
    `# Vessel,${esc(header.vessel_name)},IMO,${esc(header.imo)},Template,${esc(`${tid} v${tver}`)},` +
    `Status,${esc(header.status === "submitted" ? (header.is_partial ? "SUBMITTED (PARTIAL)" : "SUBMITTED") : "DRAFT")}\n`;
  return meta + rows.map((r) => r.map(esc).join(",")).join("\n");
}

export function buildJson(
  header: InspectionHeader,
  answers: AnswerMap,
  evidence: EvidenceMeta[] = [],
  submittedSnapshot?: Record<string, unknown> | null
) {
  return {
    template_id: header.template_id || TEMPLATE_ID,
    template_version: header.template_version ?? TEMPLATE_VERSION,
    inspection: header,
    report_status:
      header.status === "submitted" ? (header.is_partial ? "SUBMITTED_PARTIAL" : "SUBMITTED") : "DRAFT",
    exported_at: new Date().toISOString(),
    answers: Object.values(answers).map((a) => ({
      group_key: a.group_key,
      item_ref: a.item_ref,
      version: a.version,
      updated_at: a.updated_at,
      data: a.data,
    })),
    evidence_manifest: evidence.map((e) => ({
      evidence_id: e.id,
      photo_no: e.photo_no,
      kind: kindOf(e.mime_type),
      group_key: e.group_key,
      item_ref: e.item_ref,
      caption: e.caption,
      source_type: e.source_type,
      mime_type: e.mime_type,
      size_bytes: e.size_bytes,
      storage_path: e.storage_path,
      uploaded_at: e.created_at,
    })),
    /** Frozen server snapshot, present only once the report is submitted. */
    submitted_snapshot: submittedSnapshot ?? null,
  };
}

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
