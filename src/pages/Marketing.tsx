import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PasswordInput from "@/components/PasswordInput";

const GOLD = "#D4AF37";
const NAVY = "#0D1B2A";
const CARD = "#112240";
const BORDER = "#1e3a5f";

const ANGLES = [
  { id: "jobs", label: "💼 Today's Jobs" },
  { id: "scam", label: "🚫 No Fees" },
  { id: "score", label: "🏆 Competency Score" },
  { id: "truth", label: "🌊 Life at Sea" },
  { id: "article", label: "📖 Today's Guide" },
  { id: "company", label: "🏢 For Companies" },
];

const DIGEST = "https://luomzexqgcjtcmdlbevo.supabase.co/functions/v1/vacancy-card?mode=digest&secret=sm-agt-7Qk4Xv92Rb1Ld6Zt5Wn3Hy8Pc";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 12px", borderRadius: 10,
  background: NAVY, border: `1px solid ${BORDER}`, color: "#e2e8f0",
  fontSize: 13, outline: "none",
};

type Channel = { id: string; platform: string; label: string; url: string };

const Marketing = () => {
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [member, setMember] = useState<boolean | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  const [angle, setAngle] = useState("jobs");
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<any>(null);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [cPlatform, setCPlatform] = useState("");
  const [cLabel, setCLabel] = useState("");
  const [cUrl, setCUrl] = useState("");
  const [adding, setAdding] = useState(false);

  const loadChannels = useCallback(async () => {
    const { data } = await supabase.from("marketing_channels").select("*").order("created_at");
    setChannels((data as Channel[]) || []);
  }, []);

  const evaluate = useCallback(async () => {
    setChecking(true);
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id ?? null;
    setUserId(uid);
    if (!uid) {
      setMember(null);
      setChecking(false);
      return;
    }
    const { data: ok } = await supabase.rpc("is_marketing_member");
    setMember(ok === true);
    if (ok === true) {
      supabase.rpc("log_marketing_action", { p_action: "portal_open" });
      loadChannels();
    }
    setChecking(false);
  }, [loadChannels]);

  useEffect(() => { evaluate(); }, [evaluate]);

  const signIn = async () => {
    setSigningIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSigningIn(false);
    if (error) { toast.error(error.message); return; }
    evaluate();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserId(null);
    setMember(null);
  };

  const generate = async () => {
    setLoading(true);
    setContent(null);
    try {
      const { data, error } = await supabase.functions.invoke("social-content", { body: { angle } });
      if (error) throw error;
      if (!data?.success) { toast.error(data?.error || "Could not generate"); return; }
      setContent(data.content);
      supabase.rpc("log_marketing_action", { p_action: "content_generated", p_details: { angle } });
    } catch {
      toast.error("Could not generate. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const addChannel = async () => {
    if (!cPlatform.trim() || !cUrl.trim()) { toast.error("Platform and URL required"); return; }
    setAdding(true);
    const { error } = await supabase.from("marketing_channels").insert({
      platform: cPlatform.trim(), label: cLabel.trim(), url: cUrl.trim(), added_by: userId,
    });
    setAdding(false);
    if (error) { toast.error(error.message); return; }
    supabase.rpc("log_marketing_action", { p_action: "channel_added", p_details: { platform: cPlatform.trim(), url: cUrl.trim() } });
    setCPlatform(""); setCLabel(""); setCUrl("");
    loadChannels();
    toast.success("Channel added");
  };

  const copy = (text: string, what: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${what} copied`),
      () => toast.error("Could not copy"),
    );
  };

  const Block = ({ title, body, extra }: { title: string; body: string; extra?: string }) => (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <span style={{ color: GOLD, fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>{title}</span>
        <button onClick={() => copy(extra ? `${body}\n\n${extra}` : body, title)}
          style={{ marginLeft: "auto", background: GOLD, color: NAVY, border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}>
          Copy
        </button>
      </div>
      <p style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{body}</p>
      {extra && <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>{extra}</p>}
    </div>
  );

  if (checking) {
    return <div style={{ minHeight: "100vh", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>Checking access…</div>;
  }

  if (!userId) {
    return (
      <div style={{ minHeight: "100vh", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ width: "100%", maxWidth: 380, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20 }}>
          <h1 style={{ color: GOLD, fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Marketing Team</h1>
          <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 16 }}>Sign in with your SeaMinds team account.</p>
          <div style={{ display: "grid", gap: 10 }}>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@seaminds.life" autoComplete="email" style={inputStyle}
            />
            <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" style={inputStyle} onEnter={signIn} />
            <button onClick={signIn} disabled={signingIn}
              style={{ width: "100%", padding: "12px 0", borderRadius: 12, border: "none", background: GOLD, color: NAVY, fontWeight: 900, fontSize: 14, cursor: signingIn ? "default" : "pointer", opacity: signingIn ? 0.5 : 1 }}>
              {signingIn ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (member !== true) {
    return (
      <div style={{ minHeight: "100vh", background: NAVY, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 16 }}>
        <p style={{ color: "#e2e8f0", fontSize: 14, textAlign: "center" }}>This account is not on the marketing team.</p>
        <button onClick={signOut}
          style={{ background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 10, padding: "9px 18px", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: NAVY, paddingBottom: 50 }}>
      <header style={{ borderBottom: `1px solid ${BORDER}`, padding: "16px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ color: GOLD, fontSize: 18, fontWeight: 900 }}>Content Studio</h1>
            <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 3 }}>
              Written from today's live jobs and articles. Pick an angle, generate, copy, post.
            </p>
          </div>
          <button onClick={signOut}
            style={{ marginLeft: "auto", background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 10, padding: "7px 14px", fontWeight: 800, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
            Sign out
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {ANGLES.map((a) => (
            <button key={a.id} onClick={() => setAngle(a.id)}
              style={{
                padding: "8px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                background: angle === a.id ? GOLD : "transparent",
                color: angle === a.id ? NAVY : GOLD,
                border: `1px solid ${angle === a.id ? GOLD : "rgba(212,175,55,0.45)"}`,
              }}>
              {a.label}
            </button>
          ))}
        </div>

        <button onClick={generate} disabled={loading}
          style={{
            width: "100%", padding: "14px 0", borderRadius: 14, border: "none",
            background: GOLD, color: NAVY, fontWeight: 900, fontSize: 15,
            cursor: loading ? "default" : "pointer", opacity: loading ? 0.5 : 1, marginBottom: 18,
          }}>
          {loading ? "Writing…" : "✨ Write today's content"}
        </button>

        <section style={{ marginBottom: 20 }}>
          <h2 style={{ color: GOLD, fontSize: 14, fontWeight: 900, marginBottom: 10 }}>📺 Our Channels</h2>
          {channels.length === 0 && (
            <p style={{ color: "#64748b", fontSize: 12, marginBottom: 10 }}>No channels added yet.</p>
          )}
          {channels.map((ch) => (
            <div key={ch.id}
              style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ color: GOLD, fontSize: 12, fontWeight: 800 }}>{ch.platform}</p>
                <p style={{ color: "#e2e8f0", fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.label}</p>
              </div>
              <a href={ch.url} target="_blank" rel="noopener noreferrer"
                style={{ marginLeft: "auto", color: NAVY, background: GOLD, borderRadius: 8, padding: "6px 12px", fontSize: 11.5, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap" }}>
                Open ↗
              </a>
            </div>
          ))}

          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, marginTop: 10, display: "grid", gap: 8 }}>
            <input value={cPlatform} onChange={(e) => setCPlatform(e.target.value)} placeholder="Platform (e.g. TikTok)" style={inputStyle} />
            <input value={cLabel} onChange={(e) => setCLabel(e.target.value)} placeholder="Label (e.g. SeaMinds Official)" style={inputStyle} />
            <input value={cUrl} onChange={(e) => setCUrl(e.target.value)} placeholder="https://…" style={inputStyle} />
            <button onClick={addChannel} disabled={adding}
              style={{ padding: "10px 0", borderRadius: 10, border: "none", background: GOLD, color: NAVY, fontWeight: 900, fontSize: 13, cursor: adding ? "default" : "pointer", opacity: adding ? 0.5 : 1 }}>
              {adding ? "Adding…" : "Add channel"}
            </button>
          </div>
        </section>

        {content && (
          <>
            {content.tiktok && (
              <div style={{ background: CARD, border: `1px solid ${GOLD}`, borderRadius: 14, padding: 14, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ color: GOLD, fontSize: 12, fontWeight: 800 }}>TIKTOK / REELS</span>
                  <button onClick={() => copy(`${content.tiktok.script}\n\n${content.tiktok.caption}\n\n${content.tiktok.hashtags}`, "TikTok")}
                    style={{ marginLeft: "auto", background: GOLD, color: NAVY, border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}>
                    Copy
                  </button>
                </div>
                <p style={{ color: "#f59e0b", fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
                  HOOK: {content.tiktok.hook}
                </p>
                <p style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{content.tiktok.script}</p>
                {Array.isArray(content.tiktok.onscreen) && (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>ON-SCREEN TEXT:</p>
                    {content.tiktok.onscreen.map((t: string, k: number) => (
                      <p key={k} style={{ color: "#cbd5e1", fontSize: 12.5, lineHeight: 1.6 }}>{k + 1}. {t}</p>
                    ))}
                  </div>
                )}
                <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>{content.tiktok.caption}</p>
                <p style={{ color: "#64748b", fontSize: 11.5, marginTop: 6 }}>{content.tiktok.hashtags}</p>
              </div>
            )}

            {content.instagram && <Block title="INSTAGRAM / FACEBOOK" body={content.instagram.caption} extra={content.instagram.hashtags} />}
            {content.x && <Block title="X" body={content.x.post} />}
            {content.linkedin && <Block title="LINKEDIN" body={content.linkedin.post} />}
            {content.whatsapp && <Block title="WHATSAPP / TELEGRAM" body={content.whatsapp.message} />}

            <a href={DIGEST} target="_blank" rel="noopener noreferrer"
              style={{ display: "block", textAlign: "center", background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 12, padding: "12px 0", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
              🖼️ Open today's job image to save
            </a>
          </>
        )}
      </main>
    </div>
  );
};

export default Marketing;
