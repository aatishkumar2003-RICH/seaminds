import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import seamindsLogo from "@/assets/seaminds-logo.png";

type AuthzDetails = {
  client?: { name?: string; client_name?: string; logo_uri?: string };
  redirect_url?: string;
  redirect_to?: string;
  scope?: string;
};

// The `supabase.auth.oauth` namespace is beta; typed locally.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthzDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthzDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthzDetails | null; error: { message: string } | null }>;
};
const oauthApi = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

const OAuthConsent = () => {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthzDetails | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const returnUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        setNeedsLogin(true);
        return;
      }
      const { data, error: detErr } = await oauthApi().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (detErr) {
        setError(detErr.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    const api = oauthApi();
    const { data, error: decErr } = approve
      ? await api.approveAuthorization(authorizationId)
      : await api.denyAuthorization(authorizationId);
    if (decErr) {
      setBusy(false);
      setError(decErr.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  };

  const signInGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: returnUrl } });
  };

  const signInEmail = async () => {
    if (!email) return;
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: returnUrl },
    });
    if (authError) setError(authError.message);
    else setEmailSent(true);
  };

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "this app";

  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-10 bg-[#0D1B2A] text-white">
      <div className="w-full max-w-md rounded-2xl border border-[#D4AF37]/30 bg-[#132437] p-7 shadow-xl">
        <img src={seamindsLogo} alt="SeaMinds logo" className="h-12 w-12 rounded-xl mb-5" />

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {needsLogin ? (
          <>
            <h1 className="text-xl font-semibold text-[#D4AF37]">Sign in to continue</h1>
            <p className="mt-2 text-sm text-white/70">
              Sign in to your SeaMinds account to approve this connection request.
            </p>
            <button
              onClick={signInGoogle}
              className="mt-5 w-full rounded-xl bg-[#D4AF37] py-3 font-semibold text-[#0D1B2A]"
            >
              Continue with Google
            </button>
            <div className="my-4 text-center text-xs uppercase tracking-widest text-white/40">or</div>
            {emailSent ? (
              <p className="text-sm text-white/70">Check your inbox for the sign-in link, then return here.</p>
            ) : (
              <div className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-white/15 bg-[#0D1B2A] px-4 py-3 text-sm outline-none focus:border-[#D4AF37]"
                />
                <button
                  onClick={signInEmail}
                  className="w-full rounded-xl border border-[#D4AF37]/50 py-3 text-sm font-semibold text-[#D4AF37]"
                >
                  Email me a sign-in link
                </button>
              </div>
            )}
          </>
        ) : !details ? (
          <p className="text-sm text-white/70">Loading authorization request…</p>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-[#D4AF37]">Connect {clientName} to SeaMinds</h1>
            <p className="mt-3 text-sm text-white/70">
              {clientName} will be able to read your crew profile, SMC score and job matches, and update your
              availability — acting as you. Your wellness chats stay private.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                disabled={busy}
                onClick={() => decide(true)}
                className="flex-1 rounded-xl bg-[#D4AF37] py-3 font-semibold text-[#0D1B2A] disabled:opacity-60"
              >
                Approve
              </button>
              <button
                disabled={busy}
                onClick={() => decide(false)}
                className="flex-1 rounded-xl border border-white/20 py-3 font-semibold text-white/80 disabled:opacity-60"
              >
                Deny
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
};

export default OAuthConsent;
