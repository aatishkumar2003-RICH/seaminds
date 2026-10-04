import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ROLES: [string, string][] = [
  ["technical_superintendent", "Technical Superintendent"],
  ["marine_superintendent", "Marine Superintendent"],
  ["technical_manager", "Technical Manager"],
  ["purchasing_officer", "Purchasing Officer"],
  ["accounts_officer", "Accounts Officer"],
  ["crewing_officer", "Crewing Officer"],
  ["crewing_manager", "Crewing Manager"],
  ["ship_master", "Master (onboard)"],
  ["chief_engineer", "Chief Engineer (onboard)"],
  ["vessel_owner", "Vessel Owner"],
  ["approval_admin", "Approval Admin"],
];
const roleLabel = (r?: string | null) => ROLES.find(([k]) => k === r)?.[1] || r || "";

type Staff = { status: string; requested_role: string; approved_role: string | null } | null;
const inputCls = "w-full min-h-[48px] rounded-xl bg-[#0D1B2A] border border-[rgba(212,175,55,0.3)] px-3 text-sm text-slate-100 mb-2";

export default function FleetLogin() {
  const navigate = useNavigate();
  const { user, isReady } = useAuth();
  const [mode, setMode] = useState<"signin" | "request">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState(ROLES[0][0]);
  const [busy, setBusy] = useState(false);
  const [staff, setStaff] = useState<Staff | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState(false);

  // After sign-in: work out where this person belongs
  useEffect(() => {
    if (!user) { setStaff(undefined); return; }
    (async () => {
      const db = supabase as any;
      const { data: admin } = await db.rpc("is_admin", { _user_id: user.id });
      if (admin) { setIsAdmin(true); navigate("/management/fleet", { replace: true }); return; }
      let { data } = await db.from("fleet_staff_members").select("status,requested_role,approved_role").eq("user_id", user.id).maybeSingle();
      const meta: any = user.user_metadata || {};
      if (!data && meta.fleet_role) {
        await db.from("fleet_staff_members").insert({
          user_id: user.id, email: user.email, full_name: meta.full_name || null,
          company: meta.fleet_company || null, requested_role: meta.fleet_role,
        });
        data = { status: "pending", requested_role: meta.fleet_role, approved_role: null };
      }
      setStaff(data || null);
      if (data?.status === "approved") navigate("/management/fleet", { replace: true });
    })();
  }, [user, navigate]);

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.includes("@") ? email.trim() : `${email.trim().toLowerCase()}@staff.seaminds.life`, password });
    setBusy(false);
    if (error) toast.error(error.message);
  };

  const requestAccess = async () => {
    if (!name.trim() || !email.trim() || password.length < 8) { toast.error("Fill name, email and a password of 8+ characters"); return; }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: {
        emailRedirectTo: `${window.location.origin}/fleet/login`,
        data: { full_name: name.trim(), fleet_role: role, fleet_company: company.trim() },
      },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Check your email to confirm, then sign in here.");
    setMode("signin");
  };

  const submitForSignedIn = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await (supabase as any).from("fleet_staff_members").insert({
      user_id: user.id, email: user.email, full_name: name.trim() || null, company: company.trim() || null, requested_role: role,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setStaff({ status: "pending", requested_role: role, approved_role: null });
  };

  const card = "max-w-sm mx-auto mt-10 rounded-2xl bg-[#112240] border border-[rgba(212,175,55,0.3)] p-5";
  const gold = "w-full min-h-[48px] rounded-xl bg-[#D4AF37] text-[#0D1B2A] font-bold disabled:opacity-60";

  let body: JSX.Element;
  if (!isReady || (user && (staff === undefined || isAdmin))) {
    body = <p className="text-center text-[#94A3B8] mt-20">Checking your access…</p>;
  } else if (user && staff) {
    const msg = staff.status === "pending" ? "Your request is waiting for admin approval. You'll get access as soon as it's approved."
      : staff.status === "rejected" ? "Your request was not approved. Contact your company admin."
      : staff.status === "suspended" ? "Your access is paused. Contact your company admin." : "Opening your workspace…";
    body = (
      <div className={card}>
        <h1 className="text-lg font-bold text-[#D4AF37] mb-2">Ship Management access</h1>
        <p className="text-sm text-slate-200 mb-1">Requested: <b>{roleLabel(staff.requested_role)}</b></p>
        <p className="text-sm text-[#94A3B8] mb-4">{msg}</p>
        <button onClick={() => supabase.auth.signOut()} className="w-full min-h-[44px] rounded-xl border border-[#D4AF37] text-[#D4AF37]">Sign out</button>
      </div>
    );
  } else if (user) {
    body = (
      <div className={card}>
        <h1 className="text-lg font-bold text-[#D4AF37] mb-1">Request staff access</h1>
        <p className="text-xs text-[#94A3B8] mb-4">Signed in as {user.email}. Choose your job — the admin will approve it.</p>
        <input className={inputCls} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={inputCls} placeholder="Company (optional)" value={company} onChange={(e) => setCompany(e.target.value)} />
        <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <button className={gold} disabled={busy} onClick={submitForSignedIn}>{busy ? "Sending…" : "Send request"}</button>
      </div>
    );
  } else {
    body = (
      <div className={card}>
        <div className="hidden flex mb-4 rounded-xl overflow-hidden border border-[rgba(212,175,55,0.3)]">
          {(["signin", "request"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`flex-1 min-h-[40px] text-sm font-bold ${mode === m ? "bg-[#D4AF37] text-[#0D1B2A]" : "text-[#D4AF37]"}`}>
              {m === "signin" ? "Sign in" : "New staff"}
            </button>
          ))}
        </div>
        {mode === "request" && <>
          <input className={inputCls} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputCls} placeholder="Company (optional)" value={company} onChange={(e) => setCompany(e.target.value)} />
          <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </>}
        <input className={inputCls} placeholder="Staff ID or email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={inputCls + " mb-3"} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className={gold} disabled={busy} onClick={mode === "signin" ? signIn : requestAccess}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Request access"}
        </button>
        <p className="text-[11px] text-[#94A3B8] mt-3">Your Staff ID and password are issued by your company admin.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D1B2A] p-4">
      <button onClick={() => navigate("/")} className="flex items-center gap-1 text-[#D4AF37] min-h-[44px]">
        <ChevronLeft size={20} /> Back
      </button>
      <p className="text-center text-xs tracking-widest text-[#94A3B8] mt-4">SEAMINDS FLEET WORKSPACE</p>
      {body}
    </div>
  );
}
