import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Copy, Loader2, MessageCircle, Search } from "lucide-react";
import { ago } from "@/components/manager/TrainingRadar";

const GOLD = "#D4AF37", NAVY = "#0D1B2A", CARD = "#112240", BORDER = "#1e3a5f";
type H = { at: string; channel: string; items: string[]; message: string | null };
type Row = { key: string; name: string; rank: string | null; email: string | null; phone: string | null; sends: number; last_sent: string; channels: string[]; history: H[]; modules_done: number; modules_total: number; last_active: string | null; status: string };
const ST: Record<string, [string, string]> = { completed: ["Completed", "#22c55e"], in_progress: ["In progress", "#38bdf8"], joined: ["Signed in · not started", "#f59e0b"], not_joined: ["Sent · not signed in yet", "#f59e0b"] };
const CH: Record<string, string> = { email: "✉️ Email", whatsapp: "🟢 WhatsApp", zalo: "🔵 Zalo", copy: "📋 Link copied" };

/** Every training invitation sent from this tab, one row per crew (repeat sends fold into a history). */
export default function TrainingSentLog() {
  const [q, setQ] = useState(""); const [dq, setDq] = useState(""); const [rank, setRank] = useState(""); const [off, setOff] = useState(0);
  const [res, setRes] = useState<any>(null); const [open, setOpen] = useState<string | null>(null); const [tick, setTick] = useState(0);
  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setOff(0); }, 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { const f = () => setTick((n) => n + 1); window.addEventListener("training-invite-sent", f); return () => window.removeEventListener("training-invite-sent", f); }, []);
  useEffect(() => {
    let alive = true;
    void supabase.rpc("manager_training_sent" as any, { p_search: dq, p_rank: rank, p_offset: off }).then(({ data }) => alive && setRes((data as any)?.ok ? data : { rows: [], total: 0, ranks: [] }));
    return () => { alive = false; };
  }, [dq, rank, off, tick]);
  const rows: Row[] = res?.rows || []; const total = res?.total || 0;
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
      <p style={{ color: GOLD, fontSize: 14, fontWeight: 800 }}>📨 Sent training invitations</p>
      <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 3 }}>One line per crew. Sending again adds to their history instead of a new line.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: 11, color: "#94a3b8" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or phone" style={{ ...field, paddingLeft: 28, width: "100%" }} />
        </div>
        <select value={rank} onChange={(e) => { setRank(e.target.value); setOff(0); }} aria-label="Filter by rank" style={{ ...field, minWidth: 140 }}>
          <option value="">All ranks</option>{(res?.ranks || []).map((r: string) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      {!res ? <p style={muted}><Loader2 size={13} className="inline animate-spin" /> Loading…</p>
        : rows.length === 0 ? <p style={muted}>{dq || rank ? "No invitations match." : "No invitations recorded yet. Every invitation you send above (Email, WhatsApp, Zalo or Copy) will be listed here."}</p>
        : <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {rows.map((r) => {
            const st = ST[r.status] || ["", "#94a3b8"]; const isOpen = open === r.key; const last = r.history[0];
            return (
              <div key={r.key} style={{ background: NAVY, border: `1px solid ${isOpen ? GOLD : BORDER}`, borderRadius: 11 }}>
                <button onClick={() => setOpen(isOpen ? null : r.key)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", color: "#fff", padding: 10, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {isOpen ? <ChevronDown size={14} color={GOLD} /> : <ChevronRight size={14} color={GOLD} />}
                    <span style={{ fontWeight: 800, fontSize: 13, flex: 1 }}>{r.name} <span style={{ color: "#94a3b8", fontWeight: 600 }}>· {r.rank || "—"}</span></span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: st[1] }}>{st[0]}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5, fontSize: 11, paddingLeft: 20 }}>
                    <span style={pill}>{r.sends}× sent</span>
                    {r.modules_total > 0 && <span style={pill}>📚 {r.modules_done}/{r.modules_total} modules</span>}
                    <span style={{ color: "#94a3b8" }}>{r.channels.map((c) => CH[c] || c).join(" · ")} · last {ago(r.last_sent)}</span>
                  </div>
                  {last?.items?.length > 0 && <p style={{ fontSize: 11, color: "#cbd5e1", marginTop: 4, paddingLeft: 20 }}>{last.items.slice(0, 3).join(" · ")}{last.items.length > 3 ? ` +${last.items.length - 3}` : ""}</p>}
                </button>
                {isOpen && <div style={{ borderTop: `1px solid ${BORDER}`, padding: "6px 10px 10px" }}>
                  <p style={{ fontSize: 11, color: "#94a3b8" }}>{[r.email, r.phone].filter(Boolean).join(" · ")}{r.last_active ? ` · active ${ago(r.last_active)}` : ""}</p>
                  {r.history.map((h, i) => (
                    <div key={i} style={{ padding: "7px 0", borderBottom: i < r.history.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                      <div style={{ display: "flex", fontSize: 12, color: "#fff" }}><span style={{ flex: 1 }}>{CH[h.channel] || h.channel}</span><span style={{ color: "#94a3b8" }}>{new Date(h.at).toLocaleString()}</span></div>
                      {h.items?.length > 0 && <ul style={{ margin: "4px 0 0 16px", fontSize: 11.5, color: "#cbd5e1" }}>{h.items.map((t) => <li key={t}>{t}</li>)}</ul>}
                      {h.message && <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                        <button style={act} onClick={() => navigator.clipboard.writeText(h.message!).then(() => toast.success("Invitation copied"), () => toast.error("Could not copy"))}><Copy size={12} /> Copy invitation</button>
                        {r.phone && <a style={act} target="_blank" rel="noopener noreferrer" href={`https://wa.me/${r.phone}?text=${encodeURIComponent(h.message)}`}><MessageCircle size={12} /> Resend WhatsApp</a>}
                      </div>}
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
