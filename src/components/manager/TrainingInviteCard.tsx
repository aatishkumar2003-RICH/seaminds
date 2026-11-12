import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trainingCatalog, type CatalogItem } from "@/lib/training";
import { shareZalo } from "@/lib/zaloShare";

const GOLD = "#D4AF37", NAVY = "#0D1B2A", CARD = "#112240", BORDER = "#1e3a5f";

/** Training invitation for any crew (no interview needed). Crew sign in at /training and start the listed modules. */
export const trainingInviteText = (company: string, titles: string[], origin = "https://seaminds.life") =>
  [`Hello,`, `${company || "Our company"} invites you to complete short pre-joining training on SeaMinds (3–5 minutes each):`, "",
    ...titles.map((t, i) => `${i + 1}. ${t}`), "",
    `Sign in free and open My training: ${origin}/training?utm_source=manager_invite`, "Free for crew."].join("\n");

export default function TrainingInviteCard({ company }: { company: string }) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [phone, setPhone] = useState(""); const [email, setEmail] = useState("");
  useEffect(() => { void trainingCatalog().then((d: any) => d?.ok && setItems(d.items || [])); }, []);
  const titles = items.filter((i) => picked.includes(i.slug)).map((i) => i.title);
  const msg = () => trainingInviteText(company, titles, window.location.origin);
  const need = () => { if (!titles.length) { toast.error("Choose at least one training module."); return false; } return true; };
  const btn = (bg: string, color = "#fff") => ({ flex: 1, minWidth: 110, padding: "9px 0", borderRadius: 10, border: "none", background: bg, color, fontSize: 12.5, fontWeight: 800, cursor: "pointer" });
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
      <p style={{ color: GOLD, fontSize: 14, fontWeight: 800 }}>🎓 Send training invitation</p>
      <p style={{ color: "#94a3b8", fontSize: 11.5, marginTop: 3 }}>For any crew — no interview needed. Pick modules, then send.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, maxHeight: 220, overflowY: "auto" }}>
        {items.length === 0 && <p style={{ color: "#64748b", fontSize: 11 }}>Loading training modules…</p>}
        {items.map((i) => { const on = picked.includes(i.slug); return (
          <button key={i.slug} type="button" onClick={() => setPicked((p) => on ? p.filter((s) => s !== i.slug) : [...p, i.slug].slice(0, 5))}
            style={{ padding: "6px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, cursor: "pointer", background: on ? GOLD : "transparent", color: on ? NAVY : GOLD, border: `1px solid ${on ? GOLD : "rgba(212,175,55,0.45)"}` }}>{i.title}</button>); })}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Crew WhatsApp / Zalo number (optional)" style={{ flex: 1, minWidth: 180, background: NAVY, color: "#fff", border: `1px solid ${BORDER}`, borderRadius: 9, padding: 8, fontSize: 12 }} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Crew email (optional)" style={{ flex: 1, minWidth: 180, background: NAVY, color: "#fff", border: `1px solid ${BORDER}`, borderRadius: 9, padding: 8, fontSize: 12 }} />
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
