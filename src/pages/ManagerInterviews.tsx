import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, Copy, Users } from "lucide-react";

const GOLD = "#D4AF37";
const NAVY = "#0D1B2A";
const CARD = "#112240";
const BORDER = "#1e3a5f";

const RANKS = ["Master","Chief Officer","2nd Officer","3rd Officer","Chief Engineer","2nd Engineer","3rd Engineer","4th Engineer","ETO","Electrician","Bosun","AB","OS","Oiler","Fitter","Cook","Messman","Deck Cadet","Engine Cadet"];
const VESSELS = ["Bulk Carrier","Oil Tanker","Chemical Tanker","LNG Carrier","Container","General Cargo","PSV / OSV","AHTS","Ro-Ro","Passenger"];
const LANGS = [
  { code: "en", label: "English" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "tl", label: "Tagalog" },
  { code: "hi", label: "हिन्दी" },
  { code: "id", label: "Bahasa" },
];

interface Campaign {
  id: string; title: string; rank_required: string; vessel_type: string | null;
  language: string; open_link_token: string; status: string; created_at: string;
}

const ManagerInterviews = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [board, setBoard] = useState<Record<string, any[]>>({});
  const [busy, setBusy] = useState(false);

  // create form
  const [title, setTitle] = useState("");
  const [rank, setRank] = useState("");
  const [vessel, setVessel] = useState("");
  const [language, setLanguage] = useState("en");

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/manager"); return; }
    const { data } = await supabase
      .from("interview_campaigns" as any)
      .select("id, title, rank_required, vessel_type, language, open_link_token, status, created_at")
      .order("created_at", { ascending: false });
    setCampaigns(((data as any[]) || []) as Campaign[]);
    setChecking(false);
  }, [navigate]);

  useEffect(() => { document.title = "SeaMinds Crew Interviews"; }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!rank) { toast.error("Choose the rank you are interviewing for."); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("create_interview_campaign" as any, {
        p_title: title.trim() || `${rank}${vessel ? ` — ${vessel}` : ""}`,
        p_rank: rank,
        p_vessel: vessel || null,
        p_language: language,
        p_sections: null,
        p_closes_at: null,
      });
      if (error) throw error;
      const res: any = data;
      if (!res?.ok) throw new Error(res?.error || "Could not create");
      toast.success("Interview created. Share the link with your candidates.");
      setCreating(false);
      setTitle(""); setRank(""); setVessel(""); setLanguage("en");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Could not create the interview");
    } finally {
      setBusy(false);
    }
  };

  const showBoard = async (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (board[id]) return;
    const { data } = await supabase.rpc("campaign_leaderboard" as any, { p_campaign_id: id });
    setBoard((s) => ({ ...s, [id]: (data as any[]) || [] }));
  };

  const linkFor = (token: string) => `${window.location.origin}/interview/${token}`;

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(linkFor(token)).then(
      () => toast.success("Interview link copied"),
      () => toast.error("Could not copy"),
    );
  };

  const shareWhatsApp = (c: Campaign) => {
    const msg = `⚓ You are invited to a SeaMinds interview\n\n${c.title}\nRank: ${c.rank_required}${c.vessel_type ? `\nVessel: ${c.vessel_type}` : ""}\n\nAbout 20 minutes. Free.\n\n${linkFor(c.open_link_token)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const input: React.CSSProperties = {
    width: "100%", background: NAVY, color: "#fff", border: `1px solid ${BORDER}`,
    borderRadius: 11, padding: "11px 13px", fontSize: 14, outline: "none", marginTop: 6,
  };
  const label: React.CSSProperties = { color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 };

  if (checking) {
    return <div style={{ minHeight: "100vh", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>Loading…</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: NAVY, paddingBottom: 50 }}>
      <header style={{ borderBottom: `1px solid ${BORDER}`, padding: "14px 16px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => navigate("/manager/dashboard")}
            style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
            <ArrowLeft size={16} /> Dashboard
          </button>
          <h1 style={{ marginLeft: "auto", color: GOLD, fontSize: 16, fontWeight: 800 }}>Crew Interviews</h1>
        </div>
      </header>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: 16 }}>
        <div style={{ background: "rgba(212,175,55,0.07)", border: `1px solid rgba(212,175,55,0.3)`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
          <p style={{ color: GOLD, fontSize: 13, fontWeight: 800, marginBottom: 5 }}>Free AI crew interviews</p>
          <p style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.55 }}>
            Send one link. Candidates answer in their own language — English is tested separately.
            You get a ranked shortlist with competency scores and red flags.
          </p>
        </div>

        {!creating && (
          <button onClick={() => setCreating(true)}
            style={{ width: "100%", padding: "14px 0", borderRadius: 13, border: "none", background: GOLD, color: NAVY, fontWeight: 800, fontSize: 14.5, cursor: "pointer", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Plus size={17} /> Arrange New Interview
          </button>
        )}

        {creating && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 18 }}>
            <div style={{ marginBottom: 12 }}>
              <label style={label}>Rank you are interviewing for *</label>
              <select value={rank} onChange={(e) => setRank(e.target.value)} style={input}>
                <option value="">Choose rank…</option>
                {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={label}>Vessel type</label>
              <select value={vessel} onChange={(e) => setVessel(e.target.value)} style={input}>
                <option value="">Any vessel</option>
                {VESSELS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={label}>Interview language</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 7 }}>
                {LANGS.map((l) => (
                  <button key={l.code} onClick={() => setLanguage(l.code)}
                    style={{
                      padding: "7px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                      background: language === l.code ? GOLD : "transparent",
                      color: language === l.code ? NAVY : GOLD,
                      border: `1px solid ${language === l.code ? GOLD : "rgba(212,175,55,0.45)"}`,
                    }}>{l.label}</button>
                ))}
              </div>
              <p style={{ color: "#64748b", fontSize: 10.5, marginTop: 7, lineHeight: 1.5 }}>
                Technical and scenario questions use this language. Marine English is always tested in English.
              </p>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Title (optional)</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Chief Officer — March joining" style={input} />
            </div>
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={create} disabled={busy || !rank}
                style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: GOLD, color: NAVY, fontWeight: 800, fontSize: 14, cursor: busy || !rank ? "default" : "pointer", opacity: busy || !rank ? 0.45 : 1 }}>
                {busy ? "Creating…" : "Create Interview"}
              </button>
              <button onClick={() => setCreating(false)}
                style={{ padding: "12px 18px", borderRadius: 12, background: "transparent", color: "#94a3b8", border: `1px solid ${BORDER}`, fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {campaigns.length === 0 && !creating && (
          <p style={{ color: "#64748b", fontSize: 13, textAlign: "center", padding: "36px 20px", lineHeight: 1.6 }}>
            No interviews yet. Create one, send the link on WhatsApp, and candidates appear here ranked by score.
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {campaigns.map((c) => (
            <div key={c.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>{c.title}</p>
                  <p style={{ color: "#94a3b8", fontSize: 11.5, marginTop: 3 }}>
                    {c.rank_required}{c.vessel_type ? ` · ${c.vessel_type}` : ""} · {LANGS.find((l) => l.code === c.language)?.label || c.language}
                  </p>
                </div>
                <span style={{ color: "#64748b", fontSize: 10, whiteSpace: "nowrap" }}>
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </div>

              <div style={{ display: "flex", gap: 7, marginTop: 12, flexWrap: "wrap" }}>
                <button onClick={() => shareWhatsApp(c)}
                  style={{ flex: 1, minWidth: 130, padding: "9px 0", borderRadius: 10, border: "none", background: "#25D366", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                  Send on WhatsApp
                </button>
                <button onClick={() => copyLink(c.open_link_token)}
                  style={{ padding: "9px 14px", borderRadius: 10, background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  <Copy size={13} /> Link
                </button>
                <button onClick={() => showBoard(c.id)}
                  style={{ padding: "9px 14px", borderRadius: 10, background: openId === c.id ? "rgba(212,175,55,0.15)" : "transparent", color: GOLD, border: `1px solid ${GOLD}`, fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  <Users size={13} /> Results
                </button>
              </div>

              {openId === c.id && (
                <div style={{ marginTop: 13 }}>
                  {!board[c.id] && <p style={{ color: "#64748b", fontSize: 12 }}>Loading…</p>}
                  {board[c.id] && board[c.id].length === 0 && (
                    <p style={{ color: "#64748b", fontSize: 12, lineHeight: 1.6 }}>
                      Nobody has taken this interview yet. Share the link on WhatsApp or in a seafarer group.
                    </p>
                  )}
                  {board[c.id] && board[c.id].length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {board[c.id].map((r: any, idx: number) => (
                        <div key={r.invite_id} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${r.red_flag_count > 0 ? "rgba(239,68,68,0.5)" : BORDER}`, borderRadius: 11, padding: 11 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <span style={{ color: GOLD, fontSize: 14, fontWeight: 900, minWidth: 22 }}>{idx + 1}</span>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>
                                {r.name}{r.nationality ? ` · ${r.nationality}` : ""}
                              </p>
                              <p style={{ color: "#94a3b8", fontSize: 10.5, marginTop: 2 }}>
                                {r.status === "completed"
                                  ? `Tech ${r.technical ?? "—"} · Eng ${r.english ?? "—"} · Behav ${r.behavioural ?? "—"}`
                                  : r.status === "in_progress" ? "In progress" : "Invited, not started"}
                              </p>
                              {r.red_flag_count > 0 && (
                                <p style={{ color: "#ef4444", fontSize: 10.5, marginTop: 3, fontWeight: 700 }}>
                                  ⚠ {r.red_flag_count} red flag{r.red_flag_count === 1 ? "" : "s"}
                                </p>
                              )}
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <p style={{ color: r.overall ? "#22c55e" : "#64748b", fontSize: 17, fontWeight: 900 }}>
                                {r.overall ? Number(r.overall).toFixed(2) : "—"}
                              </p>
                              {r.band && <p style={{ color: "#94a3b8", fontSize: 9.5 }}>{r.band}</p>}
                            </div>
                          </div>
                          {r.whatsapp && r.status === "completed" && (
                            <a href={`https://wa.me/${String(r.whatsapp).replace(/[^\d]/g, "")}`} target="_blank" rel="noopener noreferrer"
                              style={{ display: "block", marginTop: 9, textAlign: "center", background: "#25D366", color: "#fff", borderRadius: 9, padding: "8px 0", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                              Contact on WhatsApp
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default ManagerInterviews;
