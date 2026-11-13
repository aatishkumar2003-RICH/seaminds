import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const GOLD = "#D4AF37", NAVY = "#0D1B2A", BORDER = "#1e3a5f";
export type PoolCrew = { id: string; first_name: string; last_name: string; rank: string; email: string | null; whatsapp: string | null; vessel: string | null; source?: string };
export type Pick = { email: string; name: string };

const norm = (r: string) => (r || "").toLowerCase()
  .replace(/\bsecond\b/g, "2nd").replace(/\bthird\b/g, "3rd").replace(/\bfourth\b/g, "4th")
  .replace(/\bc\/o\b/g, "chief officer").replace(/\bc\/e\b/g, "chief engineer")
  .replace(/[^a-z0-9]+/g, " ").trim();
export const rankMatches = (crewRank: string, target: string) => {
  const a = norm(crewRank), b = norm(target);
  return !!a && !!b && (a === b || a.includes(b) || b.includes(a));
};
const okEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const SRC: Record<string, string> = { company: "Company crew", radar: "Training radar", interview: "Past interview", training: "Training invite" };

let poolCache: PoolCrew[] | null = null;

/** Lists crew from the manager's own pool matching a rank; returns selected emails. */
export default function RankCrewPicker({ rank, onChange }: { rank: string; onChange: (p: Pick[]) => void }) {
  const [pool, setPool] = useState<PoolCrew[] | null>(poolCache);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [extra, setExtra] = useState(""); const [q, setQ] = useState("");
  useEffect(() => {
    if (poolCache) return;
    void supabase.rpc("manager_training_pool" as any).then(({ data }) => { poolCache = ((data as any[]) || []) as PoolCrew[]; setPool(poolCache); });
  }, []);
  const matches = useMemo(() => (pool || []).filter((c) => rankMatches(c.rank, rank)), [pool, rank]);
  const shown = useMemo(() => !q ? matches : matches.filter((c) => `${c.first_name} ${c.last_name} ${c.email || ""} ${c.whatsapp || ""} ${c.vessel || ""}`.toLowerCase().includes(q.toLowerCase())), [matches, q]);
  useEffect(() => { // default: everyone with an email selected
    const s: Record<string, boolean> = {}; matches.forEach((c) => { if (c.email && okEmail(c.email)) s[c.id] = true; }); setSel(s);
  }, [matches]);
  const extras = useMemo(() => extra.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(okEmail), [extra]);
  useEffect(() => {
    const seen = new Set<string>(); const out: Pick[] = [];
    matches.forEach((c) => { const e = (c.email || "").toLowerCase(); if (sel[c.id] && okEmail(e) && !seen.has(e)) { seen.add(e); out.push({ email: e, name: `${c.first_name} ${c.last_name}`.trim() }); } });
    extras.forEach((e) => { if (!seen.has(e)) { seen.add(e); out.push({ email: e, name: "" }); } });
    onChange(out);
  }, [sel, extras, matches]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rank) return null;
  const withEmail = matches.filter((c) => c.email && okEmail(c.email));
  const n = withEmail.filter((c) => sel[c.id]).length;
  const all = n === withEmail.length && n > 0;
  return (
    <div style={{ marginBottom: 12, border: `1px solid rgba(212,175,55,0.3)`, borderRadius: 12, padding: 11, background: "rgba(212,175,55,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <p style={{ color: GOLD, fontSize: 12.5, fontWeight: 800, flex: 1 }}>
          {pool === null ? "Loading your crew…" : `${matches.length} ${rank} in your crew database`}
        </p>
        {withEmail.length > 0 && <button type="button" onClick={() => { const s: Record<string, boolean> = {}; if (!all) withEmail.forEach((c) => { s[c.id] = true; }); setSel(s); }}
          style={{ background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 8, padding: "4px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{all ? "Deselect all" : "Select all"}</button>}
      </div>
      {matches.length > 6 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, vessel…"
        style={{ width: "100%", marginTop: 8, background: NAVY, color: "#fff", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "7px 10px", fontSize: 12.5 }} />}
      <div style={{ maxHeight: 260, overflowY: "auto", marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
        {shown.map((c) => {
          const has = !!c.email && okEmail(c.email);
          return (
            <label key={c.id} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "7px 8px", borderRadius: 9, background: NAVY, border: `1px solid ${BORDER}`, cursor: has ? "pointer" : "default", opacity: has ? 1 : 0.7 }}>
              <input type="checkbox" disabled={!has} checked={!!sel[c.id]} onChange={(e) => setSel((s) => ({ ...s, [c.id]: e.target.checked }))} style={{ marginTop: 3, accentColor: GOLD }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ color: "#fff", fontSize: 12.5, fontWeight: 700 }}>{`${c.first_name} ${c.last_name}`.trim() || "Unnamed crew"} <span style={{ color: "#64748b", fontWeight: 500, fontSize: 11 }}>· {c.rank}</span></p>
                <p style={{ color: has ? "#cbd5e1" : "#f59e0b", fontSize: 11.5, wordBreak: "break-all" }}>{has ? c.email : "No email — WhatsApp only"}{c.whatsapp ? ` · ${c.whatsapp}` : ""}</p>
                <p style={{ color: "#64748b", fontSize: 10.5 }}>{[c.vessel, SRC[c.source || ""]].filter(Boolean).join(" · ")}</p>
              </div>
            </label>
          );
        })}
        {pool !== null && matches.length === 0 && <p style={{ color: "#94a3b8", fontSize: 11.5 }}>No {rank} found yet. Add emails below, or share the link on WhatsApp.</p>}
      </div>
      <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="+ Add other emails (comma separated)"
        style={{ width: "100%", marginTop: 8, background: NAVY, color: "#fff", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "7px 10px", fontSize: 12.5 }} />
    </div>
  );
}

/** Sends interview emails in small parallel batches; returns counts. */
export async function sendInterviewInvites(campaignId: string, picks: Pick[]) {
  let sent = 0, skipped = 0, failed = 0;
  for (let i = 0; i < picks.length; i += 5) {
    await Promise.all(picks.slice(i, i + 5).map(async (p) => {
      const { data, error } = await supabase.functions.invoke("send-interview-invite", { body: { campaign_id: campaignId, email: p.email, name: p.name || undefined } });
      const d: any = data;
      if (error || !d?.ok) failed++; else if (d.skipped) skipped++; else sent++;
    }));
  }
  const parts = [`${sent} emailed`, skipped && `${skipped} already invited today`, failed && `${failed} failed`].filter(Boolean).join(" · ");
  (failed ? toast.warning : toast.success)(`Interview invitations: ${parts}`);
  return { sent, skipped, failed };
}
