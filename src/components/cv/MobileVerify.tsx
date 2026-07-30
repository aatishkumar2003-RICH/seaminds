import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BadgeCheck, Clock, Copy, Loader2, ShieldAlert } from "lucide-react";
import {
  ACTIVE_MOBILE_PROVIDER,
  getMobileVerificationProvider,
  toE164,
  validatePhone,
} from "@/lib/verification/mobileProviders";

interface MobileVerifyProps {
  phone: string;
  email: string;
  fullName: string;
  /** Called with the normalised E.164 number when it changes / is validated. */
  onNormalized?: (e164: string) => void;
  onStatusChange?: (status: "unverified" | "pending" | "verified") => void;
}

/**
 * Mobile number validation + OPTIONAL WhatsApp verification.
 * No OTP is sent — the crew opens WhatsApp with a prefilled message containing
 * a unique verification token, which an admin (or a future WhatsApp Business
 * webhook) confirms. CV generation is never blocked by this.
 */
const MobileVerify = ({ phone, email, fullName, onNormalized, onStatusChange }: MobileVerifyProps) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<"unverified" | "pending" | "verified">("unverified");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const e164 = toE164(phone);
  const formatError = phone ? validatePhone(phone) : "";

  const apply = useCallback((s: "unverified" | "pending" | "verified") => {
    setStatus(s);
    onStatusChange?.(s);
  }, [onStatusChange]);

  // Load any existing verification request for this crew member
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("mobile_verifications")
        .select("verification_token, verification_status, phone_number")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      const row = data?.[0];
      if (!row) return;
      setToken(row.verification_token);
      if (row.verification_status === "verified") apply("verified");
      else if (row.verification_status === "pending") apply("pending");
    })();
  }, [user?.id, apply]);

  useEffect(() => {
    if (!formatError && e164) onNormalized?.(e164);
  }, [e164, formatError, onNormalized]);

  const newToken = () => {
    const buf = new Uint8Array(6);
    crypto.getRandomValues(buf);
    return "SMV-" + Array.from(buf).map(b => b.toString(36).toUpperCase().padStart(2, "0")).join("").slice(0, 10);
  };

  const handleVerify = async () => {
    setErr(""); setMsg("");
    if (formatError) { setErr(formatError); return; }
    if (!user?.id) { setErr("Please sign in again."); return; }
    setBusy(true);
    try {
      // Duplicate check — same number already registered by another crew member
      const { data: dupes } = await supabase
        .from("crew_profiles")
        .select("user_id")
        .eq("whatsapp_number", e164)
        .limit(5);
      if ((dupes || []).some(d => d.user_id && d.user_id !== user.id)) {
        throw new Error("This mobile number is already registered to another SeaMinds account.");
      }

      const t = token || newToken();
      const { error } = await supabase.from("mobile_verifications").insert({
        user_id: user.id,
        full_name: fullName,
        email,
        phone_number: e164,
        verification_token: t,
        provider: ACTIVE_MOBILE_PROVIDER,
        verification_status: "pending",
      });
      if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
      setToken(t);

      const provider = getMobileVerificationProvider();
      const result = await provider.startChallenge({ token: t, phone: e164, email, fullName });
      if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
      apply("pending");
      setMsg(result.message);
    } catch (e: any) {
      setErr(e.message || "Could not start WhatsApp verification");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-1.5">
      {status === "verified" ? (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
          <BadgeCheck size={13} /> 🟢 WhatsApp Verified
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          {status === "pending" ? (
            <span className="flex items-center gap-1 text-[11px] text-amber-400"><Clock size={12} /> Verification pending</span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-amber-400"><ShieldAlert size={12} /> 🟡 Mobile number not verified</span>
          )}
          <button
            type="button"
            onClick={handleVerify}
            disabled={busy || !phone}
            className="text-[11px] px-2 py-1 rounded-md border border-[#25D366] text-[#25D366] disabled:opacity-50"
          >
            {busy ? <Loader2 size={11} className="animate-spin" /> : status === "pending" ? "Resend on WhatsApp" : "Verify via WhatsApp"}
          </button>
          {token && (
            <button
              type="button"
              onClick={() => { navigator.clipboard?.writeText(token); setMsg("Verification ID copied."); }}
              className="text-[11px] text-gray-400 underline flex items-center gap-1"
            >
              <Copy size={10} /> {token}
            </button>
          )}
        </div>
      )}
      {formatError && phone && <p className="text-[10px] text-red-400 mt-1">{formatError}</p>}
      {msg && <p className="text-[10px] text-gray-400 mt-1">{msg}</p>}
      {err && <p className="text-[10px] text-red-400 mt-1">{err}</p>}
      <p className="text-[10px] text-gray-500 mt-1">Optional — your CV can be generated without it.</p>
    </div>
  );
};

export default MobileVerify;
