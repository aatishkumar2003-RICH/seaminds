import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { checkRest, REST_STORAGE_KEY, type RestLog } from "@/lib/restHours";

/** Home one-tap duty/rest switch. Shares the same log as the Rest Hours screen. */
const RestQuickLog = ({ profileId, onOpen }: { profileId?: string; onOpen: () => void }) => {
  const [logs, setLogs] = useState<RestLog[]>(() => { try { return JSON.parse(localStorage.getItem(REST_STORAGE_KEY) || "[]"); } catch { return []; } });
  useEffect(() => {
    if (!profileId) return;
    supabase.from("rest_hours_data").select("entries").eq("crew_profile_id", profileId).maybeSingle()
      .then(({ data }) => { if (Array.isArray(data?.entries) && data.entries.length) setLogs(data.entries as unknown as RestLog[]); });
  }, [profileId]);
  const current = logs.at(-1)?.type ?? null;
  const { rest24, issues } = checkRest(logs);
  const toggle = async () => {
    const next = [...logs, { type: current === "work" ? "rest" : "work", timestamp: new Date().toISOString() } as RestLog];
    setLogs(next);
    localStorage.setItem(REST_STORAGE_KEY, JSON.stringify(next));
    if (profileId) await supabase.from("rest_hours_data").upsert({ crew_profile_id: profileId, entries: next as any, updated_at: new Date().toISOString() }, { onConflict: "crew_profile_id" });
  };
  return (
    <div className="mt-2 flex items-center gap-2 rounded-xl border border-primary/30 bg-card p-2">
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="text-xs font-bold text-foreground">⏱ {current ? (current === "work" ? "On duty" : "Resting") : "Rest hours"}{logs.length ? ` · ${rest24}h rest / 24h` : ""}</p>
        <p className={`truncate text-[10px] ${issues.length ? "text-destructive" : "text-muted-foreground"}`}>{issues[0] || (logs.length ? "Within STCW / MLC minimums" : "Tap the button when your duty starts")}</p>
      </button>
      <button onClick={toggle} className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
        {current === "work" ? "Start rest" : "Start duty"}
      </button>
    </div>
  );
};
export default RestQuickLog;
