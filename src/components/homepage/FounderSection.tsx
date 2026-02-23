import { useEffect, useRef } from "react";

const useScrollFade = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) el.classList.add("visible"); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
};

const stats = [
  { value: "10,000+", label: "Seafarers Consulted" },
  { value: "35+", label: "Countries Represented" },
  { value: "12 Months", label: "Research Period" },
  { value: "4", label: "Core Needs That Drive Every Feature" },
];

const FounderSection = () => {
  const ref = useScrollFade();

  return (
    <section className="py-16 md:py-24 bg-background">
      <div ref={ref} className="fade-in-on-scroll max-w-3xl mx-auto px-4 sm:px-6">
        <p className="text-xs uppercase tracking-[0.3em] text-primary font-semibold mb-3 text-center">
          How SeaMinds Was Born
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-8">
          Not Built in a Boardroom. Built From 12 Months of Listening.
        </h2>

        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed mb-10">
          <p>
            SeaMinds was conceived by a coalition of maritime professionals — including ITF-affiliated inspectors, Flag State surveyors, Classification Society surveyors, and freelance Port State Control inspectors — who spent decades witnessing the same problems repeat across every ocean. They approached Anthropic-trained AI engineers and platform architects with a single brief: <span className="text-foreground font-medium">build what seafarers actually need.</span>
          </p>
          <p>
            Before a single line of code was written, the team conducted 12 months of structured research. Over 10,000 seafarers across 35 countries were consulted — through surveys, WhatsApp groups, maritime forums, port welfare centre interviews, and direct conversations aboard vessels in Singapore, Rotterdam, Manila, Mumbai and Jakarta. HR personnel from major shipping companies and crewing agencies were interviewed. Mental health NGOs working with seafarers including Mission to Seafarers and ISWAN contributed insights. The ITF provided access to their global crew welfare network.
          </p>
          <p>
            Four needs emerged from every single response regardless of rank, nationality or vessel type: private mental health support with no company visibility, a portable verified competency score, protection from recruitment exploitation, and reliable family connection at sea. <span className="text-foreground font-medium">Every feature in SeaMinds traces directly to those four needs.</span> This is not a product someone invented. It is a platform 10,000 seafarers asked for.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="glass-card rounded-xl p-4 text-center">
              <div className="text-2xl md:text-3xl font-bold font-mono-score text-primary mb-1">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-primary italic">
          Built with the maritime community. For the maritime community.
        </p>
      </div>
    </section>
  );
};

export default FounderSection;
