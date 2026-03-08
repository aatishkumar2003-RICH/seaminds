import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import HomeNav from "@/components/homepage/HomeNav";
import HomeFooter from "@/components/homepage/HomeFooter";

const benefits = [
  { icon: "🎓", title: "Free for All Cadets", desc: "First 1,000 SMC assessments are completely free. No cost to your institution or students." },
  { icon: "📜", title: "Recognised Certificate", desc: "PDF certificate with QR verification. Cadets add it to their CV immediately." },
  { icon: "📊", title: "Batch Dashboard", desc: "Track your entire graduating batch's competency scores in one view." },
];

const steps = [
  "Email us your institution details — we set up a college code in 24 hours",
  "Share the code with your batch via WhatsApp or notice board",
  "Students register free, complete SMC, download certificates",
];

const countries = ["India", "Philippines", "Indonesia", "Malaysia", "Vietnam", "Pakistan", "Bangladesh", "Sri Lanka"];

const CollegePage = () => {
  useEffect(() => { document.title = "SeaMinds — For Maritime Colleges"; }, []);

  return (
    <div className="min-h-screen animated-gradient-bg text-foreground">
      <HomeNav />

      {/* Hero */}
      <section className="pt-28 pb-16 px-6 text-center max-w-3xl mx-auto">
        <span
          className="inline-block rounded-full px-4 py-1.5 text-xs font-semibold tracking-widest text-primary mb-6"
          style={{ border: "1px solid hsl(var(--primary) / 0.5)", background: "hsl(var(--primary) / 0.08)" }}
        >
          FOR MARITIME INSTITUTIONS
        </span>
        <h1 className="text-3xl font-bold text-foreground mb-4 max-w-2xl mx-auto leading-tight">
          Give Every Graduate a Verified Competency Score Before Their First Contract
        </h1>
        <p className="text-muted-foreground text-sm max-w-xl mx-auto mb-8">
          SeaMinds SMC certification is free for graduating cadets. Partner with us and your students leave with a recognised score on their CV.
        </p>
        <Button
          size="lg"
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-8"
          onClick={() => window.location.href = "mailto:info@indossol.com?subject=College Partnership - SeaMinds"}
        >
          Partner With SeaMinds — Free
        </Button>
      </section>

      {/* Benefits */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="rounded-2xl p-6 transition-colors"
              style={{ background: "hsl(var(--navy-deep) / 0.6)", border: "1px solid hsl(var(--primary) / 0.15)" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "hsl(var(--primary) / 0.4)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "hsl(var(--primary) / 0.15)")}
            >
              <span className="text-3xl block mb-3">{b.icon}</span>
              <h3 className="text-foreground font-semibold mb-1">{b.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-3xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">How It Works</h2>
        <div className="space-y-6">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-4 items-start">
              <span className="text-3xl font-bold text-primary opacity-30 font-mono-score shrink-0 w-10">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="text-foreground text-sm pt-1">{step}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Partner countries */}
      <section className="max-w-3xl mx-auto px-6 py-12 text-center">
        <h3 className="text-lg font-semibold text-foreground mb-4">Join institutions from:</h3>
        <p className="text-muted-foreground text-sm">
          {countries.join(" · ")}
        </p>
      </section>

      {/* Footer CTA */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl font-bold text-foreground mb-4">Ready to partner?</h2>
        <Button
          size="lg"
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 mb-3"
          onClick={() => window.location.href = "mailto:info@indossol.com?subject=College Partnership - SeaMinds"}
        >
          info@indossol.com
        </Button>
        <p className="text-xs text-muted-foreground">We respond within 24 hours</p>
      </section>

      <HomeFooter />
    </div>
  );
};

export default CollegePage;
