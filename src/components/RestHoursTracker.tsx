import { useState, useEffect } from "react";

interface LogEntry {
  type: "work" | "rest";
  timestamp: string;
}

const STORAGE_KEY = "seaminds_rest_logs";

const RestHoursTracker = () => {
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

  // Current status
  const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
  const currentStatus = lastLog?.type || null;
  const currentSince = lastLog ? new Date(lastLog.timestamp) : null;

  // Calculate hours for today (last 24h)
  const calcHours = (type: "work" | "rest", hoursBack: number) => {
    const cutoff = new Date(now.getTime() - hoursBack * 3600000);
    let totalMs = 0;

    // Get relevant logs sorted by time
    const relevantLogs = logs
      .filter((l) => new Date(l.timestamp) >= cutoff || logs.indexOf(l) === logs.length - 1)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Find the state at cutoff time
    let stateAtCutoff: "work" | "rest" | null = null;
    for (const l of logs) {
      if (new Date(l.timestamp) <= cutoff) stateAtCutoff = l.type;
    }

    // Build time segments
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
    // Final open segment to now
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

  const hoursWorkedToday = calcHours("work", 24);
  const hoursRestedToday = calcHours("rest", 24);
  const hoursRestedWeekly = calcHours("rest", 168); // 7 * 24

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
