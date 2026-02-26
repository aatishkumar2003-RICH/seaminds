import { useEffect } from "react";
import HomeNav from "@/components/homepage/HomeNav";
import HeroSection from "@/components/homepage/HeroSection";
import OceanBackground from "@/components/homepage/OceanBackground";
import BentoGrid from "@/components/homepage/BentoGrid";
import TestimonialsSection from "@/components/homepage/TestimonialsSection";
import FinalCTA from "@/components/homepage/FinalCTA";
import HomeFooter from "@/components/homepage/HomeFooter";

const HomePage = () => {
  useEffect(() => { document.title = "SeaMinds"; }, []);
  return (
  <div className="min-h-screen animated-gradient-bg text-foreground relative">
    <OceanBackground />
    <div className="relative z-10">
    <HomeNav />
    <HeroSection />
    <BentoGrid />
    <TestimonialsSection />
    <FinalCTA />
    <HomeFooter />
  </div>
  );
};

export default HomePage;
