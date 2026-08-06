import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Anchor, Briefcase, Trophy, MessageCircle } from "lucide-react";
import { trackPixel } from "@/lib/metaPixel";
import seamindsLogo from "@/assets/seaminds-logo.png";

const GOLD = "#D4AF37";
const NAVY = "#0D1B2A";
const CARD = "#112240";
const BORDER = "#1e3a5f";

const JoinLanding = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<number | null>(null);
  const [countries, setCountries] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [{ count: jobCount }, { data: nats }] = await Promise.all([
          supabase.from("external_vacancies").select("*", { count: "exact", head: true }),
          supabase.from("crew_profiles").select("nationality").not("nationality", "is", null),
        ]);
        setJobs(jobCount ?? null);
        const uniq = new Set(((nats as any[]) || []).map((n) => n.nationality).filter(Boolean));
        setCountries(uniq.size || null);
      } catch { /* show without numbers */ }
    })();
  }, []);

  const go = (where: string) => {
    trackPixel("Lead", { content_name: "join_landing_cta" });
    navigate(where);
  };

  return (
    <div style={{ minHeight: "100vh", background: NAVY }}>
      <Helmet>
        <title>Free Seafarer Jobs & Maritime CV — Join SeaMinds</title>
        <meta name="description" content="Free app for seafarers: live maritime vacancies, apply by WhatsApp in one tap, build your verified CV, get your competency score. No agent fees. Join free." />
        <link rel="canonical" href="https://seaminds.life/join" />
      </Helmet>

      {/* Minimal header — no navigation, nothing to leak clicks */}
      <header className="flex items-center justify-center gap-2 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <img src={seamindsLogo} alt="SeaMinds" className="w-7 h-7" />
        <span className="text-base font-bold text-white">SeaMinds</span>
      </header>

      <main className="max-w-md mx-auto px-5 pb-10">
        {/* Hero */}
        <section className="pt-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.25em] mb-3" style={{ color: GOLD }}>
            Free for seafarers
          </p>
          <h1 className="text-3xl font-extrabold text-white leading-tight mb-3">
            Your next contract<br />is in your pocket
          </h1>
          <p className="text-sm mb-6" style={{ color: "#cbd5e1" }}>
            {jobs ? `${jobs}+ live vacancies` : "Live vacancies"} from manning companies worldwide.
            Apply by WhatsApp in one tap. No agent fees.
          </p>

          <button
            onClick={() => go("/app")}
            className="w-full rounded-2xl py-4 font-extrabold text-base mb-3"
            style={{ background: GOLD, color: NAVY, border: "none", cursor: "pointer" }}
          >
            Join Free — Takes 1 Minute
          </button>
          <button
            onClick={() => go("/feed")}
            className="w-full rounded-2xl py-3 font-bold text-sm"
            style={{ background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, cursor: "pointer" }}
          >
            See the jobs first
          </button>
        </section>

        {/* Trust — the seafarer's real fear */}
        <section className="mt-7 rounded-2xl p-4 flex gap-3 items-start"
          style={{ border: `1px solid rgba(212,175,55,0.35)`, background: "rgba(212,175,55,0.07)" }}>
          <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" style={{ color: GOLD }} />
          <p className="text-xs leading-relaxed" style={{ color: "#e2e8f0" }}>
            <span className="font-bold" style={{ color: GOLD }}>Your conversations are sealed.</span>{" "}
            Your mood check-ins and AI chats are private — never shown to your company,
            your manning agent, or your captain.
          </p>
        </section>

        {/* What you get */}
        <section className="mt-6 space-y-3">
          {[
            { icon: <Briefcase size={18} style={{ color: GOLD }} />, title: "Live jobs, every day", text: "New vacancies added every 2 hours. Deck, engine, catering, cadets." },
            { icon: <MessageCircle size={18} style={{ color: GOLD }} />, title: "Apply in one tap", text: "Straight to the company on WhatsApp. No middleman, no fees." },
            { icon: <Anchor size={18} style={{ color: GOLD }} />, title: "Your maritime CV", text: "Upload once — we read your certificates and build it for you." },
            { icon: <Trophy size={18} style={{ color: GOLD }} />, title: "Your competency score", text: "Companies sort crew by score. Higher score, seen first." },
          ].map((b) => (
            <div key={b.title} className="flex gap-3 rounded-2xl p-3.5" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <span className="shrink-0 mt-0.5">{b.icon}</span>
              <div>
                <p className="text-sm font-bold text-white">{b.title}</p>
                <p className="text-[11px] leading-snug" style={{ color: "#94a3b8" }}>{b.text}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Proof */}
        <section className="mt-6 grid grid-cols-3 gap-2 text-center">
          {[
            { v: jobs ? `${jobs}+` : "Live", l: "vacancies" },
            { v: countries ? `${countries}` : "15", l: "nationalities" },
            { v: "Free", l: "always, for crew" },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl py-3" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <p className="text-lg font-extrabold" style={{ color: GOLD }}>{s.v}</p>
              <p className="text-[10px]" style={{ color: "#94a3b8" }}>{s.l}</p>
            </div>
          ))}
        </section>

        <section className="mt-4 text-center">
          <p className="text-[11px] mb-4" style={{ color: "#64748b" }}>
            English · Tiếng Việt · Tagalog · Bahasa · हिन्दी · Русский
          </p>
          <button
            onClick={() => go("/app")}
            className="w-full rounded-2xl py-4 font-extrabold text-base"
            style={{ background: GOLD, color: NAVY, border: "none", cursor: "pointer" }}
          >
            Join Free — No Card Needed
          </button>
          <p className="text-[10px] mt-3" style={{ color: "#64748b" }}>
            SeaMinds · PT Indoglobal Service Solutions
          </p>
        </section>
      </main>
    </div>
  );
};

export default JoinLanding;
