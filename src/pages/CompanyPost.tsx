import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ImagePlus, X, Loader2 } from "lucide-react";

const GOLD = "#D4AF37";
const NAVY = "#0D1B2A";
const CARD = "#112240";
const BORDER = "#1e3a5f";

const TYPES = [
  { id: "hiring", label: "🚢 Hiring" },
  { id: "update", label: "📢 Company Update" },
  { id: "fleet", label: "⚓ Fleet News" },
  { id: "training", label: "🎓 Training" },
  { id: "welfare", label: "🤝 Crew Welfare" },
];

const CompanyPost = () => {
  const navigate = useNavigate();
  const [managerId, setManagerId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);

  const [caption, setCaption] = useState("");
  const [postType, setPostType] = useState("hiring");
  const [whatsapp, setWhatsapp] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [checkingContent, setCheckingContent] = useState(false);
  const [toTelegram, setToTelegram] = useState(true);
  const [aiWriting, setAiWriting] = useState(false);
  const [ranks, setRanks] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/manager"); return; }
      const { data: profile } = await supabase
        .from("manager_profiles")
        .select("company_name, company_verified")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile) { navigate("/manager"); return; }
      setManagerId(user.id);
      setCompanyName(profile.company_name);
      setVerified(!!(profile as any).company_verified);
      setChecking(false);
    })();
  }, [navigate]);

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error("Image must be under 8MB"); return; }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${managerId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("company-posts")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("company-posts").getPublicUrl(path);
      setImageUrl(pub?.publicUrl || null);
    } catch (err: any) {
      toast.error(err?.message || "Could not upload image");
    } finally {
      setUploading(false);
    }
  };

  const writeWithAI = async () => {
    if (!imageUrl && !caption.trim()) {
      toast.error("Add your flier, or type a few words first — then AI can write it up.");
      return;
    }
    setAiWriting(true);
    try {
      const { data, error } = await supabase.functions.invoke("post-assist", {
        body: { imageUrl, draft: caption.trim(), postType, companyName },
      });
      if (error) throw error;
      if (!data?.success) { toast.error(data?.error || "Could not write it. Please type your message."); return; }
      setCaption(String(data.caption || "").slice(0, 600));
      setRanks(Array.isArray(data.ranks) ? data.ranks : []);
      toast.success("Draft written — edit anything you like.");
    } catch {
      toast.error("AI help is unavailable. Please write your message.");
    } finally {
      setAiWriting(false);
    }
  };

  const publish = async () => {
    if (!caption.trim()) { toast.error("Write something to post."); return; }
    setPublishing(true);
      setCheckingContent(true);
      try {
        const { data: check } = await supabase.functions.invoke("post-check", {
          body: { caption: caption.trim(), imageUrl },
        });
        if (check && check.allowed === false) {
          toast.error(check.reason || "This post does not appear to be maritime related.");
          setCheckingContent(false);
          setPublishing(false);
          return;
        }
      } catch {
        // Never block a company on a check failure
      }
      setCheckingContent(false);
    try {
      const { data, error } = await supabase.from("company_posts" as any).insert({
        manager_id: managerId,
        company_name: companyName,
        post_type: postType,
        caption: caption.trim(),
        image_url: imageUrl,
        whatsapp: whatsapp.trim() || null,
        link_url: linkUrl.trim() || null,
        verified,
        telegram_posted: !toTelegram,
      }).select("id").single();
      if (error) throw error;

      toast.success("Posted! Seafarers can see it now.");
      navigate("/manager/dashboard");
      void data;
    } catch (err: any) {
      toast.error(err?.message || "Could not publish. Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: NAVY, color: "#fff", border: `1px solid ${BORDER}`,
    borderRadius: 12, padding: "12px 14px", fontSize: 14, outline: "none",
  };

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: NAVY, paddingBottom: 40 }}>
      <header style={{ borderBottom: `1px solid ${BORDER}`, padding: "14px 16px" }}>
        <div style={{ maxWidth: 620, margin: "0 auto", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => navigate("/manager/dashboard")}
            style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
            <ArrowLeft size={16} /> Dashboard
          </button>
          <h1 style={{ marginLeft: "auto", color: GOLD, fontSize: 16, fontWeight: 800 }}>Create Post</h1>
        </div>
      </header>

      <main style={{ maxWidth: 620, margin: "0 auto", padding: "18px 16px", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Image */}
        {imageUrl ? (
          <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", border: `1px solid ${BORDER}` }}>
            <img src={imageUrl} alt="Your flier" style={{ width: "100%", display: "block" }} />
            <button onClick={() => setImageUrl(null)}
              style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.65)", border: "none", borderRadius: 999, width: 32, height: 32, cursor: "pointer", color: "#fff" }}>
              <X size={16} />
            </button>
          </div>
        ) : (
          <label style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 8, padding: "38px 16px", borderRadius: 16, cursor: "pointer",
            border: `2px dashed ${BORDER}`, background: CARD,
          }}>
            {uploading ? <Loader2 size={26} style={{ color: GOLD }} className="animate-spin" /> : <ImagePlus size={26} style={{ color: GOLD }} />}
            <span style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 700 }}>
              {uploading ? "Uploading…" : "Add your flier or photo"}
            </span>
            <span style={{ color: "#64748b", fontSize: 11 }}>Optional · any layout, any number of ranks</span>
            <input type="file" accept="image/*" onChange={handleImage} style={{ display: "none" }} disabled={uploading} />
          </label>
        )}

        {/* Caption */}
        <div>
          <label style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>
            What do you want to say? *
          </label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 600))}
            rows={5}
            placeholder="Urgent requirement — Chief Officer, 2/O, ETO for bulk carriers. Joining Manila, March. Walk-in interviews 14–16 March."
            style={{ ...inputStyle, marginTop: 6, resize: "vertical", lineHeight: 1.5 }}
          />
          <p style={{ color: "#64748b", fontSize: 11, textAlign: "right", marginTop: 4 }}>{caption.length}/600</p>
        </div>

        {/* Type */}
        <div>
          <label style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>Post type</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {TYPES.map((t) => (
              <button key={t.id} onClick={() => setPostType(t.id)}
                style={{
                  padding: "8px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                  background: postType === t.id ? GOLD : "transparent",
                  color: postType === t.id ? NAVY : GOLD,
                  border: `1px solid ${postType === t.id ? GOLD : "rgba(212,175,55,0.45)"}`,
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Optional contact */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>
              WhatsApp for applications (optional)
            </label>
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+63 917 000 0000" style={{ ...inputStyle, marginTop: 6 }} />
          </div>
          <div>
            <label style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>
              Link (optional)
            </label>
            <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://yourcompany.com/careers" style={{ ...inputStyle, marginTop: 6 }} />
          </div>
        </div>

        {/* Share to */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14 }}>
          <p style={{ color: GOLD, fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 10 }}>SHARE THIS POST TO</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
            <span style={{ color: "#e2e8f0", fontSize: 13 }}>SeaMinds Feed</span>
            <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 700 }}>Always on</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
            <span style={{ color: "#e2e8f0", fontSize: 13 }}>Telegram channel</span>
            <button onClick={() => setToTelegram(!toTelegram)}
              style={{
                width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer",
                background: toTelegram ? "#22c55e" : "#334155", position: "relative", transition: "background .2s",
              }}>
              <span style={{
                position: "absolute", top: 3, left: toTelegram ? 23 : 3, width: 20, height: 20,
                borderRadius: 999, background: "#fff", transition: "left .2s",
              }} />
            </button>
          </div>
        </div>

        {/* Live preview */}
        <div>
          <p style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
            How seafarers will see it
          </p>
          <article style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>
            {imageUrl && <img src={imageUrl} alt="" style={{ width: "100%", display: "block", maxHeight: 300, objectFit: "cover" }} />}
            <div style={{ padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ color: GOLD, fontSize: 13, fontWeight: 800 }}>{companyName}</span>
                {verified && <span style={{ color: "#22c55e", fontSize: 12 }}>✅</span>}
                <span style={{ marginLeft: "auto", fontSize: 10, color: "#64748b" }}>now</span>
              </div>
              <p style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                {caption || "Your message will appear here…"}
              </p>
              {whatsapp && (
                <div style={{ marginTop: 12, background: GOLD, color: NAVY, borderRadius: 11, padding: "9px 0", textAlign: "center", fontWeight: 800, fontSize: 12.5 }}>
                  Apply on WhatsApp
                </div>
              )}
            </div>
          </article>
        </div>

        {(() => {
          const tips: { icon: string; text: string }[] = [];
          if (!imageUrl) tips.push({ icon: "🖼️", text: "Add your flier — posts with an image get far more attention in the feed and on Telegram." });
          if (caption.trim().length > 0 && caption.trim().length < 60) tips.push({ icon: "✍️", text: "Add the joining port and dates — seafarers decide on those two details first." });
          if (!whatsapp.trim()) tips.push({ icon: "📲", text: "Add a WhatsApp number so seafarers can apply in one tap. Without it there is no Apply button." });
          if (tips.length === 0) return null;
          return (
            <div style={{ background: "rgba(212,175,55,0.07)", border: `1px solid rgba(212,175,55,0.3)`, borderRadius: 14, padding: 14 }}>
              <p style={{ color: GOLD, fontSize: 11, fontWeight: 800, letterSpacing: 0.8, marginBottom: 10 }}>
                GET MORE APPLICATIONS
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {tips.map((t, k) => (
                  <div key={k} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 14, lineHeight: 1.3 }}>{t.icon}</span>
                    <span style={{ color: "#cbd5e1", fontSize: 11.5, lineHeight: 1.5 }}>{t.text}</span>
                  </div>
                ))}
              </div>
              <p style={{ color: "#64748b", fontSize: 10.5, marginTop: 10 }}>
                These are optional — you can publish without them.
              </p>
            </div>
          );
        })()}

        <button onClick={publish} disabled={publishing || !caption.trim()}
          style={{
            width: "100%", borderRadius: 14, padding: "15px 0", border: "none",
            background: GOLD, color: NAVY, fontWeight: 800, fontSize: 15,
            cursor: publishing || !caption.trim() ? "default" : "pointer",
            opacity: publishing || !caption.trim() ? 0.45 : 1,
          }}>
          {checkingContent ? "Checking…" : publishing ? "Publishing…" : "Publish Now"}
        </button>

        {!caption.trim() && (
          <p style={{ color: "#f59e0b", fontSize: 11.5, textAlign: "center", marginTop: -8 }}>
            Write your message above, or tap "Write it for me", to publish.
          </p>
        )}

        <p style={{ color: "#64748b", fontSize: 10.5, textAlign: "center", lineHeight: 1.5 }}>
          Posted by your company. SeaMinds does not endorse third-party advertisements.
          Maritime content only.
        </p>
      </main>
    </div>
  );
};

export default CompanyPost;
