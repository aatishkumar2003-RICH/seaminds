import { useEffect, useState } from "react";
import { toast } from "sonner";
import { acceptSlot, counterSlots, countdown, formatSlot, localInputToIso, schedulePhase, SCHEDULE_ERRORS, type InterviewSchedule } from "@/lib/interviewSchedule";

interface Props {
  inviteId: string;
  schedule: InterviewSchedule;
  me: "crew" | "manager";
  onJoin?: () => void;
  onChanged: () => void;
}

/** Shared accept / counter-propose / countdown card used by crew and managers. */
export default function InterviewScheduleCard({ inviteId, schedule, me, onJoin, onChanged }: Props) {
  const [, tick] = useState(0);
  const [counter, setCounter] = useState(false);
  const [times, setTimes] = useState(["", "", ""]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(t); }, []);

  const phase = schedulePhase(schedule, me);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const run = async (p: Promise<{ ok: boolean; error?: string }>, ok: string) => {
    setBusy(true); const r = await p; setBusy(false);
    if (!r.ok) { toast.error(SCHEDULE_ERRORS[r.error || ""] || "Could not save. Check your connection."); return; }
    toast.success(ok); setCounter(false); onChanged();
  };
  const sendCounter = () => {
    const iso = times.map(localInputToIso).filter(Boolean);
    if (!iso.length) { toast.error("Add at least one time."); return; }
    run(counterSlots(inviteId, iso), "New times sent ✓");
  };

  return (
    <div className="space-y-2">
      {phase.kind === "flex_open" && (
        <p className="text-xs text-muted-foreground">Start any time{phase.endsAt ? ` before ${formatSlot(phase.endsAt)} (${countdown(phase.endsAt.getTime() - Date.now())} left)` : ""}. Find a quiet place with good signal.</p>
      )}
      {phase.kind === "flex_expired" && <p className="text-xs text-destructive">The interview window has closed. Propose a new time below.</p>}
      {phase.kind === "your_turn" && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">{me === "crew" ? "The company proposed these times — pick one:" : "The candidate proposed these times — pick one:"}</p>
          {phase.slots.length === 0 && <p className="text-xs text-muted-foreground">All proposed times have passed. Suggest new ones.</p>}
          {phase.slots.map((d) => (
            <button key={d.toISOString()} disabled={busy} onClick={() => run(acceptSlot(inviteId, d.toISOString()), "Interview time confirmed ✓")}
              className="flex w-full items-center justify-between rounded-xl border border-primary/40 bg-background px-3 py-2.5 text-left text-sm text-foreground hover:bg-primary/10">
              <span>{formatSlot(d)}</span><span className="text-xs font-bold text-primary">Confirm</span>
            </button>
          ))}
        </div>
      )}
      {phase.kind === "waiting_other" && (
        <p className="text-xs text-muted-foreground">⏳ Waiting for {me === "crew" ? "the company" : "the candidate"} to confirm one of: {phase.slots.map((d) => formatSlot(d)).join(" / ") || "—"}</p>
      )}
      {phase.kind === "upcoming" && (
        <div className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-center">
          <p className="text-xs text-muted-foreground">Confirmed for</p>
          <p className="text-sm font-bold text-foreground">{formatSlot(phase.at)}</p>
          <p className="mt-1 text-xs text-primary">Room opens in {countdown(phase.msToOpen)}</p>
        </div>
      )}
      {phase.kind === "missed" && <p className="text-xs text-destructive">The agreed time ({formatSlot(phase.at)}) has passed. Propose a new time.</p>}

      {me === "crew" && onJoin && (phase.kind === "flex_open" || phase.kind === "join_now") && (
        <button onClick={onJoin} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground animate-pulse">🎤 {phase.kind === "join_now" ? "Join interview now" : "Start interview"}</button>
      )}

      {phase.kind !== "join_now" && (counter ? (
        <div className="space-y-2 rounded-xl border border-border p-2">
          <p className="text-[11px] text-muted-foreground">Times in your zone ({zone}). Up to 3.</p>
          {times.map((v, i) => (
            <input key={i} type="datetime-local" value={v} onChange={(e) => setTimes((t) => t.map((x, j) => (j === i ? e.target.value : x)))}
              className="w-full rounded-lg border border-input bg-background p-2 text-sm text-foreground" />
          ))}
          <div className="flex gap-2">
            <button disabled={busy} onClick={sendCounter} className="flex-1 rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground">Send times</button>
            <button onClick={() => setCounter(false)} className="rounded-xl border border-primary px-3 py-2 text-sm text-primary">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCounter(true)} className="w-full rounded-xl border border-primary/50 py-2 text-xs font-bold text-primary">🕑 {me === "crew" ? "Suggest a different time" : "Propose new times"}</button>
      ))}
    </div>
  );
}
