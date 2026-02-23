import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const useCountUp = (end: number, duration: number = 2000, decimals: number = 2) => {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const startTime = performance.now();
          const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(eased * end);
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return { ref, value: value.toFixed(decimals) };
};

const tickerStats = [
  "1,890,000 seafarers worldwide need this",
  "25% suffer depression at sea",
  "0 platforms built for them — until now",
];

const HeroSection = () => {
  const navigate = useNavigate();
  const counter = useCountUp(4.21, 2500, 2);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: "linear-gradient(180deg, hsl(220 55% 6%) 0%, hsl(220 50% 10%) 100%)" }}>
      {/* Animated wave background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-[200%] h-[200%] -top-1/2 -left-1/2 animate-spin" style={{ animationDuration: "120s" }}>
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-[0.03]" style={{ background: "radial-gradient(circle, hsl(32 45% 64%) 0%, transparent 70%)" }} />
          <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, hsl(32 45% 64%) 0%, transparent 60%)" }} />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-32 opacity-[0.06]" style={{ background: "repeating-linear-gradient(90deg, transparent, transparent 60px, hsl(32 45% 64%) 60px, hsl(32 45% 64%) 61px)" }} />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center pt-24 pb-16">
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-4">
          One Platform. Every Seafarer Needs.
        </h1>
        <p className="text-xl md:text-2xl text-primary gold-glow mb-4 font-semibold">
          Wellness · Career · Community · Certification
        </p>
        <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto mb-10">
          Built by a Master Mariner who spent 27 years at sea. Because nobody understood the problem better.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Button size="lg" onClick={() => navigate("/app")} className="text-base px-8 h-13">
            I Am Crew — Get Started Free <ChevronRight className="ml-1 w-4 h-4" />
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/manager")} className="text-base px-8 h-13">
            I Am a Company — Hire Verified Crew
          </Button>
        </div>

        {/* Stats ticker */}
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {tickerStats.map((stat, i) => (
            <span key={i} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              {stat}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
