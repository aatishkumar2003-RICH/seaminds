import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Copy, Loader2, Mail, MessageCircle, Search, Trash2 } from "lucide-react";

const GOLD = "#D4AF37", NAVY = "#0D1B2A", CARD = "#112240", BORDER = "#1e3a5f";
type Invite = { id: string; token: string; campaign: string; status: string; score: number | null; created_at: string; completed_at: string | null };
type TH = { at: string; channel: string; items: string[]; message: string | null };
type Person = { key: string; name: string; rank: string | null; nationality: string | null; email: string | null; whatsapp: string | null; invites_count: number; last_at: string; best_score: number | null; status: string; shortlisted: boolean; invites: Invite[]; training?: TH[]; train_status?: string; modules_done?: number; modules_total?: number };
const CH: Record<string, string> = { email: "✉️ Email", whatsapp: "🟢 WhatsApp", zalo: "🔵 Zalo", copy: "📋 Link copied" };
const TST: Record<string, string> = { completed: "Training complete", in_progress: "Training in progress", joined: "Signed in · not started", not_joined: "Not signed in yet" };
const pkey = (email?: string | null, phone?: string | null, name?: string | null) => (email || "").toLowerCase().trim() || (phone || "").replace(/\D/g, "") || (name || "").toLowerCase().trim();
const STATUS: [string, string][] = [["all", "All"], ["completed", "✅ Completed"], ["in_progress", "⏳ In progress"], ["invited", "✉️ Not started"], ["shortlisted", "⭐ Shortlisted"]];
const ST: Record<string, [string, string]> = { completed: ["Completed", "#22c55e"], in_progress: ["In progress", "#38bdf8"], invited: ["Not started", "#f59e0b"] };
const label = (s: string) => ST[s]?.[0] || (s || "").replace(/_/g, " ");
const d = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short" }) : "";

