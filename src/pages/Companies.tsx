import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, HeartPulse, ShieldCheck, Brain, BarChart3, BookOpen, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import HomeNav from "@/components/homepage/HomeNav";
import HomeFooter from "@/components/homepage/HomeFooter";
import OceanBackground from "@/components/homepage/OceanBackground";
import { useTimeOfDay } from "@/hooks/useTimeOfDay";

const problems = [
  {
    icon: Search,
    title: "The Vetting Problem",
    body: "Traditional vetting relies on paper certificates anyone can fake. PSC detentions cost $15,000–50,000 per day. One bad hire puts your fleet at risk.",
  },
  {
    icon: HeartPulse,
    title: "The Wellness Problem",
    body: "20% of seafarers experience depression at sea. Untreated mental health issues cause accidents, abandonments, and insurance claims worth millions.",
  },
  {
    icon: ShieldCheck,
    title: "The Compliance Problem",
    body: "MLC 2006 requires documented crew welfare programs. Most companies have policies but no platform to deliver, measure, or prove compliance.",
  },
];

const solutions = [
  {
    icon: Brain,
    title: "SMC Verified Scoring",
    body: "Every candidate arrives with an AI-verified competency score from 0.00 to 5.00. Six dimensions. Department-specific. Vessel-type aware. No more guessing.",
  },
  {
    icon: BarChart3,
    title: "Fleet Wellness Dashboard",
    body: "See anonymised fleet wellness trends. Identify at-risk vessels before incidents occur. Prove MLC 2006 welfare compliance with one report.",
  },
  {
    icon: BookOpen,
    title: "Reduce PSC Risk",
    body: "SeaMinds Academy keeps your crew current on PSC inspection requirements. Verified preparation. Documented training. Fewer deficiencies.",
  },
  {
    icon: DollarSign,
    title: "Salary Transparency",
    body: "Post jobs with minimum SMC Score requirements. Attract qualified crew. Pay fair market rates. Reduce turnover by hiring right the first time.",
  },
];

const roiStats = [
  { value: "70%", label: "Reduction in vetting time" },
  { value: "$50,000", label: "Average cost of one PSC detention" },
  { value: "40%", label: "Reduction in crew turnover with wellness support" },
  { value: "1 platform", label: "Replaces vetting + wellness + compliance tools" },
];

const Companies = () => {
  const navigate = useNavigate();
  const timeOfDay = useTimeOfDay();

  useEffect(() => {
    document.title = "SeaMinds | For Companies";
  }, []);

  return (
    <div className="min-h-screen animated-gradient-bg text-foreground relative">
      <OceanBackground timeOfDay={timeOfDay} />
      <div className="relative z-10">
        <HomeNav />

        {/* HERO */}
        <section className="pt-28 pb-20 md:pt-36 md:pb-28 px-4 sm:px-6 text-center">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Hire Verified. Manage Better.{" "}
              <span className="text-primary">Comply Confidently.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              SeaMinds gives ship management companies AI-verified crew competency scores, fleet wellness dashboards, and MLC 2006 compliance tools — in one platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-base px-8 h-12" onClick={() => navigate("/app")}>
                Request Free Demo
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8 h-12" onClick={() => navigate("/pricing")}>
                View Pricing
              </Button>
            </div>
          </div>
        </section>

        {/* PROBLEMS */}
        <section className="py-20 md:py-28 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-14">
              Three Problems We Solve
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {problems.map((p) => (
                <div key={p.title} className="glass-card rounded-xl p-8">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-5 bg-primary/10">
                    <p.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-3">{p.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SOLUTIONS */}
        <section className="py-20 md:py-28 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-14">
              One Platform. <span className="text-primary">Every Answer.</span>
            </h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {solutions.map((s) => (
                <div key={s.title} className="glass-card rounded-xl p-8 text-left">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-5 bg-primary/10">
                    <s.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-3">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ROI */}
        <section className="py-20 md:py-28 px-4 sm:px-6 bg-background/80">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-14">
              The Numbers That Matter <span className="text-primary">To Your CFO</span>
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {roiStats.map((s) => (
                <div key={s.value} className="glass-card rounded-xl p-8">
                  <div className="text-3xl md:text-4xl font-bold text-primary font-mono-score mb-3">{s.value}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING SUMMARY */}
        <section className="py-20 md:py-28 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-14">Company Plans</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {/* Company Starter */}
              <div className="glass-card rounded-xl p-8 border border-primary/30">
                <h3 className="text-xl font-bold mb-1">Company Starter</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-bold text-primary font-mono-score">$199</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground mb-8">
                  <li>Up to 50 crew members</li>
                  <li>Manager wellness dashboard</li>
                  <li>Crew SMC score verification</li>
                  <li>Bulk assessment tools</li>
                  <li>PSC inspection readiness reports</li>
                  <li>Priority support</li>
                </ul>
                <Button className="w-full" onClick={() => navigate("/app")}>Request Demo</Button>
              </div>
              {/* Enterprise */}
              <div className="glass-card rounded-xl p-8 border border-primary/30">
                <h3 className="text-xl font-bold mb-1">Enterprise</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-bold text-primary font-mono-score">Custom</span>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground mb-8">
                  <li>Unlimited crew</li>
                  <li>Full fleet wellness analytics</li>
                  <li>Custom SMC assessment programs</li>
                  <li>API integration</li>
                  <li>Dedicated account manager</li>
                  <li>White-label options</li>
                </ul>
                <Button className="w-full" onClick={() => navigate("/app")}>Contact Us</Button>
              </div>
            </div>
            <p className="text-center mt-8">
              <button onClick={() => navigate("/pricing")} className="text-primary hover:underline text-sm">
                See full pricing →
              </button>
            </p>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="py-20 md:py-28 px-4 sm:px-6 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to <span className="text-primary">Verify Your Fleet?</span>
            </h2>
            <p className="text-muted-foreground mb-10 leading-relaxed">
              Join shipping companies already using SeaMinds to hire better, manage safer, and comply confidently.
            </p>
            <Button size="lg" className="text-base px-10 h-12" onClick={() => navigate("/app")}>
              Request Free Demo
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              No credit card required. Setup in 24 hours. Cancel anytime.
            </p>
          </div>
        </section>

        <HomeFooter />
      </div>
    </div>
  );
};

export default Companies;
