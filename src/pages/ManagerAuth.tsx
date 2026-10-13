import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Award, Megaphone } from "lucide-react";
import seamindsLogo from "@/assets/seaminds-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { trackPixel } from "@/lib/metaPixel";
import PasswordInput from "@/components/PasswordInput";

const COMPANY_SUGGESTIONS = [
  "Fleet Management Ltd", "Anglo-Eastern", "Synergy Marine", "V.Group", "BSM",
  "Wilhelmsen", "Columbia Shipmanagement", "Maersk", "MSC", "NYK",
  "Mitsui OSK", "Stolt-Nielsen", "Euronav",
];
const COMPANY_TYPES = ["Manning Agency", "Ship Owner / Operator", "Ship Management", "Recruitment / Crewing", "Other"];
const DESIGNATIONS = ["Crewing Manager", "Fleet Manager", "HR Manager", "Marine Superintendent", "Director / Owner", "Other"];

const inputClass = "w-full bg-secondary text-foreground text-sm rounded-xl px-4 py-3 placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary";
const labelClass = "text-xs text-muted-foreground uppercase tracking-wide";

const DEMO_STEPS = [
  {
    tab: "1 · Vacancy",
    title: "Vacancy extraction & crew matching",
    body: (
      <>
        <p className="text-sm font-semibold text-foreground">Chief Officer · Bulk Carrier (sample advert)</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <span>Contract: 6 months</span><span>Joining: Singapore</span>
          <span>COC: Chief Mate</span><span>Positions: 1</span>
        </div>
        <p className="text-xs text-muted-foreground">Fields are read from the flyer or pasted text, then checked by you before publishing. Matching suggests candidates by rank and vessel type; availability is not guaranteed.</p>
      </>
    ),
  },
  {
    tab: "2 · Interview",
    title: "AI competency interview & sample scoring",
    body: (
      <>
        <p className="text-sm font-semibold text-foreground">Sample candidate A · Chief Officer</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <span>Technical 3.6 / 5</span><span>Judgment 3.4 / 5</span>
          <span>Maritime English 4.0 / 5</span><span>Behaviour 3.8 / 5</span>
        </div>
        <p className="text-xs text-muted-foreground">Scores are AI-assessed professional screening. CV details are self-declared, not independently verified.</p>
      </>
    ),
  },
  {
    tab: "3 · Shortlist",
    title: "Shortlist, protected contact & application workflow",
    body: (
      <>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>⭐ Sample candidate A — 3.7 overall · shortlisted</li>
          <li>⭐ Sample candidate B — 3.4 overall · shortlisted</li>
          <li>Sample candidate C — 2.9 overall · under review</li>
        </ul>
        <p className="text-xs text-muted-foreground">Contact details unlock only for approved companies and use credits. WhatsApp messages open prefilled — you press send yourself.</p>
      </>
    ),
  },
];

