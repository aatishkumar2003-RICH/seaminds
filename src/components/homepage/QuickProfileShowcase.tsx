import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const CHIPS = [
  "Chief Officer",
  "Bulk Carrier · 5+ yrs",
  "5–8 yrs in rank",
  "RightShip ✓",
  "⚓ Sea Profile Ready",
];

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const QuickProfileShowcase = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const reduced = prefersReduced();
  const [step, setStep] = useState(reduced ? CHIPS.length : 0);

  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => {
      setStep((s) => (s >= CHIPS.length ? 0 : s + 1));
    }, 1200);
    return () => clearInterval(t);
  }, [reduced]);

  return (
    <section className="relative py-12 sm:py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 grid gap-8 md:grid-cols-2 items-center">
        <div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight mb-3">
            Start in 2 Minutes. Not 20 Pages.
          </h2>
          <p className="text-sm md:text-base text-muted-foreground mb-5 max-w-lg">
            Tap through your rank, vessels and experience. Apply for jobs and take your
            competency assessment — add your full CV and certificates later.
          </p>
          <Button
            size="lg"
            className="h-12 px-6 text-sm font-bold rounded-xl"
            onClick={() => navigate(user ? "/quick-profile" : "/app")}
          >
            Create your Sea Profile ⚓
          </Button>
        </div>

        <div className="flex justify-center">
          <div
            className="w-[260px] sm:w-[290px] rounded-3xl p-5 backdrop-blur-md"
            style={{
              background: "rgba(17,34,64,0.75)",
              border: "1px solid rgba(212,175,55,0.35)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
            }}
          >
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-primary/30" />
            <p className="text-[10px] uppercase tracking-[0.25em] text-primary/70 mb-3 font-mono-score">
              Sea Profile
            </p>
            <div className="flex flex-col gap-2.5">
              {CHIPS.map((chip, i) => {
                const lit = i < step;
                const isFinal = i === CHIPS.length - 1;
                return (
                  <div
                    key={chip}
                    className="rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-500"
                    style={{
                      border: `1px solid ${lit ? "rgba(212,175,55,0.7)" : "rgba(212,175,55,0.18)"}`,
                      background: lit
                        ? isFinal
                          ? "rgba(212,175,55,0.25)"
                          : "rgba(212,175,55,0.12)"
                        : "rgba(255,255,255,0.03)",
                      color: lit ? "#D4AF37" : "#94A3B8",
                      boxShadow:
                        lit && isFinal ? "0 0 22px rgba(212,175,55,0.45)" : "none",
                      opacity: lit ? 1 : 0.6,
                    }}
                  >
                    {chip}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default QuickProfileShowcase;
