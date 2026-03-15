import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import HomeNav from "@/components/homepage/HomeNav";
import HeroSection from "@/components/homepage/HeroSection";
import OceanBackground from "@/components/homepage/OceanBackground";
import AppPreviewSection from "@/components/homepage/AppPreviewSection";
import HowItWorksSection from "@/components/homepage/HowItWorksSection";
import BentoGrid from "@/components/homepage/BentoGrid";
import CompaniesB2BSection from "@/components/homepage/CompaniesB2BSection";
import TestimonialsSection from "@/components/homepage/TestimonialsSection";
import FinalCTA from "@/components/homepage/FinalCTA";
import HomeFooter from "@/components/homepage/HomeFooter";
import { useTimeOfDay } from "@/hooks/useTimeOfDay";
import { supabase } from "@/integrations/supabase/client";

const HomePage = () => {
  const timeOfDay = useTimeOfDay();
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => { document.title = "SeaMinds — The Seafarer's Digital Platform"; }, []);

  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SeaMinds",
    url: "https://seaminds.life",
    logo: "https://seaminds.life/seaminds-logo.png",
    description: "The digital platform for seafarers — wellness, career tools, competency scoring and maritime community.",
    sameAs: [],
  };

  // Check auth and redirect authenticated users to /app (with 3s timeout)
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const resolve = () => { clearTimeout(timeout); setAuthReady(true); };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate('/app', { replace: true });
      } else {
        resolve();
      }
    }).catch(() => resolve());

    // Fallback: always show homepage after 3 seconds
    timeout = setTimeout(resolve, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        navigate('/app', { replace: true });
      }
    });
    return () => { clearTimeout(timeout); subscription.unsubscribe(); };
  }, [navigate]);

  if (!authReady) {
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
        <title>SeaMinds — The Seafarer's Digital Platform</title>
        <meta name="description" content="The digital platform for seafarers — wellness, career tools, competency scoring and maritime community." />
        <link rel="canonical" href="https://seaminds.life" />
        <script type="application/ld+json">{JSON.stringify(organizationLd)}</script>
      </Helmet>
      <OceanBackground timeOfDay={timeOfDay} />
      <div className="relative z-10">
        <HomeNav />
        <HeroSection timeOfDay={timeOfDay} />
        <AppPreviewSection />
        <HowItWorksSection />
        <BentoGrid />
        <CompaniesB2BSection />
        <TestimonialsSection />
        <FinalCTA />
        <HomeFooter />
      </div>
    </div>
  );
};

export default HomePage;
