import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import ResumeBuilder from "@/components/ResumeBuilder";
import CertWallet from "@/components/CertWallet";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  profileId: string;
}

const DISMISS_KEY = "sm_cv_banner_dismissed";

const CvAndCertificates = ({ profileId }: Props) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"cv" | "certs">("cv");
  const [banner, setBanner] = useState<"A" | "B" | null>(null);
  const [dismissedB, setDismissedB] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid || !active) return;

      const [profRes, cvRes] = await Promise.all([
        supabase.from("crew_profiles").select("quick_profile_completed_at").eq("id", uid).maybeSingle(),
        supabase.from("crew_cv_data").select("cv_json").eq("crew_profile_id", uid).maybeSingle(),
      ]);
      if (!active) return;

      if (!profRes.data?.quick_profile_completed_at) { setBanner("A"); return; }

      const cv: any = cvRes.data?.cv_json ?? null;
      const seaService = Array.isArray(cv?.seaService) ? cv.seaService : Array.isArray(cv?.sea_service) ? cv.sea_service : [];
      const hasContent = seaService.length > 0 || !!(cv?.personal?.fullName || cv?.personal?.full_name || cv?.summary);
      setBanner(hasContent ? null : "B");
    })();
    return () => { active = false; };
  }, []);

  const showB = banner === "B" && !dismissedB;

  const dismissB = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setDismissedB(true);
  };

  return (
    <div className="flex flex-col h-full">
      {banner === "A" && (
        <div
          className="mx-4 mt-3 rounded-xl px-3 py-2.5"
          style={{ background: "#112240", border: "1px solid rgba(212,175,55,0.5)" }}
        >
          <p className="text-xs font-bold" style={{ color: "#D4AF37" }}>⚓ Start with your 2-minute Sea Profile</p>
          <p className="text-[11px] leading-snug mt-0.5" style={{ color: "#94A3B8" }}>
            All taps, no typing — it unlocks job applications and your SMC assessment. Build your full CV anytime after.
          </p>
          <button
            onClick={() => navigate("/quick-profile")}
            className="mt-2 rounded-lg px-3 py-1.5 text-[11px] font-bold"
            style={{ background: "#D4AF37", color: "#0D1B2A", border: "none" }}
          >
            Start Sea Profile →
          </button>
        </div>
      )}

      {showB && (
        <div
          className="mx-4 mt-3 rounded-xl px-3 py-2.5 relative"
          style={{ background: "#112240", border: "1px solid rgba(34,197,94,0.5)" }}
        >
          <button
            onClick={dismissB}
            aria-label="Dismiss"
            className="absolute right-1.5 top-1.5 p-1"
            style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer" }}
          >
            <X size={13} />
          </button>
          <p className="text-xs font-bold pr-5" style={{ color: "#22c55e" }}>✓ You're application-ready</p>
          <p className="text-[11px] leading-snug mt-0.5" style={{ color: "#94A3B8" }}>
            Your Sea Profile already lets you apply for jobs and take the SMC assessment. The sections below are optional — add them whenever you want to stand out. Companies evaluate complete profiles faster, and when a company shortlists you, we'll remind you to complete it.
          </p>
        </div>
      )}

      <div className="px-4 pt-3 pb-2 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">CV / Certificate</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Build your CV and keep your certificates in one place
        </p>
        <div className="flex gap-2 mt-3">
          {([
            { id: "cv", label: "📄 My CV" },
            { id: "certs", label: "📜 Certificates" },
          ] as const).map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className="flex-1 rounded-xl py-2 text-xs font-bold transition-colors"
              style={{
                background: mode === m.id ? "#D4AF37" : "transparent",
                color: mode === m.id ? "#0D1B2A" : "#D4AF37",
                border: `1px solid ${mode === m.id ? "#D4AF37" : "rgba(212,175,55,0.4)"}`,
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {mode === "cv" ? <ResumeBuilder /> : <CertWallet profileId={profileId} />}
      </div>
    </div>
  );
};

export default CvAndCertificates;
