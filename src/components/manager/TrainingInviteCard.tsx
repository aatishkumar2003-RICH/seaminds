import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { trainingCatalog, MATRIX_TIERS, type CatalogItem } from "@/lib/training";
import { shareZalo } from "@/lib/zaloShare";
import { Loader2, Sparkles, X } from "lucide-react";

const GOLD = "#D4AF37", NAVY = "#0D1B2A", CARD = "#112240", BORDER = "#1e3a5f";

export type Draft = { title: string; objectives: string[]; key_points: string[]; self_check: string[] };
export type Practice = { title: string; path: string };
type Cat = "library" | "english" | "drills" | "rank" | "custom";
const CATS: { key: Cat; label: string; hint: string }[] = [
  { key: "library", label: "📚 Safety & vetting", hint: "SeaMinds modules with quiz — completion is recorded in My training." },
  { key: "english", label: "🗣️ Maritime English", hint: "Pick any number of English Lab areas — crew practise by voice." },
  { key: "drills", label: "🚢 Fleet drills", hint: "Ship-type emergency and cargo drills — pick several." },
  { key: "rank", label: "⚓ Rank & orals", hint: "Promotion readiness and CoC orals practice with the AI examiner." },
  { key: "custom", label: "✨ Custom (AI)", hint: "Your own topic or company deficiency — AI writes the briefing." },
];
const PRACTICE: Record<"english" | "drills" | "rank", Practice[]> = {
  english: [
    { title: "Maritime English: Bridge & VHF (SMCP)", path: "/training?tab=english" },
    { title: "Maritime English: Engine room reporting & handover", path: "/training?tab=english" },
    { title: "Maritime English: Deck & ratings closed-loop", path: "/training?tab=english" },
    { title: "Maritime English: Safety & emergency announcements", path: "/training?tab=english" },
    { title: "Maritime English: PSC & vetting interview", path: "/training?tab=english" },
  ],
  drills: [
    { title: "Fleet drill: Bulk carrier", path: "/training?tab=drills&drill=bulk" },
    { title: "Fleet drill: Oil / chemical tanker", path: "/training?tab=drills&drill=tanker" },
    { title: "Fleet drill: Gas carrier", path: "/training?tab=drills&drill=gas" },
    { title: "Fleet drill: Container ship", path: "/training?tab=drills&drill=container" },
    { title: "Fleet drill: Reefer", path: "/training?tab=drills&drill=reefer" },
  ],
  rank: [
    { title: "Promotion readiness: next-rank AI interview", path: "/maritime-interview" },
    { title: "Orals practice: COLREG & navigation (Maritime Brain)", path: "/training?tab=brain" },
    { title: "Orals practice: stability & cargo (Maritime Brain)", path: "/training?tab=brain" },
    { title: "Orals practice: marine engineering & safety (Maritime Brain)", path: "/training?tab=brain" },
    { title: "Orals practice: MARPOL, ISM & MLC (Maritime Brain)", path: "/training?tab=brain" },
  ],
};
const RANKS = ["Any rank", "Master", "Chief Officer", "2nd Officer", "3rd Officer", "Chief Engineer", "2nd Engineer", "3rd Engineer", "4th Engineer", "ETO", "Bosun", "AB", "Oiler", "Cadet"];
const MAX = 10;

export const trainingInviteText = (company: string, titles: string[], origin = "https://seaminds.life", drafts: Draft[] = [], practice: Practice[] = []) => {
  let n = 0;
  return [`Hello,`, `${company || "Our company"} invites you to complete pre-joining training on SeaMinds:`, "",
    ...titles.map((t) => `${++n}. ${t}`),
    ...practice.map((p) => `${++n}. ${p.title}\n   ${origin}${p.path}${p.path.includes("?") ? "&" : "?"}utm_source=manager_invite`),
    ...drafts.flatMap((d) => ["", `📘 ${++n}. ${d.title}`, ...d.objectives.map((o) => `• ${o}`), "Key points:", ...d.key_points.map((p) => `- ${p}`), "Check yourself:", ...d.self_check.map((q) => `? ${q}`)]),
    "", `Sign in free and open My training: ${origin}/training?utm_source=manager_invite`, "Free for crew."].join("\n");
};

type Crew = { id: string; first_name: string; last_name: string; rank: string; email: string | null; whatsapp: string | null; vessel: string | null };

