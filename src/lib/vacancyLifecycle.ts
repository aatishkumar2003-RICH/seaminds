// Scalable vacancy inventory queries (server-side paging, filters, exact counts) and
// the single frontend integration point for secure lifecycle actions.
// Lifecycle writes (delete, admin archive/restore) are PENDING until the reviewed
// database RPC `vacancy_lifecycle_action` is approved and applied. No client-side
// DELETE path exists anywhere; every cleanup control calls requestLifecycleAction().
import { supabase } from "@/integrations/supabase/client";
import { DAY_MS } from "@/lib/managerVacancies";

/**
 * Activation switches. Flip only after the reviewed backend is applied:
 * managerDelete/managerStatus/adminActions → vacancy_lifecycle_action RPC,
 * appCounts → vacancy_application_counts RPC, externalArchive → external_vacancies.archived_at.
 * While a switch is off, the matching column/RPC is never queried.
 */
export const LIFECYCLE_BACKEND = {
  managerDelete: true,
  managerStatus: true,
  adminActions: true,
  appCounts: true,
  externalArchive: true,
} as const;
export const PENDING_LABEL = "Pending secure backend activation";
export const PAGE_SIZE = 50;

export type VacancyKind = "direct" | "external";
export type LifecycleAction = "delete" | "archive" | "restore" | "filled" | "reopen";
export type LifecycleResult = {
  ok: boolean;
  affected?: number;
  affectedIds?: string[];
  /** Vacancies protected because seafarer applications are linked. */
  blockedIds?: string[];
  /** True while the secure backend is not yet activated (no write performed). */
  pending?: boolean;
  blocked?: { applications: number };
  reason?: string;
  message?: string;
};

/** Strict parser for the backend contract: ok, affected, affected_ids, blocked_ids, blocked_applications, reason. */
export const parseLifecycleResponse = (raw: unknown): LifecycleResult => {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const ids = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  const affectedIds = ids(d.affected_ids);
  const blockedIds = ids(d.blocked_ids);
  const affected = Number.isFinite(Number(d.affected)) ? Number(d.affected) : affectedIds.length;
  const apps = Number(d.blocked_applications ?? d.applications) || 0;
  const reason = d.reason != null ? String(d.reason) : undefined;
  const blocked = apps > 0 || blockedIds.length > 0 ? { applications: apps } : undefined;
  // Never report success unless the backend explicitly says ok: true.
  if (d.ok !== true) {
    return { ok: false, pending: false, affected, affectedIds, blockedIds, blocked, reason,
      message: blocked ? "Applications are linked to these vacancies, so they were not deleted." : (reason || "The action was not completed.") };
  }
  return { ok: true, affected, affectedIds, blockedIds, blocked, reason };
};

/** Human summary for a (possibly mixed) bulk result. */
export const summarizeLifecycle = (r: LifecycleResult, verb = "deleted"): string => {
  const n = r.affected ?? 0;
  const b = r.blockedIds?.length ?? 0;
  const head = `${n} vacanc${n === 1 ? "y" : "ies"} ${verb}`;
  return b ? `${head} · ${b} protected because seafarers have applied` : head;
};

export const pageRange = (page: number, size = PAGE_SIZE): [number, number] => {
  const p = Math.max(0, Math.floor(page));
  return [p * size, p * size + size - 1];
};

/** created_at cutoff for "at least N days old"; null = no age filter. */
export const ageCutoffIso = (minDays: number | null, now = Date.now()): string | null =>
  minDays == null || minDays < 0 ? null : new Date(now - minDays * DAY_MS).toISOString();

