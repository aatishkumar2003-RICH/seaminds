import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, RotateCcw, MessageCircle, Mail } from "lucide-react";
import { resolveNationality, manningStatus, STATUS_META, type ManningStatus } from "@/lib/crewManning";
import CrewDossierDrawer from "./CrewDossierDrawer";

const GOLD = "#D4AF37";
const CARD = "#112240";
const BORDER = "rgba(212,175,55,0.3)";
const QUICK_RANKS = ["Master", "Chief Officer", "2nd Officer", "3rd Officer", "Chief Engineer", "2nd Engineer", "3rd Engineer", "ETO", "Bosun", "AB", "Cook"];
const VESSELS = ["Bulk", "Tanker", "Container", "LNG", "LPG", "Offshore", "Ro-Ro", "General Cargo", "Passenger"];

const rankOf = (r: any) => String(r.rank || "").trim() || (r.role && r.role !== "Seafarer" ? r.role : "");
const rankMatch = (rank: string, q: string) => {
  const a = rank.toLowerCase(), b = q.toLowerCase();
  if (b === "master") return /master|captain/.test(a);
  if (b === "ab") return /\bab\b|able/.test(a);
  return a.includes(b);
};
const ago = (d?: string | null) => {
  if (!d) return "—";
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 15) return "Online now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} h ago`;
  return `${Math.floor(m / 1440)} d ago`;
};

