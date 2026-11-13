import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { englishBand, ENGLISH_BANDS, type EnglishBand } from "@/lib/englishBands";

const GOLD = "#D4AF37", NAVY = "#0D1B2A", CARD = "#112240", BORDER = "#1e3a5f";
type R = { crew_id: string; name: string; rank: string | null; email: string | null; whatsapp: string | null; eng_avg: number | null; eng_attempts: number; eng_scenario: string | null; vessel?: string | null };

export default function EnglishFluencyReport({ filters, onClose }: { filters: Record<string, unknown>; onClose: () => void }) {
  const [rows, setRows] = useState<R[] | null>(null);
  const [band, setBand] = useState<EnglishBand>("attention");
  useEffect(() => {
    let alive = true;
    (async () => {
      const all: R[] = [];
      for (let off = 0; off < 2000; off += 25) {
        const { data } = await supabase.rpc("manager_training_radar" as any, { ...filters, p_offset: off });
        const d = data as any; if (!d?.ok) break;
        all.push(...d.rows); if (d.rows.length < 25) break;
      }
      if (alive) setRows(all);
    })();
    return () => { alive = false; };
  }, [filters]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {}; (rows || []).forEach((r) => { const b = englishBand(r.eng_avg); c[b] = (c[b] || 0) + 1; if (b === "under" || b === "developing") c.attention = (c.attention || 0) + 1; });
    return c;
  }, [rows]);
  const list = (rows || []).filter((r) => { const b = englishBand(r.eng_avg); return band === "attention" ? b === "under" || b === "developing" : b === band; })
    .sort((a, b) => (a.eng_avg ?? 999) - (b.eng_avg ?? 999));
  const copy = () => {
    const lines = ["SeaMinds — English fluency report", ...ENGLISH_BANDS.filter((b) => b.key !== "attention").map((b) => `${b.label}: ${counts[b.key] || 0}`), "", "Needs attention (<70%):",
      ...(rows || []).filter((r) => r.eng_avg != null && r.eng_avg < 70).sort((a, b) => a.eng_avg! - b.eng_avg!).map((r) => `• ${r.name || "Crew"} (${r.rank || "—"}) ${r.eng_avg}%`)];
    void navigator.clipboard.writeText(lines.join("\n")).then(() => toast.success("Report copied"));
  };
  const send = (r: R) => {
    const [first, ...rest] = (r.name || "").split(" ");
    window.dispatchEvent(new CustomEvent("training-pick-crew", { detail: { id: `c:${r.crew_id}`, first_name: first || "", last_name: rest.join(" "), rank: r.rank || "", email: r.email, whatsapp: r.whatsapp, vessel: null } }));
    onClose();
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 70, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(620px,100%)", height: "100%", overflowY: "auto", background: NAVY, borderLeft: `1px solid ${BORDER}`, padding: 16, color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={onClose} aria-label="Back" style={{ background: "none", border: "none", color: GOLD, cursor: "pointer" }}><ChevronLeft /></button>
          <p style={{ flex: 1, fontWeight: 800, fontSize: 16, color: GOLD }}>📋 English fluency report</p>
          <button onClick={copy} disabled={!rows} style={{ background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 10, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}><Copy size={12} className="inline" /> Copy</button>
        </div>
        <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 4 }}>Based on each crew member's average voice-drill score, using your current radar filters.</p>
        {!rows ? <p style={{ marginTop: 14, color: "#94a3b8" }}><Loader2 size={14} className="inline animate-spin" /> Building report…</p> : <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(105px,1fr))", gap: 8, marginTop: 12 }}>
            {ENGLISH_BANDS.map((b) => <button key={b.key} onClick={() => setBand(b.key)} style={{ textAlign: "left", background: band === b.key ? CARD : "transparent", border: `1px solid ${band === b.key ? b.color : BORDER}`, borderRadius: 10, padding: 8, cursor: "pointer", color: "#fff" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: b.color }}>{counts[b.key] || 0}</div><div style={{ fontSize: 11, fontWeight: 700 }}>{b.label}</div><div style={{ fontSize: 10, color: "#94a3b8" }}>{b.hint}</div></button>)}
          </div>
          <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
            {list.length === 0 ? <p style={{ color: "#94a3b8", fontSize: 12 }}>No crew in this group.</p> : list.map((r) => <div key={r.crew_id} style={{ display: "flex", alignItems: "center", gap: 8, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 8 }}>
              <div style={{ flex: 1, fontSize: 12.5 }}><b>{r.name || "Crew"}</b> <span style={{ color: "#94a3b8" }}>· {r.rank || "—"}{r.vessel ? ` · 🚢 ${r.vessel}` : ""}</span>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{r.eng_avg != null ? `${r.eng_avg}%` : "Not assessed"} · {r.eng_attempts} drills{r.eng_scenario ? ` · last: ${r.eng_scenario.replace(/^(eng|deck|bridge|safe|psc)-/, "").replace(/-/g, " ")}` : ""}</div></div>
              <button onClick={() => send(r)} style={{ background: GOLD, color: NAVY, border: "none", borderRadius: 10, padding: "5px 9px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>🎓 Send drills</button>
            </div>)}
          </div></>}
      </div>
    </div>);
}
