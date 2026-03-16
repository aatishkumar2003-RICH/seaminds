import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const benefits = [
  { icon: "🛡️", title: "Verified Crew Before You Hire", desc: "SMC scores give you certified competency data before signing any contract. Reduce vetting time 70%." },
  { icon: "⏱", title: "MLC Compliance Dashboard", desc: "See rest hour compliance across your fleet. Audit-ready reports for Port State Control." },
  { icon: "📊", title: "Fleet Wellness Index", desc: "Anonymous aggregate wellness data per vessel. Spot problems before they become incidents." },
  { icon: "📜", title: "Certificate Expiry Alerts", desc: "Never sail with an uncertified crew member. Automated alerts 90/60/30 days before expiry." },
];

const features = [
  "Unlimited crew onboarding",
  "SMC score access for all crew",
  "MLC rest hours compliance reports",
  "Fleet wellness dashboard",
  "Certificate expiry tracking",
  "Priority support",
];

const CompaniesB2BSection = () => {
  const navigate = useNavigate();
  const [jobPrice, setJobPrice] = useState(0);

  useEffect(() => {
    supabase.from('admin_settings').select('value').eq('key', 'price_job_monthly').single()
      .then(({ data }) => { if (data?.value) setJobPrice(Number(data.value)); });
  }, []);

  return (
    <section id="companies" className="max-w-5xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-2">Built for Shipping Companies Too</h2>
        <p className="text-sm text-muted-foreground">One dashboard. Your entire fleet's wellness and competency — verified.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-12">
        <div className="space-y-6">
          {benefits.map((b) => (
            <div key={b.title} className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0 text-lg">
                {b.icon}
              </div>
              <div>
                <h3 className="text-foreground font-semibold mb-0.5">{b.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div>
          <div
            className="rounded-2xl p-8"
            style={{
              background: "hsl(var(--navy-deep) / 0.8)",
              border: "1px solid hsl(var(--primary))",
            }}
          >
            <p className="text-sm text-muted-foreground mb-1">Company Plan</p>
            <p className="text-3xl font-bold text-primary mb-1">
              {jobPrice === 0 ? 'Free' : '$' + jobPrice} <span className="text-base font-normal text-muted-foreground">/ vessel / month</span>
            </p>
            <p className="text-xs text-muted-foreground mb-6">Minimum 1 vessel. Cancel anytime.</p>

            <ul className="space-y-3 mb-8">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                  <span className="text-primary font-bold">✓</span>
                  {f}
                </li>
              ))}
            </ul>

            <Button
              size="lg"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => navigate('/for-companies')}
            >
              Request Demo
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Trusted by crew from Fleet Management Ltd, Anglo-Eastern, Synergy Marine and 35+ nationalities
          </p>
        </div>
      </div>
    </section>
  );
};

export default CompaniesB2BSection;