const Pill = ({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) => (
  <button onClick={onClick} className="shrink-0 whitespace-nowrap px-3 py-1 rounded-lg text-xs font-bold transition-colors"
    style={active ? { background: color || GOLD, color: "#0D1B2A" } : { background: "transparent", color: color || GOLD, border: `1px solid ${color ? color + "66" : BORDER}` }}>
    {children}
  </button>
);

export default function CrewManningMatrix() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(() => new URLSearchParams(window.location.search).get("q") || "");
  const [rank, setRank] = useState("");
  const [nat, setNat] = useState("");
  const [vessel, setVessel] = useState("");
  const [status, setStatus] = useState<ManningStatus | "">("");
  const [activeToday, setActiveToday] = useState(false);
  const [open, setOpen] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const all: any[] = [];
    for (let from = 0; from < 20000; from += 1000) {
      const { data, error } = await supabase.from("crew_profiles")
        .select("id, first_name, last_name, email, rank, role, nationality, whatsapp_number, vessel_type, preferred_vessel_types, ship_name, is_available, availability_status, placed_until, available_from, crew_unique_id, last_seen, created_at, years_in_rank_band, total_sea_service_band, passport_number, date_of_birth, is_test" as any)
        .order("created_at", { ascending: false }).range(from, from + 999);
      if (error || !data?.length) break;
      all.push(...data);
      if (data.length < 1000) break;
    }
    setRows(all.map((r: any) => ({ ...r, _rank: rankOf(r), _nat: resolveNationality(r), _status: manningStatus(r) })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }, []);
  const base = useMemo(() => rows.filter((r) => !activeToday || (r.last_seen && new Date(r.last_seen).getTime() >= todayStart)), [rows, activeToday, todayStart]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return base.filter((r) => {
      if (s && ![r.first_name, r.last_name, `${r.first_name} ${r.last_name}`, r.email, r.whatsapp_number, r.crew_unique_id, r.passport_number, r.date_of_birth]
        .some((v) => String(v || "").toLowerCase().includes(s))) return false;
      if (rank && !rankMatch(r._rank, rank)) return false;
      if (nat && r._nat.name !== nat) return false;
      if (vessel && !`${r.vessel_type || ""} ${(r.preferred_vessel_types || []).join?.(" ") || ""}`.toLowerCase().includes(vessel.toLowerCase())) return false;
      if (status && r._status !== status) return false;
      return true;
    });
  }, [base, q, rank, nat, vessel, status]);

  // Nationality tabs auto-grow from data, counted within the other active filters
  const natCounts = useMemo(() => {
    const m = new Map<string, { flag: string; n: number }>();
    base.forEach((r) => { if (rank && !rankMatch(r._rank, rank)) return; if (status && r._status !== status) return;
      const k = r._nat.name; const e = m.get(k) || { flag: r._nat.flag, n: 0 }; e.n++; m.set(k, e); });
    return [...m.entries()].sort((a, b) => (a[0] === "Unknown" ? 1 : b[0] === "Unknown" ? -1 : b[1].n - a[1].n));
  }, [base, rank, status]);
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    base.forEach((r) => { if (rank && !rankMatch(r._rank, rank)) return; if (nat && r._nat.name !== nat) return; c[r._status] = (c[r._status] || 0) + 1; });
    return c;
  }, [base, rank, nat]);

  const reset = () => { setQ(""); setRank(""); setNat(""); setVessel(""); setStatus(""); setActiveToday(false); };
  const summary = [filtered.length, status ? STATUS_META[status].label : "", rank || "crew", nat ? `from ${nat}` : ""].filter(Boolean).join(" ");

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 space-y-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: GOLD }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, Crew ID, WhatsApp, email, passport…"
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none" style={{ background: "#0D1B2A", color: "#E0E0E0", border: `1px solid ${BORDER}` }} />
          </div>
          <Pill active={activeToday} onClick={() => setActiveToday((v) => !v)}>Active today</Pill>
          <button onClick={reset} className="flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-lg" style={{ color: GOLD, border: `1px solid ${BORDER}` }}>
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        </div>

        <Row label="⚓ Rank">
          <select value={QUICK_RANKS.includes(rank) ? rank : rank ? "__other" : ""} onChange={(e) => setRank(e.target.value === "__other" ? rank : e.target.value)}
            className="text-xs rounded-lg px-2 py-1" style={{ background: "#0D1B2A", color: GOLD, border: `1px solid ${BORDER}` }}>
            <option value="">All ranks</option>
            {QUICK_RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {QUICK_RANKS.map((r) => <Pill key={r} active={rank === r} onClick={() => setRank(rank === r ? "" : r)}>{r}</Pill>)}
        </Row>
        <Row label="🌍 Nationality">
          <Pill active={!nat} onClick={() => setNat("")}>All</Pill>
          {natCounts.map(([name, v]) => <Pill key={name} active={nat === name} onClick={() => setNat(nat === name ? "" : name)}>{v.flag} {name} ({v.n})</Pill>)}
        </Row>
        <Row label="🚢 Vessel">
          <Pill active={!vessel} onClick={() => setVessel("")}>All types</Pill>
          {VESSELS.map((v) => <Pill key={v} active={vessel === v} onClick={() => setVessel(vessel === v ? "" : v)}>{v}</Pill>)}
        </Row>
        <Row label="🟢 Status">
          <Pill active={!status} onClick={() => setStatus("")}>All</Pill>
          {(Object.keys(STATUS_META) as ManningStatus[]).map((s) => (
            <Pill key={s} color={STATUS_META[s].color} active={status === s} onClick={() => setStatus(status === s ? "" : s)}>
              ● {STATUS_META[s].label} ({statusCounts[s] || 0})
            </Pill>
          ))}
        </Row>
        <p className="text-xs pt-1" style={{ color: "#94A3B8", borderTop: `1px solid ${BORDER}` }}>
          📊 {loading ? "Loading crew…" : `Showing ${summary}`} · {rows.length} registered in total
        </p>
      </div>

      <div className="rounded-xl overflow-x-auto" style={{ border: `1px solid ${BORDER}` }}>
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr style={{ background: CARD }}>
              {["Crew member", "Rank", "Nationality", "Vessel experience", "Contact", "Status", "Last active", ""].map((h) => (
                <th key={h} className="text-left px-3 py-2 text-xs whitespace-nowrap" style={{ color: GOLD }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 300).map((r) => {
              const st = STATUS_META[r._status as ManningStatus];
              const wa = String(r.whatsapp_number || "").replace(/[^0-9]/g, "");
              return (
                <tr key={r.id} onClick={() => setOpen(r)} className="cursor-pointer hover:bg-white/5" style={{ borderTop: "1px solid #1e3a5f" }}>
                  <td className="px-3 py-2">
                    <p className="font-semibold" style={{ color: "#E0E0E0" }}>{`${r.first_name || ""} ${r.last_name || ""}`.trim() || r.email || "—"}</p>
                    <p className="text-[11px]" style={{ color: "#94A3B8" }}>{r.crew_unique_id || r.email || ""}</p>
                  </td>
                  <td className="px-3 py-2">{r._rank ? <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: "#D4AF3722", color: GOLD }}>{r._rank}</span> : <span style={{ color: "#64748B" }}>Not set</span>}</td>
                  <td className="px-3 py-2 whitespace-nowrap" style={{ color: "#E0E0E0" }} title={`Source: ${r._nat.source}`}>
                    {r._nat.flag} {r._nat.name}{r._nat.source === "phone" || r._nat.source === "email" ? <span className="text-[10px] ml-1" style={{ color: "#64748B" }}>(auto)</span> : null}
                  </td>
                  <td className="px-3 py-2 text-xs" style={{ color: "#CBD5E1" }}>
                    {r.vessel_type || "—"}
                    {r.total_sea_service_band ? <p className="text-[11px]" style={{ color: "#94A3B8" }}>{r.total_sea_service_band} yrs sea</p> : null}
                  </td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle className="w-4 h-4" style={{ color: "#22c55e" }} /></a>}
                      {r.email && <a href={`mailto:${r.email}`} aria-label="Email"><Mail className="w-4 h-4" style={{ color: GOLD }} /></a>}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs font-bold" style={{ color: st.color }}>● {st.label}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: ago(r.last_seen) === "Online now" ? "#22c55e" : "#94A3B8" }}>{ago(r.last_seen)}</td>
                  <td className="px-3 py-2"><span className="text-xs font-bold" style={{ color: GOLD }}>Open →</span></td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center" style={{ color: "#94A3B8" }}>No crew match these filters.</td></tr>
            )}
          </tbody>
        </table>
        {filtered.length > 300 && <p className="text-xs p-2 text-center" style={{ color: "#94A3B8" }}>Showing first 300 of {filtered.length}. Narrow with filters.</p>}
      </div>

      <CrewDossierDrawer crew={open} onClose={() => setOpen(null)} onSaved={load} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold w-24 shrink-0" style={{ color: "#94A3B8" }}>{label}</span>
      <div className="flex gap-1.5 overflow-x-auto md:flex-wrap pb-1 scrollbar-none">{children}</div>
    </div>
  );
}
