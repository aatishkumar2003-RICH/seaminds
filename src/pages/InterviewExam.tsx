import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AssessmentFlow from "@/components/smc/AssessmentFlow";

const GOLD = "#D4AF37";
const NAVY = "#0b1929";

const InterviewExam = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "ready" | "error" | "done">("loading");
  const [error, setError] = useState("");
  const [ctx, setCtx] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate(`/interview/${token}`); return; }

        // What is this interview for? The CAMPAIGN decides, not the candidate's profile.
        const { data: info } = await supabase.rpc("get_interview_by_token" as any, { p_token: token });
        const res: any = info;
        if (!res?.ok) { setError(res?.error || "This interview link is not valid."); setState("error"); return; }

        // Attach this seafarer to the invite
        const { data: claimed } = await supabase.rpc("claim_interview" as any, { p_token: token, p_assessment_id: null });
        const claim: any = claimed;
        if (!claim?.ok) { setError("Could not start this interview."); setState("error"); return; }

        // Candidate details for the report
        const { data: profile } = await supabase
          .from("crew_profiles")
          .select("first_name, last_name, role, ship_name, years_at_sea")
          .eq("id", user.id)
          .maybeSingle();

        // Resume an existing assessment for this invite, or create one
        let assessmentId: string | null = null;
        const { data: existing } = await supabase
          .from("interview_progress" as any)
          .select("assessment_id")
          .eq("crew_id", user.id)
          .eq("invite_id", claim.invite_id)
          .maybeSingle();
        assessmentId = (existing as any)?.assessment_id || null;

        if (!assessmentId) {
          const { data: created, error: cErr } = await supabase
            .from("smc_assessments")
            .insert({ crew_profile_id: user.id, status: "in_progress", current_step: 1 } as any)
            .select("id")
            .single();
          if (cErr) throw cErr;
          assessmentId = created.id;
          await supabase.from("interview_progress" as any).insert({
            invite_id: claim.invite_id, crew_id: user.id,
            assessment_id: assessmentId, campaign_id: claim.campaign_id,
          });
        }

        setCtx({
          inviteId: claim.invite_id,
          assessmentId,
          profileId: user.id,
          firstName: (profile as any)?.first_name || "Candidate",
          lastName: (profile as any)?.last_name || "",
          // The MANAGER'S requirement drives the questions
          rank: res.rank,
          vesselType: res.vessel || "General Cargo",
          shipName: (profile as any)?.ship_name || "",
          yearsExperience: Number((profile as any)?.years_at_sea) || 5,
          company: res.company,
        });
        setState("ready");
      } catch (e: any) {
        setError(e?.message || "Could not load the interview.");
        setState("error");
      }
    })();
  }, [token, navigate]);

  const finish = async () => {
    try {
      if (ctx?.inviteId && ctx?.assessmentId) {
        await supabase.rpc("complete_interview" as any, {
          p_invite_id: ctx.inviteId, p_assessment_id: ctx.assessmentId,
        });
      }
    } catch { /* ignore */ }
    setState("done");
  };

  if (state === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", color: GOLD }}>
        Preparing your interview…
      </div>
    );
  }

  if (state === "error") {
    return (
      <div style={{ minHeight: "100vh", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 320 }}>
          <p style={{ fontSize: 36, marginBottom: 10 }}>⚓</p>
          <p style={{ color: "#fff", fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{error}</p>
          <button onClick={() => navigate("/feed")}
            style={{ background: GOLD, color: "#0D1B2A", border: "none", borderRadius: 12, padding: "12px 22px", fontWeight: 800, cursor: "pointer" }}>
            See live jobs
          </button>
        </div>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div style={{ minHeight: "100vh", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 340 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>✅</p>
          <h1 style={{ color: "#fff", fontSize: 19, fontWeight: 800, marginBottom: 10 }}>Interview complete</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
            {ctx?.company} can now see your result. Your score is saved to your SeaMinds profile
            and works for other companies too.
          </p>
          <button onClick={() => navigate("/app")}
            style={{ background: GOLD, color: "#0D1B2A", border: "none", borderRadius: 12, padding: "13px 24px", fontWeight: 800, cursor: "pointer" }}>
            Open SeaMinds
          </button>
        </div>
      </div>
    );
  }

  // Sealed exam — no app navigation, no drawer, no feed
  return (
    <div style={{ position: "fixed", inset: 0, background: NAVY, display: "flex", flexDirection: "column", zIndex: 100 }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #1a2e47", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: GOLD, fontSize: 10, fontWeight: 800, letterSpacing: 1.4 }}>SEAMINDS ASSESSMENT</p>
            <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {ctx.rank}{ctx.vesselType ? ` · ${ctx.vesselType}` : ""} · {ctx.company}
            </p>
          </div>
          <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{ctx.firstName}</span>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <AssessmentFlow
          profileId={ctx.profileId}
          firstName={ctx.firstName}
          lastName={ctx.lastName}
          rank={ctx.rank}
          shipName={ctx.shipName}
          assessmentId={ctx.assessmentId}
          vesselType={ctx.vesselType}
          yearsExperience={ctx.yearsExperience}
          mode="interview"
          onComplete={finish}
        />
      </div>
    </div>
  );
};

export default InterviewExam;
