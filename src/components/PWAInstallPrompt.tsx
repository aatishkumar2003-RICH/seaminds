import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "sm_install_dismissed";
const SHOW_DELAY_MS = 45000;

const PWAInstallPrompt = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  const isIOS = typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

  useEffect(() => {
    // Already installed / running standalone? Never render.
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      // @ts-ignore iOS
      window.navigator.standalone === true;
    if (isStandalone) return;

    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    // Desktop: do not render at all.
    if (!isIOS && !isAndroid) return;

    const timer = window.setTimeout(() => {
      setVisible(true);
    }, SHOW_DELAY_MS);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installed = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", installed);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const handleInstall = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted" || outcome === "dismissed") {
        setDeferred(null);
        setVisible(false);
      }
      return;
    }
    // Fallback to Play Store listing.
    window.open("https://play.google.com/store/apps/details?id=life.seaminds.twa", "_blank");
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="pwa-install-card fixed left-4 right-4 z-[60] mx-auto max-w-md rounded-xl border border-primary/40 p-4 shadow-xl backdrop-blur-md sm:left-auto sm:right-4"
      style={{
        background: "hsl(var(--background) / 0.95)",
        bottom: "calc(76px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          {isIOS ? (
            <>
              <p className="text-sm font-semibold text-foreground">Add SeaMinds to your Home Screen</p>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>1.</span>
                  <span>Tap the Share button</span>
                  <Share size={14} className="text-primary" />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>2.</span>
                  <span>Choose "Add to Home Screen"</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">Install SeaMinds</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Get the app — jobs, alerts and your CV in your pocket.
              </p>
              <Button size="sm" onClick={handleInstall} className="mt-3 h-8 text-xs">
                Get the App
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
