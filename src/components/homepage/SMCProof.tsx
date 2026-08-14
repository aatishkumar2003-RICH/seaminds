import { useInView } from "@/hooks/useInView";

const DIMENSIONS = [
  { label: "Technical", value: 4.3 },
  { label: "Judgment", value: 4.1 },
  { label: "English", value: 4.0 },
  { label: "Behaviour", value: 4.2 },
];

const SMCProof = () => {
  const [ref, inView] = useInView<HTMLDivElement>(0.25);

  return (
    <section ref={ref} className="relative py-12 sm:py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center leading-tight mb-8">
          Your CV Tells Your History.
          <br />
          Your SMC Shows Your Competency.
        </h2>

        <div className="grid gap-8 md:grid-cols-2 items-center">
          <div className="flex flex-col gap-4">
            <div
              className="rounded-2xl px-4 py-3"
              style={{
                border: "1px solid rgba(212,175,55,0.3)",
                background: "rgba(17,34,64,0.6)",
              }}
            >
              <p className="text-[10px] uppercase tracking-[0.25em] text-primary font-mono-score mb-1">
                For Crew
              </p>
              <p className="text-sm text-muted-foreground">
                Don't only tell companies you're capable — show structured evidence of your
                knowledge.
              </p>
            </div>
            <div
              className="rounded-2xl px-4 py-3"
              style={{
                border: "1px solid rgba(212,175,55,0.3)",
                background: "rgba(17,34,64,0.6)",
              }}
            >
              <p className="text-[10px] uppercase tracking-[0.25em] text-primary font-mono-score mb-1">
                For Managers
              </p>
              <p className="text-sm text-muted-foreground">
                See structured competency signals before deciding who deserves your time.
              </p>
            </div>
          </div>

          <div
            className="rounded-3xl p-6 backdrop-blur-md mx-auto w-full max-w-sm"
            style={{
              border: "1px solid rgba(212,175,55,0.35)",
              background: "rgba(17,34,64,0.75)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.25em] text-primary/70 font-mono-score mb-2">
              SeaMinds Command Score
            </p>
            <p className="text-3xl font-bold text-primary font-mono-score mb-5">
              SMC 4.18 · STRONG
            </p>
            <div className="flex flex-col gap-3">
              {DIMENSIONS.map((d) => (
                <div key={d.label}>
                  <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                    <span>{d.label}</span>
                    <span className="font-mono-score text-primary">{d.value.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-primary/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: inView ? `${(d.value / 5) * 100}%` : "0%",
                        background: "linear-gradient(90deg, #C5941F, #D4AF37)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SMCProof;
