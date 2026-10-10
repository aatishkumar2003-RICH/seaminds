import { supabase } from "@/integrations/supabase/client";
import { formatSalaryText } from "@/lib/salary";

/** One vacancy shape shared by every SeaMinds surface (feed, home, jobs, homepage). */
export interface UnifiedVacancy {
  id: string;
  kind: "direct" | "external";
  rank: string;
  vessel: string | null;
  port: string | null;
  joiningDate: string | null;
  contractDuration: string | null;
  salaryText: string | null;
  company: string;
  /** Who published the listing on SeaMinds (may differ from the hiring company). */
  publisherName: string | null;
  verified: boolean;
  qualityScore: number | null;
  postedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
  email: string | null;
  whatsapp: string | null;
  applyUrl: string | null;
  positions: number;
  flierUrl: string | null;
  postingBatchId: string | null;
  source: string | null;
  isNew: boolean;
}

const DAY = 24 * 3600 * 1000;
const isNewSince = (iso: string | null) =>
  !!iso && Date.now() - new Date(iso).getTime() < DAY;

/** Display salary for a unified vacancy — shared formatter, never duplicated. */
export const vacancySalary = (v: UnifiedVacancy, suffix = "/month") =>
  formatSalaryText(v.salaryText, suffix);

const mapDirect = (r: Record<string, any>): UnifiedVacancy => ({
  id: String(r.id),
  kind: "direct",
  rank: r.rank_required || "Crew",
  vessel: r.vessel_type || null,
  port: r.joining_port || null,
  joiningDate: r.joining_date || null,
  contractDuration: r.contract_duration || null,
  salaryText: r.monthly_salary ?? null,
  company: r.recruiter_name
    || (/^seaminds/i.test(String(r.company_name || "")) ? "Agency shown on flyer" : (r.company_name || "Maritime Company")),
  publisherName: r.company_name || null,
  verified: !!r.verified,
  qualityScore: null,
  postedAt: r.created_at || null,
  expiresAt: r.expires_at || null,
  notes: r.additional_notes || null,
  email: r.contact_email || null,
  whatsapp: r.contact_whatsapp || null,
  applyUrl: null,
  positions: Number(r.positions) > 0 ? Number(r.positions) : 1,
  flierUrl: r.flier_url || null,
  postingBatchId: r.posting_batch_id || null,
  source: "seaminds",
  isNew: isNewSince(r.created_at || null),
});

const mapExternal = (r: Record<string, any>): UnifiedVacancy => ({
  id: String(r.id),
  kind: "external",
  rank: r.rank_required || r.title || "Crew",
  vessel: r.vessel_type || null,
  port: r.joining_port || null,
  joiningDate: r.joining_date || null,
  contractDuration: r.contract_duration || null,
  salaryText: r.salary_text ?? null,
  company: r.company_name || "Maritime Company",
  publisherName: null,
  verified: r.is_verified === undefined || r.is_verified === null ? false : !!r.is_verified,
  qualityScore: r.quality_score ?? null,
  postedAt: r.created_at || null,
  expiresAt: r.expires_at || null,
  notes: r.description || null,
  email: r.contact_email || null,
  whatsapp: r.contact_whatsapp || null,
  applyUrl: r.apply_url || r.company_website || null,
  positions: 1,
  flierUrl: null,
  postingBatchId: null,
  source: r.source || null,
  isNew: isNewSince(r.created_at || null),
});

export interface LoadVacanciesOpts {
  limitDirect?: number;
  limitExternal?: number;
  minQuality?: number;
}

/** Loads live direct + external vacancies, merged and sorted newest first. */
export const loadVacancies = async (opts: LoadVacanciesOpts = {}): Promise<UnifiedVacancy[]> => {
  const nowIso = new Date().toISOString();

  let extQuery = supabase
    .from("external_vacancies")
    .select(
      "id, title, rank_required, vessel_type, joining_port, joining_date, contract_duration, salary_text, company_name, company_website, is_verified, quality_score, created_at, expires_at, description, contact_email, contact_whatsapp, apply_url, source"
    )
    .eq("is_scam_flagged", false)
    .gt("expires_at", nowIso);
  if (opts.minQuality !== undefined) extQuery = extQuery.gte("quality_score", opts.minQuality);

  const [directRes, extRes] = await Promise.all([
    supabase
      .from("job_postings")
      .select(
        "id, rank_required, vessel_type, joining_port, joining_date, contract_duration, monthly_salary, company_name, verified, created_at, expires_at, additional_notes, contact_email, contact_whatsapp, positions, flier_url, posting_batch_id, recruiter_name"
      )
      .eq("status", "active")
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(opts.limitDirect ?? 20),
    extQuery.order("created_at", { ascending: false }).limit(opts.limitExternal ?? 50),
  ]);

  const rows = [
    ...(((directRes.data as any[]) || []).map(mapDirect)),
    ...(((extRes.data as any[]) || []).map(mapExternal)),
  ];
  return rows.sort(
    (a, b) => new Date(b.postedAt || 0).getTime() - new Date(a.postedAt || 0).getTime()
  );
};

