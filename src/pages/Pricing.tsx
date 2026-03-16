import { useNavigate } from "react-router-dom";
import { Check, Star, Anchor, Ship, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Helmet } from "react-helmet-async";
import HomeNav from "@/components/homepage/HomeNav";
import HomeFooter from "@/components/homepage/HomeFooter";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const tiers = [
  {
    name: "Free",
    subtitle: "First 1,000 crew members",
    price: "$0",
    period: "forever",
    icon: Anchor,
    features: [
      "AI wellness chat (5/month)",
      "Daily mood check-ins",
      "Community forum access",
      "Maritime news feed",
      "Basic job board",
      "Rest hours tracker",
    ],
    cta: "Get Your Score",
    popular: false,
  },
  {
    name: "Pro",
    subtitle: "Everything you need at sea",
    price: "$9",
    period: "/month",
    icon: Ship,
    features: [
      "Unlimited AI wellness chat",
      "SMC Score assessment included",
      "Full Academy & PMS reference",
      "BRIDGE equipment diagnostics",
      "Priority job matching",
      "Family connection portal",
      "Cert Wallet & document storage",
      "SOS emergency support 24/7",
    ],
    cta: "Get Your Score",
    popular: true,
  },
  {
    name: "Company",
    subtitle: "Fleet-wide crew management",
    price: "$49",
    period: "/month",
    icon: Building2,
    features: [
      "Manager wellness dashboard",
      "Team analytics & reporting",
      "Bulk SMC assessments",
      "Crew competency verification",
      "PSC inspection readiness",
      "MLC 2006 compliance reports",
      "Priority support",
    ],
    cta: "Get Your Score",
    popular: false,
  },
];

const faqs = [
  {
    q: "Is crew wellness data visible to employers?",
    a: "Never. The Sealed Envelope Principle means your wellness data is 100% private.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. No contracts, no cancellation fees.",
  },
  {
    q: "Is SeaMinds MLC 2006 compliant?",
    a: "Yes. SeaMinds is built in full accordance with MLC 2006 seafarer welfare standards.",
  },
  {
    q: "What is an SMC Score?",
    a: "SeaMinds Certified Score — an AI-verified competency rating from 0.00 to 5.00 that travels with you across every employer.",
  },
];

const Pricing = () => {
  const navigate = useNavigate();
  useEffect(() => { document.title = "SeaMinds | Pricing"; }, []);

  return (
    <div className="min-h-screen text-foreground" style={{ background: "linear-gradient(180deg, hsl(210 50% 8%) 0%, hsl(210 40% 12%) 50%, hsl(210 50% 8%) 100%)" }}>
      <Helmet>
        <title>SeaMinds Pricing — Plans for Seafarers & Companies</title>
        <meta name="description" content="Simple, transparent pricing for seafarers and shipping companies. Free forever tier, Pro at $9/month, and Company plans." />
        <link rel="canonical" href="https://seaminds.life/pricing" />
        <meta property="og:title" content="SeaMinds Pricing — Plans for Seafarers & Companies" />
        <meta property="og:description" content="Simple, transparent pricing for seafarers and shipping companies." />
        <meta property="og:url" content="https://seaminds.life/pricing" />
        <meta property="og:image" content="https://seaminds.life/og-image.png" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": faqs.map(f => ({
            "@type": "Question",
            "name": f.q,
            "acceptedAnswer": { "@type": "Answer", "text": f.a }
          }))
        })}</script>
      </Helmet>
      <HomeNav />

      <main className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto text-center mb-14">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: "#D4AF37" }}>
            Simple, Transparent Pricing
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Whether you're a seafarer looking after your wellbeing or a company managing a fleet — there's a plan for you.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="max-w-5xl mx-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {tiers.map((t) => {
            const Icon = t.icon;
            return (
              <Card
                key={t.name}
                className={`relative flex flex-col border-0 ${
                  t.popular
                    ? "ring-2 shadow-lg"
                    : "shadow-md"
                }`}
                style={{
                  background: t.popular
                    ? "linear-gradient(135deg, hsl(210 40% 14%) 0%, hsl(32 30% 14%) 100%)"
                    : "hsl(210 40% 12%)",
                  borderColor: t.popular ? "#D4AF37" : "hsl(210 20% 20%)",
                  ...(t.popular ? { boxShadow: "0 0 30px rgba(212, 175, 55, 0.15)" } : {}),
                  ...(t.popular ? { ringColor: "#D4AF37" } as any : {}),
                }}
              >
                {t.popular && (
                  <Badge
                    className="absolute -top-3 left-1/2 -translate-x-1/2 gap-1 border-0"
                    style={{ background: "linear-gradient(90deg, #D4AF37, #8B6914)", color: "#0D1B2A" }}
                  >
                    <Star className="w-3 h-3" /> Most Popular
                  </Badge>
                )}
                <CardHeader className="pb-2 text-center">
                  <div className="mx-auto mb-3 w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(212,175,55,0.1)" }}>
                    <Icon className="w-6 h-6" style={{ color: "#D4AF37" }} />
                  </div>
                  <CardTitle className="text-xl font-bold text-foreground">{t.name}</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">{t.subtitle}</CardDescription>
                  <div className="mt-3">
                    <span className="text-4xl font-bold" style={{ color: "#D4AF37" }}>{t.price}</span>
                    <span className="text-sm text-muted-foreground ml-1">{t.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 pt-4">
                  <ul className="space-y-3 mb-8 flex-1">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#D4AF37" }} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full font-semibold border-0"
                    style={
                      t.popular
                        ? { background: "linear-gradient(90deg, #D4AF37, #8B6914)", color: "#0D1B2A" }
                        : { background: "rgba(212,175,55,0.12)", color: "#D4AF37", border: "1px solid rgba(212,175,55,0.3)" }
                    }
                    onClick={() => navigate("/app")}
                  >
                    {t.cta}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-6" style={{ color: "#D4AF37" }}>Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border-b" style={{ borderColor: "hsl(210 20% 20%)" }}>
                <AccordionTrigger className="text-left text-sm text-foreground">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </main>

      <HomeFooter />
    </div>
  );
};

export default Pricing;
