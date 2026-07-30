import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BadgeCheck, Loader2, ShieldAlert } from "lucide-react";

interface ContactVerifyProps {
  channel: "email" | "whatsapp";
  value: string;
  verifiedValue: string;
  onVerified: (target: string) => void;
}

/**
 * Sends a 6-digit code to the crew's email / WhatsApp and confirms it,
 * so the CV database only holds contact details we know are reachable.
 */
const ContactVerify = ({ channel, value, verifiedValue, onVerified }: ContactVerifyProps) => {
  const { accessToken, user } = useAuth();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const startCooldown = () => {
    setCooldown(60);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { if (timer.current) clearInterval(timer.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const target = (value || "").trim();
  const isVerified = !!target && target.toLowerCase() === (verifiedValue || "").toLowerCase();
  const label = channel === "email" ? "email" : "WhatsApp number";

  const validate = () => {
    if (!target) return `Enter your ${label} first`;
    if (channel === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) return "Enter a valid email address";
    if (channel === "whatsapp" && !/^\+\d{7,15}$/.test(target.replace(/[^\d+]/g, "")))
      return "Use international format with country code (e.g. +639171234567)";
    return "";
  };

  const call = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!accessToken) throw new Error("Please sign in again to verify your contact.");
    const { data, error } = await supabase.functions.invoke("verify-contact", {
      body: { action, channel, target, fallback_email: user?.email || "", ...extra },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (error && !data) throw new Error(error.message || "Could not reach the verification service");
    if (!data?.success) throw new Error(data?.error || "Verification failed");
    return data;
  };

  const handleSend = async () => {
    setErr(""); setMsg("");
    const invalid = validate();
    if (invalid) { setErr(invalid); return; }
    setSending(true);
    try {
      const data = await call(channel === "email" ? "send_email_code" : "send_whatsapp_code");
      setCodeSent(true);
      startCooldown();
      setMsg(data.delivered === "email_fallback"
        ? `Code sent to your account email (${user?.email}) — enter it below to confirm this number.`
        : `6-digit code sent to your ${label}. It expires in 10 minutes.`);
    } catch (e: any) {
      setErr(e.message || "Could not send the code");
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async () => {
    setErr(""); setMsg("");
    setChecking(true);
    try {
      await call(channel === "email" ? "verify_email_code" : "verify_whatsapp_code", { code });
      onVerified(target);
      setCodeSent(false);
      setCode("");
      setMsg("Welcome to SeaMinds. Your contact has been successfully verified.");
    } catch (e: any) {
      setErr(e.message || "Incorrect code");
    } finally {
      setChecking(false);
    }
  };

  if (isVerified) {
    return (
      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-emerald-400">
        <BadgeCheck size={13} /> {channel === "email" ? "Email Verified" : "WhatsApp Verified"}
      </div>
    );
  }

  return (
    <div className="mt-1.5">
      {!codeSent ? (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] text-amber-400"><ShieldAlert size={12} /> Not verified</span>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || cooldown > 0}
            className="text-[11px] px-2 py-1 rounded-md border border-[#D4AF37] text-[#D4AF37] disabled:opacity-50"
          >
            {sending ? <Loader2 size={11} className="animate-spin" /> : cooldown > 0 ? `Resend in ${cooldown}s` : "Send code"}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="6-digit code"
            className="w-28 bg-[#0a1929] border border-[#1e3a5f] rounded-md px-2 py-1 text-white text-xs tracking-widest focus:border-[#D4AF37] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleVerify}
            disabled={checking || code.length !== 6}
            className="text-[11px] px-2 py-1 rounded-md bg-[#D4AF37] text-[#0D1B2A] font-semibold disabled:opacity-50"
          >
            {checking ? <Loader2 size={11} className="animate-spin" /> : "Verify code"}
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || cooldown > 0}
            className="text-[11px] text-gray-400 underline disabled:opacity-50"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend"}
          </button>
        </div>
      )}
      {msg && <p className="text-[10px] text-gray-400 mt-1">{msg}</p>}
      {err && <p className="text-[10px] text-red-400 mt-1">{err}</p>}
    </div>
  );
};

export default ContactVerify;
