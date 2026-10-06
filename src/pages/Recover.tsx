import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const MSG: Record<string, string> = {
  WRONG_ACCOUNT: "This link belongs to a different SeaMinds account. Please sign in with the account that took the assessment.",
  ALREADY_USED: "This link has already been used. Open SeaMinds — your resume message is in your notifications.",
  EXPIRED: "This link has expired. Open SeaMinds — your resume message is in your notifications.",
  CLOSED: "This assessment is no longer open.",
  INVALID: "This link is not valid.",
};

// R5: single-use, candidate-bound recovery link. Requires sign-in as the same candidate; shows no paper data.
const Recover = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, isReady } = useAuth();
  const [state, setState] = useState<"wait" | "signin" | "error">("wait");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!isReady) return;
    if (!user) { setState("signin"); return; }
    (async () => {
      const { data } = await supabase.rpc("redeem_recovery_token" as any, { p_token: token });
      const d: any = data;
      if (d?.ok) {
        const route = String(d.route || "/app").replace("/app?screen=smc", "/app?tab=smc");
        navigate(route, { replace: true });
        return;
      }
      setErr(MSG[d?.error_code] || MSG.INVALID);
      setState("error");
    })();
  }, [isReady, user, token, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col p-5">
      <button onClick={() => navigate("/app")} className="flex items-center gap-1 text-sm self-start" style={{ color: "#D4AF37" }}>
        <ChevronLeft size={18} /> Back
      </button>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-3">⚓</p>
          {state === "wait" && <p className="text-foreground">Opening your assessment…</p>}
          {state === "signin" && (
            <>
              <h1 className="text-lg font-bold text-foreground mb-2">Sign in to resume</h1>
              <p className="text-sm text-muted-foreground mb-5">
                Your attempt is saved. Sign in to SeaMinds with the same account you used for the assessment, then open this link again.
              </p>
              <button onClick={() => navigate("/app")} className="px-6 py-3 rounded-xl font-bold" style={{ background: "#D4AF37", color: "#0D1B2A" }}>
                Sign in
              </button>
            </>
          )}
          {state === "error" && (
            <>
              <p className="text-foreground mb-2">{err}</p>
              <p className="text-xs text-muted-foreground mb-5">Need help? Contact support@seaminds.life</p>
              <button onClick={() => navigate("/app")} className="px-6 py-3 rounded-xl font-bold" style={{ background: "#D4AF37", color: "#0D1B2A" }}>
                Open SeaMinds
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Recover;
