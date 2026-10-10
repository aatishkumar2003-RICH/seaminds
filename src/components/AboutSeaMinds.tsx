import { useState } from "react";
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
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl p-4 text-xs" style={{ background: "#112240", border: "1px solid rgba(212,175,55,0.3)", color: "#E2E8F0" }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="mb-2 flex items-center gap-1" style={{ color: "#D4AF37" }}><ChevronLeft size={16} /> Back</button>
        <h2 className="mb-3 text-base font-bold" style={{ color: "#D4AF37" }}>About SeaMinds</h2>
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
    </div>
  );
};

export default AboutSeaMinds;
