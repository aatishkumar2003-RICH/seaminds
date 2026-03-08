import { useState, useEffect, useMemo } from "react";

interface LogEntry {
  type: "work" | "rest";
  timestamp: string;
}

const STORAGE_KEY = "seaminds_rest_logs";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface RestHoursTrackerProps {
  onNavigate?: (screen: string) => void;
}

const RestHoursTracker = ({ onNavigate }: RestHoursTrackerProps) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setLogs(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const saveLogs = (updated: LogEntry[]) => {
    setLogs(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const logEntry = (type: "work" | "rest") => {
    const entry: LogEntry = { type, timestamp: new Date().toISOString() };
    saveLogs([...logs, entry]);
    setNow(new Date());
  };

  const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
  const currentStatus = lastLog?.type || null;
  const currentSince = lastLog ? new Date(lastLog.timestamp) : null;

  // Calculate hours of a given type within a rolling window
  const calcHours = (type: "work" | "rest", hoursBack: number) => {
    const cutoff = new Date(now.getTime() - hoursBack * 3600000);
    let totalMs = 0;

    let stateAtCutoff: "work" | "rest" | null = null;
    for (const l of logs) {
      if (new Date(l.timestamp) <= cutoff) stateAtCutoff = l.type;
    }

    const segments: { type: "work" | "rest"; start: Date; end: Date }[] = [];
    let currentType = stateAtCutoff;
    let segStart = cutoff;

    for (const l of logs) {
      const t = new Date(l.timestamp);
      if (t <= cutoff) continue;
      if (currentType) {
        segments.push({ type: currentType, start: segStart, end: t });
      }
      currentType = l.type;
      segStart = t;
    }
    if (currentType) {
      segments.push({ type: currentType, start: segStart, end: now });
    }

    for (const seg of segments) {
      if (seg.type === type) {
        totalMs += seg.end.getTime() - seg.start.getTime();
      }
    }

    return Math.round((totalMs / 3600000) * 10) / 10;
  };

  // Calculate rest hours for a specific calendar day (midnight to midnight)
  const calcDayRest = (dayStart: Date) => {
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    let totalMs = 0;

    let stateAtStart: "work" | "rest" | null = null;
    for (const l of logs) {
      if (new Date(l.timestamp) <= dayStart) stateAtStart = l.type;
    }

    const segments: { type: "work" | "rest"; start: Date; end: Date }[] = [];
    let currentType = stateAtStart;
    let segStart = dayStart;

    for (const l of logs) {
      const t = new Date(l.timestamp);
      if (t <= dayStart) continue;
      if (t >= dayEnd) break;
      if (currentType) {
        segments.push({ type: currentType, start: segStart, end: t });
      }
      currentType = l.type;
      segStart = t;
    }
    const capEnd = now < dayEnd ? now : dayEnd;
    if (currentType && segStart < capEnd) {
      segments.push({ type: currentType, start: segStart, end: capEnd });
    }

    for (const seg of segments) {
      if (seg.type === "rest") {
        totalMs += seg.end.getTime() - seg.start.getTime();
      }
    }

    return Math.round((totalMs / 3600000) * 10) / 10;
  };

  const calcDayWork = (dayStart: Date) => {
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    let totalMs = 0;

    let stateAtStart: "work" | "rest" | null = null;
    for (const l of logs) {
      if (new Date(l.timestamp) <= dayStart) stateAtStart = l.type;
    }

    const segments: { type: "work" | "rest"; start: Date; end: Date }[] = [];
    let currentType = stateAtStart;
    let segStart = dayStart;

    for (const l of logs) {
      const t = new Date(l.timestamp);
      if (t <= dayStart) continue;
      if (t >= dayEnd) break;
      if (currentType) {
        segments.push({ type: currentType, start: segStart, end: t });
      }
      currentType = l.type;
      segStart = t;
    }
    const capEnd = now < dayEnd ? now : dayEnd;
    if (currentType && segStart < capEnd) {
      segments.push({ type: currentType, start: segStart, end: capEnd });
    }

    for (const seg of segments) {
      if (seg.type === "work") {
        totalMs += seg.end.getTime() - seg.start.getTime();
      }
    }

    return Math.round((totalMs / 3600000) * 10) / 10;
  };

  const hoursWorkedToday = calcHours("work", 24);
  const hoursRestedToday = calcHours("rest", 24);
  const hoursRestedWeekly = calcHours("rest", 168);

  // Violation detection
  const hasViolation = logs.length > 0 && (hoursRestedToday < 10 || hoursRestedWeekly < 77);
  const violationText = hoursRestedToday < 10
    ? `You have ${hoursRestedToday} hours rest in last 24h. Minimum is 10 hours.`
    : `You have ${hoursRestedWeekly} hours rest in last 7 days. Minimum is 77 hours.`;

  // 7-day history
  const last7Days = useMemo(() => {
    const days: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    return days;
  }, [now]);

  const dayData = useMemo(() => {
    return last7Days.map((d) => ({
      date: d,
      rest: calcDayRest(d),
      work: calcDayWork(d),
      label: DAY_LABELS[d.getDay()],
      dateStr: `${d.getDate()}/${d.getMonth() + 1}`,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last7Days, logs, now]);

  const maxBarHours = 24;

  // Export week report
  const exportReport = () => {
    const weekStart = last7Days[0];
    const dateStr = weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    let report = `SeaMinds Rest Hours Report — Week of ${dateStr}\n\n`;

    dayData.forEach((d, i) => {
      const compliant = d.rest >= 10;
      report += `Day ${i + 1} (${d.label} ${d.dateStr}): Worked ${d.work}h, Rested ${d.rest}h [${compliant ? "OK" : "VIOLATION"}]\n`;
    });

    const totalRest = dayData.reduce((s, d) => s + d.rest, 0);
    report += `\nWeekly Rest Total: ${totalRest.toFixed(1)}h ${totalRest >= 77 ? "[OK]" : "[VIOLATION — below 77h]"}\n`;
    report += `\nGenerated by SeaMinds — MLC 2006 Compliance Tracker`;

    // Copy to clipboard and show in alert
    navigator.clipboard?.writeText(report).catch(() => {});
    alert(report);
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col h-full px-4 py-3 overflow-y-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: "#D4AF37" }}>
          ⏱ Rest Hours Tracker
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          MLC 2006 — Your Legal Protection
        </p>
      </div>

      {/* Violation Alert */}
      {hasViolation && (
        <div
          className="rounded-xl p-3 mb-4"
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid #ef4444",
          }}
        >
          <p className="text-sm font-bold mb-1" style={{ color: "#fca5a5" }}>
            ⚠️ MLC REST VIOLATION DETECTED
          </p>
          <p className="text-xs mb-3" style={{ color: "#fca5a5" }}>
            {violationText}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => onNavigate?.("community")}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#fca5a5",
              }}
            >
              📋 Log in Safety Report
            </button>
            <a
              href="https://www.ilo.org/mlc"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#fca5a5",
              }}
            >
              ℹ️ Know Your Rights
            </a>
          </div>
        </div>
      )}

      {/* MLC Requirements */}
      <div
        className="rounded-xl p-3 mb-4"
        style={{
          background: "rgba(212,175,55,0.06)",
          border: "1px solid rgba(212,175,55,0.15)",
        }}
      >
        <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "#D4AF37" }}>
          MLC 2006 Minimums
        </p>
        <div className="space-y-0.5">
          <p className="text-[11px] text-muted-foreground">• Min <span style={{ color: "#D4AF37" }}>10 hours</span> rest per 24-hour period</p>
          <p className="text-[11px] text-muted-foreground">• Min <span style={{ color: "#D4AF37" }}>77 hours</span> rest per 7-day period</p>
          <p className="text-[11px] text-muted-foreground">• Max <span style={{ color: "#D4AF37" }}>14 hours</span> work per 24-hour period</p>
        </div>
      </div>

      {/* Log Buttons */}
      <div className="flex gap-3 mb-3">
        <button
          onClick={() => logEntry("work")}
          className="flex-1 py-4 rounded-xl font-bold text-sm transition-all"
          style={{
            background: currentStatus === "work" ? "rgba(212,175,55,0.15)" : "rgba(13,27,42,0.8)",
            border: "1.5px solid #D4AF37",
            color: "#D4AF37",
          }}
        >
          🟢 LOG WORK START
        </button>
        <button
          onClick={() => logEntry("rest")}
          className="flex-1 py-4 rounded-xl font-bold text-sm transition-all"
          style={{
            background: currentStatus === "rest" ? "rgba(212,175,55,0.15)" : "rgba(19,34,54,0.8)",
            border: "1.5px solid #D4AF37",
            color: "#D4AF37",
          }}
        >
          🔴 LOG REST START
        </button>
      </div>

      {/* Current Status */}
      {currentStatus && currentSince && (
        <p className="text-xs text-muted-foreground text-center mb-5">
          Currently: <span className="font-bold text-foreground">{currentStatus.toUpperCase()}</span> since{" "}
          <span style={{ color: "#D4AF37" }}>{formatTime(currentSince)}</span>
        </p>
      )}

      {/* Today's Summary */}
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Today's Summary (24h)
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div
            className="rounded-xl p-3 text-center"
            style={{
              background: "rgba(13,27,42,0.8)",
              border: `1px solid ${hoursWorkedToday > 14 ? "rgba(239,68,68,0.4)" : "rgba(212,175,55,0.15)"}`,
            }}
          >
            <p
              className="text-2xl font-bold"
              style={{ color: hoursWorkedToday > 14 ? "#ef4444" : "#D4AF37" }}
            >
              {hoursWorkedToday}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Hours Worked</p>
            {hoursWorkedToday > 14 && (
              <p className="text-[9px] font-bold mt-1" style={{ color: "#ef4444" }}>
                ⚠ OVER LIMIT
              </p>
            )}
          </div>

          <div
            className="rounded-xl p-3 text-center"
            style={{
              background: "rgba(13,27,42,0.8)",
              border: `1px solid ${hoursRestedToday < 10 ? "rgba(239,68,68,0.4)" : "rgba(212,175,55,0.15)"}`,
            }}
          >
            <p
              className="text-2xl font-bold"
              style={{ color: hoursRestedToday < 10 ? "#ef4444" : "#D4AF37" }}
            >
              {hoursRestedToday}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Hours Rested</p>
            {hoursRestedToday < 10 && logs.length > 0 && (
              <p className="text-[9px] font-bold mt-1" style={{ color: "#ef4444" }}>
                ⚠ BELOW MIN
              </p>
            )}
          </div>

          <div
            className="rounded-xl p-3 text-center"
            style={{
              background: "rgba(13,27,42,0.8)",
              border: `1px solid ${hoursRestedWeekly < 77 ? "rgba(239,68,68,0.4)" : "rgba(212,175,55,0.15)"}`,
            }}
          >
            <p
              className="text-2xl font-bold"
              style={{ color: hoursRestedWeekly < 77 ? "#ef4444" : "#D4AF37" }}
            >
              {hoursRestedWeekly}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Weekly Rest</p>
            {hoursRestedWeekly < 77 && logs.length > 0 && (
              <p className="text-[9px] font-bold mt-1" style={{ color: "#ef4444" }}>
                ⚠ BELOW 77h
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 7-Day Bar Chart */}
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
          7-Day Rest History
        </p>
        <div
          className="rounded-xl p-4"
          style={{
            background: "rgba(13,27,42,0.8)",
            border: "1px solid rgba(212,175,55,0.15)",
          }}
        >
          <div className="flex items-end justify-between gap-2" style={{ height: 120 }}>
            {dayData.map((d, i) => {
              const barHeight = Math.max(4, (d.rest / maxBarHours) * 100);
              const isCompliant = d.rest >= 10;
              return (
                <div key={i} className="flex flex-col items-center flex-1 h-full justify-end">
                  <p className="text-[9px] font-bold mb-1" style={{ color: isCompliant ? "#22c55e" : "#ef4444" }}>
                    {d.rest > 0 ? `${d.rest}h` : "—"}
                  </p>
                  <div
                    className="w-full rounded-t-md transition-all"
                    style={{
                      height: `${barHeight}%`,
                      background: isCompliant
                        ? "linear-gradient(to top, rgba(34,197,94,0.6), rgba(34,197,94,0.3))"
                        : "linear-gradient(to top, rgba(239,68,68,0.6), rgba(239,68,68,0.3))",
                      border: `1px solid ${isCompliant ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
                      borderBottom: "none",
                      minHeight: 4,
                    }}
                  />
                </div>
              );
            })}
          </div>
          {/* 10h compliance line label */}
          <div className="flex justify-between mt-1.5">
            {dayData.map((d, i) => (
              <div key={i} className="flex-1 text-center">
                <p className="text-[9px] text-muted-foreground">{d.label}</p>
                <p className="text-[8px] text-muted-foreground">{d.dateStr}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Logs */}
      {logs.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Recent Log Entries
          </p>
          <div className="space-y-1.5">
            {[...logs]
              .reverse()
              .slice(0, 10)
              .map((entry, i) => {
                const t = new Date(entry.timestamp);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 rounded-lg"
                    style={{
                      background: i % 2 === 0 ? "rgba(13,27,42,0.8)" : "rgba(13,27,42,0.6)",
                    }}
                  >
                    <span className="text-xs text-foreground">
                      {entry.type === "work" ? "🟢" : "🔴"}{" "}
                      {entry.type === "work" ? "Work Started" : "Rest Started"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {t.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{" "}
                      {formatTime(t)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Export Week Report */}
      {logs.length > 0 && (
        <button
          onClick={exportReport}
          className="w-full py-3 rounded-xl font-bold text-sm mb-4 transition-all"
          style={{
            background: "rgba(212,175,55,0.1)",
            border: "1.5px solid #D4AF37",
            color: "#D4AF37",
          }}
        >
          📊 Export Week Report
        </button>
      )}

      {/* Privacy Notice */}
      <div
        className="rounded-xl p-3 mt-auto"
        style={{
          background: "rgba(13,27,42,0.6)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <p className="text-[10px] text-muted-foreground text-center leading-tight">
          🔒 This log is <strong>your personal record</strong>. It is never shared with your
          company, captain, or manning agency. Use it to protect your rights under MLC 2006.
        </p>
      </div>

      {/* Clear Logs */}
      {logs.length > 0 && (
        <button
          onClick={() => saveLogs([])}
          className="text-[10px] text-muted-foreground underline mt-3 mb-1 mx-auto block"
        >
          Clear all logs
        </button>
      )}
    </div>
  );
};

export default RestHoursTracker;
