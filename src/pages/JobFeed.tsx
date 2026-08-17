import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Anchor, MapPin, Ship, BadgeCheck, MessageCircle, ExternalLink } from "lucide-react";
import { trackPixel } from "@/lib/metaPixel";
import { formatSalaryText } from "@/lib/salary";

const NAVY = "#0D1B2A";
const GOLD = "#D4AF37";
const CARD = "#112240";
const BORDER = "#1e3a5f";

const TYPE_LABEL: Record<string, string> = {
  hiring: "🚢 Hiring", update: "📢 Company Update", fleet: "⚓ Fleet News",
  training: "🎓 Training", welfare: "🤝 Crew Welfare",
};

interface FeedItem {
  id: string;
  source: "company" | "market";
  rank: string;
  vessel: string;
  company: string;
  salary: string | null;
  port: string | null;
  duration: string | null;
  flier: string | null;
  whatsapp: string | null;
  applyUrl: string | null;
  verified: boolean;
  posted: string;
  caption?: string;
  isCompanyPost?: boolean;
  postType?: string;
}

const GROUPS: Record<string, string[]> = {
  Deck: ["captain", "master", "officer", "mate", "bosun", "ab", "os", "seaman", "deck"],
  Engine: ["engineer", "eto", "oiler", "fitter", "motorman", "electr", "engine"],
  Cadet: ["cadet", "trainee"],
  Catering: ["cook", "steward", "messman", "chef"],
};


const timeAgo = (iso: string) => {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
};

