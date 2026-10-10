// Release identification. Values are injected at build time by vite.config.ts (never hand-edited).
// buildTime is when the bundle was BUILT, not when it was published.

declare const __SM_BUILD_ID__: string;
declare const __SM_BUILD_COMMIT__: string;
declare const __SM_BUILD_TIME__: string;

export interface ReleaseMeta { buildId: string; commit: string; buildTime: string }

export const CURRENT_RELEASE: ReleaseMeta = {
  buildId: typeof __SM_BUILD_ID__ !== "undefined" ? __SM_BUILD_ID__ : "dev",
  commit: typeof __SM_BUILD_COMMIT__ !== "undefined" ? __SM_BUILD_COMMIT__ : "",
  buildTime: typeof __SM_BUILD_TIME__ !== "undefined" ? __SM_BUILD_TIME__ : "",
};

/** "10 Oct 2026, 14:43 WIB" (Asia/Jakarta). Empty string if unparsable. */
export const formatWib = (iso: string): string => {
  const d = new Date(iso);
  if (!iso || isNaN(d.getTime())) return "";
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
  return `${s} WIB`;
};

/** True only when the server reports a different, valid build. */
export const isNewerRelease = (current: ReleaseMeta, remote: Partial<ReleaseMeta> | null): boolean =>
  !!remote?.buildId && current.buildId !== "dev" && remote.buildId !== current.buildId;

/** Network-only fetch of /version.json; never throws. */
export const fetchRemoteRelease = async (f: typeof fetch = fetch): Promise<ReleaseMeta | null> => {
  try {
    const r = await f(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    return j && typeof j.buildId === "string" ? j : null;
  } catch { return null; }
};

/** Screens where a refresh prompt must not appear (assessments, interviews, forms in progress). */
export const isUnsafeToInterrupt = (path: string): boolean =>
  /^\/(interview|smc|exam|quick-profile|profile|join|post-vacancy|takeover|recover|reset-password)/i.test(path) ||
  /[?&]tab=(smc|score|cv|resume)\b/i.test(path);
