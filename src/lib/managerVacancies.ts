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
  /** Hiring/recruiting agency named on the advert (optional). */
  recruiter_name: string;
  // ---- Stage 2 per-row provenance (optional so legacy callers keep working) ----
  /** Stable client-side id of the staged source (flyer or pasted message). */
  source_id?: string;
  /** Per-row source type; overrides the batch-level sourceType when set. */
  source_type?: SourceType;
  /** Per-row original flyer URL; overrides the batch-level flierUrl when set. */
  flier_url?: string | null;
  /** Explicit manager classification. Undefined = legacy caller (previous behaviour). */
  ownership?: Ownership;
  /** Extraction risk level for the source. */
  risk_level?: "low" | "medium" | "high";
};

export type Ownership = "own" | "third_party";

export type SimilarVacancy = {
  id: string;
  rank_required: string;
  vessel_type: string;
  joining_port: string;
  joining_date: string | null;
  monthly_salary: string | null;
  created_at: string;
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
    recruiter_name: str(v.recruiter_name ?? v.recruiter_company).replace(/^seaminds.*$/i, ""),
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

const norm = (v: string | null | undefined) => str(v).toLowerCase().replace(/\s+/g, " ");
/** NULL-safe equality — two empty values compare as equal. */
const sameField = (a: string | null | undefined, b: string | null | undefined) => norm(a) === norm(b);
const digits = (v: string | null | undefined) => str(v).replace(/\D/g, "").replace(/^00/, "");
const samePhone = (a: string | null | undefined, b: string | null | undefined) => digits(a) === digits(b);
const samePositions = (a: unknown, b: unknown) => (Number(a) >= 1 ? Math.floor(Number(a)) : 1) === (Number(b) >= 1 ? Math.floor(Number(b)) : 1);

export type ActiveRow = {
  id: string;
  rank_required: string;
  vessel_type: string;
  joining_port: string;
  joining_date: string | null;
  contract_duration: string;
  monthly_salary: string | null;
  positions?: number | null;
  recruiter_name?: string | null;
  contact_whatsapp?: string | null;
  contact_email?: string | null;
  created_at: string;
};

/** Manager-scoped: only the signed-in manager's own active postings (RLS/visibility). Not a global check. */
const loadActivePostings = async (managerId: string): Promise<ActiveRow[]> => {
  const { data } = await supabase
    .from("job_postings")
    .select("id, rank_required, vessel_type, joining_port, joining_date, contract_duration, monthly_salary, positions, recruiter_name, contact_whatsapp, contact_email, created_at")
    .eq("manager_id", managerId)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString());
  return (data || []) as unknown as ActiveRow[];
};

/** Recruiter actually stored for a row (own vacancy → publisher company). */
export const effectiveRecruiter = (v: PreviewVacancy, companyName?: string): string =>
  v.ownership === "own" ? str(companyName) : str(v.recruiter_name);

/**
 * Exact duplicate: same recruiter, rank, vessel, port, date, contract, salary,
 * positions and contacts. Legacy rows with NULL recruiter never exactly match a
 * row that names a recruiter (conservative: similar warning only).
 */
export const isExactDuplicate = (v: PreviewVacancy, r: ActiveRow, companyName?: string): boolean =>
  sameField(effectiveRecruiter(v, companyName), r.recruiter_name) &&
  sameField(v.rank_required, r.rank_required) &&
  sameField(v.vessel_type, r.vessel_type) &&
  sameField(v.joining_port, r.joining_port) &&
  sameField(v.joining_date, r.joining_date) &&
  sameField(v.contract_duration, r.contract_duration) &&
  sameField(v.monthly_salary, r.monthly_salary) &&
  (r.positions === undefined || samePositions(v.positions, r.positions)) &&
  (r.contact_whatsapp === undefined || samePhone(v.contact_whatsapp, r.contact_whatsapp)) &&
  (r.contact_email === undefined || sameField(v.contact_email, r.contact_email));

/** Similar = same rank, vessel and port (any recruiter). Warning only — never skipped. */
export const isSimilar = (v: PreviewVacancy, r: ActiveRow) =>
  sameField(v.rank_required, r.rank_required) &&
  sameField(v.vessel_type, r.vessel_type) &&
  sameField(v.joining_port, r.joining_port);

