import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { ChevronLeft, ShieldCheck, Anchor, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

type Claim = { ok: boolean; company?: string; first_name?: string; last_name?: string; rank?: string; nationality?: string; vessel?: string; crew_unique_id?: string; status?: string; sea_count?: number; cert_count?: number; email_hint?: string | null };
const ERR: Record<string, string> = {
  manager_account: "You are signed in with a company account. Please sign in with your personal seafarer account.",
  already_claimed: "This profile was already accepted by another account. Contact your company if this is wrong.",
  invalid_link: "This link is not valid.", sign_in_required: "Please sign in first.",
};

export default function ClaimProfile() {
  const { token = "" } = useParams(); const navigate = useNavigate(); const { user, isReady } = useAuth();
  const [c, setC] = useState<Claim | null>(null); const [busy, setBusy] = useState(false); const [done, setDone] = useState<string | null>(null);

  const load = async () => { const { data } = await supabase.rpc("get_crew_claim" as any, { p_token: token }); setC((data as any) || { ok: false }); };
  useEffect(() => { void load(); }, [token]);

  const accept = async () => {
    if (!user) { navigate(`/join?next=${encodeURIComponent(`/claim/${token}`)}`); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("accept_crew_claim" as any, { p_token: token });
    setBusy(false); const d = data as any;
    if (error || !d?.ok) { toast.error(ERR[d?.error] || "Could not accept. Please try again."); return; }
    setDone(d.crew_unique_id || c?.crew_unique_id || "");
  };
  const decline = async () => {
    if (!confirm("Decline this profile? The company will see that you declined.")) return;
    setBusy(true); await supabase.rpc("decline_crew_claim" as any, { p_token: token }); setBusy(false);
    toast.success("You declined this profile."); void load();
  };

  return (
    <main className="min-h-screen bg-background text-foreground pb-10">
      <Helmet><title>Accept your crew profile | SeaMinds</title><meta name="robots" content="noindex" /></Helmet>
      <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
        <Button variant="ghost" className="px-0 text-primary" onClick={() => navigate("/")}><ChevronLeft /> Back</Button>
        {!c || !isReady ? <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" size={18} /> Loading your profile…</p>
        : !c.ok ? (
          <section className="space-y-3"><Anchor className="text-primary" size={36} /><h1 className="text-xl font-bold">This link is not valid.</h1><p className="text-sm text-muted-foreground">Ask your company to send a new link.</p></section>
        ) : done !== null ? (
          <section className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto text-primary" size={56} />
            <h1 className="text-2xl font-bold">Profile accepted</h1>
            <p className="text-sm text-muted-foreground">Your SeaMinds Crew ID</p>
            <p className="text-2xl font-mono font-bold text-primary">{done}</p>
            <p className="text-sm text-muted-foreground">Your company-verified details are now in your SeaMinds CV. You can add or correct anything any time.</p>
            <Button className="w-full min-h-12 rounded-xl font-bold" onClick={() => navigate("/")}>Open SeaMinds <ArrowRight /></Button>
          </section>
        ) : c.status === "declined" ? (
          <section className="space-y-3"><h1 className="text-xl font-bold">You declined this profile</h1><p className="text-sm text-muted-foreground">{c.company} has been informed. If this was a mistake, ask them to add you again.</p></section>
        ) : (
          <section className="space-y-5">
            <header className="space-y-2">
              <Anchor size={32} className="text-primary" />
              <h1 className="text-2xl font-bold">{c.company} created your seafarer profile</h1>
              <p className="text-sm text-muted-foreground">Check the details below. If they are yours, accept with one tap.</p>
            </header>
            <article className="rounded-xl border border-primary/50 bg-card p-5 space-y-2">
              <p className="text-lg font-bold">{c.rank} {c.first_name} {c.last_name}</p>
              <p className="text-sm text-muted-foreground">{[c.nationality, c.vessel].filter(Boolean).join(" · ")}</p>
              <p className="text-sm">Crew ID: <span className="font-mono font-bold text-primary">{c.crew_unique_id}</span></p>
              <p className="text-sm text-muted-foreground">{c.sea_count || 0} sea service entries · {c.cert_count || 0} certificates</p>
              {c.email_hint && <p className="text-xs text-muted-foreground">Email on file: {c.email_hint}</p>}
              <p className="flex items-center gap-1 text-xs text-primary"><ShieldCheck size={14} /> Company Verified by {c.company}</p>
            </article>
            <Button disabled={busy} onClick={accept} className="w-full min-h-12 rounded-xl font-bold">{busy ? "Please wait…" : user ? "Confirm & accept my profile" : "Sign in free & accept"}</Button>
            <Button variant="ghost" disabled={busy} onClick={decline} className="w-full text-muted-foreground">This is not me / Decline</Button>
            <footer className="text-xs text-muted-foreground space-y-1 border-t border-border pt-3">
              <p>By accepting, you confirm these details are yours and agree that {c.company} manages your crew record. Your private wellness chats are never shared with any company.</p>
              <p>Free for seafarers.</p>
            </footer>
          </section>
        )}
      </div>
    </main>
  );
}
