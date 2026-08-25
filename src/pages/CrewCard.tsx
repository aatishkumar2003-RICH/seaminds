import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, Anchor, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const GOLD = "#D4AF37";
const NAVY = "#0D1B2A";
const CARD = "#112240";
const BORDER = "rgba(212,175,55,0.3)";

interface CardData {
  first_name?: string;
  last_initial?: string;
  role?: string;
  nationality?: string;
  years_in_rank_band?: string;
  contracts_in_rank_band?: string;
  total_sea_service_band?: string;
  is_available?: boolean;
  vessel_families?: { vessel_family: string; sea_time_band: string }[];
  score?: { overall_score: number; score_band: string; certificate_id: string; completed_at: string } | null;
  claims?: { claim_key: string; status: string }[];
}

const CLAIM_STATUS: Record<string, { label: string; color: string }> = {
  VERIFIED: { label: "Verified", color: "#22c55e" },
  ASSESSED: { label: "AI-Assessed", color: GOLD },
  CLAIM: { label: "Self-declared", color: "#94A3B8" },
  FACT: { label: "Fact", color: "#22c55e" },
};

const prettify = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const Row = ({ label, value }: { label: string; value?: string }) => (
  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "10px 12px", flex: 1, minWidth: 120 }}>
    <p style={{ color: "#94A3B8", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</p>
    <p style={{ color: "#fff", fontSize: 13.5, fontWeight: 700, marginTop: 3 }}>{value || "—"}</p>
  </div>
);

const CrewCard = () => {
  const { token } = useParams();
  const [data, setData] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: res } = await supabase.rpc("get_crew_card" as any, { p_token: token });
      const d = (res || {}) as CardData;
      setData(d && Object.keys(d).length ? d : null);
      setLoading(false);
    })();
  }, [token]);

  const score = data?.score || null;
  const expired = !!score?.completed_at &&
    new Date(score.completed_at).getTime() + 2 * 365 * 24 * 3600 * 1000 < Date.now();

  return (
    <div style={{ minHeight: "100vh", background: NAVY, padding: "16px 16px 40px" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: GOLD, fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
          <ChevronLeft size={18} /> SeaMinds
        </Link>

        {loading && <p style={{ color: "#94A3B8", fontSize: 13 }}>Loading…</p>}

        {!loading && !data && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24, textAlign: "center" }}>
            <p style={{ color: "#fff", fontWeight: 800 }}>No profile found.</p>
            <Link to="/join" style={{ color: GOLD, fontSize: 13, display: "inline-block", marginTop: 10 }}>
              Create your free Sea Profile →
            </Link>
          </div>
        )}

        {!loading && data && (
          <>
            <h1 style={{ color: GOLD, fontSize: 15, fontWeight: 900, letterSpacing: 0.5, marginBottom: 12 }}>
              <Anchor size={16} style={{ display: "inline", verticalAlign: "-3px", marginRight: 6 }} />
              SeaMinds Verified Sea Profile
            </h1>

            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, marginBottom: 12 }}>
              <p style={{ color: "#fff", fontSize: 22, fontWeight: 900 }}>
                {data.first_name} {data.last_initial ? `${data.last_initial}.` : ""}
              </p>
              <p style={{ color: GOLD, fontSize: 14, fontWeight: 700, marginTop: 2 }}>{data.role || "Seafarer"}</p>
              <p style={{ color: "#94A3B8", fontSize: 12.5, marginTop: 2 }}>{data.nationality || "—"}</p>
              <span style={{
                display: "inline-block", marginTop: 10, padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800,
                background: data.is_available ? "rgba(34,197,94,0.12)" : "rgba(148,163,184,0.12)",
                color: data.is_available ? "#22c55e" : "#94A3B8",
                border: `1px solid ${data.is_available ? "rgba(34,197,94,0.4)" : "rgba(148,163,184,0.3)"}`,
              }}>
                {data.is_available ? "Available for work" : "Not currently available"}
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <Row label="Years in rank" value={data.years_in_rank_band} />
              <Row label="Contracts in rank" value={data.contracts_in_rank_band} />
              <Row label="Total sea service" value={data.total_sea_service_band} />
            </div>

            {!!data.vessel_families?.length && (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 14, marginBottom: 12 }}>
                <p style={{ color: "#94A3B8", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Vessel experience</p>
                {data.vessel_families.map((v, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: i ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                    <span style={{ color: "#e2e8f0", fontSize: 13 }}>{prettify(v.vessel_family || "")}</span>
                    <span style={{ color: GOLD, fontSize: 12.5, fontWeight: 700 }}>{v.sea_time_band || "—"}</span>
                  </div>
                ))}
              </div>
            )}

            {score && (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 16, marginBottom: 12 }}>
                <p style={{ color: "#94A3B8", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.6 }}>SeaMinds Score</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
                  <span style={{ color: GOLD, fontSize: 34, fontWeight: 900 }}>{Number(score.overall_score).toFixed(2)}</span>
                  <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 700 }}>{score.score_band}</span>
                  {expired && (
                    <span style={{ marginLeft: "auto", background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 800 }}>
                      Expired
                    </span>
                  )}
                </div>
                {score.certificate_id && (
                  <Link to={`/verify/${score.certificate_id}`} style={{ color: GOLD, fontSize: 12.5, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10 }}>
                    <ShieldCheck size={14} /> Verify certificate →
                  </Link>
                )}
              </div>
            )}

            {!!data.claims?.length && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
                {data.claims.map((c, i) => {
                  const st = CLAIM_STATUS[(c.status || "").toUpperCase()] || { label: c.status, color: "#94A3B8" };
                  return (
                    <span key={i} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${st.color}55`, color: "#e2e8f0", borderRadius: 999, padding: "5px 10px", fontSize: 11.5 }}>
                      {prettify(c.claim_key || "")} · <span style={{ color: st.color, fontWeight: 800 }}>{st.label}</span>
                    </span>
                  );
                })}
              </div>
            )}

            <Link to="/for-companies" style={{
              display: "block", textAlign: "center", background: GOLD, color: NAVY, fontWeight: 900,
              borderRadius: 12, padding: "14px 0", fontSize: 14,
            }}>
              Contact this candidate via SeaMinds — FIND CREW →
            </Link>
            <Link to="/join" style={{
              display: "block", textAlign: "center", marginTop: 10, color: GOLD, border: `1px solid ${GOLD}`,
              borderRadius: 12, padding: "12px 0", fontSize: 13, fontWeight: 700,
            }}>
              Are you a seafarer? Create your free Sea Profile →
            </Link>
          </>
        )}
      </div>
    </div>
  );
};

export default CrewCard;
