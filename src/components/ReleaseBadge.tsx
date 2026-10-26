import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { CURRENT_RELEASE, formatWib } from "@/lib/releaseInfo";
import { checkPwaUpdate, forcePwaHardReset } from "@/lib/pwaUpdate";

/** Build label that doubles as an "Update app" button. Checks quietly on mount and highlights when a newer build exists. */
const ReleaseBadge = ({ className = "" }: { className?: string }) => {
  const when = formatWib(CURRENT_RELEASE.buildTime);
  const [newer, setNewer] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    checkPwaUpdate().then((r) => { if (alive) setNewer(r.newer); });
    return () => { alive = false; };
  }, []);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    const r = await checkPwaUpdate();
    if (r.newer) {
      toast.success("New version found — updating…");
      await forcePwaHardReset();
      return;
    }
    toast("You're on the latest version", {
      action: { label: "Force refresh", onClick: () => { void forcePwaHardReset(); } },
    });
    setBusy(false);
  };

  return (
    <div className={`flex justify-center ${className}`}>
      <button
        type="button"
        onClick={onClick}
        aria-label={newer ? "Update available — tap to update" : "Check for app update"}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] tracking-wide border transition-colors"
        style={{
          color: "#94A3B8",
          borderColor: newer ? "#D4AF37" : "rgba(212,175,55,0.3)",
          background: newer ? "rgba(212,175,55,0.15)" : "transparent",
        }}
      >
        <RefreshCw size={11} className={busy ? "animate-spin" : ""} style={{ color: "#D4AF37" }} />
        {newer ? (
          <span style={{ color: "#D4AF37", fontWeight: 700 }}>Update available · tap to update</span>
        ) : (
          <>
            <span style={{ color: "#D4AF37" }}>Build {CURRENT_RELEASE.buildId}</span>
            {when && <span>· {when}</span>}
            <span style={{ color: "#D4AF37" }}>· Refresh</span>
          </>
        )}
      </button>
    </div>
  );
};

export default ReleaseBadge;
