import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import HomeNav from "@/components/homepage/HomeNav";
import HeroSection from "@/components/homepage/HeroSection";
import OceanBackground from "@/components/homepage/OceanBackground";
import BentoGrid from "@/components/homepage/BentoGrid";
import TestimonialsSection from "@/components/homepage/TestimonialsSection";
import FinalCTA from "@/components/homepage/FinalCTA";
import HomeFooter from "@/components/homepage/HomeFooter";
import { useTimeOfDay } from "@/hooks/useTimeOfDay";

const HomePage = () => {
  const timeOfDay = useTimeOfDay();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    document.title = "SeaMinds";
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session);
    });
  }, []);

  return (
  <div className="min-h-screen animated-gradient-bg text-foreground relative">
    <OceanBackground timeOfDay={timeOfDay} />
    <div className="relative z-10">
    <HomeNav isLoggedIn={isLoggedIn} />
    <HeroSection timeOfDay={timeOfDay} isLoggedIn={isLoggedIn} />
    <BentoGrid />
    <TestimonialsSection />
    <FinalCTA isLoggedIn={isLoggedIn} />
    <HomeFooter />
    </div>
  </div>
  );
};

export default HomePage;
