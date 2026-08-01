import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Award, Megaphone } from "lucide-react";
import seamindsLogo from "@/assets/seaminds-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { checkRateLimit } from "@/lib/rateLimiter";

const COMPANY_SUGGESTIONS = [
  "Fleet Management Ltd", "Anglo-Eastern", "Synergy Marine", "V.Group", "BSM",
  "Wilhelmsen", "Columbia Shipmanagement", "Maersk", "MSC", "NYK",
  "Mitsui OSK", "Stolt-Nielsen", "Euronav",
];
const COMPANY_TYPES = ["Manning Agency", "Ship Owner / Operator", "Ship Management", "Recruitment / Crewing", "Other"];
const DESIGNATIONS = ["Crewing Manager", "Fleet Manager", "HR Manager", "Marine Superintendent", "Director / Owner", "Other"];

const inputClass = "w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary";
const labelClass = "text-xs text-muted-foreground uppercase tracking-wide";

const ManagerAuth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [designation, setDesignation] = useState("");
  const [loading, setLoading] = useState(false);

  const bumpRateLimit = async (key: string) => {
    const now = new Date().toISOString();
    const rl = await supabase.from("auth_rate_limits").select("*").eq("ip_address", key).maybeSingle();
    if (rl.data) {
      const stale = new Date(rl.data.window_start).getTime() < Date.now() - 10 * 60 * 1000;
      await supabase.from("auth_rate_limits").update(
        stale ? { attempt_count: 1, window_start: now, last_attempt: now }
              : { attempt_count: rl.data.attempt_count + 1, last_attempt: now }
      ).eq("ip_address", key);
    } else {
      await supabase.from("auth_rate_limits").insert({ ip_address: key, attempt_count: 1, window_start: now, last_attempt: now });
    }
  };

  const overLimit = async (key: string) => {
    const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabase.from("auth_rate_limits").select("*", { count: "exact", head: true }).eq("ip_address", key).gte("last_attempt", windowStart);
    return (count || 0) >= 5;
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    if (!(await checkRateLimit())) return;
    const key = `login:${email.trim()}`;
    if (await overLimit(key)) { toast.error("Too many attempts. Please wait 10 minutes."); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { toast.error(error.message); await bumpRateLimit(key); setLoading(false); return; }
    navigate("/manager/dashboard");
  };

  const handleSignup = async () => {
    if (!email.trim() || !password || !companyName.trim() || !fullName.trim()) {
      toast.error("Please fill company, your name, email and password.");
      return;
    }
    if (!(await checkRateLimit())) return;
    const key = `login:${email.trim()}`;
    if (await overLimit(key)) { toast.error("Too many attempts. Please wait 10 minutes."); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) { toast.error(error.message); await bumpRateLimit(key); setLoading(false); return; }
    if (data.user) {
      const { error: profileErr } = await supabase.from("manager_profiles").insert({
        user_id: data.user.id,
        company_name: companyName.trim(),
        company_type: companyType || null,
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        designation: designation || null,
      });
      if (profileErr) { toast.error("Could not save company details. Please try again."); setLoading(false); return; }
    }
    toast.success("Welcome aboard! Your company account is ready.");
    navigate("/manager/dashboard");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen max-w-md mx-auto bg-background px-6 py-10">
      <div className="w-full max-w-sm space-y-6">
        <button onClick={() => navigate("/")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} /> Back to SeaMinds
        </button>

        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto overflow-hidden">
            <img src={seamindsLogo} alt="SeaMinds" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Manager Portal</h1>
          <p className="text-sm text-muted-foreground">Free crew access for manning companies</p>
        </div>

        {mode === "signup" && (
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["Search verified crew", Search], ["View SMC scores", Award], ["Post vacancies", Megaphone]].map(([t, Icon]: any) => (
              <div key={t} className="bg-secondary/60 rounded-xl px-2 py-3 space-y-1">
                <Icon size={16} className="text-primary mx-auto" />
                <p className="text-[10px] leading-tight text-muted-foreground">{t}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex bg-secondary rounded-xl p-1">
          <button onClick={() => setMode("login")} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Sign in</button>
          <button onClick={() => setMode("signup")} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Create free account</button>
        </div>

        <div className="space-y-4">
          {mode === "signup" && (
            <>
              <div className="space-y-1.5">
                <label className={labelClass}>Company Name *</label>
                <input list="company-suggestions" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Type your company name" className={inputClass} />
                <datalist id="company-suggestions">{COMPANY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Company Type</label>
                <select value={companyType} onChange={(e) => setCompanyType(e.target.value)} className={`${inputClass} appearance-none`}>
                  <option value="">Select type</option>
                  {COMPANY_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Your Full Name *</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Maria Santos" className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Phone / WhatsApp</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+63 917 000 0000" className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Designation</label>
                <select value={designation} onChange={(e) => setDesignation(e.target.value)} className={`${inputClass} appearance-none`}>
                  <option value="">Select role</option>
                  {DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className={labelClass}>Work Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Password *</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={inputClass} />
          </div>
        </div>

        <button onClick={mode === "login" ? handleLogin : handleSignup} disabled={loading} className="w-full bg-primary text-primary-foreground font-medium text-sm rounded-xl py-3.5 disabled:opacity-30 transition-opacity">
          {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create free account"}
        </button>

        {mode === "signup" && (
          <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
            Free for manning companies during launch — no credit card. By registering you agree to use crew data for genuine recruitment only.
          </p>
        )}
      </div>
    </div>
  );
};

export default ManagerAuth;
