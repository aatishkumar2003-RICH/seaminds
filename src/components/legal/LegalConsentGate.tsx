import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Anchor, Ship } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CONSENT_TEXT, hasAcceptedConsent, recordConsent, type ConsentRole } from "@/lib/legalConsent";

/** One-time, role-specific agreement shown after sign-in. Renders nothing once accepted. */
const LegalConsentGate = ({ role }: { role: ConsentRole }) => {
  const [uid, setUid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const check = async (id?: string) => {
      if (!id) { if (active) setUid(null); return; }
      const ok = await hasAcceptedConsent(id, role);
      if (active) setUid(ok ? null : id);
    };
    supabase.auth.getUser().then(({ data }) => check(data.user?.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setTimeout(() => check(s?.user?.id), 0); });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [role]);

  if (!uid) return null;
  const t = CONSENT_TEXT[role];
  const Icon = role === "crew" ? Anchor : Ship;

  const accept = async () => {
    setBusy(true);
    try { await recordConsent(uid, role); setUid(null); }
    catch { toast.error("Could not save. Check your connection and try again."); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-background/90 backdrop-blur-sm p-3" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div className="w-full max-w-md max-h-[92vh] flex flex-col rounded-2xl border border-primary/30 bg-card shadow-2xl">
        <div className="px-5 pt-5 pb-3 text-center">
          <div className="mx-auto mb-2 w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center text-primary"><Icon size={22} /></div>
          <h2 id="consent-title" className="text-lg font-bold text-foreground">{t.title}</h2>
          <p className="text-xs text-muted-foreground">{t.subtitle}</p>
        </div>
        <ol className="px-5 space-y-3 overflow-y-auto flex-1">
          {t.points.map((p, i) => (
            <li key={p.h} className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <div><p className="text-sm font-semibold text-foreground">{p.h}</p><p className="text-xs text-muted-foreground leading-relaxed">{p.b}</p></div>
            </li>
          ))}
        </ol>
        <div className="p-5 pt-4 space-y-2" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
          <button onClick={accept} disabled={busy} className="w-full min-h-[48px] rounded-xl bg-primary text-primary-foreground font-bold disabled:opacity-60">
            {busy ? "Saving…" : t.button}
          </button>
          <p className="text-[11px] text-center text-muted-foreground">
            By continuing you agree to our <Link to="/terms" className="text-primary underline">Terms</Link> and <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LegalConsentGate;
