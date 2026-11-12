import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

// Branded unsubscribe: GET only shows a button (mail scanners pre-open links); the opt-out is a POST.
const ALLOWED = new Set(["recruiter-outreach", "weekly-briefing", "crew-job-digest", "manager-engagement", "vessel-briefing"]);

const REASONS: Record<string, [string, string][]> = {
  "vessel-briefing": [["email_changed", "Email changed / vessel renamed or sold"], ["bandwidth", "Saving satellite data"], ["too_frequent", "Daily is too often"], ["not_relevant", "Not relevant to our trade"], ["other", "Other reason"]],
  "recruiter-outreach": [["no_external_platforms", "We don't recruit via platforms"], ["wrong_contact", "Not the right crewing contact"], ["no_vacancies", "No vacancies right now"], ["already_registered", "Already using SeaMinds"], ["other", "Other reason"]],
  crew: [["on_board", "On board / contract signed"], ["found_vessel", "Already found a vessel"], ["too_many", "Too many emails"], ["not_my_rank", "Not relevant to my rank"], ["other", "Other reason"]],
};

const Unsubscribe = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const fn = params.get("f") || "";
  const [reason, setReason] = useState("");
  const options = REASONS[fn] || REASONS.crew;
  const valid = ALLOWED.has(fn) && !!params.get("s") && !!(params.get("c") || params.get("u"));

  const confirm = async () => {
    setState("busy");
    const q = new URLSearchParams();
    for (const k of ["c", "u", "s"]) { const v = params.get(k); if (v) q.set(k, v); }
    q.set("r", reason || "not_specified");
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
            <p className="mt-3">Optional: tell us why, so we can improve.</p>
            <div className="mt-5 space-y-2 text-left" role="radiogroup" aria-label="Reason">
              {options.map(([id, label]) => (
                <button key={id} type="button" role="radio" aria-checked={reason === id} onClick={() => setReason(id)}
                  className={`w-full rounded-xl px-4 py-3 border text-sm ${reason === id ? "border-[#D4AF37] bg-[#D4AF37]/15 text-[#D4AF37] font-semibold" : "border-[#D4AF37]/30 bg-[#112240]"}`}>
                  {label}
                </button>
              ))}
            </div>
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