const JobFeed = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [ships, setShips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("All");

  useEffect(() => {
    (async () => {
      try {
        const [posts, ext, cposts, shipRes] = await Promise.all([
          supabase.from("job_postings" as any)
            .select("id, rank_required, vessel_type, monthly_salary, joining_port, contract_duration, company_name, contact_whatsapp, verified, flier_url, created_at, status")
            .eq("status", "active").order("created_at", { ascending: false }).limit(60),
          supabase.from("external_vacancies" as any)
            .select("id, rank_required, vessel_type, company_name, salary_text, joining_port, contract_duration, contact_whatsapp, apply_url, is_verified, fetched_at")
            .gt("expires_at", new Date().toISOString())
            .order("fetched_at", { ascending: false }).limit(60),
          supabase.from("company_posts" as any)
            .select("id, company_name, post_type, caption, image_url, whatsapp, link_url, verified, created_at")
            .eq("status", "live").order("created_at", { ascending: false }).limit(30),
          supabase.from("ship_photos" as any)
            .select("id, photo_url, caption").eq("active", true).limit(12),
        ]);



        const a: FeedItem[] = ((posts.data as any[]) || []).map((r) => ({
          id: `p-${r.id}`, source: "company",
          rank: r.rank_required || "Crew", vessel: r.vessel_type || "—",
          company: r.company_name || "Maritime Company", salary: r.monthly_salary,
          port: r.joining_port, duration: r.contract_duration, flier: r.flier_url,
          whatsapp: r.contact_whatsapp, applyUrl: null,
          verified: !!r.verified, posted: r.created_at,
        }));

        const b: FeedItem[] = ((ext.data as any[]) || []).map((r) => ({
          id: `e-${r.id}`, source: "market",
          rank: r.rank_required || "Crew", vessel: r.vessel_type || "—",
          company: r.company_name || "Maritime Company", salary: r.salary_text,
          port: r.joining_port, duration: r.contract_duration, flier: null,
          whatsapp: r.contact_whatsapp, applyUrl: r.apply_url,
          verified: !!r.is_verified, posted: r.fetched_at,
        }));

        const c: FeedItem[] = (((cposts as any).data as any[]) || []).map((r) => ({
          id: `c-${r.id}`, source: "company" as const,
          rank: r.company_name, vessel: "",
          company: r.company_name, salary: null,
          port: null, duration: null, flier: r.image_url,
          whatsapp: r.whatsapp, applyUrl: r.link_url,
          verified: !!r.verified, posted: r.created_at,
          caption: r.caption, isCompanyPost: true, postType: r.post_type,
        }));

        setItems([...a, ...b, ...c].sort((x, y) => +new Date(y.posted) - +new Date(x.posted)));
        setShips((((shipRes as any).data as any[]) || []).sort(() => Math.random() - 0.5));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const shown = useMemo(() => {
    if (filter === "All") return items;
    const keys = GROUPS[filter] || [];
    return items.filter((i) => keys.some((k) => (i.rank || "").toLowerCase().includes(k)));
  }, [items, filter]);

  // Record the outbound handoff before opening — best effort, never blocks
  const recordOutbound = async (i: FeedItem, url: string) => {
    try {
      await supabase.rpc("submit_application" as any, {
        p_vacancy_id: null,
        p_company_post_id: i.isCompanyPost ? String(i.id).replace(/^c-/, "") : null,
        p_company_name: i.company || null,
        p_rank: i.rank || null,
        p_vessel: i.vessel || null,
        p_external_url: url,
      });
    } catch { /* duplicates / signed-out visitors never block the open */ }
  };

  const apply = async (i: FeedItem) => {
    trackPixel("Contact", { content_name: "job_apply_public" });
    if (i.whatsapp) {
      const d = i.whatsapp.replace(/[^\d]/g, "");
      if (d) {
        const url = `https://wa.me/${d}?text=${encodeURIComponent(`Hello, I am interested in the ${i.rank} position (seen on SeaMinds).`)}`;
        await recordOutbound(i, url);
        return window.open(url, "_blank", "noopener,noreferrer");
      }
    }
    if (i.applyUrl) {
      await recordOutbound(i, i.applyUrl);
      return window.open(i.applyUrl, "_blank", "noopener,noreferrer");
    }
    navigate("/app?tab=jobs");
  };

  return (
    <div style={{ minHeight: "100vh", background: NAVY }}>
      <Helmet>
        <title>Maritime Jobs Feed — Live Seafarer Vacancies | SeaMinds</title>
        <meta name="description" content="Live maritime job vacancies for seafarers — deck, engine, cadet and catering ranks from manning companies worldwide. Apply free on SeaMinds." />
        <link rel="canonical" href="https://seaminds.life/feed" />
      </Helmet>

      <header style={{ position: "sticky", top: 0, zIndex: 20, background: NAVY, borderBottom: `1px solid ${BORDER}`, padding: "14px 16px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Anchor size={20} style={{ color: GOLD }} />
              <div>
                <h1 style={{ color: GOLD, fontSize: 17, fontWeight: 800, lineHeight: 1.1 }}>Maritime Jobs Feed</h1>
                <p style={{ color: "#94a3b8", fontSize: 11 }}>{loading ? "Loading…" : `${items.length} live vacancies`}</p>
              </div>
            </div>
            <button onClick={() => navigate("/app")} style={{ background: GOLD, color: NAVY, border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 800, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
              Join Free
            </button>
          </div>

          <div style={{ display: "flex", gap: 7, marginTop: 11, overflowX: "auto", paddingBottom: 2 }}>
            {["All", "Deck", "Engine", "Cadet", "Catering"].map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{
                flexShrink: 0, padding: "6px 13px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer",
                background: filter === f ? GOLD : "transparent", color: filter === f ? NAVY : GOLD,
                border: `1px solid ${GOLD}${filter === f ? "" : "66"}`,
              }}>{f}</button>
            ))}
          </div>

          <div className="flex gap-2 mt-2">
            <a href="https://whatsapp.com/channel/0029Vb8xcAJBFLgOKwwdTJ2V" target="_blank" rel="noopener noreferrer"
              style={{ flex: 1, textAlign: "center", background: "#25D366", color: "#fff", borderRadius: 10, padding: "7px 0", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
              📲 Job alerts on WhatsApp
            </a>
            <a href="https://t.me/seamindsjobs" target="_blank" rel="noopener noreferrer"
              style={{ flex: 1, textAlign: "center", background: "#229ED9", color: "#fff", borderRadius: 10, padding: "7px 0", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
              Telegram
            </a>
          </div>
        </div>
      </header>

      <section style={{ borderBottom: `1px solid ${BORDER}`, background: "linear-gradient(160deg, rgba(212,175,55,0.10), transparent)" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px 22px", textAlign: "center" }}>
          <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 900, lineHeight: 1.25 }}>
            Your next contract, direct from the company
          </h2>
          <p style={{ color: "#cbd5e1", fontSize: 13, marginTop: 8, lineHeight: 1.55 }}>
            Live maritime vacancies updated every 2 hours. Apply straight to the company on WhatsApp — no agent fees, no middleman.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 14, flexWrap: "wrap" }}>
            {[
              { v: loading ? "—" : String(items.length), l: "live now" },
              { v: "Free", l: "always, for crew" },
              { v: "2h", l: "refresh rate" },
            ].map((s) => (
              <div key={s.l} style={{ textAlign: "center" }}>
                <p style={{ color: GOLD, fontSize: 18, fontWeight: 900 }}>{s.v}</p>
                <p style={{ color: "#94a3b8", fontSize: 10 }}>{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <main style={{ maxWidth: 700, margin: "0 auto", padding: "16px 16px 60px", display: "flex", flexDirection: "column", gap: 14 }}>
        {loading && <p style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>Loading vacancies…</p>}

        {!loading && shown.length === 0 && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 40, textAlign: "center", color: "#94a3b8" }}>
            No vacancies in this category right now — try "All" to see everything live.
          </div>
        )}

        {shown.map((i, idx) => (
          <div key={i.id} style={{ display: "contents" }}>
            <article style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>
              {i.flier && (
                <img src={i.flier} alt={`${i.rank} vacancy flier`} loading="lazy"
                  style={{ width: "100%", display: "block", maxHeight: 460, objectFit: "cover" }} />
              )}

              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ color: "#fff", fontSize: 17, fontWeight: 800, lineHeight: 1.2 }}>{i.rank}</h2>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                      <span style={{ color: GOLD, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.company}</span>
                      {i.verified && <BadgeCheck size={13} style={{ color: "#22c55e", flexShrink: 0 }} />}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap" }}>{timeAgo(i.posted)}</span>
                </div>

                {i.isCompanyPost ? (
                  <>
                    <span style={{
                      display: "inline-block", alignSelf: "flex-start", borderRadius: 999,
                      padding: "4px 10px", fontSize: 10, fontWeight: 800,
                      background: "rgba(212,175,55,0.12)", color: GOLD, border: `1px solid rgba(212,175,55,0.35)`,
                    }}>
                      {TYPE_LABEL[i.postType || "update"] || "📢 Update"}
                    </span>
                    <p style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{i.caption}</p>
                  </>
                ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: "#cbd5e1" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Ship size={13} style={{ color: "#94a3b8" }} />{i.vessel}</span>
                  {i.port && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={13} style={{ color: "#94a3b8" }} />{i.port}</span>}
                  {i.duration && <span style={{ color: "#94a3b8" }}>{i.duration}</span>}
                </div>
                )}

                {formatSalaryText(i.salary) && (
                  <div style={{ color: "#22c55e", fontWeight: 800, fontSize: 15 }}>{formatSalaryText(i.salary)}</div>
                )}

                <button onClick={() => apply(i)} style={{
                  marginTop: 2, width: "100%", padding: "11px", borderRadius: 11, border: "none", cursor: "pointer",
                  background: GOLD, color: NAVY, fontWeight: 800, fontSize: 13,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                }}>
                  {i.whatsapp ? <><MessageCircle size={15} /> Apply via WhatsApp</> : <><ExternalLink size={15} /> View & Apply</>}
                </button>
              </div>

              {(idx + 1) % 6 === 0 && (
                <div style={{ borderTop: `1px solid ${BORDER}`, padding: 13, textAlign: "center" }}>
                  <p style={{ color: "#cbd5e1", fontSize: 12, marginBottom: 8 }}>
                    Build your CV free and let companies find you.
                  </p>
                  <button onClick={() => navigate("/app")} style={{ background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 9, padding: "7px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    Join SeaMinds Free
                  </button>
                </div>
              )}
            </article>

            {(idx + 1) % 5 === 0 && ships[Math.floor(idx / 5) % Math.max(ships.length, 1)] && (
              <article style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>
                <img
                  src={ships[Math.floor(idx / 5) % ships.length].photo_url}
                  alt="Life at sea"
                  loading="lazy"
                  style={{ width: "100%", display: "block", height: 190, objectFit: "cover" }}
                />
                <div style={{ padding: 12 }}>
                  <p style={{ color: GOLD, fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>🚢 LIFE AT SEA</p>
                  <p style={{ color: "#fff", fontSize: 13, marginTop: 3 }}>
                    {ships[Math.floor(idx / 5) % ships.length].caption}
                  </p>
                </div>
              </article>
            )}
          </div>
        ))}

        <p style={{ color: "#64748b", fontSize: 11, textAlign: "center", lineHeight: 1.6, padding: "10px 20px" }}>
          SeaMinds never charges seafarers for jobs. Under MLC 2006 no manning agency may charge you a recruitment fee.
        </p>
      </main>

    </div>
  );
};

export default JobFeed;
