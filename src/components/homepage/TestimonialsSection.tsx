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
  { value: "12", label: "Months of Research" },
  { value: "4", label: "Core Needs Identified" },
];

const tickerQuotes = [
  { flag: "🇵🇭", name: "Angelo R.", rank: "AB Seaman", quote: "I needed someone to talk to at 2am who would not judge me or tell my captain." },
  { flag: "🇮🇳", name: "Rajesh K.", rank: "Chief Officer", quote: "My skills are real but paper certificates do not prove it. I needed verified proof." },
  { flag: "🇮🇩", name: "Sri W.", rank: "Catering Officer", quote: "Eight months from my children. Connection to family was not a luxury. It was survival." },
  { flag: "🇻🇳", name: "Nguyen H.", rank: "Engineer", quote: "I paid illegal recruitment fees twice. Transparency in hiring would have protected me." },
  { flag: "🇺🇦", name: "Dmytro M.", rank: "Master", quote: "Mental health and ship safety are the same thing. Why did nobody build this connection before?" },
  { flag: "🇲🇲", name: "Kyaw T.", rank: "Bosun", quote: "I improved every year but could not show it. A score that travels with me changes everything." },
  { flag: "🇳🇬", name: "Emeka O.", rank: "2nd Officer", quote: "My family did not know if I was safe for weeks. Family connection should be standard, not optional." },
  { flag: "🇨🇳", name: "Zhang W.", rank: "Chief Engineer", quote: "PSC preparation in the Academy module. This alone is worth having the whole app." },
  { flag: "🇷🇺", name: "Ivan P.", rank: "3rd Officer", quote: "Anonymous safety reporting protects the crew and the ship. Finally someone built it." },
  { flag: "🇬🇭", name: "Kofi A.", rank: "Electrician", quote: "Rest hours tracker gives me legal protection. Before this I had no record, no proof." },
  { flag: "🇵🇭", name: "Jose M.", rank: "Able Seaman", quote: "Three companies saw my SMC Score. Two made offers. The score did what my CV never could." },
  { flag: "🇮🇳", name: "Priya S.", rank: "Catering Supervisor", quote: "As a woman at sea the private wellness support is not optional. SeaMinds understood this." },
];

const TestimonialsSection = () => {
  const headerRef = useScrollFade();
  const statsRef = useScrollFade();
  const tickerRef = useRef<HTMLDivElement>(null);

  // Pause on hover
  const handleMouseEnter = () => {
    tickerRef.current?.style.setProperty("--ticker-play", "paused");
  };
  const handleMouseLeave = () => {
    tickerRef.current?.style.setProperty("--ticker-play", "running");
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
        <div
          className="overflow-hidden mb-4"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          ref={tickerRef}
          style={{ "--ticker-play": "running" } as React.CSSProperties}
        >
          <div className="flex animate-ticker gap-4 w-max">
            {[...tickerQuotes, ...tickerQuotes].map((q, i) => (
              <div
                key={i}
                className="rounded-xl px-5 py-4 min-w-[340px] max-w-[380px] shrink-0 border border-primary/40 bg-[#0D1B2A]"
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
