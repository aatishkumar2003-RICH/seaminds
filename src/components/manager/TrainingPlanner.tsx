import { useEffect, useState } from "react";
import { toast } from "sonner";
import { recommendTraining, assignTraining, trainingLedger, trainingMessage, trainingError, TRADING_AREAS, type Recommendation, type LedgerItem } from "@/lib/training";

const GOLD = "#D4AF37";
const BORDER = "#1e3a5f";

/** Manager view: training needs for one interview candidate, assignment and the candidate's training record. */
const TrainingPlanner = ({ inviteId, name, whatsapp, company }: { inviteId: string; name: string; whatsapp?: string; company: string }) => {
  const [area, setArea] = useState("");
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      setRecs(null); setErr("");
      const [r, l] = await Promise.all([recommendTraining(inviteId, area, 5), trainingLedger(inviteId)]);
      if (!live) return;
      if (!r.ok) { setErr(trainingError(r.error_code)); setRecs([]); return; }
      setMeta(r); setRecs(r.items);
      setPicked(r.items.filter((i: Recommendation) => i.gap || i.score >= 30).slice(0, 2).map((i: Recommendation) => i.slug));
      setLedger(l.ok ? l.items : []);
    })();
    return () => { live = false; };
  }, [inviteId, area]);

  const assign = async (share: boolean) => {
    if (!picked.length || busy) return;
    setBusy(true);
    const d = await assignTraining(inviteId, picked, area);
    setBusy(false);
    if (!d.ok) return toast.error(trainingError(d.error_code));
    const msg = trainingMessage(name, company, d.assigned, window.location.origin.includes("localhost") ? undefined : window.location.origin);
    if (share) window.open(`https://wa.me/${String(whatsapp || "").replace(/[^\d]/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
    else { await navigator.clipboard.writeText(msg).catch(() => null); toast.success("Training links copied"); }
    const l = await trainingLedger(inviteId);
    if (l.ok) setLedger(l.items);
  };

  const weak = meta?.weak_domains ? Object.keys(meta.weak_domains) : [];
  return (
    <div style={{ marginTop: 9, borderTop: `1px solid ${BORDER}`, paddingTop: 9 }}>
      <p style={{ color: GOLD, fontSize: 12, fontWeight: 800 }}>🎓 Training needs</p>
      <label style={{ display: "block", color: "#94a3b8", fontSize: 11, marginTop: 6 }}>Trading area
        <select value={area} onChange={(e) => setArea(e.target.value)}
          style={{ display: "block", width: "100%", marginTop: 4, background: "#0D1B2A", color: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 7, fontSize: 12 }}>
          {TRADING_AREAS.map((a) => <option key={a.code} value={a.code}>{a.label}</option>)}
        </select>
      </label>
      {weak.length > 0 && <p style={{ color: "#f59e0b", fontSize: 10.5, marginTop: 6 }}>Weak exam areas: {weak.join(", ")}</p>}
      {err && <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 6 }}>{err}</p>}
      {recs === null ? <p style={{ color: "#64748b", fontSize: 11, marginTop: 6 }}>Finding matching training…</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 7 }}>
          {recs.map((r) => (
            <label key={r.slug} style={{ display: "flex", gap: 8, alignItems: "flex-start", border: `1px solid ${picked.includes(r.slug) ? GOLD : BORDER}`, borderRadius: 9, padding: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={picked.includes(r.slug)} style={{ accentColor: GOLD, marginTop: 2 }}
                onChange={(e) => setPicked((p) => e.target.checked ? [...p, r.slug].slice(0, 5) : p.filter((s) => s !== r.slug))} />
              <span>
                <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, display: "block" }}>{r.title}{r.assigned ? " · already sent" : ""}</span>
                <span style={{ color: r.gap ? "#f59e0b" : "#94a3b8", fontSize: 10.5 }}>{r.reasons.join(" · ")}</span>
              </span>
            </label>
          ))}
          {recs.length > 0 && (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => assign(true)} disabled={busy || !picked.length || !whatsapp}
                style={{ flex: 1, background: GOLD, color: "#0D1B2A", border: 0, borderRadius: 9, padding: "8px 0", fontSize: 12, fontWeight: 800, cursor: "pointer", opacity: !picked.length || !whatsapp ? 0.5 : 1 }}>
                {busy ? "Assigning…" : "Assign & send on WhatsApp"}
              </button>
              <button onClick={() => assign(false)} disabled={busy || !picked.length}
                style={{ flex: 1, background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 9, padding: "8px 0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Assign & copy links
              </button>
            </div>
          )}
        </div>
      )}
      {ledger.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700 }}>Training record</p>
          {ledger.map((l) => (
            <p key={l.slug} style={{ color: l.status === "completed" ? "#22c55e" : "#94a3b8", fontSize: 10.5, marginTop: 3 }}>
              {l.status === "completed" ? `✓ ${l.title} — ${l.quiz_correct}/${l.quiz_total}, ${new Date(l.completed_at!).toLocaleDateString()}` : `• ${l.title} — ${l.status === "opened" ? "opened, not finished" : "sent, not opened"}`}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrainingPlanner;
