import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const PWA_DISMISS_KEY = "seaminds_pwa_dismissed";
const PWA_DISMISS_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Don't show if already installed as standalone
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // Don't show if recently dismissed
    const dismissed = localStorage.getItem(PWA_DISMISS_KEY);
    if (dismissed && Date.now() - parseInt(dismissed, 10) < PWA_DISMISS_EXPIRY) return;

    // Detect iOS Safari (no beforeinstallprompt support)
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|Chrome/.test(ua);
    if (isiOS) {
      setIsIOS(true);
      // Show after a short delay on iOS Safari
      if (isSafari) {
        const timer = setTimeout(() => setShowBanner(true), 3000);
        return () => clearTimeout(timer);
      }
      return;
    }

    // Android / Chrome — listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(PWA_DISMISS_KEY, String(Date.now()));
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-[60] md:hidden animate-in slide-in-from-bottom-4 duration-300">
      <div
        className="rounded-2xl p-4 shadow-lg border border-[#D4AF37]/20"
        style={{ background: "linear-gradient(135deg, #0D1B2A 0%, #132236 100%)" }}
      >
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(212,175,55,0.15)" }}
          >
            <Download size={20} style={{ color: "#D4AF37" }} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Install SeaMinds</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {isIOS
                ? "Tap the Share button below, then \"Add to Home Screen\" for quick access."
                : "Add to your home screen for instant access — works offline too."}
            </p>
          </div>
        </div>

        {!isIOS ? (
          <button
            onClick={handleInstall}
            className="w-full mt-3 py-2.5 rounded-xl font-bold text-sm transition-colors"
            style={{ background: "#D4AF37", color: "#0D1B2A" }}
          >
            ⚓ Install App
          </button>
        ) : (
          <div className="mt-3 flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
            <span>Tap</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#D4AF37" }}>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <span>then "Add to Home Screen"</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
