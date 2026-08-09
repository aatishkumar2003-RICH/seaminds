import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const GOLD = "#D4AF37";
const NAVY = "#0D1B2A";
const CARD = "#112240";
const BORDER = "#1e3a5f";

const LANG_LABEL: Record<string, string> = {
  en: "English", vi: "Tiếng Việt", tl: "Tagalog", hi: "हिन्दी", id: "Bahasa Indonesia",
};

const InterviewInvite = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nationality, setNationality] = useState("");

  useEffect(() => {
    (async () => {
      if (!token) { setLoading(false); return; }
      const { data } = await supabase.rpc("get_interview_by_token" as any, { p_token: token });
      const res: any = data;
      setInfo(res);
      if (res?.name) setName(res.name);
      setLoading(false);
    })();
  }, [token]);

  const createAndStart = async () => {
    if (!name.trim()) { toast.error("Please enter your name."); return; }
    if (!whatsapp.trim()) { toast.error("Please enter your WhatsApp number."); return; }
    if (!email.trim()) { toast.error("Please enter your email."); return; }
    if (!password.trim()) { toast.error("Please choose a password."); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    setStarting(true);
    try {
      const { data: { user: existingUser } } = await supabase.auth.getUser();
      if (existingUser) { navigate(`/interview/${token}/exam`); return; }

      const parts = name.trim().split(" ");
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/interview/${token}/exam`,
          data: {
            crew_signup: true,
            first_name: parts[0],
            last_name: parts.slice(1).join(" "),
            whatsapp: whatsapp.trim(),
            nationality: nationality || "",
            rank: info?.rank || "",
          },
        },
      });
      if (error) {
        if (String(error.message).toLowerCase().includes("already")) {
          toast.error("That email is already registered. Please sign in first, then reopen this link.");
        } else {
          toast.error(error.message);
        }
        return;
      }
      if (!data.session) {
        toast.success("Account created. Check your email to confirm, then reopen this interview link.");
        return;
      }
      navigate(`/interview/${token}/exam`);
    } catch {
      toast.error("Could not create your account. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  const input: React.CSSProperties = {
    width: "100%", background: NAVY, color: "#fff", border: `1px solid ${BORDER}`,
    borderRadius: 11, padding: "12px 14px", fontSize: 15, outline: "none", marginTop: 6,
  };

  if (loading) {
    return <div style={{ minHeight: "100vh", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>Loading…</div>;
  }

  if (!info?.ok) {
    return (
      <div style={{ minHeight: "100vh", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 340 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>⚓</p>
          <h1 style={{ color: "#fff", fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
            {info?.error || "This interview link is not valid."}
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
            Ask the company for a new link, or browse live vacancies on SeaMinds.
          </p>
          <button onClick={() => navigate("/feed")}
            style={{ background: GOLD, color: NAVY, border: "none", borderRadius: 12, padding: "12px 22px", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
            See live jobs
          </button>
        </div>
      </div>
    );
  }

  if (info.already_done) {
    return (
      <div style={{ minHeight: "100vh", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 340 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>✅</p>
          <h1 style={{ color: "#fff", fontSize: 18, fontWeight: 800, marginBottom: 8 }}>You have already completed this interview</h1>
          <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
            {info.company} can see your result. Keep your CV and availability up to date.
          </p>
          <button onClick={() => navigate("/app")}
            style={{ background: GOLD, color: NAVY, border: "none", borderRadius: 12, padding: "12px 22px", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
            Open SeaMinds
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: NAVY, paddingBottom: 40 }}>
      <Helmet>
        <title>{`Interview invitation — ${info.rank} | SeaMinds`}</title>
        <meta name="description" content={`${info.company} invites you to a free SeaMinds interview for ${info.rank}. About 20 minutes.`} />
      </Helmet>

      <div style={{ maxWidth: 460, margin: "0 auto", padding: "28px 18px" }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <p style={{ fontSize: 34 }}>⚓</p>
          <p style={{ color: GOLD, fontSize: 11, letterSpacing: 2, fontWeight: 800, marginTop: 4 }}>SEAMINDS INTERVIEW</p>
        </div>

        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 18, marginBottom: 18 }}>
          <p style={{ color: "#94a3b8", fontSize: 12 }}>You have been invited by</p>
          <p style={{ color: GOLD, fontSize: 18, fontWeight: 900, marginTop: 3 }}>{info.company}</p>

          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8", fontSize: 12.5 }}>Position</span>
              <span style={{ color: "#fff", fontSize: 12.5, fontWeight: 700 }}>{info.rank}</span>
            </div>
            {info.vessel && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8", fontSize: 12.5 }}>Vessel</span>
                <span style={{ color: "#fff", fontSize: 12.5, fontWeight: 700 }}>{info.vessel}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8", fontSize: 12.5 }}>Language</span>
              <span style={{ color: "#fff", fontSize: 12.5, fontWeight: 700 }}>{LANG_LABEL[info.language] || "English"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8", fontSize: 12.5 }}>Takes about</span>
              <span style={{ color: "#fff", fontSize: 12.5, fontWeight: 700 }}>20 minutes</span>
            </div>
          </div>
        </div>

        <div style={{ background: "rgba(212,175,55,0.07)", border: `1px solid rgba(212,175,55,0.3)`, borderRadius: 14, padding: 14, marginBottom: 18 }}>
          <p style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.6 }}>
            ✅ Free — SeaMinds never charges seafarers<br />
            ✅ Your score is saved to your profile and works for other companies too<br />
            ✅ Answer in your own language — English is tested separately
          </p>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>Your name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="As on your passport" style={input} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>WhatsApp number *</label>
          <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+63 917 000 0000" style={input} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>Email *</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="your@email.com" style={input} />
          <p style={{ color: "#64748b", fontSize: 10.5, marginTop: 5 }}>Your interview result and study plan are sent here.</p>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>Choose a password *</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="At least 8 characters" style={input} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>Nationality</label>
          <input value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="e.g. Filipino, Indian, Vietnamese" style={input} />
        </div>

        <button onClick={createAndStart} disabled={starting}
          style={{ width: "100%", padding: "15px 0", borderRadius: 14, border: "none", background: GOLD, color: NAVY, fontWeight: 900, fontSize: 15.5, cursor: starting ? "default" : "pointer", opacity: starting ? 0.5 : 1 }}>
          {starting ? "Creating…" : "Start Interview →"}
        </button>


        <p style={{ color: "#64748b", fontSize: 10.5, textAlign: "center", marginTop: 14, lineHeight: 1.6 }}>
          Answer honestly and on your own. Switching tabs or pasting answers is recorded and shown to the company.
        </p>
      </div>
    </div>
  );
};

export default InterviewInvite;