const asActive = (v: PreviewVacancy, companyName?: string, id = ""): ActiveRow => ({
  id,
  rank_required: v.rank_required,
  vessel_type: v.vessel_type,
  joining_port: v.joining_port,
  joining_date: v.joining_date || null,
  contract_duration: v.contract_duration,
  monthly_salary: v.monthly_salary || null,
  positions: v.positions,
  recruiter_name: effectiveRecruiter(v, companyName) || null,
  contact_whatsapp: v.contact_whatsapp,
  contact_email: v.contact_email,
  created_at: "",
});

/** Indices of rows that exactly repeat an earlier row in the same session (first one is kept). */
export const findIntraBatchDuplicates = (rows: PreviewVacancy[], companyName?: string): number[] => {
  const dupes: number[] = [];
  rows.forEach((v, i) => {
    for (let j = 0; j < i; j++) {
      if (dupes.includes(j)) continue;
      if (isExactDuplicate(v, asActive(rows[j], companyName), companyName)) { dupes.push(i); return; }
    }
  });
  return dupes;
};

export type DuplicateScan = {
  toPublish: PreviewVacancy[];
  /** Exact duplicates of the manager's active postings (skipped). */
  exactDuplicates: PreviewVacancy[];
  /** Exact repeats inside this session (skipped; first occurrence kept). */
  intraBatchDuplicates: PreviewVacancy[];
  /** Similar-but-different active postings (warning only). */
  similar: SimilarVacancy[];
  /** Always "manager": only the signed-in manager's postings are compared. */
  scope: "manager";
};

/** Pure classification — testable without the network. */
export const classifyDuplicates = (rows: PreviewVacancy[], active: ActiveRow[], companyName?: string): DuplicateScan => {
  const intra = new Set(findIntraBatchDuplicates(rows, companyName));
  const toPublish: PreviewVacancy[] = [];
  const exactDuplicates: PreviewVacancy[] = [];
  const intraBatchDuplicates: PreviewVacancy[] = [];
  const similarMap = new Map<string, SimilarVacancy>();

  rows.forEach((v, i) => {
    if (intra.has(i)) { intraBatchDuplicates.push(v); return; }
    if (active.some((r) => isExactDuplicate(v, r, companyName))) { exactDuplicates.push(v); return; }
    toPublish.push(v);
    active.filter((r) => isSimilar(v, r)).forEach((r) =>
      similarMap.set(r.id, {
        id: r.id, rank_required: r.rank_required, vessel_type: r.vessel_type, joining_port: r.joining_port,
        joining_date: r.joining_date, monthly_salary: r.monthly_salary, created_at: r.created_at,
      }),
    );
  });
  return { toPublish, exactDuplicates, intraBatchDuplicates, similar: [...similarMap.values()], scope: "manager" };
};

/** Split a batch into publishable rows, exact duplicates (skipped) and similar actives (warn only). */
export const scanDuplicates = async (managerId: string, rows: PreviewVacancy[], companyName?: string): Promise<DuplicateScan> =>
  classifyDuplicates(rows, await loadActivePostings(managerId), companyName);

// ---------------- ownership / attribution ----------------

/**
 * Third-party adverts need a distinct recruiter identity and a usable contact,
 * otherwise publication is blocked for manual resolution (never routed to SeaMinds admin).
 */
export const validateAttribution = (rows: PreviewVacancy[], companyName: string): { ok: boolean; warnings: string[] } => {
  const warnings: string[] = [];
  rows.forEach((r, i) => {
    if (r.ownership !== "third_party") return;
    const label = `Vacancy ${i + 1} (${r.rank_required || "rank"})`;
    const rec = norm(r.recruiter_name);
    if (!rec || rec === norm(companyName) || /^seaminds/.test(rec)) {
      warnings.push(`${label}: enter the recruiting agency's own name before publishing.`);
    } else if (!str(r.contact_whatsapp) && !str(r.contact_email)) {
      warnings.push(`${label}: add the recruiter's WhatsApp or email so applicants reach them.`);
    }
  });
  return { ok: warnings.length === 0, warnings };
};

// ---------------- expiry ----------------

export const EXPIRY_OPTIONS = [30, 45, 60] as const;
export type ExpiryDays = (typeof EXPIRY_OPTIONS)[number];
export const DEFAULT_EXPIRY_DAYS: ExpiryDays = 30;

