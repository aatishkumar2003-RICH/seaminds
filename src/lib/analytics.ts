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
