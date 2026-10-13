// iOS Home Screen apps never poll for a new service worker on their own.
// These helpers nudge the worker, and offer a clean reload that bypasses stale caches.
import { toast } from "sonner";
import { CURRENT_RELEASE, fetchRemoteRelease, isNewerRelease, isUnsafeToInterrupt, type ReleaseMeta } from "./releaseInfo";

/** Ask the browser to re-download sw.js; never throws. */
export const nudgeServiceWorker = async (): Promise<void> => {
  try { await (await navigator.serviceWorker?.getRegistration())?.update(); } catch { /* ignore */ }
};

/** Returns the newer remote release, or null when up to date / unreachable. */
export const checkPwaUpdate = async (): Promise<{ remote: ReleaseMeta | null; newer: boolean }> => {
  const [remote] = await Promise.all([fetchRemoteRelease(), nudgeServiceWorker()]);
  return { remote, newer: isNewerRelease(CURRENT_RELEASE, remote) };
};

/** Clear app caches, drop the service worker, reload from the network. Keeps login (localStorage untouched). */
export const forcePwaHardReset = async (): Promise<void> => {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((k) => caches.delete(k)));
    }
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.allSettled(regs.map((r) => r.unregister()));
  } catch { /* ignore */ }
  const url = new URL(window.location.href);
  url.searchParams.set("sm_refresh", Date.now().toString(36));
  window.location.replace(url.toString());
};

let lastCheck = 0;
let prompted = "";
/** When the app returns to the foreground, check for a new release (max once per 5 min). */
export const installForegroundUpdateCheck = (): void => {
  if (typeof document === "undefined") return;
  // Drop the cache-buster param after a hard reset so it isn't shared/bookmarked.
  const u = new URL(window.location.href);
  if (u.searchParams.has("sm_refresh")) { u.searchParams.delete("sm_refresh"); history.replaceState(null, "", u.toString()); }
  const run = async () => {
    if (document.visibilityState !== "visible" || Date.now() - lastCheck < 5 * 60_000) return;
    lastCheck = Date.now();
    const { remote, newer } = await checkPwaUpdate();
    if (!newer || !remote || prompted === remote.buildId) return;
    if (isUnsafeToInterrupt(window.location.pathname + window.location.search)) return;
    prompted = remote.buildId;
    toast("A new SeaMinds version is available", {
      duration: 15000,
      action: { label: "Update now", onClick: () => { void forcePwaHardReset(); } },
    });
  };
  document.addEventListener("visibilitychange", run);
  setTimeout(run, 4000);
};