// ---------------------------------------------------------------- recruiter-email delivery state

/** Vacancy ids whose recruiter email was accepted by the provider (own applications only). */
const deliveredTargets = new Set<string>();
export const isEmailDelivered = (id: string) => deliveredTargets.has(id);
export const markEmailDelivered = (id: string) => { deliveredTargets.add(id); };

/** Refreshes delivery state from the server; best-effort, never throws. */
export const loadMyEmailDelivery = async (): Promise<Set<string>> => {
  try {
    const { data } = await supabase.functions.invoke("notify-application", { body: { kind: "delivery_status" } });
    const list = (data as { emailed?: unknown[] } | null)?.emailed;
    if (Array.isArray(list)) {
      deliveredTargets.clear();
      list.forEach((id) => deliveredTargets.add(String(id)));
    }
  } catch { /* keep last known state */ }
  return new Set(deliveredTargets);
};

/** Vacancy/job-posting ids the signed-in crew has already applied to (also refreshes delivery state). */
export const loadMyApplicationTargets = async (): Promise<Set<string>> => {
  const out = new Set<string>();
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return out;
    const [{ data }] = await Promise.all([
      supabase.from("job_applications").select("vacancy_id, job_posting_id").eq("crew_id", uid),
      loadMyEmailDelivery(),
    ]);
    ((data as any[]) || []).forEach((r) => {
      if (r.vacancy_id) out.add(String(r.vacancy_id));
      if (r.job_posting_id) out.add(String(r.job_posting_id));
    });
  } catch {
    /* applied state is best-effort — never block the feed */
  }
  return out;
};

/** Runs cb when the crew returns to the app (tab visible / window focus), throttled. Returns cleanup. */
export const onAppResume = (cb: () => void, minGapMs = 3000) => {
  if (typeof document === "undefined") return () => {};
  let last = 0;
  const fire = () => {
    if (document.visibilityState !== "visible") return;
    const now = Date.now();
    if (now - last < minGapMs) return;
    last = now;
    cb();
  };
  document.addEventListener("visibilitychange", fire);
  window.addEventListener("focus", fire);
  window.addEventListener("pageshow", fire);
  return () => {
    document.removeEventListener("visibilitychange", fire);
    window.removeEventListener("focus", fire);
    window.removeEventListener("pageshow", fire);
  };
};

// ---------------------------------------------------------------- stale joining dates

const ONGOING_RE = /\b(asap|urgent|immediate(ly)?|prompt|ongoing|continuous|rolling|open|tba|tbc|any ?time)\b/i;
const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

/**
 * Parses a joining date only when it is unambiguous. Returns null for ASAP/URGENT/ongoing,
 * ambiguous (e.g. 03/04/2025) or unreadable text — those are never treated as stale.
 */
export const parseJoiningDate = (raw: string | null | undefined): Date | null => {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s || ONGOING_RE.test(s)) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s\-./]+([a-z]{3,9})\.?[\s\-./,]+(\d{4})\b/i);
  if (m && MONTHS[m[2].slice(0, 4).toLowerCase()] ?? MONTHS[m?.[2]?.slice(0, 3).toLowerCase() ?? ""]) {
    const mo = MONTHS[m[2].slice(0, 4).toLowerCase()] ?? MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo !== undefined) return new Date(Date.UTC(+m[3], mo, +m[1]));
  }
  m = s.match(/^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 4).toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo !== undefined) return new Date(Date.UTC(+m[3], mo, +m[2]));
  }
  m = s.match(/^([a-z]{3,9})\.?[\s,-]+(\d{4})$/i);
  if (m) {
    const mo = MONTHS[m[1].slice(0, 4).toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mo !== undefined) return new Date(Date.UTC(+m[2], mo + 1, 0)); // end of that month
  }
  return null;
};

export const STALE_JOINING_DAYS = 90;

/** True only when the joining date is reliably parsed and more than `days` in the past. */
export const isStaleJoiningDate = (raw: string | null | undefined, now = new Date(), days = STALE_JOINING_DAYS) => {
  const d = parseJoiningDate(raw);
  return !!d && now.getTime() - d.getTime() > days * DAY;
};

