import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { trainingCatalog, type CatalogItem } from "@/lib/training";
import { shareZalo } from "@/lib/zaloShare";
import { Loader2, Sparkles } from "lucide-react";

const GOLD = "#D4AF37", NAVY = "#0D1B2A", CARD = "#112240", BORDER = "#1e3a5f";

export type Draft = { title: string; objectives: string[]; key_points: string[]; self_check: string[] };
type Cat = "library" | "english" | "promotion" | "orals" | "custom";
const CATS: { key: Cat; label: string; hint: string; presets: string[] }[] = [
  { key: "library", label: "📚 Safety & vetting library", hint: "Ready SeaMinds modules with quiz — progress shows in My training.", presets: [] },
  { key: "english", label: "🗣️ Maritime English", hint: "AI drafts a briefing; crew can also practise daily in Maritime English.", presets: ["SMCP bridge & VHF communication", "Engine room reporting & handover in English", "Port State Control / SIRE 2.0 interview English", "Emergency announcements & muster English"] },
  { key: "promotion", label: "⚓ Rank upgrade & promotion", hint: "Readiness briefing for the next rank.", presets: ["Chief Officer → Master: command readiness", "2nd Officer → Chief Officer: cargo & stability", "2nd Engineer → Chief Engineer: management level", "3rd Engineer → 2nd Engineer: maintenance planning", "Cadet → Junior Officer: watchkeeping basics"] },
  { key: "orals", label: "🎓 Orals preparation", hint: "Common examiner topics for CoC orals.", presets: ["Master / Chief Mate orals: COLREG & stability", "Officer of the Watch orals: COLREG & passage planning", "Marine Engineer orals: safety & machinery", "MARPOL & ISM orals questions"] },
  { key: "custom", label: "✨ Custom (AI)", hint: "Type any topic or company deficiency — AI builds the briefing.", presets: [] },
];
const RANKS = ["Any rank", "Master", "Chief Officer", "2nd Officer", "3rd Officer", "Chief Engineer", "2nd Engineer", "3rd Engineer", "4th Engineer", "ETO", "Bosun", "AB", "Oiler", "Cadet"];

export const trainingInviteText = (company: string, titles: string[], origin = "https://seaminds.life", drafts: Draft[] = []) =>
  [`Hello,`, `${company || "Our company"} invites you to complete pre-joining training on SeaMinds:`, "",
    ...titles.map((t, i) => `${i + 1}. ${t}`),
    ...drafts.flatMap((d, k) => ["", `📘 ${titles.length + k + 1}. ${d.title}`, ...d.objectives.map((o) => `• ${o}`), "Key points:", ...d.key_points.map((p) => `- ${p}`), "Check yourself:", ...d.self_check.map((q) => `? ${q}`)]),
    "", `Sign in free and open My training: ${origin}/training?utm_source=manager_invite`, "Free for crew."].join("\n");

