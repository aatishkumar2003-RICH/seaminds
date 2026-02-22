import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Moon, Sun, Clock } from "lucide-react";
import { format, startOfDay, subDays } from "date-fns";

interface RestEntry {
  start: string; // ISO
  end?: string;  // ISO
}

const STORAGE_KEY = "seamind_rest_hours";

function loadEntries(): RestEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
}

function saveEntries(entries: RestEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function hoursForDay(entries: RestEntry[], day: Date): number {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = dayStart + 86400000;
  let total = 0;
  for (const e of entries) {
    const s = new Date(e.start).getTime();
    const en = e.end ? new Date(e.end).getTime() : Date.now();
    const overlapStart = Math.max(s, dayStart);
    const overlapEnd = Math.min(en, dayEnd);
    if (overlapEnd > overlapStart) total += overlapEnd - overlapStart;
  }
  return total / 3600000;
}

interface RestHoursTrackerProps {
  onBack: () => void;
}

const RestHoursTracker = ({ onBack }: RestHoursTrackerProps) => {
  const [entries, setEntries] = useState<RestEntry[]>(loadEntries);
  const [now, setNow] = useState(Date.now());

  // Tick every minute for live updates
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(i);
  }, []);

  const isResting = entries.length > 0 && !entries[entries.length - 1].end;

  const handleRestStart = () => {
    const updated = [...entries, { start: new Date().toISOString() }];
    setEntries(updated);
    saveEntries(updated);
  };

  const handleRestEnd = () => {
    if (!isResting) return;
    const updated = [...entries];
    updated[updated.length - 1] = { ...updated[updated.length - 1], end: new Date().toISOString() };
    setEntries(updated);
    saveEntries(updated);
  };

  const today = useMemo(() => new Date(), []);
  const todayHours = hoursForDay(entries, today);

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 6; i >= 0; i--) days.push(subDays(today, i));
    return days;
  }, [today]);

  const weekTotal = useMemo(() => {
    return weekDays.reduce((sum, d) => sum + hoursForDay(entries, d), 0);
  }, [entries, weekDays, now]);

  const todayCompliant = todayHours >= 10;
  const weekCompliant = weekTotal >= 77;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-3">
        <button onClick={onBack} className="p-1 rounded-lg hover:bg-secondary transition-colors">
          <ArrowLeft size={20} className="text-muted-foreground" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">My Rest Hours Log</h1>
          <p className="text-xs text-muted-foreground">STCW Compliance Tracker</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* STCW Rules */}
        <div className="rounded-xl bg-primary/10 border border-primary/30 p-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">STCW Requirements</p>
          <p className="text-sm text-foreground leading-relaxed">
            Minimum <span className="font-bold text-primary">10 hours</span> rest in any 24-hour period.
          </p>
          <p className="text-sm text-foreground leading-relaxed">
            Minimum <span className="font-bold text-primary">77 hours</span> rest in any 7-day period.
          </p>
        </div>

        {/* Rest Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleRestStart}
            disabled={isResting}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white font-medium text-sm rounded-xl py-4 transition-colors"
          >
            <Moon size={18} />
            Rest Started
          </button>
          <button
            onClick={handleRestEnd}
            disabled={!isResting}
            className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-30 text-white font-medium text-sm rounded-xl py-4 transition-colors"
          >
            <Sun size={18} />
            Rest Ended
          </button>
        </div>

        {isResting && (
          <div className="flex items-center gap-2 justify-center">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <p className="text-xs text-blue-400 font-medium">Currently resting...</p>
          </div>
        )}

        {/* Today's Progress */}
        <div className="rounded-xl bg-card border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Today's Rest</p>
            <div className="flex items-center gap-1.5">
              <Clock size={14} className="text-muted-foreground" />
              <span className={`text-lg font-bold ${todayCompliant ? "text-emerald-400" : "text-red-400"}`}>
                {todayHours.toFixed(1)}h
              </span>
              <span className="text-xs text-muted-foreground">/ 10h</span>
            </div>
          </div>
          <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${todayCompliant ? "bg-emerald-500" : "bg-red-500"}`}
              style={{ width: `${Math.min(100, (todayHours / 10) * 100)}%` }}
            />
          </div>
          <p className={`text-xs ${todayCompliant ? "text-emerald-400" : "text-red-400"}`}>
            {todayCompliant ? "✅ Compliant" : `⚠️ ${(10 - todayHours).toFixed(1)}h more rest needed`}
          </p>
        </div>

        {/* Weekly Progress */}
        <div className="rounded-xl bg-card border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">This Week</p>
            <div className="flex items-center gap-1.5">
              <span className={`text-lg font-bold ${weekCompliant ? "text-emerald-400" : "text-red-400"}`}>
                {weekTotal.toFixed(1)}h
              </span>
              <span className="text-xs text-muted-foreground">/ 77h</span>
            </div>
          </div>
          <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${weekCompliant ? "bg-emerald-500" : "bg-red-500"}`}
              style={{ width: `${Math.min(100, (weekTotal / 77) * 100)}%` }}
            />
          </div>
          <p className={`text-xs ${weekCompliant ? "text-emerald-400" : "text-red-400"}`}>
            {weekCompliant ? "✅ Compliant" : `⚠️ ${(77 - weekTotal).toFixed(1)}h more rest needed this week`}
          </p>
        </div>

        {/* 7-Day Calendar */}
        <div className="rounded-xl bg-card border border-border p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">7-Day Overview</p>
          <div className="flex items-center justify-between">
            {weekDays.map((d) => {
              const hrs = hoursForDay(entries, d);
              const compliant = hrs >= 10;
              const hasData = hrs > 0;
              return (
                <div key={d.toISOString()} className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">{format(d, "EEE")}</span>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      !hasData
                        ? "bg-secondary text-muted-foreground"
                        : compliant
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {hasData ? `${hrs.toFixed(0)}h` : "—"}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{format(d, "d")}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="rounded-xl bg-secondary/50 border border-border p-4">
          <p className="text-xs text-muted-foreground leading-relaxed text-center">
            This log is private and belongs to you. It is never shared with your company or captain. Keep it as your personal record in case of any dispute about rest hours.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RestHoursTracker;