export default function TrainingInviteCard({ company }: { company: string }) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [practice, setPractice] = useState<Practice[]>([]);
  const [cat, setCat] = useState<Cat>("library");
  const [topic, setTopic] = useState(""); const [rank, setRank] = useState("Any rank");
  const [drafting, setDrafting] = useState(false); const [drafts, setDrafts] = useState<Draft[]>([]);
  const [phone, setPhone] = useState(""); const [email, setEmail] = useState("");
  const [crew, setCrew] = useState<Crew[]>([]); const [cq, setCq] = useState(""); const [who, setWho] = useState<Crew | null>(null);
  useEffect(() => {
    void trainingCatalog().then((d: any) => d?.ok && setItems(d.items || []));
    void supabase.rpc("company_crew_list" as any).then(({ data }) => setCrew(((data as any[]) || []) as Crew[]));
  }, []);
  const titles = items.filter((i) => picked.includes(i.slug)).map((i) => i.title);
  const total = titles.length + practice.length + drafts.length;
  const msg = () => trainingInviteText(company, titles, window.location.origin, drafts, practice);
  const need = () => { if (!total) { toast.error("Choose at least one training item first."); return false; } return true; };
  const full = () => { if (total >= MAX) { toast.error(`Up to ${MAX} items per invitation.`); return true; } return false; };
  const C = CATS.find((c) => c.key === cat)!;
  const togglePick = (slug: string) => setPicked((p) => p.includes(slug) ? p.filter((s) => s !== slug) : full() ? p : [...p, slug]);
  const togglePractice = (x: Practice) => setPractice((p) => p.some((q) => q.title === x.title) ? p.filter((q) => q.title !== x.title) : full() ? p : [...p, x]);
  const draft = async () => {
    if (topic.trim().length < 3) { toast.error("Enter a training topic."); return; }
    if (drafts.length >= 3) { toast.error("Up to 3 custom briefings per invitation."); return; }
    if (full()) return;
    setDrafting(true);
    const { data, error } = await supabase.functions.invoke("training-module-draft", { body: { topic: topic.trim(), rank: rank === "Any rank" ? "" : rank, category: "Custom" } });
    setDrafting(false);
    if (error || !data?.ok) { toast.error(data?.error || "Could not draft this module."); return; }
    setDrafts((d) => [...d, data.draft]); setTopic(""); toast.success("Briefing added to the invitation");
  };
  const chooseCrew = (c: Crew) => { setWho(c); setPhone(c.whatsapp || ""); setEmail(c.email || ""); setCq(""); if (rank === "Any rank" && RANKS.includes(c.rank)) setRank(c.rank); };
  const matches = useMemo(() => !cq ? [] : crew.filter((c) => `${c.first_name} ${c.last_name} ${c.rank} ${c.vessel || ""} ${c.email || ""}`.toLowerCase().includes(cq.toLowerCase())).slice(0, 8), [cq, crew]);
  const btn = (bg: string, color = "#fff") => ({ flex: 1, minWidth: 110, padding: "9px 0", borderRadius: 10, border: "none", background: bg, color, fontSize: 12.5, fontWeight: 800, cursor: "pointer" });
  const chip = (on: boolean) => ({ padding: "6px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: "pointer", background: on ? GOLD : "transparent", color: on ? NAVY : GOLD, border: `1px solid ${on ? GOLD : "rgba(212,175,55,0.45)"}` });
  const field = { flex: 1, minWidth: 180, background: NAVY, color: "#fff", border: `1px solid ${BORDER}`, borderRadius: 9, padding: 8, fontSize: 12 } as const;
  const count = (k: Cat) => k === "library" ? titles.length : k === "custom" ? drafts.length : practice.filter((p) => PRACTICE[k].some((q) => q.title === p.title)).length;
  const tray = [...titles.map((t) => ({ t, rm: () => setPicked((p) => p.filter((s) => items.find((i) => i.slug === s)?.title !== t)) })),
    ...practice.map((p) => ({ t: p.title, rm: () => togglePractice(p) })), ...drafts.map((d, k) => ({ t: `📘 ${d.title}`, rm: () => setDrafts((x) => x.filter((_, j) => j !== k)) }))];
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
      <p style={{ color: GOLD, fontSize: 14, fontWeight: 800 }}>🎓 Send training invitation</p>
      <p style={{ color: "#94a3b8", fontSize: 11.5, marginTop: 3 }}>1) Choose crew 2) Tick training in any tab — mix freely 3) Send.</p>

      <div style={{ marginTop: 10, position: "relative" }}>
        {who ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: NAVY, border: `1px solid ${GOLD}`, borderRadius: 9, padding: 8, color: "#fff", fontSize: 12 }}>
            <span style={{ flex: 1 }}>👤 {who.first_name} {who.last_name} · {who.rank}{who.vessel ? ` · ${who.vessel}` : ""}</span>
            <button type="button" onClick={() => { setWho(null); setPhone(""); setEmail(""); }} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}><X size={14} /></button>
          </div>
        ) : (
          <input value={cq} onChange={(e) => setCq(e.target.value)} placeholder={crew.length ? `Search your company crew (${crew.length}) — or type contact below` : "No company crew yet — type contact below"} style={{ ...field, width: "100%" }} />
        )}
        {matches.length > 0 && (
          <div style={{ position: "absolute", zIndex: 20, left: 0, right: 0, background: NAVY, border: `1px solid ${BORDER}`, borderRadius: 9, marginTop: 4, maxHeight: 220, overflowY: "auto" }}>
            {matches.map((c) => <button key={c.id} type="button" onClick={() => chooseCrew(c)} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", background: "none", border: "none", borderBottom: `1px solid ${BORDER}`, color: "#fff", fontSize: 12, cursor: "pointer" }}>
              {c.first_name} {c.last_name} <span style={{ color: "#94a3b8" }}>· {c.rank}{c.email ? ` · ${c.email}` : ""}</span></button>)}
          </div>)}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        {CATS.map((c) => { const n = count(c.key); return <button key={c.key} type="button" onClick={() => setCat(c.key)} style={{ ...chip(cat === c.key), whiteSpace: "nowrap" }}>{c.label}{n ? ` (${n})` : ""}</button>; })}
      </div>
      <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 6 }}>{C.hint}</p>

      {cat === "library" && (
        <div style={{ marginTop: 6, maxHeight: 260, overflowY: "auto" }}>
          {items.length === 0 && <p style={{ color: "#64748b", fontSize: 11 }}>Loading training modules…</p>}
          {MATRIX_TIERS.map((t) => { const list = items.filter((i) => i.tier === t.tier); return list.length ? (
            <div key={t.tier} style={{ marginBottom: 8 }}>
              <p style={{ color: "#cbd5e1", fontSize: 11, fontWeight: 800, marginBottom: 4 }}>{t.label}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{list.map((i) => <button key={i.slug} type="button" onClick={() => togglePick(i.slug)} style={chip(picked.includes(i.slug))}>{picked.includes(i.slug) ? "✓ " : ""}{i.title}</button>)}</div>
            </div>) : null; })}
        </div>)}
      {(cat === "english" || cat === "drills" || cat === "rank") && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {PRACTICE[cat].map((p) => { const on = practice.some((q) => q.title === p.title); return <button key={p.title} type="button" onClick={() => togglePractice(p)} style={chip(on)}>{on ? "✓ " : ""}{p.title}</button>; })}
        </div>)}
      {cat === "custom" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={300} placeholder="e.g. Fuel changeover before entering ECA" style={{ ...field, flex: 2 }} />
          <select value={rank} onChange={(e) => setRank(e.target.value)} style={{ ...field, flex: 1, minWidth: 120 }}>{RANKS.map((r) => <option key={r}>{r}</option>)}</select>
          <button type="button" disabled={drafting} onClick={() => void draft()} style={{ ...btn(GOLD, NAVY), flex: "none", padding: "9px 14px", display: "flex", alignItems: "center", gap: 6 }}>
            {drafting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {drafting ? "Creating…" : "Create with AI"}
          </button>
        </div>)}

      <div style={{ marginTop: 10, background: NAVY, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 8 }}>
        <p style={{ color: total ? "#22c55e" : "#64748b", fontSize: 11.5, fontWeight: 700 }}>{total ? `${total} item${total === 1 ? "" : "s"} in this invitation` : "Nothing selected yet"}</p>
        {tray.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
          {tray.map((x) => <span key={x.t} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#fff", border: `1px solid ${BORDER}`, borderRadius: 999, padding: "3px 8px" }}>{x.t}<button type="button" onClick={x.rm} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 0 }}><X size={12} /></button></span>)}
        </div>}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Crew WhatsApp / Zalo number" style={field} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Crew email (links an existing SeaMinds account on sign-in)" style={field} />
      </div>
      <div style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap" }}>
        <button style={btn(GOLD, NAVY)} onClick={() => need() && window.open(`mailto:${email.trim()}?subject=${encodeURIComponent(`${company || "Company"} — pre-joining training`)}&body=${encodeURIComponent(msg())}`)}>Email invite</button>
        <button style={btn("#25D366")} onClick={() => need() && window.open(`https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg())}`, "_blank")}>WhatsApp</button>
        <button style={btn("#0068FF")} onClick={() => need() && void shareZalo(msg(), phone || null)}>Send on Zalo</button>
        <button style={btn("transparent", GOLD)} onClick={() => need() && navigator.clipboard.writeText(msg()).then(() => toast.success("Training invitation copied"), () => toast.error("Could not copy"))}>Copy</button>
      </div>
    </div>
  );
}
