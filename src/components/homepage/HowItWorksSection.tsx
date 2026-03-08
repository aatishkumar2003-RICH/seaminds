import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

const steps = [
  {
    num: "01",
    icon: "📱",
    title: "Create Your Profile",
    text: "Your nationality, rank, vessel type. 35 countries supported. Takes 90 seconds.",
  },
  {
    num: "02",
    icon: "🏆",
    title: "Get Your SMC Score",
    text: "15 rank-specific questions. AI evaluates your competency. Free for first 1,000 seafarers.",
  },
  {
    num: "03",
    icon: "🚀",
    title: "Access Everything",
    text: "Wellness AI, jobs, PMS reference, rest hours tracker — all in one place, works at sea.",
  },
];

const HowItWorksSection = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.15 }
    );
    const cards = containerRef.current?.querySelectorAll(".step-card");
    cards?.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="max-w-5xl mx-auto px-6 py-16 mt-0">
      <div className="text-center mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-2">Get Started in 3 Minutes</h2>
        <p className="text-sm text-muted-foreground">No paperwork. No company approval needed. Just you.</p>
      </div>

      <div ref={containerRef} className="grid md:grid-cols-3 gap-8 mb-12">
        {steps.map((s, i) => (
          <div
            key={s.num}
            className="step-card fade-in-on-scroll rounded-2xl p-6 transition-all"
            style={{
              background: "hsl(var(--navy-deep) / 0.6)",
              border: "1px solid hsl(var(--primary) / 0.15)",
              transitionDelay: `${i * 150}ms`,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "hsl(var(--primary) / 0.4)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "hsl(var(--primary) / 0.15)")}
          >
            <span className="text-5xl font-bold text-primary opacity-30 block mb-2 font-mono-score">{s.num}</span>
            <span className="text-2xl block mb-2">{s.icon}</span>
            <h3 className="text-foreground font-semibold mb-1">{s.title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{s.text}</p>
          </div>
        ))}
      </div>

      <div className="text-center">
        <Button
          size="lg"
          onClick={() => (window.location.href = "/app")}
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-8"
        >
          Start Free — No Credit Card
        </Button>
      </div>
    </section>
  );
};

export default HowItWorksSection;
