import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import seamindsLogo from "@/assets/seaminds-logo.png";

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");

  const clearErrors = () => {
    setEmailError("");
    setPasswordError("");
    setConfirmError("");
    setSuccessMessage("");
    setForgotMessage("");
  };

  const handleSignIn = async () => {
    clearErrors();
    if (!email.trim()) { setEmailError("Email is required"); return; }
    if (!password) { setPasswordError("Password is required"); return; }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid login credentials") || msg.includes("invalid")) {
        // Supabase doesn't distinguish email-not-found vs wrong-password clearly
        // Check if user exists by trying to determine from the error
        setPasswordError("Incorrect password. Please try again.");
      } else if (msg.includes("email not confirmed")) {
        setEmailError("Please verify your email before signing in.");
      } else {
        setPasswordError(error.message);
      }
      return;
    }

    navigate("/app");
  };

  const handleSignUp = async () => {
    clearErrors();
    if (!email.trim()) { setEmailError("Email is required"); return; }
    if (!password) { setPasswordError("Password is required"); return; }
    if (password.length < 6) { setPasswordError("Minimum 6 characters"); return; }
    if (password !== confirmPassword) { setConfirmError("Passwords do not match"); return; }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already registered") || msg.includes("already been registered")) {
        setEmailError("This email is already registered. Please sign in.");
      } else {
        setEmailError(error.message);
      }
      return;
    }

    // Check if user was actually created (some configs return user even if email exists)
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setEmailError("This email is already registered. Please sign in.");
      return;
    }

    setSuccessMessage("Account created! Setting up your profile...");
    setTimeout(() => navigate("/app"), 1500);
  };

  const handleForgotPassword = async () => {
    clearErrors();
    if (!email.trim()) {
      setEmailError("Enter your email address first");
      return;
    }
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);

    if (error) {
      setEmailError(error.message);
      return;
    }
    setForgotMessage("Password reset email sent. Check your inbox.");
  };

  const passwordMismatch = mode === "signup" && confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Back link */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          Back to SeaMinds
        </button>

        {/* Logo & heading */}
        <div className="text-center space-y-3">
          <img
            src={seamindsLogo}
            alt="SeaMinds"
            className="w-16 h-16 rounded-2xl mx-auto object-cover"
          />
          <h1 className="text-xl font-semibold text-foreground">
            {mode === "signin" ? "Welcome Back" : "Create Account"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to your SeaMinds account"
              : "Join the SeaMinds seafarer community"}
          </p>
        </div>

        {/* Success message */}
        {successMessage && (
          <div className="text-center py-3 rounded-xl bg-[hsl(145_40%_16%)] border border-[hsl(145_40%_25%)]">
            <p className="text-sm text-[hsl(145_60%_65%)] font-medium">{successMessage}</p>
          </div>
        )}

        {/* Forgot password success */}
        {forgotMessage && (
          <div className="text-center py-3 rounded-xl bg-[hsl(145_40%_16%)] border border-[hsl(145_40%_25%)]">
            <p className="text-sm text-[hsl(145_60%_65%)] font-medium">{forgotMessage}</p>
          </div>
        )}

        {/* Tab toggle */}
        <div className="flex bg-secondary rounded-xl p-1">
          <button
            onClick={() => { setMode("signin"); clearErrors(); }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              mode === "signin"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode("signup"); clearErrors(); }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              mode === "signup"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wide">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
              placeholder="you@example.com"
              className="w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
            />
            {emailError && (
              <p className="text-xs text-destructive mt-1">{emailError}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wide">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPasswordError(""); }}
                placeholder="••••••••"
                className="w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 pr-10 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {passwordError && (
              <p className="text-xs text-destructive mt-1">{passwordError}</p>
            )}
            {mode === "signup" && !passwordError && (
              <p className="text-xs text-muted-foreground mt-1">Minimum 6 characters</p>
            )}
            {mode === "signin" && (
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={forgotLoading}
                className="text-xs text-primary hover:text-primary/80 transition-colors mt-1"
              >
                {forgotLoading ? "Sending..." : "Forgot password?"}
              </button>
            )}
          </div>

          {/* Confirm Password (signup only) */}
          {mode === "signup" && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setConfirmError(""); }}
                  placeholder="••••••••"
                  className="w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 pr-10 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {(confirmError || passwordMismatch) && (
                <p className="text-xs text-destructive mt-1">Passwords do not match</p>
              )}
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          onClick={mode === "signin" ? handleSignIn : handleSignUp}
          disabled={loading}
          className="w-full bg-primary text-primary-foreground font-medium text-sm rounded-xl py-3.5 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading
            ? "Please wait..."
            : mode === "signin"
              ? "Sign In"
              : "Create Account"}
        </button>

        {/* Footer text */}
        <p className="text-center text-xs text-muted-foreground">
          {mode === "signin" ? (
            <>
              Don't have an account?{" "}
              <button
                onClick={() => { setMode("signup"); clearErrors(); }}
                className="text-primary hover:text-primary/80 transition-colors"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => { setMode("signin"); clearErrors(); }}
                className="text-primary hover:text-primary/80 transition-colors"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
};

export default Auth;
