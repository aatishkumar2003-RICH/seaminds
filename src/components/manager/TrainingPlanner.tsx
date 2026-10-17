import { useEffect, useState } from "react";
import { toast } from "sonner";
import { recommendTraining, assignTraining, trainingLedger, trainingMessage, trainingError, trainingDossier, trainingProgress, trainingWhatsAppLink, TRADING_AREAS, type Recommendation, type LedgerItem } from "@/lib/training";
import { Button } from "@/components/ui/button";
import { Copy, MessageCircle } from "lucide-react";

const GOLD = "#D4AF37";
const BORDER = "#1e3a5f";

/** Manager view: training needs for one interview candidate, assignment and the candidate's training record. */
const TrainingPlanner = ({ inviteId = null, applicationId = null, name, whatsapp, company, onLedgerChange }: { inviteId?: string | null; applicationId?: string | null; name: string; whatsapp?: string; company: string; onLedgerChange?: (summary: { assigned: number; completed: number }) => void }) => {
  const [area, setArea] = useState("");
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const updateLedger = (items: LedgerItem[]) => { setLedger(items); onLedgerChange?.(trainingProgress(items)); };

  useEffect(() => {
    let live = true;
    (async () => {
      setRecs(null); setErr("");
      const [r, l] = await Promise.all([recommendTraining(inviteId, area, 5, applicationId), trainingLedger(inviteId, applicationId)]);
      if (!live) return;
      if (!r.ok) { setErr(trainingError(r.error_code)); setRecs([]); return; }
      setMeta(r); setRecs(r.items);
      setPicked(r.items.filter((i: Recommendation) => i.gap || i.score >= 30).slice(0, 2).map((i: Recommendation) => i.slug));
      if (l.ok) updateLedger(l.items);
    })();
    return () => { live = false; };
  }, [inviteId, applicationId, area]);

  const assign = async (share: boolean) => {
    if (!picked.length || busy) return;
    // Open during the tap, before awaiting the server, to avoid mobile popup blocking.
    const popup = share ? window.open("about:blank", "_blank") : null;
    if (popup) popup.opener = null;
    setBusy(true);
    try {
      const d = await assignTraining(inviteId, picked, area, applicationId);
      if (!d.ok) { popup?.close(); toast.error(trainingError(d.error_code)); return; }
      const msg = trainingMessage(name, company, d.assigned.filter((i: { token: string | null }) => i.token));
      if (share) {
        const url = trainingWhatsAppLink(whatsapp || "", msg);
        setShareUrl(url);
        if (popup) popup.location.href = url;
        else toast.info("Training assigned. Tap Open WhatsApp to share the links.");
      } else {
        try { await navigator.clipboard.writeText(msg); toast.success("Training links copied"); }
        catch { toast.error("Training assigned, but copying failed. Try copying the links below."); }
      }
      const l = await trainingLedger(inviteId, applicationId);
      if (l.ok) updateLedger(l.items);
    } catch { popup?.close(); toast.error("Check your connection and retry."); }
    finally { setBusy(false); }
  };

  const weak = meta?.weak_domains ? Object.keys(meta.weak_domains) : [];
  const pendingLinks = ledger.filter((item) => item.status !== "completed" && item.token).flatMap((item) => item.token ? [{ title: item.title, token: item.token }] : []);
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
              <Button onClick={() => assign(true)} disabled={busy || !picked.length}
                className="h-auto flex-1 whitespace-normal rounded-xl bg-gold px-2 py-2 text-xs font-bold text-primary-foreground hover:bg-gold/90">
                <MessageCircle />{busy ? "Assigning…" : "Assign & open WhatsApp"}
              </Button>
              <Button onClick={() => assign(false)} disabled={busy || !picked.length} variant="outline"
                className="h-auto flex-1 whitespace-normal rounded-xl border-gold px-2 py-2 text-xs text-gold">
                <Copy />Assign & copy links
              </Button>
            </div>
          )}
        </div>
      )}
      {ledger.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700 }}>Training record · {ledger.filter((l) => l.status === "completed").length}/{ledger.length} verified</p>
          <div style={{ height: 6, background: BORDER, borderRadius: 99, marginTop: 5, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(ledger.filter((l) => l.status === "completed").length / ledger.length) * 100}%`, background: "#22c55e" }} />
          </div>
          <p style={{ color: "#64748b", fontSize: 10, marginTop: 4 }}>
            ✓ {ledger.filter((l) => l.status === "completed").length} done · ◐ {ledger.filter((l) => l.status === "opened").length} reading · ○ {ledger.filter((l) => l.status === "assigned").length} not opened
          </p>
          {ledger.map((l) => (
            <p key={l.slug} style={{ color: l.status === "completed" ? "#22c55e" : "#94a3b8", fontSize: 10.5, marginTop: 3 }}>
              {l.status === "completed" ? `✓ ${l.title} — ${l.quiz_correct}/${l.quiz_total}, read ${l.dwell_seconds ?? 0}s, ${l.completed_at ? new Date(l.completed_at).toLocaleDateString() : "date unavailable"}` : `• ${l.title} — ${l.status === "opened" ? "opened, not finished" : "assigned, not opened"}`}
            </p>
          ))}
          <Button variant="outline" className="mt-2 h-auto w-full whitespace-normal rounded-xl border-gold py-2 text-xs text-gold" onClick={async () => {
            try { await navigator.clipboard.writeText(trainingDossier(name, ledger)); toast.success("Training record copied"); }
            catch { toast.error("Could not copy training record. Please try again."); }
          }}><Copy />Copy pre-joining training record</Button>
        </div>
      )}
      {(shareUrl || pendingLinks.length > 0) && <div className="mt-3 flex flex-wrap gap-2">
        {(whatsapp || shareUrl) && <Button asChild size="sm" variant="outline" className="border-gold text-gold">
          <a href={shareUrl || trainingWhatsAppLink(whatsapp || "", trainingMessage(name, company, pendingLinks))} target="_blank" rel="noopener noreferrer"><MessageCircle />Open WhatsApp</a>
        </Button>}
        {pendingLinks.length > 0 && <Button size="sm" variant="outline" className="border-gold text-gold" onClick={async () => {
          try { await navigator.clipboard.writeText(trainingMessage(name, company, pendingLinks)); toast.success("Training links copied"); }
          catch { toast.error("Could not copy training links. Please try again."); }
        }}><Copy />Copy pending links</Button>}
        {pendingLinks.length > 0 && <Button asChild size="sm" variant="outline" className="border-gold text-gold">
          <a href={`mailto:?subject=${encodeURIComponent("Your SeaMinds pre-joining training")}&body=${encodeURIComponent(trainingMessage(name, company, pendingLinks))}`}>Send by email</a>
        </Button>}
      </div>}
    </div>
  );
};

export default TrainingPlanner;
