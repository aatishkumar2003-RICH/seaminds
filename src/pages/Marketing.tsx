import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

const Marketing = () => {
  const [angle, setAngle] = useState("jobs");
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<any>(null);

  const generate = async () => {
    setLoading(true);
    setContent(null);
    try {
      const { data, error } = await supabase.functions.invoke("social-content", { body: { angle } });
      if (error) throw error;
      if (!data?.success) { toast.error(data?.error || "Could not generate"); return; }
      setContent(data.content);
    } catch {
      toast.error("Could not generate. Try again.");
    } finally {
      setLoading(false);
    }
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

  return (
    <div style={{ minHeight: "100vh", background: NAVY, paddingBottom: 50 }}>
      <header style={{ borderBottom: `1px solid ${BORDER}`, padding: "16px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h1 style={{ color: GOLD, fontSize: 18, fontWeight: 900 }}>Content Studio</h1>
          <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 3 }}>
            Written from today's live jobs and articles. Pick an angle, generate, copy, post.
          </p>
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
