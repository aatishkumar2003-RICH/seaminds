import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ChevronLeft, ShieldCheck, Anchor, Globe } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import PasswordInput from "@/components/PasswordInput";
import seamindsLogo from "@/assets/seaminds-logo.png";

const GOLD = "#D4AF37";
const NAVY = "#0D1B2A";
const CARD = "#112240";
const BORDER = "rgba(212,175,55,0.3)";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  padding: "12px 14px",
  color: "#fff",
  fontSize: 14,
  outline: "none",
};

const Join = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const nextParam = params.get("next");
  const dest = nextParam && nextParam.startsWith("/") ? nextParam : "/app";
  const [tab, setTab] = useState<"create" | "signin">("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) navigate(dest, { replace: true });
    });
    return () => { active = false; };
  }, [navigate, dest]);

  const google = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${dest}` },
    });
  };

  const createAccount = async () => {
    if (!email || password.length < 8) {
      toast.error("Enter your email and a password of at least 8 characters");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}${dest}` },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("already") ? "This email already has an account — sign in instead." : error.message);
      return;
    }
    if (data.session) navigate(dest);
    else setConfirmSent(true);
  };

  const signIn = async () => {
    if (!email || !password) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error("Wrong email or password");
      return;
    }
    navigate(dest);
  };

  const forgot = async () => {
    const target = email || window.prompt("Enter your email to reset your password") || "";
    if (!target) return;
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Reset link sent — check your email");
  };

  return (
    <div style={{ minHeight: "100vh", background: NAVY }}>
      <Helmet>
        <title>Join SeaMinds — Free Crew Account for Seafarers</title>
        <meta name="description" content="Create your free SeaMinds crew account: 2-minute Sea Profile, live maritime jobs and structured SMC competency assessment." />
        <link rel="canonical" href="https://seaminds.life/join" />
      </Helmet>

      <button
        onClick={() => navigate("/")}
        aria-label="Back to home"
        style={{ position: "absolute", top: 14, left: 14, background: "transparent", border: "none", color: GOLD, cursor: "pointer", padding: 6 }}
      >
        <ChevronLeft size={26} />
      </button>

      <main className="max-w-md mx-auto px-5 pt-16 pb-12">
        <div className="text-center">
          <div
            className="mx-auto mb-4 flex items-center justify-center rounded-full"
            style={{ width: 76, height: 76, border: `2px solid ${BORDER}`, background: CARD }}
          >
            <img src={seamindsLogo} alt="SeaMinds logo" className="w-11 h-11" />
          </div>
          <h1 className="text-2xl font-extrabold text-white mb-2">Join SeaMinds</h1>
          <p className="text-sm" style={{ color: "#94A3B8" }}>
            Free for seafarers — 2-minute Sea Profile, jobs, SMC assessment.
          </p>
        </div>

        <div className="mt-6 space-y-2.5">
          {[
            { icon: <ShieldCheck size={16} style={{ color: GOLD }} />, text: "Confidential conversations — never shared with your company" },
            { icon: <Anchor size={16} style={{ color: GOLD }} />, text: "Built by a Master Mariner" },
            { icon: <Globe size={16} style={{ color: GOLD }} />, text: "Works wherever your voyage takes you" },
          ].map((b) => (
            <div key={b.text} className="flex gap-2.5 items-start rounded-xl px-3.5 py-2.5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <span className="shrink-0 mt-0.5">{b.icon}</span>
              <p className="text-xs leading-snug" style={{ color: "#e2e8f0" }}>{b.text}</p>
            </div>
          ))}
        </div>

        <button
          onClick={google}
          className="mt-6 w-full rounded-xl py-3.5 font-bold text-sm"
          style={{ background: "#fff", color: "#1f2937", border: "none", cursor: "pointer" }}
        >
          Continue with Google
        </button>

        <div className="flex items-center gap-3 my-5">
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
          <span className="text-[11px]" style={{ color: "#64748b" }}>or</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
        </div>

        {confirmSent ? (
          <div className="rounded-2xl p-5 text-center" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
            <p className="text-sm font-bold text-white mb-2">✓ Account created!</p>
            <p className="text-xs mb-4" style={{ color: "#94A3B8" }}>
              Check your email to confirm, then sign in.
            </p>
            <button
              onClick={() => { setConfirmSent(false); setTab("signin"); setPassword(""); }}
              className="w-full rounded-xl py-3 font-bold text-sm"
              style={{ background: GOLD, color: NAVY, border: "none", cursor: "pointer" }}
            >
              Sign in
            </button>
          </div>
        ) : (
          <>
            <div className="flex rounded-xl p-1 mb-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              {(["create", "signin"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="flex-1 rounded-lg py-2 text-xs font-bold"
                  style={{
                    background: tab === t ? GOLD : "transparent",
                    color: tab === t ? NAVY : "#94A3B8",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {t === "create" ? "Create account" : "Sign in"}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
              <PasswordInput
                value={password}
                onChange={setPassword}
                autoComplete={tab === "create" ? "new-password" : "current-password"}
                style={inputStyle}
                onEnter={tab === "create" ? createAccount : signIn}
              />
              {tab === "create" && (
                <p className="text-[11px]" style={{ color: "#64748b" }}>Minimum 8 characters.</p>
              )}

              <button
                onClick={tab === "create" ? createAccount : signIn}
                disabled={busy}
                className="w-full rounded-xl py-3.5 font-extrabold text-sm"
                style={{ background: GOLD, color: NAVY, border: "none", cursor: "pointer", opacity: busy ? 0.6 : 1 }}
              >
                {tab === "create" ? "Create free account ⚓" : "Sign in"}
              </button>

              {tab === "signin" && (
                <button
                  onClick={forgot}
                  className="w-full text-[11px] underline"
                  style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer" }}
                >
                  Forgot password?
                </button>
              )}
            </div>
          </>
        )}

        <div className="mt-8 text-center">
          <p className="text-[11px]" style={{ color: "#64748b" }}>Free for crew members</p>
          <button
            onClick={() => navigate("/manager")}
            className="mt-2 text-[11px] font-semibold underline"
            style={{ background: "transparent", border: "none", color: GOLD, cursor: "pointer" }}
          >
            Manager Login
          </button>
        </div>
      </main>
    </div>
  );
};

export default Join;
