// Shared manager vacancy publishing service.
// PostVacancy (flier upload) and ManagerDashboard Paste-to-Post BOTH use this
// so publishing rules can never drift apart.

import { supabase } from "@/integrations/supabase/client";

export type SourceType = "manual" | "text" | "flier";

export type PreviewVacancy = {
  rank_required: string;
  vessel_type: string;
  contract_duration: string;
  monthly_salary: string;
  joining_port: string;
  joining_date: string;
  contact_whatsapp: string;
  contact_email: string;
  additional_notes: string;
  positions: number;
};

export type SimilarVacancy = {
  id: string;
  rank_required: string;
  vessel_type: string;
  joining_port: string;
  joining_date: string | null;
  monthly_salary: string | null;
  created_at: string;
};

export type PublishResult = {
  requested: number;
  published: number;
  duplicatesSkipped: number;
  failures: string[];
  batchId: string | null;
};

export type ManagerIdentity = {
  userId: string;
  companyName: string;
  approved: boolean;
};

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

/** Normalize any AI/manual row into a preview vacancy. Never invents values. */
export const toPreviewVacancy = (v: Record<string, unknown>): PreviewVacancy => {
  const p = Number(v.positions);
  return {
    rank_required: str(v.rank_required),
    vessel_type: str(v.vessel_type),
    contract_duration: str(v.contract_duration),
    monthly_salary: str(v.monthly_salary),
    joining_port: str(v.joining_port),
    joining_date: str(v.joining_date),
    contact_whatsapp: str(v.contact_whatsapp),
    contact_email: str(v.contact_email),
    additional_notes: str(v.additional_notes),
    positions: Number.isFinite(p) && p >= 1 ? Math.floor(p) : 1,
  };
};

export const emptyPreviewVacancy = (): PreviewVacancy => toPreviewVacancy({});

/** Fetch the signed-in approved manager's verified identity. */
export const loadManagerIdentity = async (): Promise<ManagerIdentity | null> => {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return null;
  const { data } = await supabase
    .from("manager_profiles")
    .select("company_name, admin_approved")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    userId,
    companyName: str((data as { company_name?: string }).company_name),
    approved: (data as { admin_approved?: boolean }).admin_approved === true,
  };
};

// ---------------- original flier storage ----------------

export const ACCEPTED_FLIER_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export type FlierUploadResult = { ok: true; url: string } | { ok: false; error: string };

