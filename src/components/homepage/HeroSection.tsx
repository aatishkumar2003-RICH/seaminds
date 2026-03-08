import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type TimeOfDay, getGreeting } from "@/hooks/useTimeOfDay";

interface Props {
  timeOfDay?: TimeOfDay;
}

const HeroSection = ({ timeOfDay = "day" }: Props) => {
  const navigate = useNavigate();
  const greeting = getGreeting(timeOfDay);

  return (
    <section className="relative pt-28 pb-16 md:pt-32 md:pb-20 overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left column */}
          <div className="text-center lg:text-left">
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
            <p className="text-muted-foreground text-sm md:text-base max-w-xl mx-auto lg:mx-0 mb-8">
              Built from 12 months of research with 10,000+ seafarers. Because the people at sea should design what the people at sea use.
            </p>
            {/* Feature pills — auto-scrolling ticker on desktop */}
            <div className="mb-6 overflow-hidden scrollbar-hide">
              <div className="flex flex-row flex-nowrap gap-2 lg:animate-pill-drift pb-1 overflow-x-auto lg:overflow-visible" style={{ scrollbarWidth: "none" }}>
                {[...Array(2)].flatMap((_, dupeIdx) =>
                  [
                    "🔥 Streak Tracker", "⏱ MLC Rest Hours", "📜 Cert Wallet", "💰 Salary Check",
                    "🔧 PMS Equipment", "🤖 AI Wellness", "🏆 SMC Score", "💼 Jobs Board",
                    "📷 Photo Diagnosis", "🎓 Academy",
                  ].map((pill) => (
                    <button
                      key={`${pill}-${dupeIdx}`}
                      onClick={() => document.getElementById("features-section")?.scrollIntoView({ behavior: "smooth" })}
                      className="shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold whitespace-nowrap text-primary transition-colors hover:bg-primary/15"
                      style={{
                        border: "1px solid hsl(var(--primary) / 0.5)",
                        background: "hsl(var(--primary) / 0.08)",
                      }}
                    >
                      {pill}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8">
              <Button size="lg" onClick={() => window.location.href = '/app'} className="text-sm px-6 h-11">
                I Am Crew — Get Started Free <ChevronRight className="ml-1 w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => window.location.href = '/app'} className="text-sm px-6 h-11">
                I Am a Company — Hire Verified Crew
              </Button>
            </div>

            <div className="flex flex-row flex-nowrap gap-6 text-xs text-muted-foreground font-mono-score overflow-hidden whitespace-nowrap">
              {["1,890,000 seafarers need this", "25% suffer depression at sea", "0 platforms built for them"].map((stat, i) => (
                <span key={i} className="flex items-center gap-1.5 shrink-0">
                  <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                  {stat}
                </span>
              ))}
            </div>
          </div>

          {/* Right column - animated visual */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="relative w-full max-w-md aspect-square rounded-2xl glass-card flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5" />
              <div className="relative text-center p-8">
                <div className="text-6xl mb-4">⚓</div>
                <p className="text-primary font-bold text-lg mb-1">SeaMinds</p>
                <p className="text-muted-foreground text-xs">The maritime platform built by seafarers, for seafarers</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
