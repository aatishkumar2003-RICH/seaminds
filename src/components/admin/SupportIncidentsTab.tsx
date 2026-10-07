import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Incident {
  id: string; incident_ref: string; category: string; component: string; operation: string; error_signature: string;
  severity: string; status: string; total_reports: number; first_seen_at: string; last_seen_at: string;
  last_escalated_at: string | null; resolved_by_version: string | null;
}
interface Ticket {
  id: string; ticket_ref: string; category: string; status: string; subject: string; description: string;
  contact_email: string | null; contact_whatsapp: string | null; route_pathname: string | null;
  incident_id: string | null; assessment_start_incident_id: string | null; user_id: string | null; created_at: string;
}

const GOLD = "#D4AF37";
const card = { background: "#112240", border: "1px solid rgba(212,175,55,0.3)" };

export default function SupportIncidentsTab({ onOpenAssessmentOps }: { onOpenAssessmentOps: () => void }) {
  const [view, setView] = useState<"incidents" | "tickets">("incidents");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("open");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Incident | null>(null);
  // deno-lint-ignore no-explicit-any
  const [bundle, setBundle] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [inc, tk] = await Promise.all([
      supabase.from("support_incidents").select("id, incident_ref, category, component, operation, error_signature, severity, status, total_reports, first_seen_at, last_seen_at, last_escalated_at, resolved_by_version").order("last_seen_at", { ascending: false }).limit(200),
      supabase.from("support_tickets").select("id, ticket_ref, category, status, subject, description, contact_email, contact_whatsapp, route_pathname, incident_id, assessment_start_incident_id, user_id, created_at").order("created_at", { ascending: false }).limit(300),
    ]);
    if (inc.error || tk.error) toast.error("Could not load support data");
    setIncidents((inc.data as Incident[]) ?? []);
    setTickets((tk.data as Ticket[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openBundle = async (i: Incident) => {
    setSelected(i);
    setBundle(null);
    const { data, error } = await supabase.rpc("admin_get_incident_diagnostic_bundle", { p_incident_id: i.id });
    if (error) { toast.error("Could not load diagnostic bundle"); return; }
    setBundle(data);
  };

  const setStatus = async (entity: "INCIDENT" | "TICKET", id: string, status: string) => {
    let version: string | null = null;
    if (entity === "INCIDENT" && status === "RESOLVED") {
      const v = window.prompt("Resolved in build/version (optional):", "");
      if (v === null) return;
      version = v.trim().slice(0, 64) || null;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_support_set_status", { p_entity: entity, p_id: id, p_status: status, p_resolved_by_version: version });
    setBusy(false);
    // deno-lint-ignore no-explicit-any
    const res = data as any;
    if (error || !res?.ok) { toast.error(`Status change failed${res?.error ? `: ${res.error}` : ""}`); return; }
    toast.success(`${res.ref}: ${res.old_status} → ${res.new_status}`);
    await load();
    if (selected && entity === "INCIDENT") {
      const { data: fresh } = await supabase.from("support_incidents").select("*").eq("id", selected.id).maybeSingle();
      if (fresh) openBundle(fresh as Incident);
    }
  };

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${label} copied`); } catch { toast.error("Could not copy"); }
  };

  const lovablePrompt = () =>
    `SeaMinds support incident ${selected?.incident_ref}.\n\nSTAY IN CHAT MODE. DO NOT BUILD, MIGRATE, DEPLOY OR PUBLISH.\n\n` +
    `1. Diagnose this incident in Chat only, using the sanitized diagnostic bundle below and read-only checks.\n` +
    `2. Identify the permanent root cause (not a one-off workaround).\n` +
    `3. Propose the exact smallest permanent fix and a test plan.\n` +
    `4. STOP and wait for Atish's explicit approval before any Build.\n\nDiagnostic bundle:\n${JSON.stringify(bundle, null, 2)}`;

  const dayAgo = Date.now() - 864e5;
  const summary = useMemo(() => ({
    open: incidents.filter((i) => i.status !== "RESOLVED").length,
    p0p1: incidents.filter((i) => i.status !== "RESOLVED" && (i.severity === "P0_CRITICAL" || i.severity === "P1_DEGRADED")).length,
    new24: tickets.filter((t) => new Date(t.created_at).getTime() > dayAgo).length,
    unlinked: tickets.filter((t) => !t.incident_id && !["RESOLVED", "CLOSED"].includes(t.status)).length,
  }), [incidents, tickets, dayAgo]);

  const q = search.trim().toLowerCase();
  const fIncidents = incidents.filter((i) =>
    (statusFilter === "all" || (statusFilter === "open" ? i.status !== "RESOLVED" : i.status === statusFilter)) &&
    (!q || `${i.incident_ref} ${i.category} ${i.component} ${i.operation} ${i.error_signature}`.toLowerCase().includes(q)));
  const fTickets = tickets.filter((t) =>
    (statusFilter === "all" || (statusFilter === "open" ? !["RESOLVED", "CLOSED"].includes(t.status) : t.status === statusFilter)) &&
    (!q || `${t.ticket_ref} ${t.subject} ${t.category}`.toLowerCase().includes(q)));

  const statusOptions = view === "incidents"
    ? ["DETECTED", "DIAGNOSED", "PROPOSED_FIX", "RESOLVED"]
    : ["RECEIVED", "LINKED_INCIDENT", "RESPONDED", "RESOLVED", "CLOSED"];
  const incRef = (id: string | null) => incidents.find((i) => i.id === id)?.incident_ref;
  const hasLinkedStart = Array.isArray(bundle?.linked_start_incidents) && bundle.linked_start_incidents.length > 0;

  const sevColor = (s: string) => (s === "P0_CRITICAL" ? "#ef4444" : s === "P1_DEGRADED" ? "#f59e0b" : "#94A3B8");

  return (
    <div className="mt-4 space-y-4 text-white">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Open incidents", summary.open], ["Active P0/P1", summary.p0p1], ["New tickets 24h", summary.new24], ["Unlinked open tickets", summary.unlinked]].map(([l, v]) => (
          <div key={l as string} className="rounded-xl p-3" style={card}>
            <div className="text-2xl font-bold" style={{ color: GOLD }}>{v}</div>
            <div className="text-xs" style={{ color: "#94A3B8" }}>{l}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["incidents", "tickets"] as const).map((v) => (
          <Button key={v} size="sm" onClick={() => { setView(v); setStatusFilter("open"); }}
            style={view === v ? { background: GOLD, color: "#0D1B2A" } : { background: "transparent", color: GOLD, border: `1px solid ${GOLD}` }}>
            {v === "incidents" ? "Incidents" : "Tickets"}
          </Button>
        ))}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="all">All</SelectItem>
            {statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input className="h-9 w-48" placeholder="Search ref / text" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</Button>
      </div>

      {view === "incidents" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            {fIncidents.length === 0 && <p className="text-sm" style={{ color: "#94A3B8" }}>No incidents.</p>}
            {fIncidents.map((i) => (
              <button key={i.id} onClick={() => openBundle(i)} className="w-full rounded-xl p-3 text-left"
                style={{ ...card, outline: selected?.id === i.id ? `2px solid ${GOLD}` : "none" }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs" style={{ color: GOLD }}>{i.incident_ref}</span>
                  <div className="flex gap-1">
                    <Badge style={{ background: sevColor(i.severity), color: "#0D1B2A" }}>{i.severity}</Badge>
                    <Badge variant="outline" className="text-white">{i.status}</Badge>
                  </div>
                </div>
                <div className="mt-1 text-sm">{i.category} / {i.component} / {i.operation} / {i.error_signature}</div>
                <div className="mt-1 text-[11px]" style={{ color: "#94A3B8" }}>
                  {i.total_reports} reports · last {new Date(i.last_seen_at).toLocaleString()}
                  {i.status === "RESOLVED" && i.resolved_by_version ? ` · fixed in ${i.resolved_by_version}` : ""}
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-xl p-3" style={card}>
            {!selected ? (
              <p className="text-sm" style={{ color: "#94A3B8" }}>Select an incident to see its diagnostic bundle.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm" style={{ color: GOLD }}>{selected.incident_ref}</span>
                  <div className="flex flex-wrap gap-1">
                    {["DIAGNOSED", "PROPOSED_FIX", "RESOLVED"].map((s) => (
                      <Button key={s} size="sm" variant="outline" disabled={busy || selected.status === s} onClick={() => setStatus("INCIDENT", selected.id, s)}>{s}</Button>
                    ))}
                  </div>
                </div>
                {selected.status === "RESOLVED" && (
                  <p className="text-[11px]" style={{ color: "#f59e0b" }}>
                    Resolved incidents are not reopened automatically. Last report: {new Date(selected.last_seen_at).toLocaleString()} · total {selected.total_reports}.
                  </p>
                )}
                {hasLinkedStart && (
                  <div className="flex items-center justify-between gap-2 rounded-lg p-2" style={{ border: "1px solid rgba(245,158,11,0.5)" }}>
                    <span className="text-xs">Linked to assessment start incidents.</span>
                    <Button size="sm" onClick={onOpenAssessmentOps} style={{ background: GOLD, color: "#0D1B2A" }}>Open Assessment Ops</Button>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={!bundle} onClick={() => copy(JSON.stringify(bundle, null, 2), "Diagnostic JSON")} style={{ background: GOLD, color: "#0D1B2A" }}>Copy Diagnostic JSON</Button>
                  <Button size="sm" variant="outline" disabled={!bundle} onClick={() => copy(lovablePrompt(), "Lovable Chat prompt")}>Copy Lovable Chat Prompt</Button>
                </div>
                <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg p-2 text-[11px]" style={{ background: "#0D1B2A" }}>
                  {bundle ? JSON.stringify(bundle, null, 2) : "Loading…"}
                </pre>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {fTickets.length === 0 && <p className="text-sm" style={{ color: "#94A3B8" }}>No tickets.</p>}
          {fTickets.map((t) => (
            <div key={t.id} className="space-y-1 rounded-xl p-3" style={card}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs" style={{ color: GOLD }}>{t.ticket_ref}</span>
                <div className="flex flex-wrap items-center gap-1">
                  <Badge variant="outline" className="text-white">{t.status}</Badge>
                  {["RESPONDED", "RESOLVED", "CLOSED"].map((s) => (
                    <Button key={s} size="sm" variant="outline" disabled={busy || t.status === s} onClick={() => setStatus("TICKET", t.id, s)}>{s}</Button>
                  ))}
                </div>
              </div>
              <div className="text-sm font-semibold">{t.subject}</div>
              <p className="whitespace-pre-wrap text-xs" style={{ color: "#cbd5e1" }}>{t.description}</p>
              <div className="text-[11px]" style={{ color: "#94A3B8" }}>
                {t.category} · {t.route_pathname || "—"} · {new Date(t.created_at).toLocaleString()} · {t.user_id ? "signed-in" : "anonymous"}
                {t.contact_email ? ` · ${t.contact_email}` : ""}{t.contact_whatsapp ? ` · ${t.contact_whatsapp}` : ""}
                {t.incident_id ? ` · incident ${incRef(t.incident_id) ?? "linked"}` : " · unlinked"}
                {t.assessment_start_incident_id ? " · assessment start incident linked" : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
