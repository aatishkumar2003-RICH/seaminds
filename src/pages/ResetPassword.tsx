import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PasswordInput from "@/components/PasswordInput";

const NAVY = "#0D1B2A";
const GOLD = "#D4AF37";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!active) return;
      if (session) { setHasSession(true); setChecking(false); }
    });

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) { setHasSession(true); setChecking(false); return; }

      // PKCE style link: ?code=...
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { data: ex } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;
        if (ex?.session) {
          setHasSession(true);
          setChecking(false);
          window.history.replaceState({}, "", "/reset-password");
          return;
        }
      }
      setHasSession(false);
      setChecking(false);
    })();

    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);


  const save = async () => {
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    if (password !== confirm) return toast.error("Passwords do not match.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    setDone(true);
  };

  const inputClass =
    "w-full text-sm rounded-xl px-4 py-3 outline-none";
  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(212,175,55,0.25)",
    color: "#E2E8F0",
  };

  return (
    <div className="min-h-screen px-5 py-6 flex flex-col" style={{ background: NAVY }}>
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-1 text-sm"
        style={{ color: GOLD, background: "transparent", border: "none" }}
      >
        <ChevronLeft size={18} /> Back
      </button>

      <div className="flex-1 flex items-center justify-center">
        <div
          className="w-full max-w-sm rounded-2xl p-6 space-y-5"
          style={{ background: "#112240", border: `1px solid rgba(212,175,55,0.3)` }}
        >
          <h1 className="text-lg font-bold text-center" style={{ color: GOLD }}>
            Set a new password
          </h1>

          {checking ? (
            <p className="text-xs text-center" style={{ color: "#94A3B8" }}>Checking link…</p>
          ) : done ? (
            <div className="space-y-3">
              <p className="text-sm text-center" style={{ color: "#22c55e" }}>✅ Password updated</p>
              <button
                onClick={() => navigate("/app")}
                className="w-full font-bold text-sm rounded-xl py-3"
                style={{ background: GOLD, color: NAVY, border: "none" }}
              >
                Crew Login
              </button>
              <button
                onClick={() => navigate("/manager")}
                className="w-full font-medium text-sm rounded-xl py-3"
                style={{ background: "transparent", color: GOLD, border: `1px solid ${GOLD}` }}
              >
                Manager Login
              </button>
            </div>
          ) : !hasSession ? (
            <div className="space-y-3">
              <p className="text-xs text-center" style={{ color: "#94A3B8" }}>
                This reset link is invalid or expired — request a new one.
              </p>
              <button
                onClick={() => navigate("/")}
                className="w-full font-bold text-sm rounded-xl py-3"
                style={{ background: GOLD, color: NAVY, border: "none" }}
              >
                Go to homepage
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <PasswordInput
                value={password}
                onChange={setPassword}
                placeholder="New password"
                className={inputClass}
                style={inputStyle}
                autoComplete="new-password"
              />
              <PasswordInput
                value={confirm}
                onChange={setConfirm}
                placeholder="Confirm password"
                className={inputClass}
                style={inputStyle}
                autoComplete="new-password"
                onEnter={save}
              />
              <button
                onClick={save}
                disabled={loading}
                className="w-full font-bold text-sm rounded-xl py-3 disabled:opacity-40"
                style={{ background: GOLD, color: NAVY, border: "none" }}
              >
                {loading ? "Updating…" : "Update password"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
