import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

import ConversionConsole from "@/components/homepage/ConversionConsole";
import OceanBackground from "@/components/homepage/OceanBackground";
import TestimonialsSection from "@/components/homepage/TestimonialsSection";
import HomeFooter from "@/components/homepage/HomeFooter";
import HomeBento from "@/components/homepage/HomeBento";
import TrainingTracksStrip from "@/components/homepage/TrainingTracksStrip";

import { useTimeOfDay } from "@/hooks/useTimeOfDay";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";


const HomePage = () => {
  const timeOfDay = useTimeOfDay();
  const navigate = useNavigate();
  const { user, isReady: authReady } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => { document.title = "Seafarer Jobs & Maritime Vacancies Worldwide | SeaMinds"; }, []);

  // Capture referral code from share links (seaminds.life/?ref=CODE)
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && ref.length >= 6) localStorage.setItem("sm_ref", ref);
  }, []);

  // Password recovery links must land on the reset page
  useEffect(() => {
    if ((window.location.hash || "").includes("type=recovery")) {
      navigate("/reset-password" + window.location.hash, { replace: true });
      return;
    }
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") navigate("/reset-password", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);


  // Safety timeout: if auth doesn't resolve in 5s, show the page anyway
  useEffect(() => {
    if (authReady) return;
    const t = setTimeout(() => setTimedOut(true), 5000);
    return () => clearTimeout(t);
  }, [authReady]);

  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SeaMinds",
    url: "https://seaminds.life",
    logo: "https://seaminds.life/seaminds-logo.png",
    description: "The digital platform for seafarers — wellness, career tools, competency scoring and maritime community.",
    sameAs: [],
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      { "@type": "Question", name: "What is SeaMinds?", acceptedAnswer: { "@type": "Answer", text: "SeaMinds is the digital platform for seafarers — offering AI wellness support, the SeaMinds Competency Score, maritime academy, job matching, and community tools." }},
      { "@type": "Question", name: "Is my wellness data private?", acceptedAnswer: { "@type": "Answer", text: "Yes. SeaMinds follows the Sealed Envelope Principle — your wellness data and AI conversations are 100% private and never visible to employers or ship management." }},
      { "@type": "Question", name: "What is the SeaMinds Score?", acceptedAnswer: { "@type": "Answer", text: "The SeaMinds Command Score is an AI-assessed competency rating from 0.00 to 5.00 that covers technical skills, communication, behaviour, and sea experience." }},
      { "@type": "Question", name: "Is SeaMinds free?", acceptedAnswer: { "@type": "Answer", text: "Yes, SeaMinds offers a free tier with daily mood check-ins, AI wellness chat, community access, and basic job board. Pro and Company plans unlock additional features." }},
      { "@type": "Question", name: "Is SeaMinds MLC 2006 compliant?", acceptedAnswer: { "@type": "Answer", text: "Yes. SeaMinds is built in full accordance with MLC 2006 seafarer welfare standards." }},
      { "@type": "Question", name: "What is the SeaMinds Maritime Brain?", acceptedAnswer: { "@type": "Answer", text: "The Maritime Brain is SeaMinds' deck and engine knowledge engine. It runs adaptive, rank-specific AI interviews (for example 2nd Engineer to Chief Engineer or 2nd Officer to Chief Officer), checks every answer against safety rules, finds knowledge gaps and recommends targeted training and retests." }},
      { "@type": "Question", name: "Can ship managers interview and train crew with SeaMinds?", acceptedAnswer: { "@type": "Answer", text: "Yes. Managers can run AI technical interviews, see consent-based gap reports for their applicants and assign training before joining." }},
    ],
  };

  const websiteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "SeaMinds",
    url: "https://seaminds.life",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://seaminds.life/feed?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Maritime crew recruitment and seafarer welfare platform",
    provider: { "@type": "Organization", name: "SeaMinds", url: "https://seaminds.life" },
    areaServed: "Worldwide",
    audience: [
      { "@type": "Audience", audienceType: "Seafarers" },
      { "@type": "Audience", audienceType: "Manning agencies and ship managers" },
    ],
    description: "Maritime job vacancies, seafarer profiles, SeaMinds Competency Score, MLC 2006 rest hours tracking and AI crew wellness support.",
  };

  // Redirect authenticated users to /app
  useEffect(() => {
    if (authReady && user) {
      navigate('/app', { replace: true });
    }
  }, [authReady, user, navigate]);

  if (!authReady && !timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen animated-gradient-bg text-foreground relative">
      <Helmet>
        <title>Seafarer Jobs & Maritime Vacancies Worldwide | SeaMinds</title>
        <meta name="description" content="Find live seafarer jobs, build one reusable Sea Profile, manage STCW certificates and get matched with maritime employers. Free for crew. Companies: post vacancies and hire with evidence." />
        <meta name="keywords" content="seafarer jobs, maritime jobs, ship jobs, seaman jobs, crew recruitment, manning agency, hire seafarers, seafarer CV, maritime brain, AI maritime interview, chief engineer promotion interview, chief officer oral exam preparation, second engineer to chief engineer, dual fuel engine training, MAN ME engine training, ETO high voltage training, maritime crew pre-joining screening, seafarer competency score, maritime training" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
        <link rel="canonical" href="https://seaminds.life/" />
        <meta property="og:title" content="Seafarer Jobs & Maritime Vacancies Worldwide | SeaMinds" />
        <meta property="og:description" content="Find live seafarer jobs, build one reusable Sea Profile, manage STCW certificates and get matched with maritime employers. Free for crew. Companies: post vacancies and hire with evidence." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://seaminds.life/" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Seafarer Jobs & Maritime Vacancies Worldwide | SeaMinds" />
        <meta name="twitter:description" content="Find live seafarer jobs, build one reusable Sea Profile, manage STCW certificates and get matched with maritime employers. Free for crew. Companies: post vacancies and hire with evidence." />
        <script type="application/ld+json">{JSON.stringify(organizationLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqLd)}</script>
        <script type="application/ld+json">{JSON.stringify(websiteLd)}</script>
        <script type="application/ld+json">{JSON.stringify(serviceLd)}</script>
      </Helmet>
      <OceanBackground timeOfDay={timeOfDay} />
      <div className="relative z-10">
        <ConversionConsole />
        <TrainingTracksStrip />
        <HomeBento />


        {/* Legacy sections collapsed to one link row */}
        <nav aria-label="More" className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs font-semibold border-y" style={{ borderColor: "rgba(212,175,55,0.15)" }}>
          <Link to="/for-companies" className="text-muted-foreground hover:text-foreground no-underline">For Companies</Link>
          <span className="text-muted-foreground/40">·</span>
          <Link to="/smc-score" className="text-muted-foreground hover:text-foreground no-underline">How the SeaMinds Score works</Link>
          <span className="text-muted-foreground/40">·</span>
          <Link to="/privacy" className="text-muted-foreground hover:text-foreground no-underline">Privacy</Link>
          <span className="text-muted-foreground/40">·</span>
          <Link to="/contact" className="text-muted-foreground hover:text-foreground no-underline">About</Link>
        </nav>


        <TestimonialsSection />
        <HomeFooter />
      </div>
    </div>
  );
};

export default HomePage;

