import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import InterviewScheduleCard from "@/components/InterviewScheduleCard";
import { localInputToIso, openFlexWindow, proposeSlots, SCHEDULE_ERRORS, type InterviewSchedule } from "@/lib/interviewSchedule";

/** Manager control: give the candidate a flexible window or propose up to 3 fixed times. */
export default function InterviewScheduler({ inviteId }: { inviteId: string }) {
  const [s, setS] = useState<InterviewSchedule | null>(null);
  const [open, setOpen] = useState(false);
  const [times, setTimes] = useState(["", "", ""]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("interview_invites")
      .select("schedule_mode, proposed_slots, proposed_by, scheduled_at, window_ends_at").eq("id", inviteId).maybeSingle();
    setS((data as unknown as InterviewSchedule) || null);
  }, [inviteId]);
  useEffect(() => { if (open) load(); }, [open, load]);

  const done = async (p: Promise<{ ok: boolean; error?: string }>, msg: string) => {
    setBusy(true); const r = await p; setBusy(false);
    if (!r.ok) { toast.error(SCHEDULE_ERRORS[r.error || ""] || "Could not save."); return; }
    toast.success(msg); load();
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="mt-2 w-full rounded-lg border border-primary/60 py-2 text-xs font-bold text-primary">🗓 Schedule interview</button>
  );

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-primary/30 p-3">
      {s && (s.schedule_mode !== "flex" || s.window_ends_at) && (
        <InterviewScheduleCard inviteId={inviteId} schedule={s} me="manager" onChanged={load} />
      )}
      <p className="text-[11px] font-semibold text-muted-foreground">Option A — flexible window</p>
      <div className="flex gap-2">
        {[24, 48, 72].map((h) => (
          <button key={h} disabled={busy} onClick={() => done(openFlexWindow(inviteId, h, note), `Candidate can start within ${h}h`)}
            className="flex-1 rounded-lg border border-primary/50 py-1.5 text-xs font-bold text-primary">{h}h</button>
        ))}
      </div>
      <p className="text-[11px] font-semibold text-muted-foreground">Option B — propose fixed times (your local time)</p>
      {times.map((v, i) => (
        <input key={i} type="datetime-local" value={v} onChange={(e) => setTimes((t) => t.map((x, j) => (j === i ? e.target.value : x)))}
          className="w-full rounded-lg border border-input bg-background p-2 text-sm text-foreground" />
      ))}
      <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} placeholder="Note to candidate (optional)"
        className="w-full rounded-lg border border-input bg-background p-2 text-sm text-foreground" />
      <div className="flex gap-2">
        <button disabled={busy} onClick={() => { const iso = times.map(localInputToIso).filter(Boolean); if (!iso.length) { toast.error("Add at least one time."); return; } done(proposeSlots(inviteId, iso, note), "Times sent to candidate ✓"); }}
          className="flex-1 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground">Send times</button>
        <button onClick={() => setOpen(false)} className="rounded-lg border border-border px-3 text-xs text-muted-foreground">Close</button>
      </div>
      <p className="text-[10px] text-muted-foreground">The candidate sees times in their own timezone and can confirm or suggest others.</p>
    </div>
  );
}
