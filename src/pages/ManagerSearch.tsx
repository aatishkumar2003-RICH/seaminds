import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateCvPdf } from "@/lib/cvPdf";

const NAVY = "#0D1B2A";
const GOLD = "#D4AF37";
const CARD = "#112240";
const BORDER = "#1e3a5f";
const SS_KEY = "seaminds_manager_search_code";

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
  cv_uid: string | null;
  name: string;
  rank: string;
  nationality: string;
  vessel_type: string;
  whatsapp_number: string | null;
  is_available: boolean;
  available_from: string | null;
  years_at_sea: string | null;
  email_verified: boolean;
  whatsapp_verified: boolean;
  smc_score: number | null;
  smc_band: string | null;
  has_cv: boolean;
}

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
  if (error) throw new Error(error.message || "Could not reach the crew directory");
  if (!data?.success) throw new Error(data?.error || "Request failed");
  return data;
};

const GateScreen = ({ onUnlock }: { onUnlock: (code: string) => void }) => {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      await callFn({ accessCode: code.trim(), action: "verify" });
      sessionStorage.setItem(SS_KEY, code.trim());
      onUnlock(code.trim());
    } catch (e: any) {
      toast.error(e?.message || "Invalid access code");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: NAVY, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 28, width: "100%", maxWidth: 380 }}>
        <h1 style={{ color: GOLD, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>SeaMinds Crew Search</h1>
        <p style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 20 }}>
          Manager access only. Enter your access code to browse verified crew CVs.
        </p>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Manager access code"
          style={{ ...input, marginBottom: 14 }}
        />
        <button onClick={submit} disabled={busy} style={{ ...goldBtn, width: "100%", opacity: busy ? 0.6 : 1 }}>
          {busy ? "Checking…" : "Enter Crew Search"}
        </button>
      </div>
    </div>
  );
};

const ManagerSearch = () => {
  const [accessCode, setAccessCode] = useState<string | null>(() => sessionStorage.getItem(SS_KEY));
  const [rank, setRank] = useState("");
  const [nationality, setNationality] = useState("");
  const [vesselType, setVesselType] = useState("");
  const [availability, setAvailability] = useState<"all" | "available">("all");
  const [results, setResults] = useState<CrewResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);

  const search = async (code = accessCode) => {
    if (!code) return;
    setLoading(true);
    try {
      const data = await callFn({
        accessCode: code,
        action: "search",
        filters: { rank, nationality, vesselType, availability },
      });
      setResults(data.results || []);
      setSearched(true);
    } catch (e: any) {
      if (/access code/i.test(e?.message || "")) {
        sessionStorage.removeItem(SS_KEY);
        setAccessCode(null);
      }
      toast.error(e?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessCode) search(accessCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessCode]);

  const viewFullCv = async (row: CrewResult) => {
    if (!accessCode) return;
    setPdfBusy(row.user_id);
    try {
      const data = await callFn({ accessCode, action: "cv", userId: row.user_id });
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
      toast.error(e?.message || "Could not generate CV PDF");
    } finally {
      setPdfBusy(null);
    }
  };

  const contactWhatsApp = (row: CrewResult) => {
    const digits = (row.whatsapp_number || "").replace(/[^\d]/g, "");
    if (!digits) return toast.error("No WhatsApp number on file");
    const msg = encodeURIComponent(
      `Hello ${row.name}, we found your SeaMinds profile (${row.cv_uid || "CV"}) and would like to discuss a ${row.rank} opportunity.`,
    );
    window.open(`https://wa.me/${digits}?text=${msg}`, "_blank");
  };

  const availableCount = useMemo(() => results.filter((r) => r.is_available).length, [results]);

  if (!accessCode) return <GateScreen onUnlock={setAccessCode} />;

  return (
    <div style={{ minHeight: "100vh", background: NAVY, padding: "24px 16px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ color: GOLD, fontSize: 22, fontWeight: 700 }}>Crew Search</h1>
            <p style={{ color: "#9CA3AF", fontSize: 13 }}>
              {searched ? `${results.length} crew · ${availableCount} available now` : "Search verified SeaMinds crew"}
            </p>
          </div>
          <button
            onClick={() => { sessionStorage.removeItem(SS_KEY); setAccessCode(null); }}
            style={ghostBtn}
          >
            Sign out
          </button>
        </header>

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
      </div>
    </div>
  );
};

export default ManagerSearch;