/** One card per candidate across every interview sent — repeat invites fold into a single history. */
export default function InterviewPeopleBoard({ linkFor, company, onOpenCampaign, initialKind = "all" }: { linkFor: (t: string) => string; company: string; onOpenCampaign: () => void; initialKind?: "all" | "interview" | "training" }) {
  const [kind, setKind] = useState(initialKind); const [tick, setTick] = useState(0);
  useEffect(() => { const f = () => setTick((n) => n + 1); window.addEventListener("training-invite-sent", f); return () => window.removeEventListener("training-invite-sent", f); }, []);
  const [q, setQ] = useState(""); const [dq, setDq] = useState(""); const [rank, setRank] = useState(""); const [status, setStatus] = useState("all");
  const [off, setOff] = useState(0); const [res, setRes] = useState<any>(null); const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { const t = setTimeout(() => { setDq(q.trim()); setOff(0); }, 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => {
    let alive = true;
    const go = async () => {
      const wantI = kind !== "training", wantT = kind !== "interview" && (status === "all" || kind === "training");
      const [a, b] = await Promise.all([
        wantI ? supabase.rpc("manager_interview_people" as any, { p_search: dq, p_rank: rank, p_status: status, p_offset: off }) : Promise.resolve({ data: null }),
        wantT ? supabase.rpc("manager_training_sent" as any, { p_search: dq, p_rank: rank, p_offset: off }) : Promise.resolve({ data: null }),
      ]);
      const ia: any = (a as any).data?.ok ? (a as any).data : { rows: [], total: 0, counts: {}, ranks: [] };
      const ta: any = (b as any).data?.ok ? (b as any).data : { rows: [], total: 0, ranks: [] };
      const m = new Map<string, Person>();
      for (const p of ia.rows as Person[]) m.set(pkey(p.email, p.whatsapp, p.name), { ...p, training: [] });
      for (const t of ta.rows as any[]) {
        const k = pkey(t.email, t.phone, t.name); const ex = m.get(k);
        const extra = { training: t.history as TH[], train_status: t.status, modules_done: t.modules_done, modules_total: t.modules_total };
        if (ex) m.set(k, { ...ex, ...extra, whatsapp: ex.whatsapp || t.phone, email: ex.email || t.email, last_at: ex.last_at > t.last_sent ? ex.last_at : t.last_sent });
        else m.set(k, { key: `t:${t.key}`, name: t.name, rank: t.rank, nationality: null, email: t.email, whatsapp: t.phone, invites_count: 0, last_at: t.last_sent, best_score: null, status: "", shortlisted: false, invites: [], ...extra });
      }
      const rows = [...m.values()].sort((x, y) => (y.last_at || "").localeCompare(x.last_at || ""));
      const ranks = [...new Set([...(ia.ranks || []), ...(ta.ranks || [])])].sort();
      if (alive) setRes({ rows, total: Math.max(ia.total || 0, ta.total || 0), counts: ia.counts || {}, ranks, ttotal: ta.total || 0 });
    };
    void go(); const i = setInterval(() => document.visibilityState === "visible" && void go(), 30000);
    return () => { alive = false; clearInterval(i); };
  }, [dq, rank, status, off, kind, tick]);
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
        {([["all", "📁 All sends"], ["interview", "🎙️ AI interviews"], ["training", "🎓 Training"]] as const).map(([k, l]) => <button key={k} onClick={() => { setKind(k); setOff(0); if (k === "training") setStatus("all"); }} style={{ ...chip(kind === k), borderRadius: 8 }}>{l}</button>)}
      </div>
      {kind !== "training" && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {STATUS.map(([k, l]) => <button key={k} onClick={() => { setStatus(k); setOff(0); }} style={chip(status === k)}>{l} ({res?.counts?.[k] ?? 0})</button>)}
      </div>}
      {!res ? <p style={muted}><Loader2 size={13} className="inline animate-spin" /> Loading candidates…</p>
        : rows.length === 0 ? <p style={muted}>No one matches. Clear the filters — every AI interview link and training invitation you send appears here, one card per person.</p>
        : <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {rows.map((p) => {
            const st = ST[p.status] || ["", "#94a3b8"]; const isOpen = open === p.key;
            return (
              <div key={p.key} style={{ background: NAVY, border: `1px solid ${isOpen ? GOLD : BORDER}`, borderRadius: 11 }}>
                <button onClick={() => setOpen(isOpen ? null : p.key)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", color: "#fff", padding: 10, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {isOpen ? <ChevronDown size={14} color={GOLD} /> : <ChevronRight size={14} color={GOLD} />}
                    <span style={{ fontWeight: 800, fontSize: 13, flex: 1 }}>{p.shortlisted ? "⭐ " : ""}{p.name} <span style={{ color: "#94a3b8", fontWeight: 600 }}>· {p.rank || "—"}{p.nationality ? ` · ${p.nationality}` : ""}</span></span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: st[1] }}>{p.status ? label(p.status) : TST[p.train_status || ""] || ""}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5, fontSize: 11, paddingLeft: 20 }}>
                    {p.invites_count > 0 && <span style={pill}>🎙️ {p.invites_count} interview{p.invites_count === 1 ? "" : "s"}</span>}
                    {!!p.training?.length && <span style={pill}>🎓 {p.training.length} training send{p.training.length === 1 ? "" : "s"}{p.modules_total ? ` · ${p.modules_done}/${p.modules_total} modules` : ""}</span>}
                    {p.best_score != null && <span style={pill}>Best {Number(p.best_score).toFixed(2)} / 5.00</span>}
                    <span style={{ color: "#94a3b8" }}>Last sent {d(p.last_at)}</span>
                  </div>
                </button>
                {isOpen && <div style={{ borderTop: `1px solid ${BORDER}`, padding: "6px 10px 10px" }}>
                  {(p.training || []).map((h, i) => (
                    <div key={`t${i}`} style={{ padding: "7px 0", borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ display: "flex", gap: 6, fontSize: 12, color: "#fff" }}><span style={{ flex: 1 }}>🎓 Training · {CH[h.channel] || h.channel}</span><span style={{ color: "#94a3b8" }}>{d(h.at)}</span></div>
                      {h.items?.length > 0 && <p style={{ fontSize: 11, color: "#cbd5e1", marginTop: 3 }}>{h.items.join(" · ")}</p>}
                      {h.message && <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                        <button style={act} onClick={() => navigator.clipboard.writeText(h.message!).then(() => toast.success("Training invitation copied"), () => toast.error("Could not copy"))}><Copy size={12} /> Copy training link</button>
                        {p.whatsapp && <a style={act} target="_blank" rel="noopener noreferrer" href={`https://wa.me/${p.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(h.message)}`}><MessageCircle size={12} /> Resend WhatsApp</a>}
                        {p.email && <a style={act} href={`mailto:${p.email}?subject=${encodeURIComponent(`${company || "SeaMinds"} — training invitation`)}&body=${encodeURIComponent(h.message)}`}><Mail size={12} /> Resend email</a>}
                      </div>}
                    </div>))}
                  {p.invites.map((inv, i) => (
                    <div key={inv.id} style={{ padding: "7px 0", borderBottom: i < p.invites.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                      <div style={{ display: "flex", gap: 6, fontSize: 12, color: "#fff" }}>
                        <span style={{ flex: 1 }}>🎙️ AI interview · {inv.campaign}</span>
                        <span style={{ color: ST[inv.status]?.[1] || "#94a3b8", fontWeight: 700 }}>{label(inv.status)}{inv.score != null ? ` · ${Number(inv.score).toFixed(2)}` : ""}</span>
                      </div>
                      <p style={{ fontSize: 10.5, color: "#94a3b8" }}>Sent {d(inv.created_at)}{inv.completed_at ? ` · finished ${d(inv.completed_at)}` : ""}</p>
                      <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                        <button style={act} onClick={() => navigator.clipboard.writeText(linkFor(inv.token)).then(() => toast.success("Interview link copied"), () => toast.error("Could not copy"))}><Copy size={12} /> Copy link</button>
                        {p.whatsapp && <a style={act} target="_blank" rel="noopener noreferrer" href={`https://wa.me/${p.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(msg(p, inv))}`}><MessageCircle size={12} /> WhatsApp</a>}
                        {p.email && <a style={act} href={`mailto:${p.email}?subject=${encodeURIComponent(`${company || "SeaMinds"} — AI interview`)}&body=${encodeURIComponent(msg(p, inv))}`}><Mail size={12} /> Email</a>}
                        {inv.status === "completed" && <button style={act} onClick={onOpenCampaign}>View result ›</button>}
                        <button style={{ ...act, color: "#f87171", borderColor: "rgba(248,113,113,0.5)" }} onClick={async () => {
                          if (!window.confirm(`Remove this invite (${inv.campaign})?`)) return;
                          let { data, error } = await supabase.rpc("manager_delete_invite" as any, { p_invite_id: inv.id });
                          if ((data as any)?.error === "HAS_PROGRESS") {
                            if (!window.confirm("This candidate already started or finished this interview. Remove anyway? The result will be deleted.")) return;
                            ({ data, error } = await supabase.rpc("manager_delete_invite" as any, { p_invite_id: inv.id, p_force: true }));
                          }
                          if (error || !(data as any)?.ok) { toast.error("Could not remove invite"); return; }
                          toast.success("Invite removed"); setTick((n) => n + 1);
                        }}><Trash2 size={12} /> Remove</button>
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
