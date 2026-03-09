import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Anchor, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { checkRateLimit } from "@/lib/rateLimiter";

const VALID_ACCESS_CODE = "SEAMINDS2026";

const COMPANIES = [
  "Fleet Management Ltd", "Anglo-Eastern", "Synergy Marine", "V.Group", "BSM",
  "Wilhelmsen", "Columbia Shipmanagement", "Maersk", "MSC", "NYK",
  "Mitsui OSK", "Stolt-Nielsen", "Euronav", "Other",
];

const inputClass = "w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary";
const labelClass = "text-xs text-muted-foreground uppercase tracking-wide";

const ManagerAuth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    if (!(await checkRateLimit())) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    navigate("/manager/dashboard");
  };

  const handleSignup = async () => {
    if (!email.trim() || !password || !companyName || !accessCode) return;

    if (accessCode !== VALID_ACCESS_CODE) {
      toast.error("Invalid access code. Contact SeaMinds for manager access.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const { error: profileErr } = await supabase
        .from("manager_profiles")
        .insert({ user_id: data.user.id, company_name: companyName });

      if (profileErr) {
        toast.error("Failed to create manager profile");
        setLoading(false);
        return;
      }
    }

    navigate("/manager/dashboard");
  };

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
          <h1 className="text-xl font-semibold text-foreground">Manager Portal</h1>
          <p className="text-sm text-muted-foreground">Welfare oversight for shipping companies</p>
        </div>

        {/* Tab toggle */}
        <div className="flex bg-secondary rounded-xl p-1">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            Login
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            Register
          </button>
        </div>

        <div className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <label className={labelClass}>Company Name *</label>
              <div className="relative">
                <select
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={`${inputClass} appearance-none`}
                >
                  <option value="" disabled>Select company</option>
                  {COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className={labelClass}>Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="manager@company.com" className={inputClass} />
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Password *</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputClass} />
          </div>

          {mode === "signup" && (
            <div className="space-y-1.5">
              <label className={labelClass}>Access Code *</label>
              <input type="text" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Enter company access code" className={inputClass} />
            </div>
          )}
        </div>

        <button
          onClick={mode === "login" ? handleLogin : handleSignup}
          disabled={loading}
          className="w-full bg-primary text-primary-foreground font-medium text-sm rounded-xl py-3.5 disabled:opacity-30 transition-opacity"
        >
          {loading ? "Please wait..." : mode === "login" ? "Login" : "Register"}
        </button>
      </div>
    </div>
  );
};

export default ManagerAuth;
