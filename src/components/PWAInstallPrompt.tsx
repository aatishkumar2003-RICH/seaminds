import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "sm_pwa_install_dismissed_v1";

const PWAInstallPrompt = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Already installed?
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      // @ts-ignore iOS
      window.navigator.standalone === true;
    if (isStandalone) return;

    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;

    const ua = window.navigator.userAgent.toLowerCase();
    const iOS = /iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua);
    if (iOS) {
      setIsIOS(true);
      setVisible(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installed = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", installed);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted" || outcome === "dismissed") {
      setDeferred(null);
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
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
          <p className="text-sm font-semibold text-foreground">Install SeaMinds</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isIOS
              ? "Tap Share, then \"Add to Home Screen\" to install."
              : "Get the full app experience on your device."}
          </p>
          {!isIOS && (
            <Button size="sm" onClick={handleInstall} className="mt-3 h-8 text-xs">
              Install App
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
