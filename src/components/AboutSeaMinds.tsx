import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft } from "lucide-react";
import { CURRENT_RELEASE, fetchRemoteRelease, formatWib, isNewerRelease } from "@/lib/releaseInfo";

/** Full release information (More → About SeaMinds). */
const AboutSeaMinds = ({ onClose }: { onClose: () => void }) => {
  const [status, setStatus] = useState("");
  const r = CURRENT_RELEASE;
  const check = async () => {
    setStatus("Checking…");
    const remote = await fetchRemoteRelease();
    if (!remote) return setStatus("Could not reach SeaMinds. Try again later.");
    setStatus(isNewerRelease(r, remote) ? `New version available (${remote.buildId})` : "You're on the latest version ✓");
  };
  const Row = ({ k, v }: { k: string; v: string }) => (
    <div className="flex justify-between gap-3 py-1.5 border-b" style={{ borderColor: "rgba(212,175,55,0.15)" }}>
      <span style={{ color: "#94A3B8" }}>{k}</span><span className="text-right break-all">{v || "—"}</span>
    </div>
  );
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/80 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="about-seaminds-title" className="h-full w-full overflow-y-auto bg-card p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] text-xs text-foreground sm:h-auto sm:max-h-[90dvh] sm:max-w-sm sm:rounded-xl sm:border sm:border-primary/30" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="mb-2 flex items-center gap-1" style={{ color: "#D4AF37" }}><ChevronLeft size={16} /> Back</button>
        <h2 id="about-seaminds-title" className="mb-3 text-base font-bold" style={{ color: "#D4AF37" }}>About SeaMinds</h2>
        <Row k="Build ID" v={r.buildId} />
        <Row k="Code revision" v={r.commit} />
        <Row k="Built (WIB)" v={formatWib(r.buildTime)} />
        <Row k="Built (UTC)" v={r.buildTime} />
        <p className="mt-2" style={{ color: "#94A3B8" }}>Build time is when this version was prepared, not when it was published.</p>
        <button onClick={check} className="mt-3 w-full rounded-xl py-2 font-bold" style={{ background: "#D4AF37", color: "#0D1B2A" }}>Check for updates</button>
        {status && (
          <p className="mt-2 text-center">{status}{status.startsWith("New") && <> — <button className="underline" style={{ color: "#D4AF37" }} onClick={() => window.location.reload()}>Refresh</button></>}</p>
        )}
      </div>
    </div>,
    document.body
  );
};

export default AboutSeaMinds;