export const computeExpiresAt = (days: number = DEFAULT_EXPIRY_DAYS, now: number = Date.now()): string => {
  const d = (EXPIRY_OPTIONS as readonly number[]).includes(days) ? days : DEFAULT_EXPIRY_DAYS;
  return new Date(now + d * 24 * 60 * 60 * 1000).toISOString();
};

// ---------------- publishing ----------------

export const toRow = (
  v: PreviewVacancy,
  identity: ManagerIdentity,
  sourceType: SourceType,
  batchId: string,
  expiresAt: string,
  flierUrl?: string | null,
) => {
  const hasSalary = v.monthly_salary.length > 0;
  // Notes carry ONLY what the manager / source actually wrote.
  const notes = v.additional_notes || null;
  // own → recruiter_name = verified company; third_party → distinct agency; legacy → unchanged.
  const recruiter = v.ownership === "own" ? identity.companyName : (v.recruiter_name || null);
  const rowSource = v.source_type ?? sourceType;
  // Per-row flyer only; a text row never inherits a flyer from another source.
  const rowFlier = v.flier_url !== undefined ? v.flier_url : (v.source_type && v.source_type !== "flier" ? null : flierUrl);

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
    recruiter_name: recruiter,
    manager_id: identity.userId,
    status: "active",
    plan: "founding",
    source_type: rowSource,
    posting_batch_id: batchId,
    expires_at: expiresAt,
    flier_url: rowFlier || null,
  };
};

export type PublishStatus = "published" | "failed" | "uncertain" | "nothing" | "blocked";

export type PublishResult = {
  requested: number;
  published: number;
  duplicatesSkipped: number;
  failures: string[];
  batchId: string | null;
  /** "uncertain" = network outcome unknown; reconcile before any retry. */
  status?: PublishStatus;
};

/** Batches whose insert outcome is unknown. Retrying them requires reconciliation first. */
const uncertainBatches = new Map<string, number>();
export const _resetUncertainBatches = () => uncertainBatches.clear();
export const isBatchUncertain = (batchId: string) => uncertainBatches.has(batchId);

/** A PostgREST error carries a code; a missing code/abort/fetch failure means the outcome is unknown. */
const isAmbiguousError = (e: { code?: string; message?: string; name?: string } | null | undefined) =>
  !!e && (!e.code || /abort|timeout|failed to fetch|network|load failed/i.test(`${e.name || ""} ${e.message || ""}`));

export type ReconcileResult = {
  state: "complete" | "partial" | "absent" | "error";
  committed: number;
  expected: number;
  message: string;
};

/**
 * Count the manager's rows for a batch. "absent" is NOT proof the original insert
 * will never land — the batch stays flagged uncertain until a deliberate retry.
 */
export const reconcileBatch = async (batchId: string, managerId: string, expected: number): Promise<ReconcileResult> => {
  const { data, error } = await supabase
    .from("job_postings")
    .select("id")
    .eq("posting_batch_id", batchId)
    .eq("manager_id", managerId);
  if (error) return { state: "error", committed: 0, expected, message: "Could not check the batch yet. Try checking again." };
  const committed = (data || []).length;
  if (committed >= expected && expected > 0) {
    uncertainBatches.delete(batchId);
    return { state: "complete", committed, expected, message: `All ${committed} vacancies were published.` };
  }
  if (committed > 0) {
    uncertainBatches.delete(batchId);
    return { state: "partial", committed, expected, message: `${committed} of ${expected} found. Do not resubmit — review My Posts.` };
  }
  return {
    state: "absent", committed: 0, expected,
    message: "No vacancies found yet. The original request may still finish — check again before retrying.",
  };
};

/**
 * Publish a batch as ONE atomic INSERT. Stable posting_batch_id per attempt,
 * explicit expiry (default 30 days), exact/intra-batch duplicates skipped.
 * After an ambiguous network failure the batch is "uncertain": a retry with the
 * same batchId first reconciles and never resubmits rows that already exist.
 * Client-side checks are not database-level idempotency.
 */
