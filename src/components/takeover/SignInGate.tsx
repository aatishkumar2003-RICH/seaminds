import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Module-local sign-in. Uses the existing platform authentication only —
 * no global auth files are touched.
 */
export default function SignInGate() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) toast.error(error.message);
  };

  return (
    <div className="min-h-screen bg-[#0D1B2A] p-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-[#D4AF37] min-h-[44px]">
        <ChevronLeft size={20} /> Back
      </button>
      <div className="max-w-sm mx-auto mt-16 rounded-2xl bg-[#112240] border border-[rgba(212,175,55,0.3)] p-5">
        <h1 className="text-lg font-bold text-[#D4AF37] mb-1">Sign in to inspections</h1>
        <p className="text-xs text-[#94A3B8] mb-4">
          Takeover inspection records are private. Sign in with the account that was given access.
        </p>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          className="w-full min-h-[48px] rounded-xl bg-[#0D1B2A] border border-[rgba(212,175,55,0.3)] px-3 text-sm text-slate-100 mb-2"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
          className="w-full min-h-[48px] rounded-xl bg-[#0D1B2A] border border-[rgba(212,175,55,0.3)] px-3 text-sm text-slate-100 mb-3"
        />
        <button
          onClick={signIn}
          disabled={busy}
          className="w-full min-h-[48px] rounded-xl bg-[#D4AF37] text-[#0D1B2A] font-bold disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </div>
  );
}
