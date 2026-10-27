import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { InterviewSchedule } from "@/lib/interviewSchedule";

interface Hub {
  interviews: (InterviewSchedule & { id: string; token: string; company_name: string | null; rank: string | null; schedule_note: string | null })[];
  training: { id: string; token: string; status: string; title: string }[];
  training_done: number;
  contracts: { id: string; vessel_name: string | null; rank: string | null; employer_name: string | null; start_date: string | null }[];
  documents: { id: string; company_name: string | null; rank_applied: string | null }[];
  tickets: number;
}

/** One place for every next step the crew must take: contracts, interviews, training, documents. */
export default function ActionHub() {
  const navigate = useNavigate();
  const [hub, setHub] = useState<Hub | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_action_hub" as any);
    if (error) { setFailed(true); return; }
    setFailed(false); setHub(data as unknown as Hub);
  }, []);
  useEffect(() => {
    load();
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [load]);

  if (failed) return <p className="mx-4 mb-3 rounded-xl border border-border p-3 text-xs text-muted-foreground">Could not load your actions. <button className="text-primary underline" onClick={load}>Retry</button></p>;
  if (!hub) return <div className="mx-4 mb-3 h-24 animate-pulse rounded-2xl bg-card" />;

  const total = hub.contracts.length + hub.interviews.length + hub.training.length + hub.documents.length;
  const trainTotal = hub.training.length + Number(hub.training_done || 0);

  return (
    <section className="mx-4 mb-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-primary">🧭 Your next actions</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${total ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{total ? `${total} to do` : "All clear"}</span>
      </div>

      {total === 0 && (
        <div className="rounded-2xl border border-primary/30 bg-card p-4 text-center">
          <p className="text-2xl">⚓</p>
          <p className="text-sm font-semibold text-foreground">Nothing waiting on you</p>
          <p className="text-xs text-muted-foreground">When a company asks for an interview, training or documents, it appears here first.</p>
          <button onClick={() => navigate("/feed")} className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Browse vacancies</button>
        </div>
      )}

      {hub.contracts.map((c) => (
        <div key={c.id} className="rounded-2xl border-2 border-primary bg-card p-4 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-primary">1 · Contract ready</p>
          <p className="text-sm font-semibold text-foreground">{c.employer_name} · {c.rank} · {c.vessel_name || "Vessel"}</p>
          <p className="text-xs text-muted-foreground">Review your employment agreement{c.start_date ? ` starting ${c.start_date}` : ""}.</p>
          <button onClick={() => navigate("/my-payslips")} className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground">📜 Review contract</button>
        </div>
      ))}

      {hub.interviews.map((i) => (
        <div key={i.id} className="rounded-2xl border border-primary/50 bg-card p-4 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-primary">🎤 AI interview</p>
          <p className="text-sm font-semibold text-foreground">{i.company_name || "Company"}{i.rank ? ` · ${i.rank}` : ""}</p>
          {i.schedule_note && <p className="text-xs italic text-muted-foreground">“{i.schedule_note}”</p>}
          <p className="text-xs text-muted-foreground">The company will contact you on WhatsApp or email to agree the time. Start when you are ready.</p>
          <button onClick={() => navigate(`/interview/${encodeURIComponent(i.token)}`)} className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground">🚀 Open interview</button>
        </div>
      ))}

      {hub.training.length > 0 && (
        <div className="rounded-2xl border border-primary/30 bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary">🎓 Training requested</p>
            <span className="text-xs text-muted-foreground">{hub.training_done}/{trainTotal} done</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary" style={{ width: `${trainTotal ? (Number(hub.training_done) / trainTotal) * 100 : 0}%` }} />
          </div>
          {hub.training.slice(0, 3).map((t) => (
            <button key={t.id} onClick={() => navigate(`/training/${encodeURIComponent(t.token)}`)}
              className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2 text-left text-sm text-foreground hover:bg-primary/10">
              <span className="truncate">{t.title}</span><span className="ml-2 shrink-0 text-xs font-bold text-primary">{t.status === "opened" ? "Continue" : "Start"} →</span>
            </button>
          ))}
          {hub.training.length > 3 && <button onClick={() => navigate("/training")} className="text-xs text-primary underline">+{hub.training.length - 3} more</button>}
        </div>
      )}

      {hub.documents.map((d) => (
        <div key={d.id} className="rounded-2xl border border-primary/30 bg-card p-4 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-primary">📄 Documents requested</p>
          <p className="text-sm text-foreground">{d.company_name} needs your documents for {d.rank_applied || "the position"}.</p>
          <button onClick={() => navigate("/app?tab=cv")} className="w-full rounded-xl border border-primary py-2 text-sm font-bold text-primary">Upload to certificate wallet</button>
        </div>
      ))}

      {hub.tickets > 0 && <p className="text-xs text-muted-foreground">💬 {hub.tickets} open joining issue{hub.tickets > 1 ? "s" : ""} — see the cards below.</p>}
    </section>
  );
}
