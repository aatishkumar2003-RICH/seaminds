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

const testimonials = [
  { flag: "🇵🇭", name: "A.R.", rank: "AB Seaman · Philippines", quote: "When I am sad at sea I have nobody to talk to. My captain will think I am weak." },
  { flag: "🇮🇳", name: "R.K.", rank: "Chief Officer · India", quote: "My certificate is good but companies don't trust it. I needed a way to prove I am better than my CV." },
  { flag: "🇮🇩", name: "S.W.", rank: "Catering Officer · Indonesia", quote: "Eight months away from my children. The loneliness is something nobody on land understands." },
  { flag: "🇻🇳", name: "N.V.H.", rank: "Engineer · Vietnam", quote: "I paid a recruitment fee I should never have paid. The system was against me from the start." },
  { flag: "🇺🇦", name: "D.M.", rank: "Master · Ukraine", quote: "Good mental health means safe ships. Nobody was connecting these two things before SeaMinds." },
  { flag: "🇲🇲", name: "K.T.", rank: "Bosun · Myanmar", quote: "I wanted to improve my skills but had no way to show companies I had improved. Now I do." },
];

const nations = "🇵🇭 Philippines · 🇮🇳 India · 🇮🇩 Indonesia · 🇻🇳 Vietnam · 🇺🇦 Ukraine · 🇳🇬 Nigeria · 🇲🇲 Myanmar · 🇨🇳 China · 🇷🇺 Russia · 🇬🇭 Ghana · and 25 more nations";

const TestimonialsSection = () => {
  const headerRef = useScrollFade();
  const gridRef = useScrollFade();

  return (
    <section id="testimonials" className="py-12 md:py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div ref={headerRef} className="fade-in-on-scroll text-center mb-8">
          <p className="text-xs uppercase tracking-[0.3em] text-primary font-semibold mb-2">
            Built With Seafarers, For Seafarers
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            1,000+ Crew From 35 Countries Were Consulted Before We Built This.
          </h2>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            We didn't build SeaMinds in an office. We listened to seafarers in the Philippines, India, Indonesia, Vietnam, Ukraine, Nigeria, Myanmar and beyond. These are their words.
          </p>
        </div>

        <div ref={gridRef} className="fade-in-on-scroll grid md:grid-cols-2 gap-3 mb-6">
          {testimonials.map((t) => (
            <div key={t.name} className="glass-card rounded-xl p-4 flex gap-3 items-start">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0 text-lg">
                {t.flag}
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-sm font-semibold text-foreground">{t.name}</span>
                  <span className="text-xs text-muted-foreground">{t.rank}</span>
                </div>
                <p className="text-sm text-foreground/80 italic leading-relaxed">"{t.quote}"</p>
              </div>
            </div>
          ))}
        </div>

        <div className="glass-card rounded-xl px-4 py-3 text-center">
          <p className="text-xs text-muted-foreground leading-relaxed">{nations}</p>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
