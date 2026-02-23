import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Shield, BookOpen, Briefcase, Heart, Users, Anchor, Home, ShieldCheck, BarChart3, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import seamindsLogo from "@/assets/seaminds-logo.png";

const useScrollFade = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) el.classList.add("visible"); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
};

const useCountUp = (end: number, duration = 2000) => {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const start = performance.now();
          const animate = (now: number) => {
            const p = Math.min((now - start) / duration, 1);
            setValue((1 - Math.pow(1 - p, 3)) * end);
            if (p < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);
  return { ref, value: value.toFixed(2) };
};

const features = [
  { icon: MessageCircle, title: "AI Wellness", desc: "Private 24/7 conversations, never shared." },
  { icon: Shield, title: "SMC Score", desc: "AI-verified competency. Salary bidding." },
  { icon: BookOpen, title: "Academy", desc: "PSC prep, vetting, STCW updates." },
  { icon: Briefcase, title: "Jobs", desc: "Verified listings with SMC requirements." },
  { icon: Heart, title: "Family", desc: "Keep your family connected at sea." },
  { icon: Users, title: "Community", desc: "35 nationalities. One crew." },
];

const subScores = [
  { label: "Technical", score: 4.5 },
  { label: "Experience", score: 4.2 },
  { label: "Communication", score: 3.9 },
  { label: "Behavioural", score: 4.3 },
  { label: "Wellness", score: 4.1 },
];

const BentoGrid = () => {
  const navigate = useNavigate();
  const counter = useCountUp(4.21, 2500);
  const ref1 = useScrollFade();
  const ref2 = useScrollFade();
  const ref3 = useScrollFade();

  return (
    <section className="py-12 md:py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-4">

        {/* Row 1: Problem stats */}
        <div ref={ref1} className="fade-in-on-scroll grid grid-cols-3 gap-3">
          {[
            { icon: Anchor, stat: "1 in 4", desc: "depression at sea" },
            { icon: Heart, stat: "20%", desc: "suicidal thoughts" },
            { icon: Home, stat: "8 months", desc: "away from family" },
          ].map((s) => (
            <div key={s.stat} className="glass-card rounded-xl p-4 md:p-6 text-center">
              <s.icon className="w-5 h-5 text-primary mx-auto mb-2" />
              <div className="text-2xl md:text-3xl font-bold text-foreground font-mono-score mb-1">{s.stat}</div>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Row 2: Features (6) + SMC Score preview */}
        <div ref={ref2} className="fade-in-on-scroll grid lg:grid-cols-5 gap-3">
          {/* Features 2x3 compact */}
          <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {features.map((f) => (
              <div key={f.title} className="glass-card rounded-xl p-4 hover:border-primary/30 transition-colors">
                <f.icon className="w-5 h-5 text-primary mb-2" />
                <h3 className="text-sm font-semibold text-foreground mb-1">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* SMC Certificate inline */}
          <div ref={counter.ref} className="lg:col-span-2 glass-card rounded-xl p-5 md:p-6 flex flex-col items-center justify-center">
            <div className="flex items-center gap-1.5 mb-1">
              <img src={seamindsLogo} alt="SeaMinds" className="w-4 h-4" />
              <span className="text-[9px] uppercase tracking-[0.2em] text-primary font-semibold">Certified Score</span>
            </div>
            <div className="text-5xl md:text-6xl font-bold text-primary score-glow leading-none my-2 font-mono-score">
              {counter.value}
            </div>
            <div className="text-xs uppercase tracking-[0.3em] text-primary font-bold mb-4">Expert</div>
            <div className="w-full space-y-2">
              {subScores.map((s) => (
                <div key={s.label}>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="text-primary font-semibold font-mono-score">{s.score.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(s.score / 5) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <Button size="sm" onClick={() => navigate("/app")} className="mt-4 text-xs px-4">
              Claim Free Assessment <ChevronRight className="ml-1 w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Row 3: For Companies compact card */}
        <div ref={ref3} className="fade-in-on-scroll grid md:grid-cols-2 gap-3">
          <div className="glass-card rounded-xl p-5 md:p-6">
            <h3 className="text-lg font-bold text-foreground mb-3">For Companies</h3>
            <div className="space-y-3">
              {[
                { icon: ShieldCheck, title: "Verify Before You Hire", desc: "AI-verified competency scores. Reduce vetting 70%." },
                { icon: BarChart3, title: "Reduce PSC Risk", desc: "One avoided deficiency saves more than the cost." },
              ].map((b) => (
                <div key={b.title} className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <b.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{b.title}</h4>
                    <p className="text-xs text-muted-foreground">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate("/manager")} className="mt-4 text-xs">
              Request Company Demo
            </Button>
          </div>

          <div className="glass-card rounded-xl p-5 md:p-6 flex flex-col justify-center">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-2">Founder</p>
            <blockquote className="text-sm text-foreground italic leading-relaxed mb-3">
              "I spent 27 years at sea. I watched good crew get overlooked and companies make bad hires. I built SeaMinds to fix both."
            </blockquote>
            <p className="text-xs text-muted-foreground">— Captain Atish · Master Mariner · Jakarta</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BentoGrid;
