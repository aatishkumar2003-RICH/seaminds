import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { isUnsafeToInterrupt } from "@/lib/releaseInfo";
import { checkPwaUpdate, forcePwaHardReset } from "@/lib/pwaUpdate";

/** Gold banner when a newer build is live. "Update now" clears old caches (needed on iPhone Home Screen apps). */
const UpdateNotice = () => {
  const loc = useLocation();
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let last = 0;
    const check = async (force = false) => {
      if (!force && Date.now() - last < 30_000) return;
      last = Date.now();
      const { newer } = await checkPwaUpdate();
      if (newer) { setAvailable(true); setDismissed(false); }
    };
    const onVis = () => { if (document.visibilityState === "visible") check(); };
    check(true);
    const retry = setTimeout(() => check(true), 4000); // iOS network often wakes late
    const t = setInterval(() => check(true), 5 * 60_000);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    window.addEventListener("online", onVis);
    return () => {
      clearTimeout(retry); clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
      window.removeEventListener("online", onVis);
    };
  }, []);

  if (!available || dismissed || isUnsafeToInterrupt(loc.pathname + loc.search)) return null;
  return (
    <div className="fixed left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[80] flex items-center gap-3 rounded-xl px-4 py-3 text-sm shadow-lg"
      style={{ bottom: "calc(80px + env(safe-area-inset-bottom))", background: "#112240", border: "1px solid #D4AF37", color: "#E2E8F0" }}>
      <span className="flex-1">⚡ New SeaMinds version available</span>
      <button disabled={busy} onClick={() => { setBusy(true); void forcePwaHardReset(); }} className="rounded-xl px-3 py-1.5 font-bold whitespace-nowrap" style={{ background: "#D4AF37", color: "#0D1B2A" }}>
        {busy ? "Updating…" : "Update now"}
      </button>
      <button onClick={() => setDismissed(true)} aria-label="Dismiss" style={{ color: "#94A3B8" }}>✕</button>
    </div>
  );
};

export default UpdateNotice;
