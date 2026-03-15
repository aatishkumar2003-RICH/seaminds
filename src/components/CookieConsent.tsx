import { useState, useEffect } from "react";
import { getConsent, setConsent } from "@/lib/analytics";
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
    setVisible(false);
  };

  const handleDecline = () => {
    setConsent("declined");
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[200] p-4 animate-in slide-in-from-bottom-4 duration-500">
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 mt-0.5 shrink-0">
            <Cookie size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground mb-1">We value your privacy</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We use cookies for analytics to improve your experience. No personal data is shared with third parties.{" "}
              <a href="/privacy" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">
                Privacy Policy
              </a>
            </p>
          </div>
          <button
            onClick={handleDecline}
            className="p-1 rounded-md hover:bg-secondary transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            onClick={handleDecline}
            className="px-4 py-1.5 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-colors"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-1.5 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Accept cookies
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
