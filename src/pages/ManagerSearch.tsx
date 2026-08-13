import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import { generateCvPdf } from "@/lib/cvPdf";

const NAVY = "#0D1B2A";
const GOLD = "#D4AF37";
const CARD = "#112240";
const BORDER = "#1e3a5f";


const RANKS = [
  "Captain / Master", "Chief Officer", "2nd Officer", "3rd Officer",
  "Chief Engineer", "2nd Engineer", "3rd Engineer", "4th Engineer", "ETO / EEO",
  "Bosun", "AB Seaman", "Ordinary Seaman (OS)", "Fitter", "Oiler", "Wiper",
  "Cook", "Messman / Steward", "Deck Cadet", "Engine Cadet", "ETO Cadet", "Pumpman",
  "Electrician", "Refrigeration Engineer", "Radio Officer",
  "Trainee Officer (Deck)", "Trainee Officer (Engine)", "Trainee OS", "Trainee Cook",
];

const VESSEL_TYPES = [
  "Bulk Carrier", "Container Ship", "Oil Tanker", "Chemical Tanker",
  "LNG Carrier", "LPG Carrier", "RORO", "General Cargo", "Offshore Supply Vessel",
  "Platform Supply Vessel", "Anchor Handling Vessel", "Passenger / Cruise Ship",
  "Dredger", "Tug / Towage", "Car Carrier", "Reefer", "Other",
];

const NATIONALITIES = [
  "Indian", "Filipino", "Indonesian", "Vietnamese", "Chinese", "Bangladeshi",
  "Pakistani", "Sri Lankan", "Myanmar", "Ukrainian", "Russian", "Romanian",
  "Polish", "Croatian", "Turkish", "Greek", "Egyptian", "Nigerian", "Ghanaian",
  "Brazilian", "British", "Other",
];

interface CrewResult {
  user_id: string;
  crewId?: string;
  cv_uid: string | null;
  name: string;
  rank: string;
  nationality: string;
  vessel_type: string;
  whatsapp_number: string | null;
  email?: string | null;
  is_available: boolean;
  available_from: string | null;
  years_at_sea: string | null;
  email_verified: boolean;
  whatsapp_verified: boolean;
  smc_score: number | null;
  smc_band: string | null;
  has_cv: boolean;
}

const REFILL_MAILTO = "mailto:info@indossol.com?subject=Credit refill request";


const input: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  background: NAVY, color: "#fff", border: `1px solid ${BORDER}`, fontSize: 14,
};

const label: React.CSSProperties = {
  color: "#9CA3AF", fontSize: 11, textTransform: "uppercase",
  letterSpacing: 0.6, marginBottom: 6, display: "block",
};

const goldBtn: React.CSSProperties = {
  padding: "10px 16px", borderRadius: 8, cursor: "pointer",
  background: GOLD, color: NAVY, border: "none", fontWeight: 700, fontSize: 13,
};

const ghostBtn: React.CSSProperties = {
  padding: "10px 16px", borderRadius: 8, cursor: "pointer",
  background: "transparent", color: GOLD, border: `1px solid ${GOLD}`,
  fontWeight: 600, fontSize: 13,
};

const callFn = async (payload: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("manager-search", { body: payload });
  let payloadData: any = data;
  if (error && (error as any).context?.json) {
    try { payloadData = await (error as any).context.json(); } catch { /* ignore */ }
  }
  if (payloadData?.pending_approval) {
    const err: any = new Error(payloadData.error || "Awaiting approval");
    err.pendingApproval = true;
    throw err;
  }
  if (payloadData?.error === "reveal_required") {
    const err: any = new Error(payloadData.message || "Reveal this seafarer's contact first (1 credit) to open the full CV.");
    err.revealRequired = true;
    throw err;
  }
  if (error) throw new Error(error.message || "Could not reach the crew directory");
  if (!payloadData?.success) throw new Error(payloadData?.error || "Request failed");
  return payloadData;
};

const isAuthError = (msg: string) => /sign in|not registered|session/i.test(msg || "");


