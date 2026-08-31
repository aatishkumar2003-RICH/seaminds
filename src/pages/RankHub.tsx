import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import NotFound from "@/pages/NotFound";
import { RANK_HUBS, rankHubBySlug, rankMatches, jobPath } from "@/lib/jobSlug";

const NAVY = "#0D1B2A";
const CARD = "#112240";
const GOLD = "#D4AF37";
const BORDER = "#1e3a5f";

interface Row {
  id: string; rank: string; vessel: string; port: string | null;
  company: string; kind: "direct" | "external";
}

const RankHub = () => {
  const { rank } = useParams();
  const hub = rankHubBySlug(rank);
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
        .filter((r) => rankMatches(hub, r.rank_required))
        .map((r) => ({ id: r.id, rank: r.rank_required || "Crew", vessel: r.vessel_type || "—", port: r.joining_port, company: r.company_name || "Maritime Company", kind: "direct" as const }));
      const ext: Row[] = (((e as any).data as any[]) || [])
        .filter((r) => !r.is_scam_flagged && rankMatches(hub, r.rank_required || r.title))
        .map((r) => ({ id: r.id, rank: r.rank_required || r.title || "Crew", vessel: r.vessel_type || "—", port: r.joining_port, company: r.company_name || "Maritime Company", kind: "external" as const }));
      if (alive) { setRows([...direct, ...ext]); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [hub]);

  if (!hub) return <NotFound title="Rank not found" message="We don't have a hub for that rank. Browse the live vacancy feed instead." />;

  const idx = RANK_HUBS.findIndex((r) => r.slug === hub.slug);
  const neighbours = [RANK_HUBS[idx - 1], RANK_HUBS[idx + 1]].filter(Boolean);
  const title = `${hub.name} Jobs & Maritime Vacancies | SeaMinds`;
  const canonical = `https://seaminds.life/jobs/rank/${hub.slug}`;

  return (
    <div style={{ minHeight: "100vh", background: NAVY, padding: "16px 16px 70px" }}>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={`Live ${hub.name} jobs and maritime vacancies from shipping companies worldwide. Apply free on SeaMinds — no agent fees.`} />
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
          {hub.name} Jobs &amp; Vacancies — {loading ? "…" : rows.length} live openings
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 6 }}>
          {loading ? "Loading live vacancies…" : `${rows.length} live ${hub.name} vacancies on SeaMinds right now.`}
        </p>

        <p style={{ color: "#cbd5e1", fontSize: 13.5, lineHeight: 1.65, marginTop: 14 }}>{hub.blurb}</p>

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
              No live {hub.name} vacancies at this moment. New contracts are posted daily — <a href="/join" style={{ color: GOLD }}>join free</a> to get alerts.
            </p>
          )}
        </div>

        <div style={{ marginTop: 24 }}>
          <p style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Nearby ranks</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {neighbours.map((n) => (
              <a key={n.slug} href={`/jobs/rank/${n.slug}`}
                style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${GOLD}`, color: GOLD, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                {n.name} jobs
              </a>
            ))}
            <a href="/join" style={{ padding: "6px 12px", borderRadius: 999, background: GOLD, color: NAVY, fontSize: 12, fontWeight: 800, textDecoration: "none" }}>
              Join SeaMinds free
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RankHub;
