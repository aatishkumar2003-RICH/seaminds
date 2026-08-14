import { useNavigate } from "react-router-dom";
import { ChevronRight, ShieldCheck, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type TimeOfDay, getGreeting } from "@/hooks/useTimeOfDay";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  timeOfDay?: TimeOfDay;
}

const HeroSection = ({ timeOfDay = "day" }: Props) => {
  const navigate = useNavigate();
  const greeting = getGreeting(timeOfDay);

  const teamEntry = async () => {
    const value = window.prompt("Enter PIN");
    if (!value) return;
    const { data } = await supabase.rpc("verify_marketing_pin", { p_pin: value.trim() });
    if (data === true) navigate("/marketing");
    else toast.error("Incorrect PIN");
  };

  return (
    <section className="relative pt-14 pb-10 sm:pt-20 sm:pb-14 md:pt-32 md:pb-20 overflow-hidden">
      <button
        type="button"
        aria-label="team"
        onClick={teamEntry}
        style={{
          position: "absolute", top: 8, right: 8, width: 22, height: 22,
          borderRadius: 999, background: "hsl(var(--primary) / 0.10)",
          border: "none", cursor: "pointer", padding: 0,
        }}
      />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">

        <div className="max-w-3xl mx-auto">
          <div className="relative text-center">
            <div className="sm-hero-glow" aria-hidden="true" />
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] sm:tracking-[0.3em] text-primary mb-2 sm:mb-4 font-mono-score">
              AI-Powered Maritime Platform
            </p>
            <p className="text-sm md:text-base text-primary/80 mb-1 sm:mb-2 font-medium tracking-wide">
              {greeting}
            </p>

            <h1 className="sm-hero-gradient text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-3">
              Better Careers at Sea. Better Crew for Shipping.
            </h1>

            <p className="text-muted-foreground text-sm md:text-base max-w-2xl mx-auto mb-3">
              SeaMinds connects seafarers and maritime companies through a 2-minute Sea
              Profile, fresh jobs, and structured competency assessment.
            </p>

            <p className="text-[11px] md:text-xs text-primary/60 mb-6 tracking-wide">
              ⚡ Powered by leading US AI technology
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center mb-3">
              <button
                type="button"
                onClick={() => navigate("/app")}
                className="sm-cta-gold rounded-xl px-7 h-14 text-base font-bold"
              >
                ⚓ I'm Crew — Join Free
              </button>
              <button
                type="button"
                onClick={() => navigate("/for-companies")}
                className="sm-cta-conic rounded-xl px-7 h-14 text-base font-bold"
              >
                <span className="sm-cta-conic-inner rounded-[10px]">
                  🏢 I Hire Crew — Request Access
                </span>
              </button>
            </div>

            <p className="text-xs md:text-sm text-primary/70 mb-6">
              No long CV form to get started · Professional profile in about 2 minutes
            </p>


            <div
              className="mx-auto mb-7 max-w-lg rounded-2xl px-4 py-3 flex items-start gap-3 text-left"
              style={{
                border: "1px solid hsl(var(--primary) / 0.35)",
                background: "hsl(var(--primary) / 0.07)",
              }}
            >
              <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-xs md:text-sm text-foreground/90 leading-relaxed">
                <span className="font-semibold text-primary">Your conversations are sealed.</span>{" "}
                Your mood check-ins and AI chats are private — never shown to your
                company, your manning agent, or your captain.
              </p>
            </div>

            <div className="mb-6 overflow-hidden scrollbar-hide">
              <div
                className="flex flex-row flex-nowrap gap-2 justify-center lg:animate-pill-drift pb-1 overflow-x-auto lg:overflow-visible"
                style={{ scrollbarWidth: "none" }}
              >
                {[...Array(2)].flatMap((_, dupeIdx) =>
                  [
                    "🔥 Streak Tracker", "⏱ MLC Rest Hours", "📜 Cert Wallet", "💰 Salary Check",
                    "🔧 PMS Equipment", "🤖 AI Wellness", "🏆 SMC Score", "💼 Jobs Board",
                    "📷 Photo Diagnosis", "🎓 Academy",
                  ].map((pill) => (
                    <button
                      key={`${pill}-${dupeIdx}`}
                      onClick={() => navigate("/app")}
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

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              <Button size="lg" onClick={() => navigate("/app")} className="text-sm px-6 h-11">
                I Am Crew — Join Free <ChevronRight className="ml-1 w-4 h-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/for-companies")}
                className="text-sm px-6 h-11"
              >
                I Am a Company — Hire Verified Crew
              </Button>
            </div>

            <div
              className="mx-auto mb-6 max-w-2xl rounded-2xl px-5 py-4 text-center"
              style={{
                border: "1px solid hsl(var(--primary) / 0.35)",
                background: "hsl(var(--primary) / 0.07)",
              }}
            >
              <p className="text-[10px] uppercase tracking-[0.25em] text-primary font-mono-score mb-1">
                For Shipping Companies & Manning Agents
              </p>
              <h3 className="text-lg md:text-xl font-bold text-foreground mb-1">
                Interview & Verify Crew with AI
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground mb-3">
                Run structured AI crew interviews — every candidate scored 0.00–5.00 by rank, vessel type and experience. Browse verified CVs. Shortlist in hours, not weeks.
              </p>
              <div className="flex flex-wrap gap-2 justify-center mb-3">
                {["🎓 AI Crew Interviews", "📄 Verified CV Database", "🏆 SMC-Scored Candidates", "📢 Post Vacancies from $19"].map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full px-3 py-1 text-[11px] font-semibold text-primary"
                    style={{
                      border: "1px solid hsl(var(--primary) / 0.5)",
                      background: "hsl(var(--primary) / 0.08)",
                    }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button size="sm" onClick={() => navigate("/manager")} className="text-sm px-4 h-9">
                  Create AI Interview <ChevronRight className="ml-1 w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/for-companies")}
                  className="text-sm px-4 h-9"
                >
                  See Company Plans
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 mb-5 text-[11px] md:text-xs text-muted-foreground">
              <Globe2 className="w-3.5 h-3.5 text-primary/70 shrink-0" />
              <span className="truncate">
                English · Tiếng Việt · Tagalog · Bahasa · हिन्दी · Русский
              </span>
            </div>

            <div className="flex flex-row flex-wrap gap-x-6 gap-y-2 justify-center text-xs text-muted-foreground font-mono-score">
              {[
                "Free to join — no card",
                "Seafarers from 15 countries",
                "MLC 2006 aligned",
              ].map((stat, i) => (
                <span key={i} className="flex items-center gap-1.5 shrink-0">
                  <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                  {stat}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