const DemoWalkthrough = () => {
  const [step, setStep] = useState(0);
  const s = DEMO_STEPS[step];
  return (
    <div className="rounded-2xl border border-primary/30 bg-card p-5 space-y-3" aria-label="ShipManager sample walkthrough">
      <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Sample / demo — not live crew data</span>
      <div className="flex gap-1.5" role="tablist">
        {DEMO_STEPS.map((d, i) => (
          <button key={d.tab} role="tab" aria-selected={i === step} onClick={() => setStep(i)}
            className={`flex-1 min-h-[36px] rounded-lg text-[11px] font-semibold border ${i === step ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
            {d.tab}
          </button>
        ))}
      </div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.title}</p>
      {s.body}
      <button onClick={() => setStep((step + 1) % DEMO_STEPS.length)} className="text-xs font-semibold text-primary">
        {step < DEMO_STEPS.length - 1 ? "Next step →" : "↺ Start again"}
      </button>
    </div>
  );
};

const ManagerAuth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">(() =>
    new URLSearchParams(window.location.search).get("mode") === "signup" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [designation, setDesignation] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);


  useEffect(() => { document.title = "ShipManager Login — ShipManager by SeaMinds"; }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      if (/not confirmed/i.test(error.message)) {
        toast.error("Your email isn't confirmed yet.", {
          description: "Check your inbox and spam folder.",
          action: {
            label: "Resend email",
            onClick: async () => {
              await supabase.auth.resend({ type: "signup", email: email.trim() });
              toast.success("Confirmation email resent — check spam too.");
            },
          },
        });
      } else {
        toast.error(error.message);
      }
      setLoading(false); return;
    }
    navigate("/manager/dashboard");
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) { toast.error("Enter your work email first, then tap Forgot password."); return; }
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Reset link sent. Check your email inbox and spam folder.");
  };

  const handleSignup = async () => {
    if (!email.trim() || !password || !companyName.trim() || !fullName.trim()) {
      toast.error("Please fill company, your name, email and password.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/manager/dashboard`,
        data: {
          company_name: companyName.trim(),
          company_type: companyType || "",
          full_name: fullName.trim(),
          phone: phone.trim() || "",
          designation: designation || "",
        },
      },
    });
    if (error) { toast.error(error.message); setLoading(false); return; }

    trackPixel("CompleteRegistration", { content_name: "company_signup" });

    // A database trigger creates the company profile from the signup metadata.
    // If we already have a session, make sure it exists straight away too.
    if (data.session && data.user) {
      await supabase.from("manager_profiles").upsert({
        user_id: data.user.id,
        company_name: companyName.trim(),
        company_type: companyType || null,
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        designation: designation || null,
      }, { onConflict: "user_id" });
    }

    setLoading(false);

    if (!data.session) {
      toast.success("Account created. Check your email to confirm, then sign in.");
      setMode("login");
      return;
    }

    toast.success("Welcome aboard! Your company account is ready.");
    navigate("/manager/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 lg:py-12 grid gap-10 lg:grid-cols-2 lg:items-start">
      {/* Value column — order 2 on mobile so the form comes first */}
      <section className="order-2 lg:order-1 space-y-6">
        <div className="hidden lg:flex items-center gap-3">
          <span className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center overflow-hidden">
            <img src={seamindsLogo} alt="SeaMinds" className="w-9 h-9 object-contain" />
          </span>
          <div>
            <p className="text-lg font-bold text-primary leading-tight">ShipManager</p>
            <p className="text-xs text-muted-foreground">by SeaMinds</p>
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl lg:text-4xl font-bold text-foreground leading-tight">Recruit, assess and manage crew from one workspace.</h2>
          <p className="text-sm lg:text-base text-muted-foreground">Post vacancies, run AI crew interviews and review structured Sea Profiles — built for manning agencies, ship managers and owners.</p>
        </div>
        <ul className="space-y-2 text-sm text-foreground">
          <li>• Free company registration during launch — vacancy posting and AI interviews</li>
          <li>• Crew search and contact details need company approval and credits</li>
          <li>• Fleet inspection tools are available to approved fleet staff</li>
        </ul>
        <DemoWalkthrough />
        <a href="mailto:admin@seaminds.life?subject=ShipManager%20by%20SeaMinds%20%E2%80%94%20company%20enquiry" className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl text-sm font-bold border border-primary/50 text-primary">
          Talk to SeaMinds by email
        </a>
      </section>

      <div className="order-1 lg:order-2 w-full max-w-sm mx-auto lg:max-w-md lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:p-8 space-y-6">
        <button onClick={() => navigate("/")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} /> Back to Home
        </button>

        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto overflow-hidden lg:hidden">
            <img src={seamindsLogo} alt="SeaMinds" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">ShipManager Login</h1>
          <p className="text-sm text-muted-foreground">ShipManager by SeaMinds — for maritime employers</p>
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
            <PasswordInput
              value={password}
              onChange={setPassword}
              className={inputClass}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              onEnter={mode === "login" ? handleLogin : handleSignup}
            />
          </div>
        </div>

        <button onClick={mode === "login" ? handleLogin : handleSignup} disabled={loading} className="w-full bg-primary text-primary-foreground font-medium text-sm rounded-xl py-3.5 disabled:opacity-30 transition-opacity">
          {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create free account"}
        </button>

        {mode === "login" && (
          <button
            onClick={handleForgotPassword}
            disabled={resetting}
            className="w-full text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            {resetting ? "Sending reset link..." : "Forgot password?"}
          </button>
        )}

        {mode === "signup" && (
          <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
            Free registration during launch — no credit card. Crew contact access depends on company approval and credits. By registering you agree to use crew data for genuine recruitment only.
          </p>
        )}

        <a href="mailto:support@seaminds.life?subject=Manager%20portal%20login%20help" className="block text-center text-[11px] text-muted-foreground hover:text-primary">Trouble signing in? Contact SeaMinds support</a>
      </div>
      </div>
    </div>
  );
};

export default ManagerAuth;