// ---------------------------------------------------------------- stable pagination

export interface SourceKey { createdAt: string; id: string }
export interface VacancyCursor {
  direct: SourceKey | null;
  external: SourceKey | null;
  directDone: boolean;
  externalDone: boolean;
}
export const START_CURSOR: VacancyCursor = { direct: null, external: null, directDone: false, externalDone: false };

/** Deterministic order: newest first, id as tiebreaker. */
export const compareVacancy = (a: UnifiedVacancy, b: UnifiedVacancy) => {
  const t = new Date(b.postedAt || 0).getTime() - new Date(a.postedAt || 0).getTime();
  if (t !== 0) return t;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
};

/**
 * Merges one fetched batch from each source into a page. `fetched` rows must be ordered
 * by compareVacancy and come from beyond the current cursor. Pure — no I/O.
 */
export const mergeVacancyPage = (
  direct: UnifiedVacancy[],
  external: UnifiedVacancy[],
  limit: number,
  cursor: VacancyCursor,
  now = new Date(),
): { items: UnifiedVacancy[]; cursor: VacancyCursor; done: boolean } => {
  const merged = [...direct, ...external].sort(compareVacancy).slice(0, limit);
  const lastOf = (kind: "direct" | "external") => {
    const rows = merged.filter((v) => v.kind === kind);
    const l = rows[rows.length - 1];
    return l ? { createdAt: l.postedAt || "", id: l.id } : null;
  };
  const usedD = merged.filter((v) => v.kind === "direct").length;
  const usedE = merged.length - usedD;
  const next: VacancyCursor = {
    direct: lastOf("direct") || cursor.direct,
    external: lastOf("external") || cursor.external,
    // A source is done once a short batch has been fully consumed.
    directDone: cursor.directDone || (direct.length < limit && usedD === direct.length),
    externalDone: cursor.externalDone || (external.length < limit && usedE === external.length),
  };
  const items = merged.filter((v) => v.kind !== "external" || !isStaleJoiningDate(v.joiningDate, now));
  return { items, cursor: next, done: next.directDone && next.externalDone };
};

const DIRECT_COLS =
  "id, rank_required, vessel_type, joining_port, joining_date, contract_duration, monthly_salary, company_name, verified, created_at, expires_at, additional_notes, contact_email, contact_whatsapp, positions, flier_url, posting_batch_id, recruiter_name";
const EXTERNAL_COLS =
  "id, title, rank_required, vessel_type, joining_port, joining_date, contract_duration, salary_text, company_name, company_website, is_verified, quality_score, created_at, expires_at, description, contact_email, contact_whatsapp, apply_url, source";

const afterKey = (k: SourceKey) => `created_at.lt.${k.createdAt},and(created_at.eq.${k.createdAt},id.lt.${k.id})`;

/** Fetches the next page of live vacancies from both sources with keyset pagination. */
export const loadVacancyPage = async (
  cursor: VacancyCursor = START_CURSOR,
  opts: { pageSize?: number; minQuality?: number } = {},
): Promise<{ items: UnifiedVacancy[]; cursor: VacancyCursor; done: boolean }> => {
  const limit = opts.pageSize ?? 20;
  const nowIso = new Date().toISOString();
  const cutoff = new Date(Date.now() - STALE_JOINING_DAYS * DAY).toISOString().slice(0, 10);

  const fetchDirect = async () => {
    if (cursor.directDone) return [] as UnifiedVacancy[];
    let q = supabase.from("job_postings").select(DIRECT_COLS)
      .eq("status", "active").gt("expires_at", nowIso)
      .or(`joining_date.is.null,joining_date.gte.${cutoff}`);
    if (cursor.direct) q = q.or(afterKey(cursor.direct));
    const { data, error } = await q.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit);
    if (error) throw error;
    return ((data as any[]) || []).map(mapDirect);
  };
  const fetchExternal = async () => {
    if (cursor.externalDone) return [] as UnifiedVacancy[];
    let q = supabase.from("external_vacancies").select(EXTERNAL_COLS)
      .eq("is_scam_flagged", false).gt("expires_at", nowIso);
    if (opts.minQuality !== undefined) q = q.gte("quality_score", opts.minQuality);
    if (cursor.external) q = q.or(afterKey(cursor.external));
    const { data, error } = await q.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit);
    if (error) throw error;
    return ((data as any[]) || []).map(mapExternal);
  };

  const [d, e] = await Promise.all([fetchDirect(), fetchExternal()]);
  return mergeVacancyPage(d, e, limit, cursor);
};
