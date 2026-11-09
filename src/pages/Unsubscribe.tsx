import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

// Branded unsubscribe: GET only shows a button (mail scanners pre-open links); the opt-out is a POST.
const ALLOWED = new Set(["recruiter-outreach", "weekly-briefing", "crew-job-digest", "manager-engagement", "vessel-briefing"]);

const Unsubscribe = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const fn = params.get("f") || "";
  const valid = ALLOWED.has(fn) && !!params.get("s") && !!(params.get("c") || params.get("u"));

  const confirm = async () => {
    setState("busy");
    const q = new URLSearchParams();
    for (const k of ["c", "u", "s"]) { const v = params.get(k); if (v) q.set(k, v); }
    try {
      await fetch(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/${fn}?${q}`, { method: "POST", mode: "no-cors" });
      setState("done");
    } catch { setState("error"); }
  };

  return (
    <div className="min-h-screen bg-[#0D1B2A] text-slate-200 px-5 py-6">
      <button onClick={() => navigate("/")} className="flex items-center gap-1 text-[#D4AF37]" aria-label="Back">
        <ChevronLeft className="w-5 h-5" /> Back
      </button>
      <div className="max-w-md mx-auto mt-16 text-center">
        {!valid ? (
          <><h1 className="text-2xl font-bold text-[#D4AF37]">Invalid link</h1><p className="mt-3">Please reply to the email instead.</p></>
        ) : state === "done" ? (
          <><h1 className="text-2xl font-bold text-[#D4AF37]">You're unsubscribed</h1><p className="mt-3">SeaMinds will not send you these emails again.</p></>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-[#D4AF37]">Stop SeaMinds emails?</h1>
            <p className="mt-3">Tap below to confirm.</p>
            <button onClick={confirm} disabled={state === "busy"}
              className="mt-6 bg-[#D4AF37] text-[#0D1B2A] font-bold rounded-xl px-6 py-3 disabled:opacity-60">
              {state === "busy" ? "Please wait…" : "Confirm unsubscribe"}
            </button>
            {state === "error" && <p className="mt-3 text-amber-400">Could not reach SeaMinds. Please try again.</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
