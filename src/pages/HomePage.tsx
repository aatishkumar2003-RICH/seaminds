import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Users, Building2, Award, BarChart3, Globe, Clock, Anchor, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import seamindsLogo from "@/assets/seaminds-logo.png";

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

const StatCounter = ({ end, label, suffix = "" }: { end: number; label: string; suffix?: string }) => {
  const { ref, value } = useCountUp(end, 1800, 0);
  return (
    <div ref={ref} className="text-center px-6 py-8">
      <div className="text-3xl md:text-4xl font-bold text-primary gold-glow">
        {Math.round(Number(value)).toLocaleString()}{suffix}
      </div>
      <p className="text-muted-foreground text-sm mt-2">{label}</p>
    </div>
  );
};

const HomePage = () => {
  const navigate = useNavigate();
  const scoreCounter = useCountUp(4.21, 2500, 2);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 nav-glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <img src={seamindsLogo} alt="SeaMinds" className="w-8 h-8" />
              <span className="text-lg font-bold text-foreground gold-glow">SeaMinds</span>
            </div>

            <div className="hidden md:flex items-center gap-6">
              <button onClick={() => scrollToSection("features")} className="text-sm text-muted-foreground hover:text-primary transition-colors">For Seafarers</button>
              <button onClick={() => scrollToSection("features")} className="text-sm text-muted-foreground hover:text-primary transition-colors">For Companies</button>
              <button onClick={() => scrollToSection("certificate")} className="text-sm text-muted-foreground hover:text-primary transition-colors">SMC Score</button>
              <button onClick={() => scrollToSection("stats")} className="text-sm text-muted-foreground hover:text-primary transition-colors">Academy</button>
              <button onClick={() => scrollToSection("footer")} className="text-sm text-muted-foreground hover:text-primary transition-colors">About</button>
            </div>

            <div className="flex items-center gap-3">
              <Button size="sm" onClick={() => navigate("/app")} className="hidden sm:inline-flex">
                Get Your Score
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate("/manager")}>
                Company Login
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden" style={{ background: "linear-gradient(180deg, hsl(220 55% 6%) 0%, hsl(220 50% 8%) 100%)" }}>
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, hsl(32 45% 64% / 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, hsl(32 45% 64% / 0.1) 0%, transparent 40%)" }} />
        
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            The World's First AI-Verified
            <br />
            <span className="text-foreground">Crew Competency Score</span>
          </h1>
          <p className="text-lg md:text-xl text-primary gold-glow mb-10 font-medium">
            45 minutes. Portable. Yours forever.
          </p>

          {/* Animated Score */}
          <div ref={scoreCounter.ref} className="mb-12">
            <div className="inline-flex flex-col items-center p-8 rounded-2xl border border-border bg-card/50 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-primary" />
                <span className="text-xs uppercase tracking-widest text-primary font-semibold">Sample SMC Score</span>
              </div>
              <div className="text-6xl md:text-7xl font-bold text-primary score-glow tabular-nums">
                {scoreCounter.value}
              </div>
              <span className="text-sm text-primary/80 uppercase tracking-widest mt-2 font-semibold">Expert</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/app")} className="text-base px-8 h-12">
              Claim Free Assessment <ChevronRight className="ml-1 w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/manager")} className="text-base px-8 h-12">
              Hire Verified Crew
            </Button>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section id="features" className="py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">One Score. Three Stakeholders.</h2>
          <p className="text-muted-foreground text-center mb-14 max-w-2xl mx-auto">The SMC Score creates transparency and trust across the entire maritime hiring chain.</p>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-card border-border hover:border-primary/30 transition-colors">
              <CardContent className="pt-8 pb-8 px-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                  <Anchor className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-3">For Crew</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  Own your verified competency score. Carry it between contracts. Bid on salary based on proven ability, not just certificates.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><Award className="w-4 h-4 text-primary shrink-0" /> Portable score across employers</li>
                  <li className="flex items-center gap-2"><Award className="w-4 h-4 text-primary shrink-0" /> Premium salary bidding</li>
                  <li className="flex items-center gap-2"><Award className="w-4 h-4 text-primary shrink-0" /> Free first assessment</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-card border-border hover:border-primary/30 transition-colors">
              <CardContent className="pt-8 pb-8 px-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-3">For Companies</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  Hire verified crew with confidence. Reduce vetting costs by 70%. Access AI-verified competency data before the interview.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><Award className="w-4 h-4 text-primary shrink-0" /> Verified hire confidence</li>
                  <li className="flex items-center gap-2"><Award className="w-4 h-4 text-primary shrink-0" /> Reduce vetting costs</li>
                  <li className="flex items-center gap-2"><Award className="w-4 h-4 text-primary shrink-0" /> AI-powered screening</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-card border-border hover:border-primary/30 transition-colors">
              <CardContent className="pt-8 pb-8 px-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-3">For Manning Agents</h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  Run bulk assessments for your roster. Differentiate your agency with verified crew. Earn placement premiums.
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2"><Award className="w-4 h-4 text-primary shrink-0" /> Bulk assessments</li>
                  <li className="flex items-center gap-2"><Award className="w-4 h-4 text-primary shrink-0" /> Agency differentiation</li>
                  <li className="flex items-center gap-2"><Award className="w-4 h-4 text-primary shrink-0" /> Higher placement fees</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Certificate Preview */}
      <section id="certificate" className="py-20 md:py-28" style={{ background: "linear-gradient(180deg, hsl(220 50% 8%) 0%, hsl(220 55% 6%) 50%, hsl(220 50% 8%) 100%)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">The SMC Certificate</h2>
          <p className="text-muted-foreground mb-12 max-w-xl mx-auto">A verified, portable credential that proves competency beyond paper certificates.</p>

          <div className="inline-block rounded-2xl border border-border bg-card p-8 md:p-12 max-w-lg w-full">
            <div className="flex items-center justify-center gap-2 mb-1">
              <img src={seamindsLogo} alt="SeaMinds" className="w-6 h-6" />
              <span className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">SeaMinds Certified Score</span>
            </div>
            <div className="text-[72px] md:text-[84px] font-bold text-primary score-glow leading-none my-4 tabular-nums">
              4.21
            </div>
            <div className="text-sm uppercase tracking-[0.3em] text-primary font-bold mb-8">Expert</div>

            <div className="space-y-4 text-left max-w-xs mx-auto">
              {[
                { label: "Technical Competence", score: 4.5 },
                { label: "Experience Integrity", score: 4.2 },
                { label: "Communication Ability", score: 3.9 },
                { label: "Behavioural Profile", score: 4.3 },
                { label: "Wellness Consistency", score: 4.1 },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="text-primary font-semibold">{item.score.toFixed(2)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-1000"
                      style={{ width: `${(item.score / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-border">
              <p className="text-xs text-muted-foreground">Certificate ID: SMC-421-ME-2026</p>
              <p className="text-xs text-muted-foreground">Top 20% of assessed seafarers globally</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section id="stats" className="border-y border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
          <StatCounter end={1000} label="Free Assessments Available" />
          <StatCounter end={35} label="Nationalities" suffix="+" />
          <StatCounter end={5} label="Vessel Types" />
          <StatCounter end={45} label="Minutes to Complete" />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28 text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to prove your worth?</h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">Your first SMC assessment is free. No company can see your score unless you share it.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/app")} className="text-base px-8 h-12">
              Start Free Assessment
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/manager")} className="text-base px-8 h-12">
              Company Dashboard
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="footer" className="border-t border-border py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src={seamindsLogo} alt="SeaMinds" className="w-6 h-6" />
                <span className="font-bold text-foreground">SeaMinds</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Built by a Master Mariner. For the people who keep global trade moving.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Platform</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><button onClick={() => navigate("/app")} className="hover:text-primary transition-colors">SMC Assessment</button></li>
                <li><button onClick={() => scrollToSection("features")} className="hover:text-primary transition-colors">For Companies</button></li>
                <li><button onClick={() => scrollToSection("certificate")} className="hover:text-primary transition-colors">Certificate</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><button onClick={() => navigate("/app")} className="hover:text-primary transition-colors">Academy</button></li>
                <li><button onClick={() => navigate("/app")} className="hover:text-primary transition-colors">Maritime News</button></li>
                <li><button onClick={() => navigate("/app")} className="hover:text-primary transition-colors">Job Board</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><button className="hover:text-primary transition-colors">About</button></li>
                <li><button className="hover:text-primary transition-colors">Privacy Policy</button></li>
                <li><button className="hover:text-primary transition-colors">Terms of Service</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-6 text-center">
            <p className="text-xs text-muted-foreground">© 2026 SeaMinds. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