export default function TrainingInviteCard({ company }: { company: string }) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [cat, setCat] = useState<Cat>("library");
  const [topic, setTopic] = useState(""); const [rank, setRank] = useState("Any rank");
  const [drafting, setDrafting] = useState(false); const [drafts, setDrafts] = useState<Draft[]>([]);
  const [phone, setPhone] = useState(""); const [email, setEmail] = useState("");
  useEffect(() => { void trainingCatalog().then((d: any) => d?.ok && setItems(d.items || [])); }, []);
  const titles = items.filter((i) => picked.includes(i.slug)).map((i) => i.title);
  const msg = () => trainingInviteText(company, titles, window.location.origin, drafts);
  const need = () => { if (!titles.length && !drafts.length) { toast.error("Choose a module or create an AI briefing first."); return false; } return true; };
  const C = CATS.find((c) => c.key === cat)!;
  const draft = async (t = topic) => {
    if (t.trim().length < 3) { toast.error("Enter a training topic."); return; }
    if (drafts.length >= 3) { toast.error("Up to 3 custom briefings per invitation."); return; }
    setDrafting(true);
    const { data, error } = await supabase.functions.invoke("training-module-draft", { body: { topic: t.trim(), rank: rank === "Any rank" ? "" : rank, category: C.label } });
    setDrafting(false);
    if (error || !data?.ok) { toast.error(data?.error || "Could not draft this module."); return; }
    setDrafts((d) => [...d, data.draft]); setTopic(""); toast.success("Briefing added to the invitation");
  };
  const btn = (bg: string, color = "#fff") => ({ flex: 1, minWidth: 110, padding: "9px 0", borderRadius: 10, border: "none", background: bg, color, fontSize: 12.5, fontWeight: 800, cursor: "pointer" });
  const chip = (on: boolean) => ({ padding: "6px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: "pointer", background: on ? GOLD : "transparent", color: on ? NAVY : GOLD, border: `1px solid ${on ? GOLD : "rgba(212,175,55,0.45)"}` });
  const field = { flex: 1, minWidth: 180, background: NAVY, color: "#fff", border: `1px solid ${BORDER}`, borderRadius: 9, padding: 8, fontSize: 12 } as const;
  const total = titles.length + drafts.length;
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
      <p style={{ color: GOLD, fontSize: 14, fontWeight: 800 }}>🎓 Send training invitation</p>
      <p style={{ color: "#94a3b8", fontSize: 11.5, marginTop: 3 }}>For any crew — no interview needed. 1) Choose training 2) Add crew contact 3) Send.</p>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 10, paddingBottom: 2 }}>
        {CATS.map((c) => <button key={c.key} type="button" onClick={() => setCat(c.key)} style={{ ...chip(cat === c.key), whiteSpace: "nowrap" }}>{c.label}</button>)}
      </div>
      <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 6 }}>{C.hint}</p>
      {cat === "library" ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, maxHeight: 200, overflowY: "auto" }}>
          {items.length === 0 && <p style={{ color: "#64748b", fontSize: 11 }}>Loading training modules…</p>}
          {items.map((i) => { const on = picked.includes(i.slug); return (
            <button key={i.slug} type="button" onClick={() => setPicked((p) => on ? p.filter((s) => s !== i.slug) : [...p, i.slug].slice(0, 5))} style={chip(on)}>{i.title}</button>); })}
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {C.presets.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {C.presets.map((p) => <button key={p} type="button" disabled={drafting} onClick={() => setTopic(p)} style={chip(topic === p)}>{p}</button>)}
          </div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={300} placeholder={cat === "custom" ? "e.g. Fuel changeover before entering ECA" : "Pick above or type your own topic"} style={{ ...field, flex: 2 }} />
            <select value={rank} onChange={(e) => setRank(e.target.value)} style={{ ...field, flex: 1, minWidth: 120 }}>{RANKS.map((r) => <option key={r}>{r}</option>)}</select>
            <button type="button" disabled={drafting} onClick={() => void draft()} style={{ ...btn(GOLD, NAVY), flex: "none", padding: "9px 14px", display: "flex", alignItems: "center", gap: 6 }}>
              {drafting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {drafting ? "Creating…" : "Create with AI"}
            </button>
          </div>
        </div>
      )}
      {drafts.map((d, i) => (
        <details key={i} style={{ marginTop: 8, background: NAVY, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 10px", color: "#fff", fontSize: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>📘 {d.title} <button type="button" onClick={(e) => { e.preventDefault(); setDrafts((x) => x.filter((_, k) => k !== i)); }} style={{ color: "#ef4444", background: "none", border: "none", marginLeft: 8, cursor: "pointer", fontSize: 11 }}>Remove</button></summary>
          <ul style={{ marginTop: 6, paddingLeft: 16, listStyle: "disc", color: "#cbd5e1" }}>{[...d.objectives, ...d.key_points].map((p, k) => <li key={k}>{p}</li>)}</ul>
          <p style={{ color: "#94a3b8", marginTop: 6, fontSize: 11 }}>AI draft — review before sending.</p>
        </details>))}
      <p style={{ color: total ? "#22c55e" : "#64748b", fontSize: 11.5, marginTop: 8, fontWeight: 700 }}>{total ? `${total} item${total === 1 ? "" : "s"} in this invitation` : "Nothing selected yet"}</p>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Crew WhatsApp / Zalo number (optional)" style={field} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Crew email (optional)" style={field} />
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
