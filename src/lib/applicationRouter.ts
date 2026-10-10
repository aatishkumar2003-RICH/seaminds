// One application routing decision shared by every Apply button.
// Publisher (who posted) is kept separate from the recruiter (who hires).
import type { UnifiedVacancy } from "@/lib/vacancyFeed";
import { normalizeWaNumber, waApplyLink, buildApplyMessage, recordApplication, sendApplicationEmail, openHandoffTab, completeHandoff, type CrewCardInfo } from "@/lib/applyMessage";

/** House accounts that publish imported adverts on behalf of other agencies. */
export const isSeaMindsPublished = (v: Pick<UnifiedVacancy, "kind" | "publisherName">) =>
  v.kind === "direct" && /^seaminds/i.test(String(v.publisherName || "").trim());

export type ApplyChannel = "whatsapp" | "portal" | "email" | "seaminds" | "flyer" | "none";

export interface ApplyRoute {
  channel: ApplyChannel;
  /** URL to open in a new tab (WhatsApp/portal). Null when nothing opens. */
  url: string | null;
  /** True when a SeaMinds application record should be stored. */
  record: boolean;
}

/** Primary channel for a vacancy. WhatsApp first (fastest in maritime), never the SeaMinds admin. */
export const resolveApplyRoute = (v: UnifiedVacancy, card: CrewCardInfo | null): ApplyRoute => {
  const info = { rank: v.rank, vessel: v.vessel, port: v.port };
  const wa = waApplyLink(v.whatsapp, card, info);
  const house = isSeaMindsPublished(v);

  if (v.kind === "direct" && !house) return { channel: "seaminds", url: null, record: true };
  if (wa) return { channel: "whatsapp", url: wa, record: true };
  if (v.email) return { channel: "email", url: null, record: true };
  if (v.applyUrl) return { channel: "portal", url: v.applyUrl, record: true };
  if (v.flierUrl) return { channel: "flyer", url: null, record: false };
  return { channel: "none", url: null, record: false };
};

