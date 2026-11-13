import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Copy, Loader2, Mail, MessageCircle, Search } from "lucide-react";

const GOLD = "#D4AF37", NAVY = "#0D1B2A", CARD = "#112240", BORDER = "#1e3a5f";
type Invite = { id: string; token: string; campaign: string; status: string; score: number | null; created_at: string; completed_at: string | null };
type Person = { key: string; name: string; rank: string | null; nationality: string | null; email: string | null; whatsapp: string | null; invites_count: number; last_at: string; best_score: number | null; status: string; shortlisted: boolean; invites: Invite[] };
const STATUS: [string, string][] = [["all", "All"], ["completed", "✅ Completed"], ["in_progress", "⏳ In progress"], ["invited", "✉️ Not started"], ["shortlisted", "⭐ Shortlisted"]];
const ST: Record<string, [string, string]> = { completed: ["Completed", "#22c55e"], in_progress: ["In progress", "#38bdf8"], invited: ["Not started", "#f59e0b"] };
const label = (s: string) => ST[s]?.[0] || (s || "").replace(/_/g, " ");
const d = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short" }) : "";

/** One card per candidate across every interview sent — repeat invites fold into a single history. */
export default function InterviewPeopleBoard({ linkFor, company, onOpenCampaign }: { linkFor: (t: string) => string; company: string; onOpenCampaign: () => void }) {
  const [q, setQ] = useState(""); const [dq, setDq] = useState(""); const [rank, setRank] = useState(""); const [status, setStatus] = useState("all");
  const [off, setOff] = useState(0); const [res, setRes] = useState<any>(null); const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setOff(0); }, 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    let alive = true;
    const go = async () => { const { data } = await supabase.rpc("manager_interview_people" as any, { p_search: dq, p_rank: rank, p_status: status, p_offset: off }); if (alive) setRes((data as any)?.ok ? data : { rows: [], total: 0, counts: {}, ranks: [] }); };
    void go(); const i = setInterval(() => document.visibilityState === "visible" && void go(), 30000);
    return () => { alive = false; clearInterval(i); };
  }, [dq, rank, status, off]);
  const rows: Person[] = res?.rows || []; const total = res?.total || 0;
  const msg = (p: Person, inv: Invite) => `Hello ${p.name || ""}, ${company || "our company"} invites you to a free AI interview on SeaMinds (${inv.campaign}). Open your personal link: ${linkFor(inv.token)}`;
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: 11, color: "#94a3b8" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, WhatsApp, nationality" style={{ ...field, paddingLeft: 28, width: "100%" }} />
        </div>
        <select value={rank} onChange={(e) => { setRank(e.target.value); setOff(0); }} aria-label="Filter by rank" style={{ ...field, minWidth: 140 }}>
          <option value="">All ranks</option>{(res?.ranks || []).map((r: string) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {STATUS.map(([k, l]) => <button key={k} onClick={() => { setStatus(k); setOff(0); }} style={chip(status === k)}>{l} ({res?.counts?.[k] ?? 0})</button>)}
      </div>
      {!res ? <p style={muted}><Loader2 size={13} className="inline animate-spin" /> Loading candidates…</p>
        : rows.length === 0 ? <p style={muted}>No candidates match. Clear the filters or open “By interview” to send new links.</p>
        : <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {rows.map((p) => {
            const st = ST[p.status] || ["", "#94a3b8"]; const isOpen = open === p.key;
            return (
              <div key={p.key} style={{ background: NAVY, border: `1px solid ${isOpen ? GOLD : BORDER}`, borderRadius: 11 }}>
                <button onClick={() => setOpen(isOpen ? null : p.key)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", color: "#fff", padding: 10, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {isOpen ? <ChevronDown size={14} color={GOLD} /> : <ChevronRight size={14} color={GOLD} />}
                    <span style={{ fontWeight: 800, fontSize: 13, flex: 1 }}>{p.shortlisted ? "⭐ " : ""}{p.name} <span style={{ color: "#94a3b8", fontWeight: 600 }}>· {p.rank || "—"}{p.nationality ? ` · ${p.nationality}` : ""}</span></span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: st[1] }}>{label(p.status)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5, fontSize: 11, paddingLeft: 20 }}>
                    <span style={pill}>📁 {p.invites_count} invite{p.invites_count === 1 ? "" : "s"}</span>
                    {p.best_score != null && <span style={pill}>Best {Number(p.best_score).toFixed(2)} / 5.00</span>}
                    <span style={{ color: "#94a3b8" }}>Last sent {d(p.last_at)}</span>
                  </div>
                </button>
                {isOpen && <div style={{ borderTop: `1px solid ${BORDER}`, padding: "6px 10px 10px" }}>
                  {p.invites.map((inv, i) => (
                    <div key={inv.id} style={{ padding: "7px 0", borderBottom: i < p.invites.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                      <div style={{ display: "flex", gap: 6, fontSize: 12, color: "#fff" }}>
                        <span style={{ flex: 1 }}>{p.invites.length - i}. {inv.campaign}</span>
                        <span style={{ color: ST[inv.status]?.[1] || "#94a3b8", fontWeight: 700 }}>{label(inv.status)}{inv.score != null ? ` · ${Number(inv.score).toFixed(2)}` : ""}</span>
                      </div>
                      <p style={{ fontSize: 10.5, color: "#94a3b8" }}>Sent {d(inv.created_at)}{inv.completed_at ? ` · finished ${d(inv.completed_at)}` : ""}</p>
                      <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                        <button style={act} onClick={() => navigator.clipboard.writeText(linkFor(inv.token)).then(() => toast.success("Interview link copied"), () => toast.error("Could not copy"))}><Copy size={12} /> Copy link</button>
                        {p.whatsapp && <a style={act} target="_blank" rel="noopener noreferrer" href={`https://wa.me/${p.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(msg(p, inv))}`}><MessageCircle size={12} /> WhatsApp</a>}
                        {p.email && <a style={act} href={`mailto:${p.email}?subject=${encodeURIComponent(`${company || "SeaMinds"} — AI interview`)}&body=${encodeURIComponent(msg(p, inv))}`}><Mail size={12} /> Email</a>}
                        {inv.status === "completed" && <button style={act} onClick={onOpenCampaign}>View result ›</button>}
                      </div>
                    </div>))}
                </div>}
              </div>);
          })}
          {total > 25 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#94a3b8", alignItems: "center" }}>
            <button disabled={off === 0} onClick={() => setOff(Math.max(0, off - 25))} style={act}>‹ Prev</button>
            <span>{off + 1}–{Math.min(off + 25, total)} of {total}</span>
            <button disabled={off + 25 >= total} onClick={() => setOff(off + 25)} style={act}>Next ›</button>
          </div>}
        </div>}
    </div>
  );
}
const field = { background: NAVY, color: "#fff", border: `1px solid ${BORDER}`, borderRadius: 9, padding: 8, fontSize: 12 } as const;
const muted = { color: "#94a3b8", fontSize: 12, marginTop: 10 } as const;
const pill = { border: "1px solid rgba(212,175,55,0.35)", color: GOLD, borderRadius: 999, padding: "2px 8px", fontWeight: 700 } as const;
const act = { display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "1px solid rgba(212,175,55,0.45)", color: GOLD, borderRadius: 8, padding: "4px 9px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", textDecoration: "none" } as const;
const chip = (on: boolean) => ({ padding: "5px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: "pointer", background: on ? GOLD : "transparent", color: on ? NAVY : GOLD, border: `1px solid ${on ? GOLD : "rgba(212,175,55,0.45)"}` });
