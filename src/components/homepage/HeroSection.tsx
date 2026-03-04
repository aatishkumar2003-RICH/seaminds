import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type TimeOfDay, getGreeting } from "@/hooks/useTimeOfDay";

interface Props {
  timeOfDay?: TimeOfDay;
  isLoggedIn?: boolean;
}

const HeroSection = ({ timeOfDay = "day", isLoggedIn = false }: Props) => {
  const greeting = getGreeting(timeOfDay);
  const [tab, setTab] = useState<"crew" | "company">("crew");

  return (
    <section className="relative pt-28 pb-16 md:pt-32 md:pb-20 overflow-hidden">
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary mb-4 font-mono-score">
          AI-Powered Maritime Platform
        </p>
        <p className="text-sm md:text-base text-primary/80 mb-2 font-medium tracking-wide">
          {greeting}
        </p>
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-3">
          One Platform. Every Seafarer Needs.
        </h1>
        <p className="text-lg md:text-xl text-primary gold-glow mb-3 font-semibold">
          Wellness · Career · Community · Certification
        </p>
        <p className="text-muted-foreground text-sm md:text-base max-w-xl mx-auto mb-8">
          Built from 12 months of research with 10,000+ seafarers. Because the people at sea should design what the people at sea use.
        </p>

        <div className="flex flex-col items-center gap-4 justify-center mb-8">
          <div className="flex bg-secondary rounded-xl p-1 w-full max-w-xs">
            <button
              onClick={() => setTab("crew")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === "crew" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              I Am Crew
            </button>
            <button
              onClick={() => setTab("company")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === "company" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              I Am a Company
            </button>
          </div>
          {isLoggedIn ? (
            <Button size="lg" onClick={() => { window.location.href = '/app'; }} className="text-sm px-6 h-11">
              Go to App <ChevronRight className="ml-1 w-4 h-4" />
            </Button>
          ) : (
            tab === "crew" ? (
              <Button size="lg" onClick={() => { window.location.href = '/auth'; }} className="text-sm px-6 h-11">
                Get Started Free <ChevronRight className="ml-1 w-4 h-4" />
              </Button>
            ) : (
              <Button size="lg" onClick={() => { window.location.href = '/auth'; }} className="text-sm px-6 h-11">
                Hire Verified Crew <ChevronRight className="ml-1 w-4 h-4" />
              </Button>
            )
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono-score">
          {["1,890,000 seafarers need this", "25% suffer depression at sea", "0 platforms built for them"].map((stat, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
              {stat}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