/** Secondary email option when the primary is WhatsApp/portal and an email also exists. */
export const emailApplyLink = (v: UnifiedVacancy, card: CrewCardInfo | null): string | null => {
  if (!v.email) return null;
  const subject = `Application: ${v.rank}${v.vessel ? ` — ${v.vessel}` : ""}`;
  const body = buildApplyMessage(card, { rank: v.rank, vessel: v.vessel, port: v.port });
  return `mailto:${v.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

export const hasWhatsapp = (v: UnifiedVacancy) => !!normalizeWaNumber(v.whatsapp);

/** Button label decided only by the route. */
export const routeLabel = (v: UnifiedVacancy): string => {
  const r = resolveApplyRoute(v, null);
  switch (r.channel) {
    case "seaminds": return "APPLY ON SEAMINDS →";
    case "whatsapp": return "APPLY VIA WHATSAPP";
    case "email": return "✉️ SEND MY SEA PROFILE BY EMAIL";
    case "portal": return "APPLY ON COMPANY WEBSITE ↗";
    case "flyer": return "📄 VIEW FLYER TO APPLY";
    default: return "NO CONTACT LISTED";
  }
};

/** Honest confirmation text: says only what SeaMinds actually did. */
export const routeToast = (
  route: ApplyRoute,
  company: string,
  r: { ok: boolean; duplicate: boolean; emailSent?: boolean },
): { title: string; description: string; tone: "success" | "warning" | "error" } => {
  if (!r.ok) {
    return route.url
      ? { title: "Opened", description: "Could not record this on SeaMinds, but the application window opened.", tone: "warning" }
      : { title: "Error", description: "Could not send application. Try again.", tone: "error" };
  }
  if (r.duplicate) return { title: "Already applied ✓", description: `You already applied to ${company}.`, tone: "success" };
  switch (route.channel) {
    case "whatsapp":
      return { title: "WhatsApp opened ✓", description: `Your Sea Profile message is ready. Tap Send in WhatsApp to deliver it to ${company}.`, tone: "success" };
    case "portal":
      return { title: "Company website opened", description: "Finish your application on their website. Saved in My Applications.", tone: "success" };
    case "email":
      return r.emailSent
        ? { title: "Emailed ✓", description: `Your Sea Profile was emailed to ${company}.`, tone: "success" }
        : { title: "Saved", description: "Saved in My Applications, but the email could not be sent. Try again later.", tone: "warning" };
    case "seaminds":
      return { title: "Applied ✓", description: `${company} can see your application in their SeaMinds dashboard.`, tone: "success" };
    default:
      return { title: "Saved", description: "Saved in My Applications.", tone: "success" };
  }
};

export interface ApplyOutcome {
  route: ApplyRoute;
  ok: boolean;
  duplicate: boolean;
  emailSent?: boolean;
  toast: ReturnType<typeof routeToast>;
}

/**
 * The single apply action used by every page. Must be called directly from a click
 * (the handoff tab is opened synchronously before any await).
 */
export const applyToVacancy = async (v: UnifiedVacancy, card: CrewCardInfo | null): Promise<ApplyOutcome> => {
  const route = resolveApplyRoute(v, card);
  if (!route.record) {
    return {
      route, ok: false, duplicate: false,
      toast: route.channel === "flyer"
        ? { title: "Check the flyer", description: "This advert has no contact we could read. Open the original flyer for the recruiter's details.", tone: "warning" }
        : { title: "No contact listed", description: "This vacancy has no way to apply yet.", tone: "warning" },
    };
  }
  // Email-only: success means the recruiter email was accepted, so Apply stays retryable
  // (also when the application record already exists).
  if (route.channel === "email") return applyByEmail(v);
  const win = route.url ? openHandoffTab() : null;
  const r = await recordApplication({
    vacancyId: v.kind === "external" ? v.id : null,
    jobPostingId: v.kind === "direct" ? v.id : null,
    company: v.company || null, rank: v.rank || null, vessel: v.vessel || null,
    externalUrl: route.url,
    // WhatsApp/portal handoffs never email the recruiter; email is a separate deliberate action.
    notify: route.channel === "email" || route.channel === "seaminds",
  });
  if (route.url) completeHandoff(win, route.url);
  return { route, ok: r.ok, duplicate: r.duplicate, emailSent: r.emailSent, toast: routeToast(route, v.company, r) };
};

/** Re-open the recruiter's WhatsApp chat (crew may have closed it without pressing Send). No new record. */
export const reopenWhatsApp = (v: UnifiedVacancy, card: CrewCardInfo | null): boolean => {
  const url = waApplyLink(v.whatsapp, card, { rank: v.rank, vessel: v.vessel, port: v.port });
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
};

/** True when a tracked SeaMinds email can be offered next to a WhatsApp/portal primary. */
export const hasSecondaryEmail = (v: UnifiedVacancy) => {
  const c = resolveApplyRoute(v, null).channel;
  return !!v.email && (c === "whatsapp" || c === "portal");
};

/** Secondary option: SeaMinds emails the Sea Profile to the recruiter (tracked, no mail app needed). */
export const applyByEmail = async (v: UnifiedVacancy): Promise<ApplyOutcome> => {
  const route: ApplyRoute = { channel: "email", url: null, record: true };
  if (!v.email) {
    return { route, ok: false, duplicate: false, toast: { title: "No email", description: "This advert has no recruiter email.", tone: "warning" } };
  }
  const r = await recordApplication({
    vacancyId: v.kind === "external" ? v.id : null,
    jobPostingId: v.kind === "direct" ? v.id : null,
    company: v.company || null, rank: v.rank || null, vessel: v.vessel || null,
    externalUrl: null,
    notify: false,
  });
  if (!r.ok || !r.applicationId) {
    return { route, ok: false, duplicate: false, toast: routeToast(route, v.company, { ok: false, duplicate: false }) };
  }
  // Same application record (may already exist from WhatsApp); email is attempted explicitly and is retry-safe.
  const e = await sendApplicationEmail(r.applicationId);
  return { route, ok: e.emailSent, duplicate: false, emailSent: e.emailSent, toast: routeToast(route, v.company, { ok: true, duplicate: false, emailSent: e.emailSent }) };
};
