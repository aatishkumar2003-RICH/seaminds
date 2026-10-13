import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ShieldCheck, BarChart3, Clock, FileCheck, Users, TrendingUp, ChevronRight, ChevronLeft, Check, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import HomeNav from "@/components/homepage/HomeNav";
import HomeFooter from "@/components/homepage/HomeFooter";
import ManagerWorkflow from "@/components/homepage/ManagerWorkflow";
import EvidenceSection from "@/components/companies/EvidenceSection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const stats = [
  { value: "1.89M", label: "Seafarers worldwide" },
  { value: "0.00–5.00", label: "SMC score range" },
  { value: "MLC 2006", label: "Rest-hours standard" },
  { value: "5.00", label: "Max SMC Score" },
];

const benefits = [
  {
    icon: ShieldCheck,
    title: "AI-Assessed Competency Scores",
    desc: "Every candidate comes with a SeaMinds Command Score — covering technical knowledge, communication, behaviour, and sea experience. No guesswork.",
  },
  {
    icon: BarChart3,
    title: "Reduce Port State Control Risk",
    desc: "Assess STCW knowledge before you hire, with structured SIRE 2.0 preparation built into the crew Academy.",
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
  "Vacancy posting and applicant management",
  "AI crew interviews with four-part scores",
  "MLC rest hours compliance reports",
  "Fleet wellness dashboard",
  "Certificate expiry tracking",
  "Crew availability matching",
  "In-app support & onboarding",
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
      .rpc("get_admin_settings", {
        p_keys: ["price_job_monthly", "price_company_annual"]
      })
      .then(({ data }) => {
        data?.forEach((row: any) => {
          if (row.key === "price_job_monthly") setJobPrice(Number(row.value));
          if (row.key === "price_company_annual") setCompanyPrice(Number(row.value));
        });
      });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>SeaMinds for Companies — Hire Assessed Maritime Crew</title>
        <meta
          name="description"
          content="AI-assessed competency scores, MLC compliance dashboards, and fleet wellness tools. Reduce PSC risk and hire better crew with SeaMinds."
        />
        <link rel="canonical" href="https://seaminds.life/for-companies" />
      </Helmet>

      <HomeNav />

      {/* Hero */}
      <section className="relative pt-28 pb-14 md:pt-36 md:pb-20 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--primary)) 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <button onClick={() => navigate("/")} className="absolute -top-10 left-4 sm:left-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px]" aria-label="Back to main page">
            <ChevronLeft size={18} /> Main page
          </button>
          <div className="sm-hero-glow" aria-hidden="true" />
          <p className="text-xs uppercase tracking-[0.3em] text-primary mb-4 font-mono-score">
            For Shipping &amp; Manning Companies
          </p>
          <h1 className="sm-hero-gradient text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-4">
            Interview Every Candidate Before You Interview Anyone.
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto mb-8">
            SeaMinds gives manning and shipping companies structured Sea Profiles, AI competency
            interviews, and evidence-based shortlists — from one dashboard.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate("/manager?mode=signup")}
              className="sm-cta-gold inline-flex items-center justify-center h-12 px-6 rounded-xl text-sm font-bold"
            >
              Create Free ShipManager Account
            </button>
            <button
              onClick={() => navigate("/manager")}
              className="inline-flex items-center justify-center h-12 px-6 rounded-xl text-sm font-bold"
              style={{ background: "transparent", color: "#D4AF37", border: "1px solid rgba(212,175,55,0.5)" }}
            >
              ShipManager Login
            </button>
          </div>
          <p className="text-xs mt-4" style={{ color: "rgba(212,175,55,0.75)" }}>
            Free for ship managers. Crew contact access requires admin approval.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="text-2xl md:text-3xl font-bold text-primary font-mono-score">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ManagerWorkflow />
      <EvidenceSection />


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
                Assessed Competency,
                <br />
                Not Just a CV.
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                The SeaMinds Command Score is an AI-assessed rating from 0.00 to 5.00 that assesses technical knowledge, communication ability, behavioural profile, and sea experience integrity. Every score is backed by the candidate’s assessment record. SeaMinds runs on leading US AI technology — the same model families used by Fortune 500 enterprises — applied to maritime competency and crewing.
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
                  { label: "Technical", score: 4.5 },
                  { label: "Judgment", score: 4.2 },
                  { label: "Maritime English", score: 3.9 },
                  { label: "Professional Behaviour", score: 4.3 },
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

      {/* Founding Company Access */}
      <section className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div
            className="rounded-2xl p-8 md:p-10 max-w-lg mx-auto text-center"
            style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--primary) / 0.3)" }}
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: "#D4AF37" }}>Founding Company Access</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Free company registration during launch, with direct founder support. Crew search and contact details
              require company approval and credits; fleet tools are available to approved fleet staff. Pricing will be
              announced after the founding period.
            </p>
            <ul className="space-y-3 mb-8 text-left">
              {planFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-foreground">
                  <Check className="w-4 h-4 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              size="lg"
              onClick={() => navigate("/manager?mode=signup")}
              className="w-full font-bold border-0"
              style={{ background: "linear-gradient(90deg, #D4AF37, #C5941F)", color: "#0D1B2A" }}
            >
              Create Free ShipManager Account
            </Button>
          </div>
        </div>
      </section>

      {/* Positioning (no client endorsements claimed) */}
      <section className="py-12" style={{ background: "hsl(var(--secondary))" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-sm text-muted-foreground">
            Built for manning agencies, ship managers and owners recruiting officers and ratings worldwide.
          </p>
        </div>
      </section>

      {/* Demo Form */}
      <section id="demo-form" className="py-16 md:py-24">
        <div className="max-w-xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Request a Demo</h2>
            <p className="text-muted-foreground text-sm">
              Tell us about your fleet and we'll show you how ShipManager by SeaMinds can help.
            </p>
          </div>

          <div className="rounded-2xl p-6 md:p-8 text-center space-y-4" style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}>
            <p className="text-sm text-muted-foreground">
              Email us your company name, fleet size and the ranks you recruit. Our team replies from the same mailbox.
            </p>
            <a
              href="mailto:admin@seaminds.life?subject=ShipManager%20by%20SeaMinds%20%E2%80%94%20demo%20request"
              className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-bold"
              style={{ background: "linear-gradient(90deg, #D4AF37, #C5941F)", color: "#0D1B2A" }}
            >
              Email SeaMinds <Send className="w-4 h-4" />
            </a>
            <p className="text-xs text-muted-foreground">Prefer to start now? <button type="button" className="underline text-primary" onClick={() => navigate("/manager?mode=signup")}>Create a free ShipManager account</button></p>
          </div>
        </div>
      </section>

      <HomeFooter />
    </div>
  );
};

export default ForCompanies;
