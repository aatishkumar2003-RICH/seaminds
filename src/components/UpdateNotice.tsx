import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { CURRENT_RELEASE, fetchRemoteRelease, isNewerRelease, isUnsafeToInterrupt } from "@/lib/releaseInfo";

/** Shows "New version available — Refresh" when /version.json differs. Never auto-reloads. */
const UpdateNotice = () => {
  const loc = useLocation();
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let last = 0;
    const check = async () => {
      if (Date.now() - last < 60_000) return;
      last = Date.now();
      if (isNewerRelease(CURRENT_RELEASE, await fetchRemoteRelease())) setAvailable(true);
    };
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    check();
    const t = setInterval(check, 15 * 60_000);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onVis); };
  }, []);

  if (!available || dismissed || isUnsafeToInterrupt(loc.pathname + loc.search)) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl px-4 py-2 text-xs shadow-lg"
      style={{ bottom: "calc(72px + env(safe-area-inset-bottom))", background: "#112240", border: "1px solid rgba(212,175,55,0.3)", color: "#E2E8F0" }}>
      <span>New version available</span>
      <button onClick={() => window.location.reload()} className="rounded-xl px-3 py-1 font-bold" style={{ background: "#D4AF37", color: "#0D1B2A" }}>Refresh</button>
      <button onClick={() => setDismissed(true)} aria-label="Dismiss" style={{ color: "#94A3B8" }}>✕</button>
    </div>
  );
};

export default UpdateNotice;