export const publishVacancyBatch = async (
  rows: PreviewVacancy[],
  identity: ManagerIdentity,
  sourceType: SourceType,
  opts?: {
    skipDuplicateScan?: boolean;
    flierUrl?: string | null;
    expiryDays?: ExpiryDays;
    /** Reuse a batch id (retry after reconciliation). */
    batchId?: string;
    timeoutMs?: number;
  },
): Promise<PublishResult> => {
  const requested = rows.length;
  const base = { requested, published: 0, duplicatesSkipped: 0 };
  if (requested === 0) return { ...base, failures: [], batchId: null, status: "nothing" };
  if (!identity.approved) {
    return { ...base, failures: ["Your company account is pending approval"], batchId: null, status: "blocked" };
  }

  const missingFlier = rows.some((r) => (r.source_type ?? sourceType) === "flier" && !(r.flier_url !== undefined ? r.flier_url : opts?.flierUrl));
  if (missingFlier) {
    return { ...base, failures: ["Original flyer is missing — upload the flyer again before publishing."], batchId: null, status: "blocked" };
  }

  const checks = [validateJoiningDates(rows), validateAttribution(rows, identity.companyName)];
  const warnings = checks.flatMap((c) => c.warnings);
  if (warnings.length) return { ...base, failures: warnings, batchId: null, status: "blocked" };

  // Retry of an uncertain batch: reconcile first, never blind-resubmit.
  if (opts?.batchId && uncertainBatches.has(opts.batchId)) {
    const rec = await reconcileBatch(opts.batchId, identity.userId, uncertainBatches.get(opts.batchId) || requested);
    if (rec.state === "complete" || rec.state === "partial") {
      return { ...base, published: rec.committed, failures: rec.state === "partial" ? [rec.message] : [], batchId: opts.batchId, status: "published" };
    }
    if (rec.state === "error") return { ...base, failures: [rec.message], batchId: opts.batchId, status: "uncertain" };
  }

  let toPublish = rows;
  let duplicatesSkipped = 0;
  if (!opts?.skipDuplicateScan) {
    const scan = await scanDuplicates(identity.userId, rows, identity.companyName);
    toPublish = scan.toPublish;
    duplicatesSkipped = scan.exactDuplicates.length + scan.intraBatchDuplicates.length;
  }
  if (toPublish.length === 0) return { ...base, duplicatesSkipped, failures: [], batchId: null, status: "nothing" };

  const batchId = opts?.batchId || crypto.randomUUID();
  const expiresAt = computeExpiresAt(opts?.expiryDays ?? DEFAULT_EXPIRY_DAYS);
  const payload = toPublish.map((v) => toRow(v, identity, sourceType, batchId, expiresAt, opts?.flierUrl));

  let data: { id: string }[] | null = null;
  let error: { code?: string; message?: string; name?: string } | null = null;
  try {
    let q = supabase.from("job_postings").insert(payload as never).select("id");
    const ms = opts?.timeoutMs ?? 30000;
    if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal && typeof (q as { abortSignal?: unknown }).abortSignal === "function") {
      q = (q as unknown as { abortSignal: (s: AbortSignal) => typeof q }).abortSignal(AbortSignal.timeout(ms));
    }
    const res = await q;
    data = (res.data as { id: string }[] | null) ?? null;
    error = res.error as typeof error;
  } catch (e) {
    error = { name: (e as Error)?.name, message: (e as Error)?.message || "Network error" };
  }

  if (error) {
    if (isAmbiguousError(error)) {
      uncertainBatches.set(batchId, payload.length);
      return {
        ...base, duplicatesSkipped, batchId, status: "uncertain",
        failures: ["Connection lost — we can't confirm whether the vacancies were published. Check the batch before retrying."],
      };
    }
    return { ...base, duplicatesSkipped, failures: [error.message || "Publish failed"], batchId, status: "failed" };
  }
  uncertainBatches.delete(batchId);
  return { ...base, published: (data || []).length, duplicatesSkipped, failures: [], batchId, status: "published" };
};

export const publishSummary = (r: PublishResult): string => {
  if (r.status === "uncertain") return "Publication not confirmed — check the batch before retrying";
  const parts = [`${r.published} of ${r.requested} vacancies published`];
  if (r.duplicatesSkipped > 0) parts.push(`${r.duplicatesSkipped} exact duplicate${r.duplicatesSkipped > 1 ? "s" : ""} skipped`);
  return parts.join(" · ");
};
