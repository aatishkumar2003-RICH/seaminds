import { useState, useEffect } from "react";
import { getConsent, setConsent } from "@/lib/analytics";
import { initMetaPixel } from "@/lib/metaPixel";

import { Cookie, X } from "lucide-react";

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show banner only if no choice has been made
    if (getConsent() === null) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!visible) return null;

  const handleAccept = () => {
    setConsent("accepted");
    void initMetaPixel();
    setVisible(false);
  };

  const handleDecline = () => {
    setConsent("declined");
    setVisible(false);
  };

  // Only the crew app (/app) has a phone bottom menu; elsewhere dock flush to the bottom edge.
  const hasBottomNav = typeof window !== "undefined" && window.location.pathname.startsWith("/app");

  return (
    <div
      className={`fixed left-0 right-0 z-[200] px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-0 animate-in slide-in-from-bottom-4 duration-500 lg:bottom-4 lg:px-4 ${
        hasBottomNav ? "bottom-16" : "bottom-0"
      }`}
    >
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-2xl px-3 py-2.5 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <Cookie size={18} className="text-primary shrink-0 hidden sm:block" />
          <p className="flex-1 min-w-0 text-[11px] sm:text-xs text-muted-foreground leading-snug">
            We use analytics cookies to improve SeaMinds.{" "}
            <a href="/privacy" className="text-primary underline underline-offset-2">Privacy</a>
          </p>
          <button
            onClick={handleDecline}
            className="px-2.5 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-colors shrink-0"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
          >
            Accept
          </button>
          <button onClick={handleDecline} className="p-1 rounded-md hover:bg-secondary shrink-0" aria-label="Close">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