/** Upload the ORIGINAL (unaltered) flier image to the public job-fliers bucket. Never swallows failures. */
export const uploadOriginalFlier = async (file: File, managerId: string): Promise<FlierUploadResult> => {
  if (!managerId) return { ok: false, error: "Manager identity not ready." };
  if (!ACCEPTED_FLIER_TYPES.includes(file.type.toLowerCase())) {
    return { ok: false, error: "Flyer must be a JPG, PNG or WEBP image." };
  }
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${managerId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("job-fliers").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return { ok: false, error: error.message };
  const url = supabase.storage.from("job-fliers").getPublicUrl(path).data.publicUrl || "";
  if (!url) return { ok: false, error: "Storage did not return a public URL." };
  return { ok: true, url };
};


// ---------------- contact validation ----------------

export type WhatsappCheck = { ok: boolean; warning: string | null };

/**
 * A WhatsApp number is publishable when it is empty, starts with "+",
 * starts with "00", or is explicit international digits not starting with 0.
 * A single domestic leading zero is never guessed into a country code.
 */
export const checkWhatsapp = (raw: string): WhatsappCheck => {
  const v = str(raw);
  if (!v) return { ok: true, warning: null };
  const compact = v.replace(/[\s()\-.]/g, "");
  const invalid = { ok: false, warning: "Enter a valid international number with country code (+XX)." } as const;
  const needsCode = { ok: false, warning: "Country code required — add +XX before publishing." } as const;

  // + international: 8-15 digits after the plus, first digit is not 0
  if (compact.startsWith("+")) {
    return /^\+[1-9][0-9]{7,14}$/.test(compact) ? { ok: true, warning: null } : { ...invalid };
  }
  // 00 international: 8-15 digits after 00, first digit is not 0
  if (compact.startsWith("00")) {
    return /^00[1-9][0-9]{7,14}$/.test(compact) ? { ok: true, warning: null } : { ...invalid };
  }
  // single domestic leading zero — never guessed into a country code
  if (compact.startsWith("0")) return { ...needsCode };
  // explicit international digits
  if (/^[1-9][0-9]{7,14}$/.test(compact)) return { ok: true, warning: null };
  return { ...needsCode };
};

// ---------------- joining date validation ----------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A joining date is publishable when empty or a real YYYY-MM-DD calendar date. */
export const isValidJoiningDate = (raw: string): boolean => {
  const v = str(raw);
  if (!v) return true;
  if (!ISO_DATE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

export const validateJoiningDates = (rows: PreviewVacancy[]): { ok: boolean; warnings: string[] } => {
  const warnings: string[] = [];
  rows.forEach((r, i) => {
    if (!isValidJoiningDate(r.joining_date)) {
      warnings.push(`Vacancy ${i + 1} (${r.rank_required || "rank"}): joining date must be YYYY-MM-DD or left blank.`);
    }
  });
  return { ok: warnings.length === 0, warnings };
};

export const validateContacts = (rows: PreviewVacancy[]): { ok: boolean; warnings: string[] } => {
  const warnings: string[] = [];
  rows.forEach((r, i) => {
    const c = checkWhatsapp(r.contact_whatsapp);
    if (!c.ok) warnings.push(`Vacancy ${i + 1} (${r.rank_required || "rank"}): ${c.warning}`);
  });
  return { ok: warnings.length === 0, warnings };
};

// ---------------- duplicate detection ----------------

const norm = (v: string | null | undefined) => str(v).toLowerCase();
/** NULL-safe equality — two empty values compare as equal. */
const sameField = (a: string | null | undefined, b: string | null | undefined) => norm(a) === norm(b);

type ActiveRow = {
  id: string;
  rank_required: string;
  vessel_type: string;
  joining_port: string;
  joining_date: string | null;
  contract_duration: string;
  monthly_salary: string | null;
  created_at: string;
};

const loadActivePostings = async (managerId: string): Promise<ActiveRow[]> => {
  const { data } = await supabase
    .from("job_postings")
    .select("id, rank_required, vessel_type, joining_port, joining_date, contract_duration, monthly_salary, created_at")
    .eq("manager_id", managerId)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString());
  return (data || []) as unknown as ActiveRow[];
};

const isExactDuplicate = (v: PreviewVacancy, r: ActiveRow) =>
  sameField(v.rank_required, r.rank_required) &&
  sameField(v.vessel_type, r.vessel_type) &&
  sameField(v.joining_port, r.joining_port) &&
  sameField(v.joining_date, r.joining_date) &&
  sameField(v.contract_duration, r.contract_duration) &&
  sameField(v.monthly_salary, r.monthly_salary);

const isSimilar = (v: PreviewVacancy, r: ActiveRow) =>
  sameField(v.rank_required, r.rank_required) &&
  sameField(v.vessel_type, r.vessel_type) &&
  sameField(v.joining_port, r.joining_port);

export type DuplicateScan = {
  toPublish: PreviewVacancy[];
  exactDuplicates: PreviewVacancy[];
  similar: SimilarVacancy[];
};

/** Split a batch into publishable rows, exact duplicates (skipped) and similar-but-different actives (warn only). */
export const scanDuplicates = async (managerId: string, rows: PreviewVacancy[]): Promise<DuplicateScan> => {
  const active = await loadActivePostings(managerId);
  const toPublish: PreviewVacancy[] = [];
  const exactDuplicates: PreviewVacancy[] = [];
  const similarMap = new Map<string, SimilarVacancy>();

  for (const v of rows) {
    if (active.some((r) => isExactDuplicate(v, r))) {
      exactDuplicates.push(v);
      continue;
    }
    toPublish.push(v);
    active.filter((r) => isSimilar(v, r)).forEach((r) =>
      similarMap.set(r.id, {
        id: r.id,
        rank_required: r.rank_required,
        vessel_type: r.vessel_type,
        joining_port: r.joining_port,
        joining_date: r.joining_date,
        monthly_salary: r.monthly_salary,
        created_at: r.created_at,
      }),
    );
  }

  return { toPublish, exactDuplicates, similar: [...similarMap.values()] };
};

// ---------------- publishing ----------------

const toRow = (
  v: PreviewVacancy,
  identity: ManagerIdentity,
  sourceType: SourceType,
  batchId: string,
  expiresAt: string,
  flierUrl?: string | null,
) => {
  const hasSalary = v.monthly_salary.length > 0;
  // Notes carry ONLY what the manager / source actually wrote. Never invented
  // salary wording, never a copy of the structured contact_email.
  const notes = v.additional_notes || null;

  return {
    rank_required: v.rank_required || "Not specified",
    vessel_type: v.vessel_type || "Not specified",
    contract_duration: v.contract_duration || "Not specified",
    monthly_salary: hasSalary ? v.monthly_salary : null,
    joining_port: v.joining_port || "Not specified",
    joining_date: isValidJoiningDate(v.joining_date) && v.joining_date ? v.joining_date : null,
    positions: v.positions >= 1 ? v.positions : 1,
    contact_whatsapp: v.contact_whatsapp || "",
    contact_email: v.contact_email || null,
    additional_notes: notes,
    // verified company identity — never a typed company name
    company_name: identity.companyName,
    manager_id: identity.userId,
    status: "active",
    plan: "founding",
    source_type: sourceType,
    posting_batch_id: batchId,
    expires_at: expiresAt,
    flier_url: flierUrl || null,
  };
};

/**
 * Publish a batch. One posting_batch_id for the whole action, 14-day expiry,
 * exact duplicates skipped, real errors returned.
 */
export const publishVacancyBatch = async (
  rows: PreviewVacancy[],
  identity: ManagerIdentity,
  sourceType: SourceType,
  opts?: { skipDuplicateScan?: boolean; flierUrl?: string | null },
): Promise<PublishResult> => {
  const requested = rows.length;
  if (requested === 0) return { requested: 0, published: 0, duplicatesSkipped: 0, failures: [], batchId: null };
  if (!identity.approved) {
    return { requested, published: 0, duplicatesSkipped: 0, failures: ["Your company account is pending approval"], batchId: null };
  }

  const dateCheck = validateJoiningDates(rows);
  if (!dateCheck.ok) {
    return { requested, published: 0, duplicatesSkipped: 0, failures: dateCheck.warnings, batchId: null };
  }

  let toPublish = rows;
  let duplicatesSkipped = 0;
  if (!opts?.skipDuplicateScan) {
    const scan = await scanDuplicates(identity.userId, rows);
    toPublish = scan.toPublish;
    duplicatesSkipped = scan.exactDuplicates.length;
  }

  if (toPublish.length === 0) {
    return { requested, published: 0, duplicatesSkipped, failures: [], batchId: null };
  }

  const batchId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const payload = toPublish.map((v) => toRow(v, identity, sourceType, batchId, expiresAt, opts?.flierUrl));

  const { data, error } = await supabase.from("job_postings").insert(payload as never).select("id");
  if (error) {
    return { requested, published: 0, duplicatesSkipped, failures: [error.message], batchId };
  }
  return { requested, published: (data || []).length, duplicatesSkipped, failures: [], batchId };
};

export const publishSummary = (r: PublishResult): string => {
  const parts = [`${r.published} of ${r.requested} vacancies published`];
  if (r.duplicatesSkipped > 0) parts.push(`${r.duplicatesSkipped} exact duplicate${r.duplicatesSkipped > 1 ? "s" : ""} skipped`);
  return parts.join(" · ");
};
