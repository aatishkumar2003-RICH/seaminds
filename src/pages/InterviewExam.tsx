import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AssessmentFlow from "@/components/smc/AssessmentFlow";
import { openAssessmentV2, gatewayErrorMessage } from "@/lib/assessmentGateway";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

const GOLD = "#D4AF37";
const NAVY = "#0b1929";

const InterviewExam = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const round2 = search.get("round") === "2";
  const [state, setState] = useState<"loading" | "ready" | "error" | "done" | "pending">("loading");
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
        // Private invites are authorized by the gateway, not the legacy claim RPC.
        const { data: claimed } = res.kind === "open"
          ? await supabase.rpc("claim_interview" as any, { p_token: token, p_assessment_id: null })
          : { data: { ok: true, invite_id: res.invite_id, campaign_id: res.campaign_id } };
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
        assessmentId = round2 ? null : ((existing as any)?.assessment_id || null);

        if (!assessmentId) {
          const [{ data: prepared }, { data: cv }] = await Promise.all([
            supabase.from("crew_profiles").select("quick_profile_completed_at").eq("id", user.id).maybeSingle(),
            supabase.from("crew_cv_data").select("sea_service, certificates").eq("user_id", user.id).maybeSingle(),
          ]);
          const hasCv = (Array.isArray(cv?.sea_service) && cv.sea_service.length > 0) || (Array.isArray(cv?.certificates) && cv.certificates.length > 0);
          if (round2 ? !hasCv : !prepared?.quick_profile_completed_at && !hasCv) {
            navigate(`/interview/${token}${round2 ? "?prepare=cv&round=2" : ""}`, { replace: true }); return;
          }
        }

        if (round2) {
          // Manager-requested CV-Based Round 2: separate record; Round 1 is never touched.
          const opened = await openAssessmentV2("CV_BASED", { inviteId: claim.invite_id, crewId: user.id });
          if (opened.error === "ROUND2_ALREADY_EXISTS" && opened.assessment_id) {
            // Reopen after Round 2 scoring: confirm the result to the company without restarting.
            setCtx({ company: res.company });
            const { data: cr, error: ce } = await supabase.rpc("complete_interview" as any, { p_invite_id: claim.invite_id, p_assessment_id: opened.assessment_id });
            if (!ce && (cr as any)?.ok) { setState("done"); return; }
            if ((cr as any)?.error_code === "SCORING_PENDING" || ce) { setState("pending"); return; }
          }
          if (!opened.ok || !opened.assessment_id) throw new Error(gatewayErrorMessage(opened.error));
          assessmentId = opened.assessment_id;
        } else if (!assessmentId) {
          // Server gateway: authorizes the invite, derives context, links invite + progress
          const opened = await openAssessmentV2("PROFILE", { inviteId: claim.invite_id, crewId: user.id });
          if (!opened.ok || !opened.assessment_id) throw new Error(gatewayErrorMessage(opened.error));
          assessmentId = opened.assessment_id;
          // Legacy (pre-migration) path only: the gateway already writes interview_progress
          await supabase.from("interview_progress" as any).upsert({
            invite_id: claim.invite_id, crew_id: user.id,
            assessment_id: assessmentId, campaign_id: claim.campaign_id,
          }, { onConflict: "crew_id,invite_id", ignoreDuplicates: true });
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
        // Reopen after scoring: confirm the saved, scored result without restarting the exam.
        if (!round2 && (existing as any)?.assessment_id) {
          const { data: a } = await supabase.from("smc_assessments").select("status, overall_score").eq("id", assessmentId).maybeSingle();
          if ((a as any)?.status === "completed") {
            const { data: cr, error: ce } = await supabase.rpc("complete_interview" as any, { p_invite_id: claim.invite_id, p_assessment_id: assessmentId });
            if (!ce && (cr as any)?.ok) { setState("done"); return; }
            if ((cr as any)?.error_code === "SCORING_PENDING" || ce) { setState("pending"); return; }
            setError("We couldn't confirm this interview. Your answers are saved. Need help? Contact support@seaminds.life");
            setState("error"); return;
          }
        }
        setState("ready");
      } catch (e: any) {
        setError(e?.message || "Could not load the interview.");
        setState("error");
      }
    })();
  }, [token, navigate, round2]);

  const finish = async () => {
    // Only a server-confirmed, scored completion shows "Interview complete".
    let res: any = null;
    try {
      if (ctx?.inviteId && ctx?.assessmentId) {
        const { data, error } = await supabase.rpc("complete_interview" as any, {
          p_invite_id: ctx.inviteId, p_assessment_id: ctx.assessmentId,
        });
        res = error ? { ok: false, error_code: "NETWORK" } : data;
      }
    } catch { res = { ok: false, error_code: "NETWORK" }; }
    if (res?.ok) { setState("done"); return; }
    if (res?.error_code === "SCORING_PENDING" || res?.error_code === "NETWORK") { setState("pending"); return; }
    setError("We couldn't confirm this interview. Your answers are saved. Need help? Contact support@seaminds.life");
    setState("error");
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

  if (state === "pending" || state === "done") {
    return <main className="min-h-screen bg-background text-foreground px-4 py-6">
      <section className="mx-auto max-w-lg space-y-5">
        <Button variant="ghost" className="px-0 text-primary" onClick={() => navigate(`/interview/${token}`)}><ChevronLeft /> Back</Button>
        <h1 className="text-xl font-bold">{state === "done" ? "Interview complete" : "Answers saved — scoring in progress"}</h1>
        <p className="text-sm text-muted-foreground">{state === "done" ? `${ctx?.company} can now see your result. Your score is saved in your SeaMinds profile.` : `Your answers are saved. Reopen this interview link later to confirm your result for ${ctx?.company}.`}</p>
        <h2 className="text-lg font-bold text-primary">Keep your CV ready</h2>
        <p className="text-sm text-muted-foreground">Upload a CV PDF or clear photo. SeaMinds extracts your sea service, vessel types and certificates for you to review in your personal profile.</p>
        <Button className="w-full h-auto whitespace-normal py-3" onClick={() => navigate("/app?tab=cv")}>Scan / Upload My CV</Button>
        <Button variant="link" className="w-full h-auto whitespace-normal" onClick={() => navigate("/app")}>I'll update my CV later — Open SeaMinds</Button>
      </section>
    </main>;
  }

  // Sealed exam — no app navigation, no drawer, no feed
  return (
    <div style={{ position: "fixed", inset: 0, background: NAVY, display: "flex", flexDirection: "column", zIndex: 100 }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #1a2e47", flexShrink: 0 }}>
        <Button variant="ghost" size="sm" className="text-primary px-0" onClick={() => navigate(`/interview/${token}`)}><ChevronLeft /> Back</Button>
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
          onExit={() => navigate("/feed")}
        />
      </div>
    </div>
  );
};

export default InterviewExam;
