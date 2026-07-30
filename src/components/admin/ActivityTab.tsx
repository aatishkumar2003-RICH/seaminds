import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const NAVY = "#0D1B2A";
const GOLD = "#D4AF37";

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");

const Card = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-xl p-4 text-center" style={{ background: "#132236", border: `1px solid ${GOLD}33` }}>
    <div className="text-2xl font-bold" style={{ color: GOLD }}>{value}</div>
    <div className="text-xs text-gray-400 mt-1">{label}</div>
  </div>
);

const Table = ({ title, headers, rows }: { title: string; headers: string[]; rows: (string | number)[][] }) => (
  <div className="mb-8">
    <h3 className="text-sm font-bold mb-2" style={{ color: GOLD }}>{title} ({rows.length})</h3>
    <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${GOLD}33` }}>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ background: "#132236" }}>
            {headers.map((h) => (
              <th key={h} className="text-left px-3 py-2 whitespace-nowrap" style={{ color: GOLD }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={headers.length} className="px-3 py-4 text-center text-gray-500">No records</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: "1px solid #1e3a5f" }}>
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 text-gray-200 whitespace-nowrap">{c === "" || c === null || c === undefined ? "—" : c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default function ActivityTab() {
  const [crew, setCrew] = useState<any[]>([]);
  const [cvs, setCvs] = useState<any[]>([]);
  const [smc, setSmc] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [leadCount, setLeadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [c, cv, s, ev, l] = await Promise.all([
      supabase
        .from("crew_profiles")
        .select("id, user_id, first_name, last_name, role, rank, nationality, gender, vessel_type, ship_name, whatsapp_number, crew_unique_id, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("crew_cv_data").select("id, user_id, updated_at").order("updated_at", { ascending: false }).limit(500),
      supabase
        .from("smc_assessments")
        .select("id, crew_profile_id, overall_score, score_band, completed_at, started_at")
        .order("completed_at", { ascending: false, nullsFirst: false })
        .limit(500),
      supabase.from("app_events").select("event_type, created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("email_leads").select("id", { count: "exact", head: true }),
    ]);
    setCrew(c.data || []);
    setCvs(cv.data || []);
    setSmc(s.data || []);
    setEvents(ev.data || []);
    setLeadCount(l.count || 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const profileFor = (uid?: string | null, id?: string | null) =>
    crew.find((p) => (uid && (p.user_id === uid || p.id === uid)) || (id && p.id === id));

  const cvUserIds = new Set(cvs.map((c) => c.user_id).filter(Boolean));

  return (
    <div className="p-1" style={{ background: NAVY }}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-gray-500">{loading ? "Loading…" : "Auto-refreshes every 60s"}</span>
        <button onClick={load} className="text-xs px-3 py-1 rounded-md" style={{ border: `1px solid ${GOLD}`, color: GOLD }}>
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Card label="Total Crew" value={crew.length} />
        <Card label="CVs Built" value={cvs.length} />
        <Card label="SMC Assessments" value={smc.length} />
        <Card label="Email Leads" value={leadCount} />
      </div>

      <Table
        title="Crew"
        headers={["Name", "Rank", "Nationality", "Vessel Type", "Ship Name", "WhatsApp", "Has CV", "Joined"]}
        rows={crew.map((p) => [
          `${p.first_name || ""} ${p.last_name || ""}`.trim(),
          p.rank || p.role || "",
          p.nationality || "",
          p.vessel_type || "",
          p.ship_name || "",
          p.whatsapp_number || "",
          cvUserIds.has(p.user_id) || cvUserIds.has(p.id) ? "Yes" : "No",
          fmt(p.created_at),
        ])}
      />

      <Table
        title="CVs"
        headers={["CV ID", "Name", "Rank", "Nationality", "Gender", "Updated"]}
        rows={cvs.map((c) => {
          const p = profileFor(c.user_id);
          return [
            p?.crew_unique_id || c.id?.slice(0, 8) || "",
            p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() : "",
            p?.rank || p?.role || "",
            p?.nationality || "",
            p?.gender || "",
            fmt(c.updated_at),
          ];
        })}
      />

      <Table
        title="SMC Assessments"
        headers={["Name", "Rank", "Score", "Band", "Date"]}
        rows={smc.map((s) => {
          const p = profileFor(null, s.crew_profile_id);
          return [
            p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() : "",
            p?.rank || p?.role || "",
            s.overall_score ?? "",
            s.score_band || "",
            fmt(s.completed_at || s.started_at),
          ];
        })}
      />

      <Table
        title="App Events"
        headers={["Event Type", "When"]}
        rows={events.map((e) => [e.event_type || "", fmt(e.created_at)])}
      />
    </div>
  );
}
