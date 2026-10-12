// Scalable vacancy inventory queries (server-side paging, filters, exact counts) and
// the single frontend integration point for secure lifecycle actions.
// Lifecycle writes (delete, admin archive/restore) are PENDING until the reviewed
// database RPC `vacancy_lifecycle_action` is approved and applied. No client-side
// DELETE path exists anywhere; every cleanup control calls requestLifecycleAction().
import { supabase } from "@/integrations/supabase/client";
import { DAY_MS } from "@/lib/managerVacancies";

/** Flip only after the secure backend (application protection + audit log) is live. */
export const LIFECYCLE_BACKEND = { managerDelete: false, adminActions: false } as const;
export const PENDING_LABEL = "Pending secure backend activation";
export const PAGE_SIZE = 50;

export type VacancyKind = "direct" | "external";
export type LifecycleAction = "delete" | "archive" | "restore" | "filled" | "reopen";
export type LifecycleResult = {
  ok: boolean;
  affected?: number;
  /** True while the secure backend is not yet activated (no write performed). */
  pending?: boolean;
  blocked?: { applications: number };
  message?: string;
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

/** Application counts for one page of vacancy ids. */
export const loadApplicationCounts = async (ids: string[]): Promise<Record<string, number>> => {
  if (!ids.length) return {};
  const { data, error } = await supabase.from("job_applications").select("job_posting_id").in("job_posting_id", ids);
  if (error) throw error;
  const out: Record<string, number> = {};
  ((data || []) as { job_posting_id: string | null }[]).forEach((r) => { if (r.job_posting_id) out[r.job_posting_id] = (out[r.job_posting_id] || 0) + 1; });
  return out;
};

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
    .select("id, company_name, rank_required, vessel_type, source, is_scam_flagged, is_verified, created_at", { count: "exact" });
  if (sanitizeSearch(q.company)) query = query.ilike("company_name", ilike(q.company));
  if (sanitizeSearch(q.rank)) query = query.ilike("rank_required", ilike(q.rank));
  if (sanitizeSearch(q.vessel)) query = query.ilike("vessel_type", ilike(q.vessel));
  if (q.source) query = query.eq("source", q.source);
  if (q.status === "scam_flagged") query = query.eq("is_scam_flagged", true);
  else if (q.status === "listed") query = query.eq("is_scam_flagged", false);
  if (cut) query = query.lte("created_at", cut);
  const { data, count, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to);
  if (error) throw error;
  return { rows: (data || []) as Record<string, unknown>[], total: count ?? 0 };
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
  const enabled = scope === "manager" ? action === "delete" && LIFECYCLE_BACKEND.managerDelete : LIFECYCLE_BACKEND.adminActions;
  if (!enabled) return { ok: false, pending: true, message: PENDING_LABEL };
  if (!ids.length) return { ok: true, affected: 0 };
  const { data, error } = await supabase.rpc("vacancy_lifecycle_action" as never, { p_kind: kind, p_ids: ids, p_action: action } as never);
  if (error) return { ok: false, pending: false, message: error.message };
  const d = (data || {}) as { affected?: number; blocked_applications?: number; message?: string };
  if (d.blocked_applications && d.blocked_applications > 0) {
    return { ok: false, pending: false, blocked: { applications: d.blocked_applications }, message: d.message || "Applications are linked to these vacancies." };
  }
  return { ok: true, affected: d.affected ?? 0 };
};
