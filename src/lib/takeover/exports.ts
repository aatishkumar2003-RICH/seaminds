import {
  MASTER_ITEMS,
  SPARE_ITEMS,
  SAFETY_ITEMS,
  CERT_ITEMS,
  TEMPLATE_ID,
  TEMPLATE_VERSION,
  type GroupKey,
} from "./template";
import { answerKey, computeShortfall, computeSafetyShortfall, type AnswerMap } from "./answers";

const esc = (v: unknown) => {
  const s = v === undefined || v === null ? "" : String(v);
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
  submitted_at?: string | null;
  limitation_note?: string | null;
}

/** Flat CSV of every template row plus any recorded observation. */
export function buildCsv(header: InspectionHeader, answers: AnswerMap): string {
  const rows: string[][] = [
    [
      "group",
      "source_ref",
      "section_or_system",
      "item",
      "template_recommendation",
      "result_or_status",
      "grade",
      "actual_qty",
      "serviceable_qty",
      "required_qty",
      "shortfall",
      "issue_date",
      "expiry_or_next_due",
      "last_test",
      "remarks",
      "action",
      "cost_usd",
      "responsible",
      "due_date",
      "location",
    ],
  ];

  const get = (g: GroupKey, ref: string) => answers[answerKey(g, ref)]?.data || {};

  for (const i of MASTER_ITEMS) {
    const d: any = get("master", i.ref);
    rows.push([
      "Master",
      i.ref,
      i.section,
      i.item,
      i.acceptance || "",
      d.result || "",
      d.grade ?? "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      d.remarks || "",
      d.action || "",
      d.cost_usd ?? "",
      d.responsible || "",
      d.due_date || "",
      "",
    ].map(String));
  }
  for (const i of SPARE_ITEMS) {
    const d: any = get("spares", i.ref);
    const sf = computeShortfall(d, i.recommendedMinimum);
    rows.push([
      "Spares",
      i.ref,
      i.system,
      i.spare,
      i.recommendedMinimum ? `recommended min ${i.recommendedMinimum}` : "",
      d.result || "",
      "",
      d.actual_qty ?? "",
      d.serviceable_qty ?? "",
      "",
      sf ?? "unknown",
      "",
      "",
      "",
      d.remarks || "",
      "",
      "",
      "",
      "",
      d.location || "",
    ].map(String));
  }
  for (const i of SAFETY_ITEMS) {
    const d: any = get("safety", i.ref);
    const sf = computeSafetyShortfall(d);
    rows.push([
      "Safety",
      i.ref,
      i.equipment,
      i.check || "",
      i.takeoverMinimum || "",
      d.status || "",
      "",
      d.onboard_qty ?? "",
      d.serviceable_qty ?? "",
      d.required_qty ?? "",
      sf ?? "unknown",
      "",
      d.next_due || "",
      d.last_test || "",
      d.remarks || "",
      "",
      "",
      "",
      "",
      "",
    ].map(String));
  }
  for (const i of CERT_ITEMS) {
    const d: any = get("certificates", i.ref);
    rows.push([
      "Certificates",
      i.ref,
      "Certificates & Records",
      i.certificate,
      "",
      d.status || "",
      "",
      "",
      "",
      "",
      "",
      d.issue_date || "",
      d.expiry_date || d.next_due || "",
      "",
      d.remarks || "",
      "",
      "",
      "",
      "",
      "",
    ].map(String));
  }

  const meta = `# Vessel,${esc(header.vessel_name)},IMO,${esc(header.imo)},Template,${TEMPLATE_ID} v${TEMPLATE_VERSION}\n`;
  return meta + rows.map((r) => r.map(esc).join(",")).join("\n");
}

export function buildJson(header: InspectionHeader, answers: AnswerMap) {
  return {
    template_id: TEMPLATE_ID,
    template_version: TEMPLATE_VERSION,
    inspection: header,
    exported_at: new Date().toISOString(),
    answers: Object.values(answers).map((a) => ({
      group_key: a.group_key,
      item_ref: a.item_ref,
      version: a.version,
      updated_at: a.updated_at,
      data: a.data,
    })),
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
