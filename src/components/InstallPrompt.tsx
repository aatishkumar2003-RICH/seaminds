import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Anchor, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "sm_install_dismissed";
const INSTALLED_KEY = "sm_install_done";
const VISITS_KEY = "sm_install_visits";
const DELAY_MS = 20000;
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as any).standalone === true);

const InstallPrompt = () => {
  const location = useLocation();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ready, setReady] = useState(false); // timing condition met
  const [dismissed, setDismissed] = useState(false);

  const isIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as any).MSStream;

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(INSTALLED_KEY) === "1") return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < THIRTY_DAYS) return;

    const visits = Number(localStorage.getItem(VISITS_KEY) || 0) + 1;
    localStorage.setItem(VISITS_KEY, String(visits));

    let timer: number | undefined;
    if (visits >= 2) setReady(true);
    else timer = window.setTimeout(() => setReady(true), DELAY_MS);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, "1");
      setDeferred(null);
      setDismissed(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (dismissed || !ready || isStandalone()) return null;
  if (!isIOS && !deferred) return null;

  const inApp = location.pathname.startsWith("/app");

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setDismissed(true);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  return (
    <div
      className="fixed left-3 right-3 z-[120] mx-auto w-auto max-w-[420px] rounded-xl p-3 shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-500"
      style={{
        background: "#112240",
        border: "1px solid rgba(212,175,55,0.35)",
        bottom: inApp
          ? "calc(72px + env(safe-area-inset-bottom, 0px))"
          : "calc(12px + env(safe-area-inset-bottom, 0px))",
      }}
      role="dialog"
      aria-label="Install SeaMinds"
    >
      <button
        onClick={handleDismiss}
        aria-label="Dismiss install prompt"
        className="absolute right-1.5 top-1.5 p-1"
        style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer" }}
      >
        <X size={14} />
      </button>
      <div className="flex items-center gap-3 pr-5">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "rgba(212,175,55,0.15)" }}
        >
          <Anchor size={18} style={{ color: "#D4AF37" }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-snug" style={{ color: "#E6EDF7" }}>
            ⚓ Install SeaMinds — faster access, works better at sea
          </p>
          {isIOS && (
            <p className="mt-1 text-[11px] leading-snug" style={{ color: "#94A3B8" }}>
              Tap the Share button ⬆️ then "Add to Home Screen"
            </p>
          )}
        </div>
        {!isIOS && (
          <button
            onClick={handleInstall}
            className="shrink-0 rounded-xl px-3 py-2 text-xs font-bold"
            style={{ background: "#D4AF37", color: "#0D1B2A", border: "none", cursor: "pointer" }}
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
};

export default InstallPrompt;
