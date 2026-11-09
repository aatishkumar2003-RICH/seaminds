const GA_ID = "G-RQ9Z086XWW";

/** Load the GA4 script and initialise gtag */
export function loadGA4() {
  if (document.querySelector(`script[src*="googletagmanager"]`)) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  (window as any).dataLayer = (window as any).dataLayer || [];
  function gtag(...args: any[]) {
    (window as any).dataLayer.push(args);
  }
  (window as any).gtag = gtag;
  gtag("js", new Date());
  gtag("config", GA_ID);
  gtag("set", "developer_id.dZjgwMW", true);
  gtag("config", ADS_ID);
}

const ADS_ID = "AW-18307689729";
const ADS_SIGNUP_SEND_TO = "AW-18307689729/4tbaCK-xirUdEIHa5JlE";

/** Google Ads crew sign-up conversion — only fires when the user accepted cookies. */
export function trackAdsSignup() {
  try {
    const g = (window as any).gtag;
    if (typeof g === "function") g("event", "conversion", { send_to: ADS_SIGNUP_SEND_TO });
  } catch { /* never block signup */ }
}

/** Remove GA cookies and reload-proof */
export function removeGA4() {
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0].trim();
    if (name.startsWith("_ga")) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname}`;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
  });
}

/** Lightweight GA4 event helper — no-ops if gtag isn't loaded */
export function trackEvent(eventName: string, params?: Record<string, string | number | boolean>) {
  if (typeof window !== "undefined" && typeof (window as any).gtag === "function") {
    (window as any).gtag("event", eventName, params);
  }
}

/** Cookie consent helpers */
const CONSENT_KEY = "seaminds_cookie_consent";

export type ConsentStatus = "accepted" | "declined" | null;

export function getConsent(): ConsentStatus {
  return localStorage.getItem(CONSENT_KEY) as ConsentStatus;
}

export function setConsent(status: "accepted" | "declined") {
  localStorage.setItem(CONSENT_KEY, status);
  try { window.dispatchEvent(new Event("sm-consent-changed")); } catch { /* non-browser */ }
  if (status === "accepted") {
    loadGA4();
  } else {
    removeGA4();
  }
}

/** Auto-load GA4 if previously accepted */
export function initAnalytics() {
  if (getConsent() === "accepted") {
    loadGA4();
  }
}
