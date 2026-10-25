import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buildRadar, radarCounts, type RadarCrew, type RadarStatus } from "@/lib/certRadar";

const LABEL: Record<RadarStatus, string> = { expired: "Expired", critical: "Under 30 days", warning: "30–90 days", valid: "Valid", no_expiry: "No expiry date" };
const TONE: Record<RadarStatus, string> = {
  expired: "border-destructive/60 text-destructive", critical: "border-destructive/40 text-destructive",
  warning: "border-primary/60 text-primary", valid: "border-border text-muted-foreground", no_expiry: "border-border text-muted-foreground",
};

export default function CertificateRadarTab() {
  const [crew, setCrew] = useState<RadarCrew[] | null>(null);
  const [filter, setFilter] = useState<RadarStatus | "attention" | "all">("attention");
  const [vessel, setVessel] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.rpc("crew_desk_certificate_radar" as any).then(({ data, error }) => {
      if (error) { toast.error("Could not load certificate radar."); setCrew([]); return; }
      setCrew((data as any) || []);
    });
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const rows = useMemo(() => buildRadar(crew || [], today), [crew, today]);
  const counts = radarCounts(rows);
  const vessels = Array.from(new Set(rows.map(r => r.crew.vessel || "Unassigned"))).sort();
  const shown = rows.filter(r =>
    (filter === "all" || (filter === "attention" ? ["expired", "critical", "warning"].includes(r.status) || r.expiresMidContract : r.status === filter)) &&
    (!vessel || (r.crew.vessel || "Unassigned") === vessel) &&
    (!q || `${r.crew.crew_name} ${r.name} ${r.crew.rank}`.toLowerCase().includes(q.toLowerCase())));

  if (!crew) return <p className="text-sm text-muted-foreground">Loading certificate radar…</p>;
  if (!crew.length) return <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Certificates appear here once crew confirm a joining with you. Only crew who have confirmed are shown.</p>;

  const tiles: [RadarStatus, number][] = [["expired", counts.expired], ["critical", counts.critical], ["warning", counts.warning], ["valid", counts.valid], ["no_expiry", counts.no_expiry]];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {tiles.map(([s, n]) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-xl border bg-card p-3 text-left ${TONE[s]} ${filter === s ? "ring-1 ring-primary" : ""}`}>
            <p className="text-2xl font-bold">{n}</p><p className="text-xs">{LABEL[s]}</p>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-center rounded-xl border border-border bg-card p-3">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search crew, rank or certificate" className="flex-1 min-w-[200px] rounded-lg border border-border bg-background px-3 min-h-[40px] text-sm text-foreground" />
        <select value={vessel} onChange={e => setVessel(e.target.value)} className="rounded-lg border border-border bg-background px-2 min-h-[40px] text-sm text-foreground">
          <option value="">All vessels</option>{vessels.map(v => <option key={v}>{v}</option>)}
        </select>
        <select value={filter} onChange={e => setFilter(e.target.value as any)} className="rounded-lg border border-border bg-background px-2 min-h-[40px] text-sm text-foreground">
          <option value="attention">Needs attention</option><option value="all">All certificates</option>
          {Object.entries(LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      {!shown.length ? <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Nothing to show for this filter.</p> : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-secondary text-xs text-muted-foreground"><tr>
              <th className="text-left p-2">Crew</th><th className="text-left p-2">Vessel</th><th className="text-left p-2">Certificate</th><th className="text-left p-2">Expiry</th><th className="text-left p-2">Status</th>
            </tr></thead>
            <tbody>{shown.map((r, i) => (
              <tr key={i} className="border-t border-border">
                <td className="p-2"><p className="font-semibold text-foreground">{r.crew.crew_name || "Crew"}</p><p className="text-[11px] text-muted-foreground">{r.crew.rank}</p></td>
                <td className="p-2 text-muted-foreground">{r.crew.vessel || "—"}</td>
                <td className="p-2 text-foreground">{r.name}{r.number && <span className="block text-[11px] text-muted-foreground">{r.number}</span>}</td>
                <td className="p-2 whitespace-nowrap">{r.expiry ? r.expiry.slice(0, 10) : "—"}{r.daysLeft !== null && <span className="block text-[11px] text-muted-foreground">{r.daysLeft < 0 ? `${-r.daysLeft} days ago` : `${r.daysLeft} days left`}</span>}</td>
                <td className="p-2">
                  <span className={`text-[11px] rounded-full border px-2 py-0.5 whitespace-nowrap ${TONE[r.status]}`}>{LABEL[r.status]}</span>
                  {r.expiresMidContract && <span className="mt-1 flex items-center gap-1 text-[11px] text-primary"><AlertTriangle size={11} /> Expires before contract ends</span>}
                </td>
              </tr>))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Dates come from the crew member's own CV. Always check the original certificate before joining.</p>
    </div>
  );
}
