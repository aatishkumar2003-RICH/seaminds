import { useNavigate } from "react-router-dom";
import { Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import HomeNav from "@/components/homepage/HomeNav";
import HomeFooter from "@/components/homepage/HomeFooter";
import { useEffect } from "react";

const tiers = [
  {
    name: "Crew Free",
    price: "$0",
    period: "forever",
    features: [
      "AI wellness chat (5 conversations/month)",
      "Mood tracking",
      "Community access",
      "Maritime news",
      "Basic job board access",
    ],
    cta: "Get Started Free",
    popular: false,
  },
  {
    name: "Crew Pro",
    price: "$9",
    period: "per month",
    features: [
      "Unlimited AI wellness conversations",
      "SMC Self-Assessment ($29 value — included)",
      "Full Academy access",
      "Priority job matching",
      "Family connection portal",
      "Rest hours tracker",
      "Anonymous safety reporting",
      "SOS emergency support 24/7",
    ],
    cta: "Start 14-Day Free Trial",
    popular: true,
  },
  {
    name: "Company Starter",
    price: "$199",
    period: "per month",
    features: [
      "Up to 50 crew members",
      "Manager wellness dashboard",
      "Crew SMC score verification",
      "Bulk assessment tools",
      "PSC inspection readiness reports",
      "Priority support",
    ],
    cta: "Request Demo",
    popular: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "pricing",
    features: [
      "Unlimited crew",
      "Full fleet wellness analytics",
      "Custom SMC assessment programs",
      "API integration with crew management systems",
      "Dedicated account manager",
      "White-label options available",
      "MLC 2006 compliance reporting",
    ],
    cta: "Contact Us",
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
    <div className="min-h-screen bg-background text-foreground">
      <HomeNav />

      <main className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto text-center mb-14">
          <h1 className="text-3xl sm:text-4xl font-bold gold-glow mb-3">Simple, Transparent Pricing</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Whether you're a seafarer looking after your wellbeing or a company managing a fleet — there's a plan for you.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {tiers.map((t) => (
            <Card
              key={t.name}
              className={`relative flex flex-col ${t.popular ? "border-primary ring-1 ring-primary" : ""}`}
            >
              {t.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground gap-1">
                  <Star className="w-3 h-3" /> Most Popular
                </Badge>
              )}
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase tracking-wider">{t.name}</CardDescription>
                <CardTitle className="text-3xl font-bold">
                  {t.price}
                  <span className="text-sm font-normal text-muted-foreground ml-1">{t.period}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col flex-1">
                <ul className="space-y-2 mb-6 flex-1">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={t.popular ? "default" : "outline"}
                  onClick={() => navigate("/app")}
                >
                  {t.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center gold-glow mb-6">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-sm">{f.q}</AccordionTrigger>
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
