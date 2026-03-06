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

  return (
    <section id="testimonials" className="py-12 md:py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div ref={headerRef} className="fade-in-on-scroll text-center mb-8">
          <p className="text-xs uppercase tracking-[0.3em] text-primary font-semibold mb-2">
            How SeaMinds Was Born
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Not Built in a Boardroom. Built From 12 Months of Listening.
          </h2>
          <div className="max-w-3xl mx-auto space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              SeaMinds was conceived by a coalition of maritime professionals — ITF-affiliated inspectors, Flag State surveyors, Classification Society surveyors, and freelance Port State Control inspectors — who spent decades witnessing the same problems repeat across every ocean. They partnered with AI engineers and platform architects with one brief: build what seafarers actually need.
            </p>
            <p>
              Before a single line of code was written, the team conducted 12 months of structured research. Over 10,000 seafarers across 35 countries were consulted through surveys, WhatsApp groups, maritime forums, port welfare centre interviews, and direct conversations in Singapore, Rotterdam, Manila, Mumbai and Jakarta. HR personnel from major shipping companies, crewing agencies, and mental health NGOs including Mission to Seafarers and ISWAN contributed insights.
            </p>
            <p>
              Four needs emerged from every response regardless of rank, nationality or vessel type: private mental health support with no company visibility, a portable verified competency score, protection from recruitment exploitation, and reliable family connection at sea. Every feature in SeaMinds traces directly to those four needs. This is not a product someone invented. It is a platform 10,000 seafarers asked for.
            </p>
          </div>
        </div>

        {/* Stat Cards */}
        <div ref={statsRef} className="fade-in-on-scroll grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {stats.map((s) => (
            <div key={s.label} className="glass-card rounded-xl p-4 text-center">
              <div className="text-2xl md:text-3xl font-bold font-mono-score text-primary mb-1">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Auto-scrolling Ticker */}
        <div className="overflow-hidden mb-4" ref={emblaRef}>
          <div className="flex gap-4">
            {tickerQuotes.map((q, i) => (
              <div
                key={i}
                className={`rounded-xl px-5 py-4 min-w-[340px] max-w-[380px] shrink-0 border border-primary/20 border-l-4 bg-[#0D1B2A] ${borderColors[q.country]}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{q.flag}</span>
                  <span className="text-sm font-semibold text-primary">{q.name}</span>
                  <span className="text-xs text-primary/60">·</span>
                  <span className="text-xs text-muted-foreground">{q.rank}</span>
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed italic">"{q.quote}"</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom line */}
        <p className="text-center text-xs text-primary font-medium italic">
          Built with the maritime community. For the maritime community.
        </p>
      </div>
    </section>
  );
};

export default TestimonialsSection;
