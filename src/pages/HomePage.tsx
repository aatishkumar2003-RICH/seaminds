import { useEffect } from "react";
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

const HomePage = () => {
  const timeOfDay = useTimeOfDay();
  useEffect(() => { document.title = "SeaMinds"; }, []);
  return (
  <div className="min-h-screen animated-gradient-bg text-foreground relative">
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
