import { Anchor, Heart, Home } from "lucide-react";

const stats = [
  { icon: Anchor, stat: "1 in 4", desc: "seafarers experiences depression at sea" },
  { icon: Heart, stat: "20%", desc: "report suicidal thoughts during voyages" },
  { icon: Home, stat: "8 months", desc: "average time away from family per year" },
];

const ProblemSection = () => (
  <section id="problem" className="py-20 md:py-28" style={{ background: "hsl(0 0% 97%)" }}>
    <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
      <h2 className="text-3xl md:text-4xl font-bold mb-14" style={{ color: "hsl(220 55% 6%)" }}>
        The Reality Nobody Talks About.
      </h2>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {stats.map((s) => (
          <div key={s.stat} className="rounded-xl p-8 text-center" style={{ background: "hsl(220 55% 6%)" }}>
            <s.icon className="w-8 h-8 text-primary mx-auto mb-4" />
            <div className="text-4xl font-bold text-foreground mb-2">{s.stat}</div>
            <p className="text-muted-foreground text-sm">{s.desc}</p>
          </div>
        ))}
      </div>

      <p className="text-base max-w-2xl mx-auto" style={{ color: "hsl(220 30% 30%)" }}>
        SeaMinds exists because these numbers are unacceptable. And because nobody was doing anything about it.
      </p>
    </div>
  </section>
);

export default ProblemSection;
