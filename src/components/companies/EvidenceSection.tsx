import { useInView } from "@/hooks/useInView";

const CARDS = [
  {
    title: "⚓ Sea Profiles",
    desc: "Structured rank, vessel and inspection experience in a comparable format.",
  },
  {
    title: "🎯 AI Interviews",
    desc: "Every candidate scored 0.00–5.00 on Technical, Judgment, English and Behaviour by rank and vessel type.",
  },
  {
    title: "🔒 Privacy-clean",
    desc: "You see professional data with crew consent; wellness is sealed and never part of scoring.",
  },
];

const EvidenceSection = () => {
  const [ref, inView] = useInView<HTMLDivElement>();

  return (
    <section className="py-14 md:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
          Hire on Evidence, Not Formatting.
        </h2>
        <div ref={ref} className="grid gap-4 md:grid-cols-3">
          {CARDS.map((c, i) => (
            <div
              key={c.title}
              className="rounded-2xl p-5 backdrop-blur-md transition-all duration-700"
              style={{
                background: "rgba(17,34,64,0.75)",
                border: "1px solid rgba(212,175,55,0.3)",
                opacity: inView ? 1 : 0,
                transform: inView ? "translateY(0)" : "translateY(12px)",
                transitionDelay: `${i * 150}ms`,
              }}
            >
              <p className="text-sm font-bold mb-2" style={{ color: "#D4AF37" }}>
                {c.title}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "#94A3B8" }}>
                {c.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default EvidenceSection;
