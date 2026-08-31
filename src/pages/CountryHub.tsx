import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import NotFound from "@/pages/NotFound";
import { COUNTRY_HUBS, countryHubBySlug, portMatches, RANK_HUBS, jobPath } from "@/lib/jobSlug";

const NAVY = "#0D1B2A";
const CARD = "#112240";
const GOLD = "#D4AF37";
const BORDER = "#1e3a5f";

interface Row {
  id: string; rank: string; vessel: string; port: string | null;
  company: string; kind: "direct" | "external";
}

const CountryHub = () => {
  const { country } = useParams();
  const hub = countryHubBySlug(country);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!hub) { setLoading(false); return; }
    (async () => {
      const nowIso = new Date().toISOString();
      const [p, e] = await Promise.all([
        supabase.from("job_postings" as any)
          .select("id, rank_required, vessel_type, joining_port, company_name, created_at")
          .eq("status", "active").order("created_at", { ascending: false }).limit(300),
        supabase.from("external_vacancies" as any)
          .select("id, rank_required, title, vessel_type, joining_port, company_name, fetched_at, is_scam_flagged")
          .gt("expires_at", nowIso).order("fetched_at", { ascending: false }).limit(400),
      ]);
      const direct: Row[] = (((p as any).data as any[]) || [])
        .filter((r) => portMatches(hub, r.joining_port))
        .map((r) => ({ id: r.id, rank: r.rank_required || "Crew", vessel: r.vessel_type || "—", port: r.joining_port, company: r.company_name || "Maritime Company", kind: "direct" as const }));
      const ext: Row[] = (((e as any).data as any[]) || [])
        .filter((r) => !r.is_scam_flagged && portMatches(hub, r.joining_port))
        .map((r) => ({ id: r.id, rank: r.rank_required || r.title || "Crew", vessel: r.vessel_type || "—", port: r.joining_port, company: r.company_name || "Maritime Company", kind: "external" as const }));
      if (alive) { setRows([...direct, ...ext]); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [hub]);

  if (!hub) return <NotFound title="Country hub not found" message="We don't have a hub for that country yet. Browse the live vacancy feed instead." />;

  const siblings = COUNTRY_HUBS.filter((c) => c.slug !== hub.slug).slice(0, 6);
  const title = `Seafarer Jobs in ${hub.name} | SeaMinds`;
  const canonical = `https://seaminds.life/jobs/country/${hub.slug}`;

  return (
    <div style={{ minHeight: "100vh", background: NAVY, padding: "16px 16px 70px" }}>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={`Live seafarer jobs and maritime vacancies in ${hub.name} — deck, engine and catering ranks. Apply free on SeaMinds, no agent fees.`} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={title} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="website" />
      </Helmet>

      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <a href="/feed" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#94A3B8", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          <ChevronLeft size={16} /> All vacancies
        </a>

        <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 900, marginTop: 12, lineHeight: 1.25 }}>
          Seafarer Jobs {hub.name} — {loading ? "…" : rows.length} live vacancies
        </h1>
        <p style={{ color: "#cbd5e1", fontSize: 13.5, lineHeight: 1.65, marginTop: 12 }}>{hub.blurb}</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 18 }}>
          {rows.map((r) => (
            <a key={`${r.kind}-${r.id}`} href={jobPath({ id: r.id, rank: r.rank, vessel: r.vessel, port: r.port })}
              style={{ display: "block", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "11px 13px", textDecoration: "none" }}>
              {r.kind === "direct" && (
                <span style={{ display: "inline-block", marginRight: 6, borderRadius: 5, padding: "1px 5px", fontSize: 9, fontWeight: 800, border: `1px solid ${GOLD}`, color: GOLD }}>DIRECT</span>
              )}
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 13.5 }}>{r.rank}</span>
              <span style={{ color: GOLD, fontSize: 12 }}> · {r.vessel}</span>
              <span style={{ color: "#94a3b8", fontSize: 11.5 }}> · {r.port || "Worldwide"} · {r.company}</span>
            </a>
          ))}
          {!loading && rows.length === 0 && (
            <p style={{ color: "#94a3b8", fontSize: 13 }}>
              No vacancies joining in {hub.name} right now — <a href="/feed" style={{ color: GOLD }}>see all live vacancies</a>.
            </p>
          )}
        </div>

        <div style={{ marginTop: 24 }}>
          <p style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Other countries</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {siblings.map((c) => (
              <a key={c.slug} href={`/jobs/country/${c.slug}`}
                style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${GOLD}`, color: GOLD, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                {c.name}
              </a>
            ))}
          </div>
          <p style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, margin: "18px 0 8px" }}>Browse by rank</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {RANK_HUBS.map((r) => (
              <a key={r.slug} href={`/jobs/rank/${r.slug}`}
                style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid #1e3a5f", color: "#cbd5e1", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                {r.name}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CountryHub;
