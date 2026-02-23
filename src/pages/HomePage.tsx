import HomeNav from "@/components/homepage/HomeNav";
import HeroSection from "@/components/homepage/HeroSection";
import ProblemSection from "@/components/homepage/ProblemSection";
import FeaturesSection from "@/components/homepage/FeaturesSection";
import SMCShowcase from "@/components/homepage/SMCShowcase";
import CompaniesSection from "@/components/homepage/CompaniesSection";
import FounderSection from "@/components/homepage/FounderSection";
import FinalCTA from "@/components/homepage/FinalCTA";
import HomeFooter from "@/components/homepage/HomeFooter";

const HomePage = () => (
  <div className="min-h-screen bg-background text-foreground">
    <HomeNav />
    <HeroSection />
    <ProblemSection />
    <FeaturesSection />
    <SMCShowcase />
    <CompaniesSection />
    <FounderSection />
    <FinalCTA />
    <HomeFooter />
  </div>
);

export default HomePage;
