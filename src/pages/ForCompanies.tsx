import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ShieldCheck, BarChart3, Clock, FileCheck, Users, TrendingUp, ChevronRight, Check, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import HomeNav from "@/components/homepage/HomeNav";
import HomeFooter from "@/components/homepage/HomeFooter";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const stats = [
  { value: "1.89M", label: "Seafarers worldwide" },
  { value: "70%", label: "Faster vetting" },
  { value: "35+", label: "Nationalities covered" },
  { value: "5.00", label: "Max SMC Score" },
];

const benefits = [
  {
    icon: ShieldCheck,
    title: "AI-Verified Competency Scores",
    desc: "Every candidate comes with a SeaMinds Command Score — covering technical knowledge, communication, behaviour, and sea experience. No guesswork.",
  },
  {
    icon: BarChart3,
    title: "Reduce Port State Control Risk",
    desc: "Hire crew with verified STCW knowledge. One avoided PSC deficiency saves more than the annual platform cost.",
  },
  {
    icon: Clock,
    title: "MLC Rest Hours Compliance",
    desc: "Real-time rest hour tracking across your fleet. Audit-ready reports generated instantly for any inspection.",
  },
  {
    icon: FileCheck,
    title: "Certificate Expiry Alerts",
    desc: "Automated alerts 90, 60, and 30 days before any crew certificate expires. Never sail with an uncertified crew member.",
  },
  {
    icon: Users,
    title: "Fleet Wellness Index",
    desc: "Anonymous, aggregate wellness data per vessel. Spot crew wellbeing trends before they become incidents or attrition.",
  },
  {
    icon: TrendingUp,
    title: "Crew Performance Analytics",
    desc: "Track assessment scores, training completion, and competency trends across your entire crew pool over time.",
  },
];

const planFeatures = [
  "Unlimited crew onboarding",
  "SMC score access for all crew",
  "MLC rest hours compliance reports",
  "Fleet wellness dashboard",
  "Certificate expiry tracking",
  "Crew availability matching",
  "Priority support & onboarding",
  "Custom branding options",
];

const trustedBy = [
  "Fleet Management Ltd",
  "Anglo-Eastern",
  "Synergy Marine",
  "Bernhard Schulte",
  "V.Ships",
  "Columbia Shipmanagement",
];

