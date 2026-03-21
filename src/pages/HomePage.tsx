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
import { useAuth } from "@/contexts/AuthContext";

const HomePage = () => {
  const timeOfDay = useTimeOfDay();
  const navigate = useNavigate();
  const { user, isReady: authReady } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => { document.title = "SeaMinds — The Seafarer's Digital Platform"; }, []);

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
      { "@type": "Question", name: "What is SeaMinds?", acceptedAnswer: { "@type": "Answer", text: "SeaMinds is the digital platform for seafarers — offering AI wellness support, the SMC Command Score, maritime academy, job matching, and community tools." }},
      { "@type": "Question", name: "Is my wellness data private?", acceptedAnswer: { "@type": "Answer", text: "Yes. SeaMinds follows the Sealed Envelope Principle — your wellness data and AI conversations are 100% private and never visible to employers or ship management." }},
      { "@type": "Question", name: "What is the SMC Score?", acceptedAnswer: { "@type": "Answer", text: "The SeaMinds Command Score is an AI-verified competency rating from 0.00 to 5.00 that covers technical skills, communication, behaviour, and sea experience." }},
      { "@type": "Question", name: "Is SeaMinds free?", acceptedAnswer: { "@type": "Answer", text: "Yes, SeaMinds offers a free tier with daily mood check-ins, AI wellness chat, community access, and basic job board. Pro and Company plans unlock additional features." }},
      { "@type": "Question", name: "Is SeaMinds MLC 2006 compliant?", acceptedAnswer: { "@type": "Answer", text: "Yes. SeaMinds is built in full accordance with MLC 2006 seafarer welfare standards." }},
    ],
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
        <title>SeaMinds — The Seafarer's Digital Platform</title>
        <meta name="description" content="The digital platform for seafarers — wellness, career tools, competency scoring and maritime community." />
        <link rel="canonical" href="https://seaminds.life" />
        <script type="application/ld+json">{JSON.stringify(organizationLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqLd)}</script>
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
