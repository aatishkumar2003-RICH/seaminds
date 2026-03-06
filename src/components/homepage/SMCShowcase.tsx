import { useNavigate } from "react-router-dom";
import { ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import seamindsLogo from "@/assets/seaminds-logo.png";

const subScores = [
  { label: "Technical Competence", score: 4.5 },
  { label: "Experience Integrity", score: 4.2 },
  { label: "Communication Ability", score: 3.9 },
  { label: "Behavioural Profile", score: 4.3 },
  { label: "Wellness Consistency", score: 4.1 },
];

const bullets = [
  "Verified in 45 minutes on your phone",
  "Portable across all employers forever",
  "Bid on salary — companies compete for you",
  "Free for first 1,000 crew members",
];

const SMCShowcase = () => {
  const navigate = useNavigate();

  return (
    <section id="smc-score" className="py-20 md:py-28 relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(32 45% 12%) 0%, hsl(32 30% 8%) 100%)" }}>
      <div className="absolute inset-0 opacity-10" style={{ background: "radial-gradient(circle at 30% 50%, hsl(32 45% 64%) 0%, transparent 50%)" }} />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Certificate preview */}
          <div className="flex justify-center">
            <div className="rounded-2xl border border-primary/20 bg-card/80 backdrop-blur p-8 md:p-10 max-w-sm w-full">
              <div className="flex items-center justify-center gap-2 mb-1">
                <img src={seamindsLogo} alt="SeaMinds" className="w-5 h-5" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-primary font-semibold">SeaMinds Certified Score</span>
              </div>
              <div className="text-[72px] font-bold text-primary score-glow leading-none my-3 tabular-nums text-center">
                4.21
              </div>
              <div className="text-sm uppercase tracking-[0.3em] text-primary font-bold mb-6 text-center">Expert</div>

              <div className="space-y-3">
                {subScores.map((s) => (
                  <div key={s.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className="text-primary font-semibold">{s.score.toFixed(2)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(s.score / 5) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-border text-center">
                <p className="text-[10px] text-muted-foreground">Certificate ID: SMC-421-ME-2026</p>
              </div>
            </div>
          </div>

          {/* Copy */}
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
              Your Score. Your Career.
              <br />
              <span className="text-primary gold-glow">Your Power.</span>
            </h2>

            <ul className="space-y-4 mb-8">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-foreground">{b}</span>
                </li>
              ))}
            </ul>

            <Button size="lg" onClick={() => window.location.href = '/app'} className="text-base px-8 h-12">
              Claim Your Free Assessment <ChevronRight className="ml-1 w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SMCShowcase;