const ForCompanies = () => {
  const navigate = useNavigate();
  const [jobPrice, setJobPrice] = useState(0);
  const [companyPrice, setCompanyPrice] = useState(0);
  const [formData, setFormData] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    fleet_size: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    supabase
      .from("admin_settings")
      .select("key, value")
      .in("key", ["price_job_monthly", "price_company_annual"])
      .then(({ data }) => {
        data?.forEach((row) => {
          if (row.key === "price_job_monthly") setJobPrice(Number(row.value));
          if (row.key === "price_company_annual") setCompanyPrice(Number(row.value));
        });
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company_name || !formData.contact_name || !formData.email) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("company_demo_requests").insert([formData]);
    setSubmitting(false);
    if (error) {
      toast.error("Something went wrong. Please try again.");
    } else {
      setSubmitted(true);
      toast.success("Demo request received! We'll be in touch within 24 hours.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>SeaMinds for Companies — Hire Verified Maritime Crew</title>
        <meta
          name="description"
          content="AI-verified competency scores, MLC compliance dashboards, and fleet wellness tools. Reduce PSC risk and hire better crew with SeaMinds."
        />
        <link rel="canonical" href="https://seaminds.life/for-companies" />
      </Helmet>

      <HomeNav />

      {/* Hero */}
      <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--primary)) 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-4 font-mono-score">
            For Shipping Companies
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-4">
            Better Crew. Less Risk.
            <br />
            <span className="text-primary">Lower Cost.</span>
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto mb-10">
            The SMC Score gives shipping companies a verified data layer for every hire. AI-assessed competency, MLC compliance, and fleet wellness — in one platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
            <Button size="lg" onClick={() => document.getElementById("demo-form")?.scrollIntoView({ behavior: "smooth" })} className="text-sm px-6 h-11">
              Request a Demo <ChevronRight className="ml-1 w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/manager")} className="text-sm px-6 h-11">
              Manager Login
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-2xl md:text-3xl font-bold text-primary font-mono-score">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Grid */}
      <section className="py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Everything You Need to Manage Crew</h2>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto">
              From hiring to compliance — one platform that covers the full crew lifecycle.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="rounded-2xl p-6 transition-shadow hover:shadow-lg"
                style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "hsl(var(--primary) / 0.12)" }}
                >
                  <b.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-foreground font-semibold mb-2">{b.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SMC Score Explainer */}
      <section className="py-16 md:py-24" style={{ background: "hsl(var(--secondary))" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-primary mb-3 font-mono-score">The SMC Score</p>
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                Verified Competency,
                <br />
                Not Just a CV.
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                The SeaMinds Command Score is an AI-verified rating from 0.00 to 5.00 that assesses technical knowledge, communication ability, behavioural profile, and sea experience integrity. Every score is backed by verifiable data.
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("/pricing")}>
                View Pricing <ChevronRight className="ml-1 w-3.5 h-3.5" />
              </Button>
            </div>
            <div
              className="rounded-2xl p-6 md:p-8"
              style={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
            >
              <div className="text-center mb-6">
                <p className="text-5xl font-bold text-primary font-mono-score">4.32</p>
                <p className="text-xs text-muted-foreground mt-1">Sample SMC Score</p>
              </div>
              <div className="space-y-3">
                {[
                  { label: "Technical Competence", score: 4.5 },
                  { label: "Experience Integrity", score: 4.2 },
                  { label: "Communication Ability", score: 3.9 },
                  { label: "Behavioural Profile", score: 4.3 },
                  { label: "Wellness Readiness", score: 4.6 },
                ].map((d) => (
                  <div key={d.label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{d.label}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-border overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(d.score / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-foreground font-mono-score text-xs font-semibold w-8 text-right">
                        {d.score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground text-sm">No hidden fees. Cancel anytime.</p>
          </div>
          <div
            className="rounded-2xl p-8 md:p-10 max-w-lg mx-auto"
            style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--primary) / 0.3)" }}
          >
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Company Plan</p>
            <p className="text-3xl md:text-4xl font-bold text-primary mb-1 font-mono-score">
              {jobPrice === 0 ? "Free" : "$" + jobPrice}
              <span className="text-base font-normal text-muted-foreground ml-2">/ vessel / month</span>
            </p>
            <p className="text-xs text-muted-foreground mb-8">Minimum 1 vessel. Cancel anytime.</p>
            <ul className="space-y-3 mb-8">
              {planFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-foreground">
                  <Check className="w-4 h-4 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              size="lg"
              className="w-full"
              onClick={() => document.getElementById("demo-form")?.scrollIntoView({ behavior: "smooth" })}
            >
              Request Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12" style={{ background: "hsl(var(--secondary))" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-6">
            Trusted by crew from leading companies
          </p>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {trustedBy.map((name) => (
              <span key={name} className="text-sm text-muted-foreground/70 font-medium">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Form */}
      <section id="demo-form" className="py-16 md:py-24">
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Request a Demo</h2>
            <p className="text-muted-foreground text-sm">
              Tell us about your fleet and we'll show you how SeaMinds can help. Response within 24 hours.
            </p>
          </div>

          {submitted ? (
            <div className="rounded-2xl p-8 text-center" style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--primary) / 0.3)" }}>
              <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-4">
                <Check className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Demo Request Received</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Our team will contact you at <strong className="text-foreground">{formData.email}</strong> within 24 hours.
              </p>
              <Button variant="outline" onClick={() => navigate("/")}>
                Back to Home
              </Button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl p-6 md:p-8 space-y-5"
              style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Company Name *</label>
                  <Input
                    required
                    maxLength={100}
                    value={formData.company_name}
                    onChange={(e) => setFormData((p) => ({ ...p, company_name: e.target.value }))}
                    placeholder="Acme Shipping"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Your Name *</label>
                  <Input
                    required
                    maxLength={100}
                    value={formData.contact_name}
                    onChange={(e) => setFormData((p) => ({ ...p, contact_name: e.target.value }))}
                    placeholder="James Chen"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Email *</label>
                  <Input
                    required
                    type="email"
                    maxLength={255}
                    value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                    placeholder="james@acmeshipping.com"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Fleet Size</label>
                  <Input
                    maxLength={50}
                    value={formData.fleet_size}
                    onChange={(e) => setFormData((p) => ({ ...p, fleet_size: e.target.value }))}
                    placeholder="e.g. 12 vessels"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Message</label>
                <Textarea
                  maxLength={1000}
                  value={formData.message}
                  onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
                  placeholder="Tell us what you're looking for…"
                  rows={4}
                />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting ? "Sending…" : (
                  <>
                    Send Demo Request <Send className="ml-2 w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          )}
        </div>
      </section>

      <HomeFooter />
    </div>
  );
};

export default ForCompanies;
