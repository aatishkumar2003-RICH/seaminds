import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const GOLD = "#D4AF37";
const PANEL = "#112240";
const BORDER = "rgba(212,175,55,0.3)";

type Post = { id: string; title: string; slug: string };

const CARDS = [
  { title: "SEA PROFILE", body: "One profile, reused for every application — recruiters find you.", link: "/profile-start", cta: "START →" },
  { title: "AI INTERVIEW & SMC", body: "Scored 0.00–5.00 on Technical · Judgment · English · Behaviour.", link: "/app?tab=smc", cta: "TAKE ASSESSMENT →" },
  { title: "MARKET & SALARY", body: "Live vacancy indices and salary benchmarks by rank and vessel.", link: "/app?tab=market", cta: "OPEN MARKET →" },
  { title: "CV · CERTIFICATES · REST HOURS", body: "Build your CV, store certificates and keep an MLC rest-hours record.", link: "/app?tab=cv", cta: "OPEN CV →" },
  { title: "ACADEMY & COMMUNITY", body: "PSC prep, vetting and STCW updates — plus a crew community at sea.", link: "/app?tab=home", cta: "EXPLORE →" },
  { title: "MANAGER WORKFLOW", body: "Post Vacancy → Match → AI Interview → Shortlist.", link: "/for-companies", cta: "FIND CREW →" },
];

const HomeBento = () => {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id,title,slug")
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(3);
      if (alive) setPosts((data as Post[]) || []);
    })();
    return () => { alive = false; };
  }, []);

  return (
    <section className="max-w-6xl mx-auto px-4 py-8">
      <div className="grid gap-3 md:grid-cols-2">
        {CARDS.map((c) => (
          <div
            key={c.title}
            className="rounded-xl p-4 flex flex-col justify-between"
            style={{ maxHeight: 120, background: `${PANEL}CC`, border: `1px solid ${BORDER}` }}
          >
            <div>
              <h3 className="text-[11px] font-bold tracking-wider mb-1" style={{ color: GOLD }}>{c.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{c.body}</p>
            </div>
            <Link to={c.link} className="mt-2 text-[11px] font-bold" style={{ color: GOLD }}>{c.cta}</Link>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground">
        🔒 Wellness conversations are private — never visible to companies. Professional profiles shared only per your visibility settings.
      </p>

      {posts.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[11px] font-bold tracking-wider text-foreground mb-2">LATEST FROM SEAMINDS</h3>
          <ul className="space-y-1.5">
            {posts.map((p) => (
              <li key={p.id}>
                <Link to={`/blog/${p.slug}`} className="text-xs text-muted-foreground hover:text-foreground">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default HomeBento;
