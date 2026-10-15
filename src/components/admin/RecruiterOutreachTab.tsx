import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = { id: string; email: string; recruiter_name: string | null; active_vacancies: number; applications_total: number; stage: string; touches_sent: number; last_kind: string | null; last_contacted_at: string | null; next_due_at: string };
const STAGES = ["new", "engaging", "nurture", "replied", "joined", "unsubscribed", "bounced", "paused"];
const gold = "#D4AF37";

export default function RecruiterOutreachTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [testEmail, setTestEmail] = useState("admin@seaminds.life");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<any>(null);

  const load = async () => {
    const { data } = await supabase.from("recruiter_outreach_contacts" as any).select("*").order("active_vacancies", { ascending: false }).limit(1000);
    setRows((data as any) || []);
  };
  useEffect(() => { load(); }, []);

  const call = async (body: object) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("recruiter-outreach", { body });
    setBusy(false);
    if (error) { toast.error("Could not run outreach"); return null; }
    return data;
  };
  const setStage = async (id: string, stage: string) => {
    const { error } = await supabase.from("recruiter_outreach_contacts" as any).update({ stage, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error("Update failed"); else { toast.success(`Marked ${stage}`); load(); }
  };

  const counts = STAGES.reduce<Record<string, number>>((a, s) => ({ ...a, [s]: rows.filter((r) => r.stage === s).length }), {});
  const shown = rows.filter((r) => (filter === "all" || r.stage === filter) && (!q || `${r.email} ${r.recruiter_name}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4" style={{ background: "#112240", border: "1px solid rgba(212,175,55,0.3)" }}>
        <h2 className="text-lg font-bold" style={{ color: gold }}>Recruiter Outreach</h2>
        <p className="text-sm" style={{ color: "#94A3B8" }}>Runs daily: up to 30 personal emails from admin@seaminds.life. 4 intro touches, then every 14 days a vacancy report, blog digest or new idea. Stops automatically on join or unsubscribe. Replies land in your Zoho inbox — mark them "replied" here to stop the sequence.</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="px-3 py-2 rounded-xl text-sm bg-transparent" style={{ border: "1px solid rgba(212,175,55,0.3)", color: "#fff" }} />
          <button disabled={busy} onClick={async () => { const d = await call({ test_email: testEmail }); if (d) toast.success("7 sample emails sent"); }} className="px-4 py-2 rounded-xl font-bold text-sm" style={{ background: gold, color: "#0D1B2A" }}>Send me all samples</button>
          <button disabled={busy} onClick={async () => { const d = await call({ dry: true }); if (d) { setInfo(d); load(); } }} className="px-4 py-2 rounded-xl text-sm font-bold" style={{ border: `1px solid ${gold}`, color: gold }}>Sync & check due</button>
        </div>
        {info && <p className="text-sm mt-2" style={{ color: "#e2e8f0" }}>Due now: {info.due} (sends {Math.min(info.due, info.cap)} next run) · {info.stats?.liveJobs} live jobs · {info.stats?.apps30} applications/30d</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", ...STAGES].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className="px-3 py-1 rounded-xl text-xs" style={{ border: `1px solid ${filter === s ? gold : "rgba(212,175,55,0.3)"}`, color: filter === s ? gold : "#94A3B8" }}>
            {s} {s === "all" ? rows.length : counts[s]}
          </button>
        ))}
        <input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="px-3 py-1 rounded-xl text-xs bg-transparent" style={{ border: "1px solid rgba(212,175,55,0.3)", color: "#fff" }} />
      </div>

      <div className="space-y-2">
        {shown.slice(0, 300).map((r) => (
          <div key={r.id} className="rounded-xl p-3 flex flex-wrap items-center gap-2 justify-between" style={{ background: "#112240", border: "1px solid rgba(212,175,55,0.15)" }}>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate">{r.recruiter_name || "—"} <span className="font-normal" style={{ color: "#94A3B8" }}>{r.email}</span></div>
              <div className="text-xs" style={{ color: "#94A3B8" }}>{r.active_vacancies} live · {r.applications_total} apps · {r.touches_sent} emails{r.last_kind ? ` (last: ${r.last_kind})` : ""} · next {new Date(r.next_due_at).toLocaleDateString()}</div>
            </div>
            <select value={r.stage} onChange={(e) => setStage(r.id, e.target.value)} className="text-xs rounded-lg px-2 py-1" style={{ background: "#0D1B2A", color: gold, border: "1px solid rgba(212,175,55,0.3)" }}>
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
