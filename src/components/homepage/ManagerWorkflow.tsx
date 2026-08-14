import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInView, prefersReducedMotion } from "@/hooks/useInView";

const STEPS = [
  { n: "①", title: "VACANCY", detail: "Chief Officer · Bulk Carrier · 5+ yrs" },
  { n: "②", title: "MATCHES", detail: "22 relevant crew" },
  { n: "③", title: "SEA PROFILE", detail: "Bulk 8 yrs · Rank 5 yrs · Available · SMC 4.18" },
  { n: "④", title: "AI INTERVIEW", detail: "Technical 4.30 · Judgment 4.10 · English 4.00" },
  { n: "⑤", title: "SHORTLIST", detail: "3 candidates" },
];

const ManagerWorkflow = () => {
  const navigate = useNavigate();
  const [ref, inView] = useInView<HTMLDivElement>(0.15);
  const reduced = prefersReducedMotion();

  return (
    <section ref={ref} className="relative py-12 sm:py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-8">
          From Vacancy to Shortlist in One Workflow.
        </h2>

        <div className="flex flex-col md:flex-row md:items-stretch gap-3 md:gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.title} className="flex flex-col md:flex-row md:flex-1 items-center gap-2">
              <div
                className="w-full rounded-2xl px-4 py-4 backdrop-blur-sm transition-all duration-700"
                style={{
                  border: `1px solid ${inView ? "rgba(212,175,55,0.55)" : "rgba(212,175,55,0.15)"}`,
                  background: inView ? "rgba(17,34,64,0.75)" : "rgba(17,34,64,0.4)",
                  opacity: inView ? 1 : 0.45,
                  transform: inView ? "translateY(0)" : "translateY(10px)",
                  boxShadow: inView ? "0 10px 30px rgba(0,0,0,0.25)" : "none",
                  transitionDelay: reduced ? "0ms" : `${i * 400}ms`,
                }}
              >
                <div className="text-primary text-lg leading-none mb-1">{s.n}</div>
                <div className="text-[11px] font-bold tracking-[0.18em] text-primary font-mono-score mb-1">
                  {s.title}
                </div>
                <div className="text-xs text-muted-foreground leading-snug">{s.detail}</div>
              </div>
              {i < STEPS.length - 1 && (
                <span className="text-primary/70 text-lg select-none md:rotate-0 rotate-90">→</span>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            className="h-12 px-6 text-sm font-bold rounded-xl"
            onClick={() => navigate("/for-companies")}
          >
            Request Founding Company Access <ChevronRight className="ml-1 w-4 h-4" />
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ManagerWorkflow;
