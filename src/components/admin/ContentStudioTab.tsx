import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

const GOLD = "#D4AF37";
const CARD = "#112240";
const BORDER = "#1e3a5f";

// Library types cost nothing — they read from content_library
const LIBRARY = [
  { kind: "incident",   label: "⚓ Incident → Regulation" },
  { kind: "history",    label: "📜 Maritime History" },
  { kind: "quote",      label: "💬 Quote" },
  { kind: "motivation", label: "🔥 Motivation" },
  { kind: "fact",       label: "📊 Fact" },
];

// AI types use live platform data (costs a little OpenAI)
const AI_ANGLES = [
  { id: "jobs",    label: "💼 Today's Jobs" },
  { id: "scam",    label: "🚫 No Fees" },
  { id: "score",   label: "🏆 Competency Score" },
  { id: "truth",   label: "🌊 Life at Sea" },
  { id: "article", label: "📖 Today's Guide" },
  { id: "company", label: "🏢 For Companies" },
];

const DIGEST = "https://luomzexqgcjtcmdlbevo.supabase.co/functions/v1/vacancy-card?mode=digest&secret=sm-agt-7Qk4Xv92Rb1Ld6Zt5Wn3Hy8Pc";

const ContentStudioTab = () => {
  const [loading, setLoading] = useState(false);
  const [post, setPost] = useState<any>(null);
  const [aiContent, setAiContent] = useState<any>(null);
  const [audience, setAudience] = useState<"crew" | "manager">("crew");

  const copy = (text: string, what: string) => {
    if (!text) { toast.error("Nothing to copy"); return; }
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${what} copied`),
      () => window.prompt(`Copy ${what}:`, text),
    );
  };

  const generateFromLibrary = async (kind: string) => {
    setLoading(true); setPost(null); setAiContent(null);
    try {
      const { data, error } = await supabase.rpc("build_post" as any, {
        p_kind: kind, p_audience: audience, p_id: null,
      });
      if (error) throw error;
      const r: any = data;
      if (!r?.ok) { toast.error(r?.error || "No content of that type"); return; }
      setPost(r);
    } catch (e: any) {
      toast.error(e?.message || "Could not generate");
    } finally { setLoading(false); }
  };

  const generateWithAI = async (angle: string) => {
    setLoading(true); setPost(null); setAiContent(null);
    try {
      const { data, error } = await supabase.functions.invoke("social-content", { body: { angle } });
      if (error) throw error;
      if (!data?.success) { toast.error(data?.error || "Could not generate"); return; }
      setAiContent(data.content);
    } catch {
      toast.error("Could not generate. Try again.");
    } finally { setLoading(false); }
  };

  const Block = ({ title, body, highlight }: { title: string; body?: string; highlight?: boolean }) => {
    if (!body) return null;
    return (
      <div style={{
        background: CARD, borderRadius: 12, padding: 14, marginBottom: 12,
        border: `1px solid ${highlight ? GOLD : BORDER}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <span style={{ color: GOLD, fontSize: 12, fontWeight: 800, letterSpacing: 0.5 }}>{title}</span>
          <Button size="sm" onClick={() => copy(body, title)}
            style={{ marginLeft: "auto", background: GOLD, color: "#0D1B2A", height: 28, fontSize: 11.5 }}>
            Copy
          </Button>
        </div>
        <p style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{body}</p>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div style={{ background: "rgba(212,175,55,0.07)", border: `1px solid rgba(212,175,55,0.3)`, borderRadius: 12, padding: 14 }}>
        <p style={{ color: GOLD, fontSize: 13, fontWeight: 800, marginBottom: 4 }}>Content Studio</p>
        <p style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.55 }}>
          Tap a type → copy the ChatGPT image prompt into your ChatGPT app to make the picture →
          copy the caption for each platform. Library types are free; AI types use live job data.
        </p>
      </div>

      <div className="flex gap-2">
        {(["crew", "manager"] as const).map((a) => (
          <Button key={a} onClick={() => setAudience(a)}
            style={audience === a
              ? { background: GOLD, color: "#0D1B2A" }
              : { background: "transparent", color: GOLD, border: `1px solid ${GOLD}` }}>
            {a === "crew" ? "For Seafarers" : "For Companies"}
          </Button>
        ))}
      </div>

      <div>
        <p style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
          From the library — free
        </p>
        <div className="flex gap-2 flex-wrap">
          {LIBRARY.map((l) => (
            <Button key={l.kind} onClick={() => generateFromLibrary(l.kind)} disabled={loading}
              style={{ background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, fontSize: 12.5 }}>
              {l.label}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <p style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
          Written by AI from today's live data
        </p>
        <div className="flex gap-2 flex-wrap">
          {AI_ANGLES.map((a) => (
            <Button key={a.id} onClick={() => generateWithAI(a.id)} disabled={loading}
              style={{ background: "transparent", color: "#94a3b8", border: `1px solid ${BORDER}`, fontSize: 12.5 }}>
              {a.label}
            </Button>
          ))}
        </div>
      </div>

      {loading && <p style={{ color: GOLD, fontSize: 13 }}>Generating…</p>}

      {post && (
        <div>
          {post.title && (
            <p style={{ color: "#fff", fontSize: 16, fontWeight: 800, marginBottom: 10 }}>
              {post.title}
            </p>
          )}
          <Block title="🎨 CHATGPT IMAGE PROMPT — paste into ChatGPT" body={post.image_prompt} highlight />
          <Block title="🐦 X / TWITTER" body={post.x} />
          <Block title="📱 INSTAGRAM / FACEBOOK" body={post.instagram} />
          <Block title="💼 LINKEDIN" body={post.linkedin} />
          <Block title="💬 WHATSAPP / TELEGRAM" body={post.whatsapp} />
        </div>
      )}

      {aiContent && (
        <div>
          {aiContent.tiktok && (
            <>
              <Block title="🎬 TIKTOK HOOK" body={aiContent.tiktok.hook} highlight />
              <Block title="🎬 TIKTOK SCRIPT" body={aiContent.tiktok.script} />
              <Block title="🎬 ON-SCREEN TEXT"
                body={Array.isArray(aiContent.tiktok.onscreen) ? aiContent.tiktok.onscreen.join("\n") : undefined} />
            </>
          )}
          <Block title="📱 INSTAGRAM / FACEBOOK"
            body={aiContent.instagram ? `${aiContent.instagram.caption}\n\n${aiContent.instagram.hashtags || ""}` : undefined} />
          <Block title="🐦 X / TWITTER" body={aiContent.x?.post} />
          <Block title="💼 LINKEDIN" body={aiContent.linkedin?.post} />
          <Block title="💬 WHATSAPP / TELEGRAM" body={aiContent.whatsapp?.message} />
        </div>
      )}

      <a href={DIGEST} target="_blank" rel="noopener noreferrer"
        style={{ display: "block", textAlign: "center", background: "transparent", color: GOLD,
                 border: `1px solid ${GOLD}`, borderRadius: 12, padding: "12px 0",
                 fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
        🖼️ Open today's jobs image
      </a>
    </div>
  );
};

export default ContentStudioTab;
