import { supabase } from "@/integrations/supabase/client";

declare global { interface Window { fbq?: any; _fbq?: any; } }

let initialised = false;

/** Loads the Meta Pixel using the ID stored in admin_settings (key: meta_pixel_id). */
export const initMetaPixel = async () => {
  if (initialised || typeof window === "undefined") return;
  try {
    const { data } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "meta_pixel_id")
      .maybeSingle();
    const pixelId = (data as any)?.value?.trim();
    if (!pixelId) return;

    /* eslint-disable */
    (function (f: any, b, e, v, n?: any, t?: any, s?: any) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = true; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */

    window.fbq("init", pixelId);
    window.fbq("track", "PageView");
    initialised = true;
  } catch { /* tracking must never break the app */ }
};

/** Fire a Meta standard or custom event. Safe to call even if the pixel is not configured. */
export const trackPixel = (event: string, params?: Record<string, any>) => {
  try {
    if (typeof window !== "undefined" && window.fbq) window.fbq("track", event, params || {});
  } catch { /* ignore */ }
};

/** Capture the ad source from the URL (?src= or ?utm_source=) once per session. */
export const captureAdSource = () => {
  try {
    const p = new URLSearchParams(window.location.search);
    const src = p.get("src") || p.get("utm_source");
    const campaign = p.get("utm_campaign");
    if (src && !sessionStorage.getItem("sm_ad_src")) {
      sessionStorage.setItem("sm_ad_src", src);
      if (campaign) sessionStorage.setItem("sm_ad_campaign", campaign);
    }
  } catch { /* ignore */ }
};

export const getAdSource = () => {
  try { return sessionStorage.getItem("sm_ad_src") || null; } catch { return null; }
};
