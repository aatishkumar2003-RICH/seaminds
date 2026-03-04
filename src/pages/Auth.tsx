import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Loader2, Anchor } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const inputClass = "w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary";
const labelClass = "text-xs text-muted-foreground uppercase tracking-wide";

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordMismatch = mode === "signup" && confirmPassword.length > 0 && password !== confirmPassword;

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      toast.error(error.message.includes("Invalid login") ? "Incorrect password. Try again." : error.message);
      return;
    }
    window.location.href = '/app';
  };

  const handleSignup = async () => {
    if (!email.trim() || !password || !confirmPassword) return;
    if (password !== confirmPassword) return;
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Account created! Check your email to verify.");
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) { toast.error("Enter your email first"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Reset email sent. Check your inbox.");
  };

  const PasswordToggle = ({ show, onToggle }: { show: boolean; onToggle: () => void }) => (
    <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
      {show ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );

  return (
    <div className="flex flex-col items-center justify-center h-screen max-w-md mx-auto bg-background px-6">
      <div className="w-full max-w-sm space-y-6">
        <button onClick={() => navigate("/")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} /> Back to SeaMinds
        </button>

        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
            <Anchor size={28} className="text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Welcome to SeaMinds</h1>
          <p className="text-sm text-muted-foreground">Your maritime wellness companion</p>
        </div>

        {mode !== "forgot" ? (
          <>
            {/* Tab toggle */}
            <div className="flex bg-secondary rounded-xl p-1">
              <button
                onClick={() => setMode("login")}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Sign In
              </button>
              <button
                onClick={() => setMode("signup")}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Sign Up
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className={labelClass}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputClass} pr-10`}
                  />
                  <PasswordToggle show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
                </div>
                <p className="text-[11px] text-muted-foreground">Minimum 6 characters</p>
              </div>

              {mode === "signup" && (
                <div className="space-y-1.5">
                  <label className={labelClass}>Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`${inputClass} pr-10`}
                    />
                    <PasswordToggle show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} />
                  </div>
                  {passwordMismatch && (
                    <p className="text-[11px] text-destructive font-medium">Passwords do not match</p>
                  )}
                </div>
              )}

              {mode === "login" && (
                <button onClick={() => setMode("forgot")} className="text-xs text-primary hover:underline">
                  Forgot password?
                </button>
              )}
            </div>

            <button
              onClick={mode === "login" ? handleLogin : handleSignup}
              disabled={loading || (mode === "signup" && passwordMismatch)}
              className="w-full bg-primary text-primary-foreground font-medium text-sm rounded-xl py-3.5 disabled:opacity-30 transition-opacity flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
            </div>
            <button
              onClick={handleForgotPassword}
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-medium text-sm rounded-xl py-3.5 disabled:opacity-30 transition-opacity flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Sending..." : "Send Reset Email"}
            </button>
            <button onClick={() => setMode("login")} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors">
              ← Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Auth;
