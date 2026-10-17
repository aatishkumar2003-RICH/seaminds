export type GuideRole = "crew" | "manager" | "staff";

/** Audience choice only; never used to authorize any workspace. */
export function guideRoleFromProfiles(manager: boolean, staff: boolean): GuideRole {
  return staff ? "staff" : manager ? "manager" : "crew";
}

export function parseGuideRole(value: string | null): GuideRole | null {
  return value === "crew" || value === "manager" || value === "staff" ? value : null;
}

export function guideLink(origin: string, role: GuideRole, section: string, step = 0): string {
  const url = new URL("/guide", origin);
  url.searchParams.set("role", role);
  url.searchParams.set("section", section);
  url.searchParams.set("step", String(Math.max(0, Math.floor(step))));
  return url.toString();
}

export function guideStep(value: string | null, count: number): number {
  const step = Number(value);
  return Number.isFinite(step) ? Math.max(0, Math.min(count - 1, Math.floor(step))) : 0;
}