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
        <div className="max-w-3xl mx-auto">
          {/* Left column */}
          <div className="text-center">
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
            {/* Feature pills — auto-scrolling ticker on desktop */}
            <div className="mb-6 overflow-hidden scrollbar-hide">
              <div className="flex flex-row flex-nowrap gap-2 justify-center lg:animate-pill-drift pb-1 overflow-x-auto lg:overflow-visible" style={{ scrollbarWidth: "none" }}>
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

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
              <Button size="lg" onClick={() => window.location.href = '/app'} className="text-sm px-6 h-11">
                I Am Crew — Get Started Free <ChevronRight className="ml-1 w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => window.location.href = '/app'} className="text-sm px-6 h-11">
                I Am a Company — Hire Verified Crew
              </Button>
            </div>

            <div className="flex flex-row flex-nowrap gap-6 justify-center text-xs text-muted-foreground font-mono-score overflow-hidden whitespace-nowrap">
              {["1,890,000 seafarers need this", "25% suffer depression at sea", "0 platforms built for them"].map((stat, i) => (
                <span key={i} className="flex items-center gap-1.5 shrink-0">
                  <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                  {stat}
                </span>
              ))}
            </div>
          </div>

          {/* Right column - App mockup */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="relative w-[280px] rounded-[2.5rem] overflow-hidden shadow-2xl shadow-primary/20" style={{ background: "#0D1B2A", border: "3px solid hsl(var(--primary) / 0.3)", aspectRatio: "9/18" }}>
              {/* Phone notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 rounded-b-2xl z-10" style={{ background: "#0D1B2A" }} />
              {/* Status bar */}
              <div className="flex items-center justify-between px-6 pt-8 pb-2">
                <span className="text-[10px] font-mono text-muted-foreground">09:41</span>
                <span className="text-[10px] font-mono text-muted-foreground">⚓ SeaMinds</span>
              </div>
              {/* Greeting */}
              <div className="px-5 pt-2 pb-3">
                <p className="text-[11px] text-primary/70 font-medium">Good morning, Seafarer 👋</p>
                <p className="text-white font-bold text-sm mt-0.5">Your Dashboard</p>
              </div>
              {/* Feature cards */}
              <div className="px-4 space-y-2.5">
                {/* AI Chat */}
                <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.2)" }}>
                  <span className="text-xl">🤖</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-semibold">AI Wellness Chat</p>
                    <p className="text-muted-foreground text-[10px]">Talk to your personal crew companion</p>
                  </div>
                  <span className="text-primary text-[10px]">●</span>
                </div>
                {/* SMC Score */}
                <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.2)" }}>
                  <span className="text-xl">🏆</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-semibold">SMC Score</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                        <div className="h-full rounded-full" style={{ width: "78%", background: "linear-gradient(90deg, #D4AF37, #F5D76E)" }} />
                      </div>
                      <span className="text-primary text-[10px] font-bold">780</span>
                    </div>
                  </div>
                </div>
                {/* Rest Hours */}
                <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.2)" }}>
                  <span className="text-xl">⏱</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-semibold">Rest Hours</p>
                    <p className="text-[10px]" style={{ color: "#4ade80" }}>✓ MLC Compliant — 10.5h today</p>
                  </div>
                </div>
                {/* Streak */}
                <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.2)" }}>
                  <span className="text-xl">🔥</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-semibold">12-Day Streak</p>
                    <p className="text-muted-foreground text-[10px]">Keep your wellness check-ins going!</p>
                  </div>
                </div>
              </div>
              {/* Bottom nav */}
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-around py-3 px-2" style={{ background: "rgba(13,27,42,0.95)", borderTop: "1px solid rgba(212,175,55,0.15)" }}>
                {["💬", "❤️", "💼", "🎓", "🏆"].map((icon, i) => (
                  <span key={i} className={`text-sm ${i === 0 ? "opacity-100" : "opacity-40"}`}>{icon}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
