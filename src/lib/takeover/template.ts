import raw from "@/data/takeover/takeover-template-v1.json";

/**
 * Typed access to the checked-in takeover inspection template.
 * The JSON is the exact extracted source workbook data — no abbreviation.
 * Formula strings (e.g. "=IF(...)") are reference material only, never executed.
 */

export type GroupKey = "master" | "spares" | "safety" | "certificates";

export interface RawItem {
  source_row: number;
  ref: string;
  cells: Record<string, string>;
}

interface RawGroup {
  sheet: string;
  headers: Record<string, string>;
  item_count: number;
  items: RawItem[];
}

const SHEET_TO_KEY: Record<string, GroupKey> = {
  "Master Checklist": "master",
  "Critical Spares": "spares",
  "Safety & Emergency": "safety",
  "Certificates & Records": "certificates",
};

export const GROUP_LABELS: Record<GroupKey, string> = {
  master: "Master",
  spares: "Spares",
  safety: "Safety",
  certificates: "Certificates",
};

const groups = (raw as any).groups as RawGroup[];

const byKey = (key: GroupKey): RawGroup =>
  groups.find((g) => SHEET_TO_KEY[g.sheet] === key)!;

export const TEMPLATE_ID: string = (raw as any).id;
export const TEMPLATE_VERSION: number = (raw as any).version;
export const TEMPLATE_NAME: string = (raw as any).name;
export const TEMPLATE_NOTES: string = (raw as any).notes;
export const TEMPLATE_SOURCE_FILE: string = (raw as any).source_file;
export const TEMPLATE_SHA256: string = (raw as any).source_sha256;
export const TEMPLATE_REFERENCES: Record<string, string>[] = (raw as any).references || [];
export const PHOTO_LOG_HEADERS: Record<string, string> = (raw as any).photo_log_headers || {};

export const headersFor = (key: GroupKey) => byKey(key).headers;

/** A formula string is source reference material, not a computed result. */
export const isFormula = (v?: string | null) => typeof v === "string" && v.trim().startsWith("=");
const clean = (v?: string) => (v == null || v === "" ? undefined : v);

// ---------- Master ----------
export interface MasterItem {
  key: string;
  ref: string;
  sourceRow: number;
  section: string;
  item: string;
  detailedTest?: string;
  acceptance?: string;
  evidence?: string;
  photoRequired: boolean;
  criticality?: string;
}

export const MASTER_ITEMS: MasterItem[] = byKey("master").items.map((i) => ({
  key: i.ref,
  ref: i.ref,
  sourceRow: i.source_row,
  section: i.cells.B || "Unsectioned",
  item: i.cells.C || "",
  detailedTest: clean(i.cells.D),
  acceptance: clean(i.cells.E),
  evidence: clean(i.cells.F),
  photoRequired: (i.cells.G || "").trim().toUpperCase() === "Y",
  criticality: clean(i.cells.J),
}));

export const MASTER_SECTIONS: string[] = MASTER_ITEMS.reduce<string[]>((acc, i) => {
  if (!acc.includes(i.section)) acc.push(i.section);
  return acc;
}, []);

// ---------- Critical Spares ----------
export interface SpareItem {
  key: string;
  ref: string;
  sourceRow: number;
  system: string;
  spare: string;
  note?: string;
  /** Template recommendation — requires vessel-specific confirmation. */
  recommendedMinimum?: string;
  alternativeMitigation?: string;
  shortfallFormula?: string;
  criticality?: string;
}

export const SPARE_ITEMS: SpareItem[] = byKey("spares").items.map((i) => ({
  key: i.ref,
  ref: i.ref,
  sourceRow: i.source_row,
  system: i.cells.B || "",
  spare: i.cells.C || "",
  note: clean(i.cells.D),
  recommendedMinimum: clean(i.cells.E),
  alternativeMitigation: clean(i.cells.F),
  shortfallFormula: clean(i.cells.I),
  criticality: clean(i.cells.J),
}));

// ---------- Safety & Emergency ----------
export interface SafetyItem {
  key: string;
  ref: string;
  sourceRow: number;
  equipment: string;
  statutorySource?: string;
  check?: string;
  takeoverMinimum?: string;
  shortfallFormula?: string;
}

export const SAFETY_ITEMS: SafetyItem[] = byKey("safety").items.map((i) => ({
  key: i.ref,
  ref: i.ref,
  sourceRow: i.source_row,
  equipment: i.cells.B || "",
  statutorySource: clean(i.cells.C),
  check: clean(i.cells.D),
  takeoverMinimum: clean(i.cells.E),
  shortfallFormula: clean(i.cells.I),
}));

// ---------- Certificates & Records ----------
export interface CertItem {
  key: string;
  ref: string;
  sourceRow: number;
  certificate: string;
  check?: string;
}

export const CERT_ITEMS: CertItem[] = byKey("certificates").items.map((i) => ({
  key: i.ref,
  ref: i.ref,
  sourceRow: i.source_row,
  certificate: i.cells.B || "",
  check: clean(i.cells.C),
}));

export const GROUP_COUNTS: Record<GroupKey, number> = {
  master: MASTER_ITEMS.length,
  spares: SPARE_ITEMS.length,
  safety: SAFETY_ITEMS.length,
  certificates: CERT_ITEMS.length,
};

export const TOTAL_ITEMS =
  GROUP_COUNTS.master + GROUP_COUNTS.spares + GROUP_COUNTS.safety + GROUP_COUNTS.certificates;

export const groupItemRefs = (key: GroupKey): string[] => {
  switch (key) {
    case "master":
      return MASTER_ITEMS.map((i) => i.ref);
    case "spares":
      return SPARE_ITEMS.map((i) => i.ref);
    case "safety":
      return SAFETY_ITEMS.map((i) => i.ref);
    default:
      return CERT_ITEMS.map((i) => i.ref);
  }
};