const ManagerSearch = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [rank, setRank] = useState("");
  const [nationality, setNationality] = useState("");
  const [vesselType, setVesselType] = useState("");
  const [availability, setAvailability] = useState<"all" | "available">("all");
  const [results, setResults] = useState<CrewResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [revealBusy, setRevealBusy] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, { email: string | null; whatsapp: string | null }>>({});

  const loadBalance = async () => {
    const { data } = await supabase.rpc("get_my_credit_balance" as any);
    const bal = (data as any)?.balance;
    if (typeof bal === "number") setBalance(bal);
  };

  const search = async () => {
    setLoading(true);
    try {
      const data = await callFn({
        action: "search",
        filters: { rank, nationality, vesselType, availability },
      });
      setResults(data.results || []);
      setPending(false);
      setSearched(true);
    } catch (e: any) {
      if (e?.pendingApproval) { setPending(true); setResults([]); setSearched(true); return; }
      const msg = e?.message || "Search failed";
      if (isAuthError(msg)) { navigate("/manager"); return; }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const revealContact = async (row: CrewResult) => {
    const crewId = row.crewId || row.user_id;
    setRevealBusy(crewId);
    try {
      const { data, error } = await supabase.rpc("reveal_contact" as any, { p_crew_id: crewId });
      if (error) { toast.error(error.message); return; }
      const res: any = data;
      if (res?.ok) {
        setRevealed((prev) => ({ ...prev, [crewId]: { email: res.email ?? null, whatsapp: res.whatsapp ?? null } }));
        if (typeof res.balance === "number") setBalance(res.balance);
        toast(res.charged ? "Contact revealed — 1 credit used" : "Already revealed — free");
      } else if (res?.error === "no_credits") {
        toast.error("Out of credits", {
          description: "Monthly free credits refresh on the 1st — or request a refill.",
          action: { label: "Refill", onClick: () => window.open(REFILL_MAILTO) },
        });
      } else {
        toast.error(res?.error || "Could not reveal contact");
      }
    } finally {
      setRevealBusy(null);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data?.user) { navigate("/manager"); return; }
      setReady(true);
      loadBalance();
      search();
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const viewFullCv = async (row: CrewResult) => {
    setPdfBusy(row.user_id);
    try {
      const data = await callFn({ action: "cv", userId: row.user_id });

      if (!data.cv) {
        toast.error("This crew member has not built a CV yet");
        return;
      }
      await generateCvPdf({
        name: row.name,
        cvUid: row.cv_uid || undefined,
        rank: row.rank,
        nationality: row.nationality,
        email: data.profile?.email,
        whatsapp: row.whatsapp_number || undefined,
        cv: data.cv,
        footer: `SeaMinds Manager Crew Search • ${new Date().toLocaleString()}`,
      });
    } catch (e: any) {
      if (e?.pendingApproval) { setPending(true); return; }
      if (e?.revealRequired) {
        toast.error("Reveal required", {
          description: "Tap 'Reveal contact' (1 credit) on this seafarer to open the full CV.",
        });
        return;
      }
      const msg = e?.message || "Could not generate CV PDF";
      if (isAuthError(msg)) { navigate("/manager"); return; }
      toast.error(msg);
    } finally {
      setPdfBusy(null);
    }
  };


  const contactWhatsApp = (row: CrewResult) => {
    const crewId = row.crewId || row.user_id;
    const revealedWa = revealed[crewId]?.whatsapp;
    if (!revealedWa) return toast.error("Reveal the contact first (1 credit)");
    const digits = revealedWa.replace(/[^\d]/g, "");
    if (!digits) return toast.error("No WhatsApp number on file");
    const msg = encodeURIComponent(
      `Hello ${row.name}, we found your SeaMinds profile (${row.cv_uid || "CV"}) and would like to discuss a ${row.rank} opportunity.`,
    );
    window.open(`https://wa.me/${digits}?text=${msg}`, "_blank");
  };

  const availableCount = useMemo(() => results.filter((r) => r.is_available).length, [results]);

  if (!ready) return null;

  return (
    <div style={{ minHeight: "100vh", background: NAVY, padding: "24px 16px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => { if (window.history.length > 1) navigate(-1); else navigate("/manager/dashboard"); }}
              style={{ background: "transparent", border: "none", color: GOLD, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 13, padding: 0 }}
            >
              <ChevronLeft size={16} /> Back
            </button>
            <div>
              <h1 style={{ color: GOLD, fontSize: 22, fontWeight: 700 }}>Crew Search</h1>
              <p style={{ color: "#9CA3AF", fontSize: 13 }}>
                {searched ? `${results.length} crew · ${availableCount} available now` : "Search verified SeaMinds crew"}
              </p>
            </div>
            {balance !== null && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ background: "rgba(212,175,55,0.15)", border: `1px solid ${GOLD}`, color: GOLD, borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>
                  💳 {balance} credits
                </span>
                <a href={REFILL_MAILTO} style={{ color: "#94A3B8", fontSize: 11, textDecoration: "underline" }}>Refill</a>
              </div>
            )}
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate("/manager"); }}
            style={ghostBtn}
          >
            Sign out
          </button>
        </header>

        {pending ? (
        <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 14, padding: 20, textAlign: "center", maxWidth: 460, margin: "40px auto" }}>
          <p style={{ fontSize: 34, marginBottom: 10 }}>🔒</p>
          <p style={{ color: "#f59e0b", fontSize: 16, fontWeight: 800, marginBottom: 8 }}>Awaiting company approval</p>
          <p style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
            SeaMinds verifies every company before releasing seafarer contact details and CVs.
            This protects the crew who trust us with their data.
          </p>
          <p style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.6 }}>
            You can still post vacancies, create company posts and arrange interviews while you wait.
          </p>
          <a href="mailto:info@indossol.com?subject=SeaMinds%20company%20approval"
            style={{ display: "inline-block", marginTop: 16, background: "#D4AF37", color: "#0D1B2A", borderRadius: 10, padding: "11px 20px", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
            Request approval
          </a>
        </div>
        ) : (
        <>
        {/* Filters */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
            <div>
              <span style={label}>Rank</span>
              <select value={rank} onChange={(e) => setRank(e.target.value)} style={input}>
                <option value="">All ranks</option>
                {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <span style={label}>Nationality</span>
              <select value={nationality} onChange={(e) => setNationality(e.target.value)} style={input}>
                <option value="">All nationalities</option>
                {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <span style={label}>Vessel Type</span>
              <select value={vesselType} onChange={(e) => setVesselType(e.target.value)} style={input}>
                <option value="">All vessel types</option>
                {VESSEL_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <span style={label}>Availability</span>
              <select value={availability} onChange={(e) => setAvailability(e.target.value as any)} style={input}>
                <option value="all">All crew</option>
                <option value="available">Available now</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <button onClick={() => search()} disabled={loading} style={{ ...goldBtn, flex: 1, opacity: loading ? 0.6 : 1 }}>
                {loading ? "Searching…" : "Search"}
              </button>
              <button
                onClick={() => { setRank(""); setNationality(""); setVesselType(""); setAvailability("all"); }}
                style={ghostBtn}
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <p style={{ color: "#94A3B8", fontSize: 12, lineHeight: 1.6, marginTop: -8 }}>
          Contacts are protected. Each reveal uses 1 credit (30 free monthly). Interviewing &amp; offering via SeaMinds never needs credits.
        </p>

        {/* Results */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {results.map((r) => (
            <article key={r.user_id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{r.name}</div>
                  <div style={{ color: GOLD, fontFamily: "monospace", fontSize: 12 }}>{r.cv_uid || "ID pending"}</div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 999,
                  background: r.is_available ? "rgba(16,185,129,0.15)" : "rgba(212,175,55,0.15)",
                  color: r.is_available ? "#10b981" : GOLD,
                  whiteSpace: "nowrap",
                }}>
                  {r.is_available ? "Available now" : "Availability on request"}
                </span>
              </div>

              <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
                <div><dt style={{ color: "#6b7280" }}>Rank</dt><dd style={{ color: "#e5e7eb" }}>{r.rank || "—"}</dd></div>
                <div><dt style={{ color: "#6b7280" }}>Nationality</dt><dd style={{ color: "#e5e7eb" }}>{r.nationality || "—"}</dd></div>
                <div><dt style={{ color: "#6b7280" }}>Vessel Type</dt><dd style={{ color: "#e5e7eb" }}>{r.vessel_type || "—"}</dd></div>
                <div>
                  <dt style={{ color: "#6b7280" }}>SMC Score</dt>
                  <dd style={{ color: r.smc_score != null ? GOLD : "#6b7280", fontWeight: 700 }}>
                    {r.smc_score != null ? `${r.smc_score}${r.smc_band ? ` · ${r.smc_band}` : ""}` : "Not assessed"}
                  </dd>
                </div>
              </dl>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {r.email_verified && <span style={{ fontSize: 11, color: "#10b981" }}>✅ Email verified</span>}
                {r.whatsapp_verified && <span style={{ fontSize: 11, color: "#10b981" }}>🟢 WhatsApp verified</span>}
                {!r.has_cv && <span style={{ fontSize: 11, color: "#f59e0b" }}>No CV built yet</span>}
              </div>

              {(() => {
                const crewId = r.crewId || r.user_id;
                const rev = revealed[crewId];
                return (
                  <div style={{ background: "rgba(212,175,55,0.06)", border: `1px solid rgba(212,175,55,0.25)`, borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 12, color: "#e5e7eb", fontFamily: "monospace" }}>
                      <div>📧 {rev ? (rev.email || "—") : (r.email || "•••••")}</div>
                      <div>📱 {rev ? (rev.whatsapp || "—") : (r.whatsapp_number || "•••••")}</div>
                    </div>
                    {!rev && (
                      <button
                        onClick={() => revealContact(r)}
                        disabled={revealBusy === crewId}
                        style={{ ...goldBtn, padding: "8px 10px", opacity: revealBusy === crewId ? 0.6 : 1 }}
                      >
                        {revealBusy === crewId ? "Revealing…" : "🔓 Reveal contact — 1 credit"}
                      </button>
                    )}
                  </div>
                );
              })()}

              <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                <button onClick={() => contactWhatsApp(r)} style={{ ...goldBtn, flex: 1, padding: "8px 10px" }}>
                  Contact via WhatsApp
                </button>
                <button
                  onClick={() => viewFullCv(r)}
                  disabled={pdfBusy === r.user_id}
                  style={{ ...ghostBtn, flex: 1, padding: "8px 10px", opacity: pdfBusy === r.user_id ? 0.6 : 1 }}
                >
                  {pdfBusy === r.user_id ? "Preparing…" : "View Full CV"}
                </button>
              </div>
            </article>
          ))}
        </div>

        {!loading && searched && results.length === 0 && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 32, textAlign: "center", color: "#6b7280" }}>
            No crew match these filters.
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
};

export default ManagerSearch;