/** Safe ilike term for PostgREST or() filters (strips filter syntax characters). */
export const sanitizeSearch = (raw: string): string =>
  String(raw ?? "").replace(/[%,()*\\:"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);

export const searchOr = (term: string, cols: string[]): string | null => {
  const t = sanitizeSearch(term);
  return t ? cols.map((c) => `${c}.ilike.*${t}*`).join(",") : null;
};

export const totalPages = (total: number, size = PAGE_SIZE) => Math.max(1, Math.ceil(Math.max(0, total) / size));

// ---------------- manager inventory ----------------

export type ManagerPageQuery = { managerId: string; page: number; status: string; minAge: number | null; search: string; size?: number };

export const loadManagerVacancyPage = async <T = Record<string, unknown>>(q: ManagerPageQuery): Promise<{ rows: T[]; total: number }> => {
  const [from, to] = pageRange(q.page, q.size);
  let query = supabase.from("job_postings").select("*", { count: "exact" }).eq("manager_id", q.managerId);
  if (q.status && q.status !== "all") query = query.eq("status", q.status);
  const cut = ageCutoffIso(q.minAge);
  if (cut) query = query.lte("created_at", cut);
  const or = searchOr(q.search, ["rank_required", "vessel_type", "joining_port", "recruiter_name"]);
  if (or) query = query.or(or);
  const { data, count, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to);
  if (error) throw error;
  return { rows: (data || []) as T[], total: count ?? 0 };
};

export const MANAGER_STATUSES = ["active", "filled", "archived", "expired"] as const;

/** Exact per-status counts for the manager's whole inventory (head-only count queries). */
export const loadManagerStatusCounts = async (managerId: string): Promise<Record<string, number>> => {
  const all = [null, ...MANAGER_STATUSES] as const;
  const res = await Promise.all(all.map((s) => {
    let q = supabase.from("job_postings").select("id", { count: "exact", head: true }).eq("manager_id", managerId);
    if (s) q = q.eq("status", s);
    return q;
  }));
  const out: Record<string, number> = {};
  res.forEach((r, i) => { if (r.error) throw r.error; out[all[i] ?? "all"] = r.count ?? 0; });
  return out;
};

/**
 * Application counts for one page of vacancy ids via the vacancy_application_counts RPC.
 * Returns null (= unavailable) until activated, so RLS-hidden rows never show as a false zero.
 */
export const loadApplicationCounts = async (ids: string[]): Promise<Record<string, number> | null> => {
  if (!LIFECYCLE_BACKEND.appCounts) return null;
  if (!ids.length) return {};
  const { data, error } = await supabase.rpc("vacancy_application_counts" as never, { p_ids: ids } as never);
  if (error) return null;
  const out: Record<string, number> = {};
  ((data || []) as { job_posting_id?: string; vacancy_id?: string; applications?: number; count?: number }[]).forEach((r) => {
    const id = r.job_posting_id ?? r.vacancy_id;
    if (id) out[id] = Number(r.applications ?? r.count) || 0;
  });
  ids.forEach((id) => { if (!(id in out)) out[id] = 0; });
  return out;
};

/** Applies the manual-archive filter only once archived_at exists (never queried before activation). */
type Filterable = { is: (c: string, v: null) => unknown; not: (c: string, op: string, v: null) => unknown };
export const withoutArchivedExternal = <Q,>(q: Q): Q =>
  LIFECYCLE_BACKEND.externalArchive ? ((q as unknown as Filterable).is("archived_at", null) as Q) : q;
const onlyArchivedExternal = <Q,>(q: Q): Q => ((q as unknown as Filterable).not("archived_at", "is", null) as Q);

// ---------------- admin inventory ----------------

export type AdminPageQuery = {
  kind: VacancyKind; page: number; size?: number; company: string; rank: string; vessel: string;
  source: string; status: string; minAge: number | null;
};

export const loadAdminVacancyPage = async (q: AdminPageQuery): Promise<{ rows: Record<string, unknown>[]; total: number }> => {
  const [from, to] = pageRange(q.page, q.size);
  const cut = ageCutoffIso(q.minAge);
  const ilike = (v: string) => `%${sanitizeSearch(v)}%`;
  if (q.kind === "direct") {
    let query = supabase.from("job_postings")
      .select("id, company_name, recruiter_name, rank_required, vessel_type, source_type, status, created_at", { count: "exact" });
    if (sanitizeSearch(q.company)) query = query.or(searchOr(q.company, ["company_name", "recruiter_name"])!);
    if (sanitizeSearch(q.rank)) query = query.ilike("rank_required", ilike(q.rank));
    if (sanitizeSearch(q.vessel)) query = query.ilike("vessel_type", ilike(q.vessel));
    if (q.source) query = query.eq("source_type", q.source);
    if (q.status) query = query.eq("status", q.status);
    if (cut) query = query.lte("created_at", cut);
    const { data, count, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to);
    if (error) throw error;
    return { rows: (data || []) as Record<string, unknown>[], total: count ?? 0 };
  }
  let query = supabase.from("external_vacancies")
    .select(`id, company_name, rank_required, vessel_type, source, is_scam_flagged, is_verified, created_at, fetched_at, source_posted_at${LIFECYCLE_BACKEND.externalArchive ? ", archived_at" : ""}`, { count: "exact" });
  if (sanitizeSearch(q.company)) query = query.ilike("company_name", ilike(q.company));
  if (sanitizeSearch(q.rank)) query = query.ilike("rank_required", ilike(q.rank));
  if (sanitizeSearch(q.vessel)) query = query.ilike("vessel_type", ilike(q.vessel));
  if (q.source) query = query.eq("source", q.source);
  if (q.status === "scam_flagged") query = query.eq("is_scam_flagged", true);
  else if (q.status === "listed") { query = query.eq("is_scam_flagged", false); query = withoutArchivedExternal(query); }
  else if (q.status === "archived" && LIFECYCLE_BACKEND.externalArchive) query = onlyArchivedExternal(query);
  if (cut) query = query.lte("created_at", cut);
  const { data, count, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to);
  if (error) throw error;
  return { rows: (data || []) as unknown as Record<string, unknown>[], total: count ?? 0 };
};

// ---------------- secure lifecycle integration point ----------------

/**
 * The ONLY entry point for delete / admin lifecycle actions. Until the reviewed RPC
 * is live this returns `pending` and performs no write. When enabled it calls
 * vacancy_lifecycle_action, which must enforce ownership/admin, block deletion of
 * vacancies with applications (offering archive) and write the audit log.
 */
export const requestLifecycleAction = async (
  scope: "manager" | "admin",
  kind: VacancyKind,
  ids: string[],
  action: LifecycleAction,
): Promise<LifecycleResult> => {
  const enabled = scope === "manager"
    ? (action === "delete" ? LIFECYCLE_BACKEND.managerDelete : LIFECYCLE_BACKEND.managerStatus)
    : LIFECYCLE_BACKEND.adminActions;
  if (!enabled) return { ok: false, pending: true, message: PENDING_LABEL };
  if (!ids.length) return { ok: true, affected: 0 };
  const { data, error } = await supabase.rpc("vacancy_lifecycle_action" as never, { p_kind: kind, p_ids: ids, p_action: action } as never);
  if (error) return { ok: false, pending: false, message: error.message };
  return parseLifecycleResponse(data);
};
