// Audit source selection for the admin cleanup history.
// Before V2 activation the vacancy_cleanup_audit table does not exist: never query it.
export const V2_AUDIT_COLUMNS =
  "id, actor_id, actor_scope, action, vacancy_kind, requested_ids, affected_ids, blocked_ids, affected_count, blocked_applications, filters, created_at";

export type AuditSource =
  | { table: "app_events"; columns: string }
  | { table: "vacancy_cleanup_audit"; columns: string };

export const auditSource = (adminActions: boolean): AuditSource => adminActions
  ? { table: "vacancy_cleanup_audit", columns: V2_AUDIT_COLUMNS }
  : { table: "app_events", columns: "id, message, created_at, metadata" };

export type AuditLine = { id: string; created_at: string; text: string };

/** Normalise either source into one display line using only real columns. */
export const toAuditLine = (adminActions: boolean, r: Record<string, any>): AuditLine => {
  if (!adminActions) return { id: String(r.id), created_at: r.created_at, text: `${r.message ?? ""} (${r.metadata?.scope ?? "—"})` };
  const blocked = Number(r.blocked_applications || 0);
  const blockedIds = Array.isArray(r.blocked_ids) ? r.blocked_ids.length : 0;
  return {
    id: String(r.id), created_at: r.created_at,
    text: `${r.actor_scope} · ${r.action} · ${r.vacancy_kind} · ${r.affected_count ?? 0} affected`
      + (blockedIds ? ` · ${blockedIds} blocked (${blocked} applications)` : ""),
  };
};

/** Remove only server-confirmed IDs from a displayed list. */
export const removeConfirmed = <T extends { id: string }>(list: T[], affectedIds: string[] | undefined): T[] => {
  const gone = new Set(affectedIds || []);
  return list.filter((j) => !gone.has(j.id));
};
