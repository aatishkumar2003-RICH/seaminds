import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Radar, Anchor, PauseCircle, X, Zap, FileText } from "lucide-react";

const GOLD = "#D4AF37";
const NAVY = "#0D1B2A";
const CARD = "#112240";
const BORDER = "rgba(212,175,55,0.3)";

type Status = "ready" | "joined" | "not_available";

const OPTIONS: { key: Status; label: string; icon: typeof Radar; color: string }[] = [
  { key: "ready", label: "Available", icon: Radar, color: "#22c55e" },
  { key: "joined", label: "Joined", icon: Anchor, color: "#38bdf8" },
  { key: "not_available", label: "Not available", icon: PauseCircle, color: "#f59e0b" },
];

const go = (path: string) => { window.history.pushState({}, "", path); window.dispatchEvent(new PopStateEvent("popstate")); };

/** Top-of-feed control: joining status + recruiter visibility (needs Quick Profile or CV). */
const HomeStatusConsole = ({ profileId, rank }: { profileId: string; rank?: string }) => {
  const [status, setStatus] = useState<Status | null>(null);
  const [visible, setVisible] = useState(false);
  const [hasEvidence, setHasEvidence] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    (async () => {
      const [p, cv, av] = await Promise.all([
        supabase.from("crew_profiles").select("is_available, availability_status, placed_until, quick_profile_completed_at" as any).eq("id", profileId).maybeSingle(),
        supabase.from("crew_cv_data").select("id").eq("user_id", profileId).limit(1),
        supabase.from("crew_availability").select("visible_to_employers").eq("crew_profile_id", profileId).maybeSingle(),
      ]);
      const d: any = p.data || {};
      const placed = d.placed_until && new Date(d.placed_until) > new Date();
      setStatus((d.availability_status as Status) || (placed ? "joined" : d.is_available ? "ready" : "not_available"));
      setVisible(!!((av.data as any)?.visible_to_employers ?? d.is_available));
      setHasEvidence(!!d.quick_profile_completed_at || !!(cv.data as any[])?.length);
    })();
  }, [profileId]);

  const setVisibility = async (on: boolean) => {
    const { data, error } = await supabase.from("crew_availability")
      .upsert({ crew_profile_id: profileId, visible_to_employers: on, updated_at: new Date().toISOString() }, { onConflict: "crew_profile_id" })
      .select("visible_to_employers").single();
    if (error || !data) return false;
    setVisible(!!data.visible_to_employers);
    return data.visible_to_employers === on;
  };

  const chooseStatus = async (s: Status) => {
    if (busy || s === status) return;
    if (s === "ready" && !hasEvidence) { setGate(true); return; }
    const prev = status; setStatus(s); setBusy(true);
    const { error } = await supabase.from("crew_profiles").update({ availability_status: s } as any).eq("id", profileId);
    const ok = !error && (await setVisibility(s === "ready"));
    setBusy(false);
    if (!ok) { setStatus(prev); return toast.error("Could not update your status. Please try again."); }
    toast.success(s === "ready" ? "You're Available — recruiters can find you." : s === "joined" ? "Marked Joined. Safe sailing!" : "Marked Not available.");
  };

  const toggleVisible = async () => {
    if (busy) return;
    if (!visible && !hasEvidence) { setGate(true); return; }
    setBusy(true);
    const ok = await setVisibility(!visible);
    setBusy(false);
    if (!ok) return toast.error("Could not update visibility. Please try again.");
    toast.success(!visible ? "You're visible to recruiters ✓" : "Hidden from recruiter search.");
  };

  if (!status) return null;

  return (
    <div className="mx-4 mb-3 rounded-2xl p-3" style={{ background: `linear-gradient(145deg, ${CARD}, ${NAVY})`, border: `1px solid ${BORDER}`, boxShadow: "0 8px 24px -12px rgba(212,175,55,0.35)" }}>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#94A3B8" }}>My joining status</p>
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl" style={{ background: "rgba(13,27,42,0.7)" }}>
        {OPTIONS.map((o) => {
          const on = status === o.key; const Icon = o.icon;
          return (
            <button key={o.key} onClick={() => chooseStatus(o.key)} disabled={busy}
              className="relative flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-bold transition-all"
              style={{ background: on ? `${o.color}22` : "transparent", color: on ? o.color : "#94A3B8", border: on ? `1px solid ${o.color}66` : "1px solid transparent", cursor: "pointer" }}>
              <span className="relative flex">
                {on && o.key === "ready" && <span className="absolute inset-0 rounded-full animate-ping" style={{ background: `${o.color}55` }} />}
                <Icon size={16} className="relative" />
              </span>
              {o.label}
            </button>
          );
        })}
      </div>

      <button onClick={toggleVisible} disabled={busy}
        className="mt-2.5 w-full flex items-center justify-between rounded-xl px-3 py-2.5"
        style={{ background: "rgba(13,27,42,0.7)", border: `1px solid ${visible ? "rgba(34,197,94,0.4)" : BORDER}`, cursor: "pointer" }}>
        <span className="text-left">
          <span className="block text-[13px] font-extrabold" style={{ color: visible ? "#22c55e" : GOLD }}>
            {visible ? "● Visible to recruiters" : "Make me visible to recruiters"}
          </span>
          <span className="block text-[11px]" style={{ color: "#94A3B8" }}>
            {visible ? `Companies searching${rank ? ` for ${rank}` : ""} can find you` : hasEvidence ? "Tap to appear in recruiter search" : "Needs Quick Profile or CV"}
          </span>
        </span>
        <span className="relative h-6 w-11 rounded-full transition-colors" style={{ background: visible ? "#22c55e" : "#334155" }}>
          <span className="absolute top-0.5 h-5 w-5 rounded-full transition-all" style={{ background: "#fff", left: visible ? 22 : 2 }} />
        </span>
      </button>

      {gate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setGate(false)}>
          <div className="w-full max-w-md rounded-t-3xl p-5 pb-8" style={{ background: CARD, borderTop: `1px solid ${GOLD}` }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <p className="text-base font-extrabold" style={{ color: GOLD }}>Get seen by recruiters</p>
              <button onClick={() => setGate(false)} aria-label="Close" style={{ color: "#94A3B8", background: "none", border: "none" }}><X size={18} /></button>
            </div>
            <p className="text-[12.5px] mt-1 mb-4" style={{ color: "#94A3B8" }}>
              Companies need your rank and sea time first. Choose one — it takes about 2 minutes.
            </p>
            <button onClick={() => go("/quick-profile")} className="w-full rounded-xl py-3 font-extrabold flex items-center justify-center gap-2 mb-2"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #C5941F)`, color: NAVY, border: "none" }}>
              <Zap size={16} /> Quick Profile (all taps)
            </button>
            <button onClick={() => go("/app?tab=resume")} className="w-full rounded-xl py-3 font-bold flex items-center justify-center gap-2"
              style={{ background: "transparent", color: GOLD, border: `1px solid ${GOLD}` }}>
              <FileText size={16} /> Upload my CV
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeStatusConsole;
