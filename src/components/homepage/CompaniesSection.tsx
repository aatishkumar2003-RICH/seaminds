import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, BarChart3, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const CompaniesSection = () => {
  const navigate = useNavigate();
  const [companyPrice, setCompanyPrice] = useState(0);

  useEffect(() => {
    supabase.rpc('get_admin_settings', { p_keys: ['price_company_annual'] })
      .then(({ data }) => { if (data?.[0]?.value) setCompanyPrice(Number(data[0].value)); });
  }, []);

  const benefits = [
    { icon: ShieldCheck, title: "Assess Before You Hire", desc: "Access AI-assessed competency scores before the interview." },
    { icon: BarChart3, title: "Reduce PSC Risk", desc: "Hire crew with assessed technical knowledge scores and structured SIRE 2.0 preparation." },
    { icon: Package, title: "Founding Company Access", desc: "Full platform access, free, for a limited group of founding companies during launch." },
  ];

  return (
    <section id="companies" className="py-20 md:py-28" style={{ background: "hsl(0 0% 97%)" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: "hsl(220 55% 6%)" }}>
          Better Crew. Less Risk. Lower Cost.
        </h2>
        <p className="mb-14 max-w-xl mx-auto" style={{ color: "hsl(220 20% 40%)" }}>
          The SMC Score gives shipping companies a structured data layer for every hire.
        </p>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {benefits.map((b) => (
            <div key={b.title} className="rounded-xl p-6 text-left border" style={{ background: "white", borderColor: "hsl(220 20% 90%)" }}>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ background: "hsl(32 45% 64% / 0.1)" }}>
                <b.icon className="w-6 h-6" style={{ color: "hsl(32 45% 50%)" }} />
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: "hsl(220 55% 6%)" }}>{b.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "hsl(220 20% 40%)" }}>{b.desc}</p>
            </div>
          ))}
        </div>

        <Button size="lg" onClick={() => navigate('/for-companies')} className="text-base px-8 h-12">
          Request Company Demo
        </Button>
      </div>
    </section>
  );
};

export default CompaniesSection;
