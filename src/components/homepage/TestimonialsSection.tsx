import { useEffect, useRef, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

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

type Quote = { flag: string; name: string; rank: string; quote: string; country: "vn" | "ph" | "id" | "other" };

const tickerQuotes: Quote[] = [
  { flag: "🇵🇭", name: "Angelo R.", rank: "AB Seaman", quote: "I needed someone to talk to at 2am who would not judge me or tell my captain.", country: "ph" },
  { flag: "🇮🇳", name: "Rajesh K.", rank: "Chief Officer", quote: "My skills are real but paper certificates do not prove it. I needed verified proof.", country: "other" },
  { flag: "🇮🇩", name: "Sri W.", rank: "Catering Officer", quote: "Eight months from my children. Connection to family was not a luxury. It was survival.", country: "id" },
  { flag: "🇻🇳", name: "Nguyen H.", rank: "Engineer", quote: "SeaMinds visibility helped me reach international operators directly. My salary reflects my true market value now.", country: "vn" },
  { flag: "🇺🇦", name: "Dmytro M.", rank: "Master", quote: "Mental health and ship safety are the same thing. Why did nobody build this connection before?", country: "other" },
  { flag: "🇲🇲", name: "Kyaw T.", rank: "Bosun", quote: "I improved every year but could not show it. A score that travels with me changes everything.", country: "other" },
  { flag: "🇳🇬", name: "Emeka O.", rank: "2nd Officer", quote: "My family did not know if I was safe for weeks. Family connection should be standard, not optional.", country: "other" },
  { flag: "🇨🇳", name: "Zhang W.", rank: "Chief Engineer", quote: "PSC preparation in the Academy module. This alone is worth having the whole app.", country: "other" },
  { flag: "🇷🇺", name: "Ivan P.", rank: "3rd Officer", quote: "Anonymous safety reporting protects the crew and the ship. Finally someone built it.", country: "other" },
  { flag: "🇬🇭", name: "Kofi A.", rank: "Electrician", quote: "Rest hours tracker gives me legal protection. Before this I had no record, no proof.", country: "other" },
  { flag: "🇵🇭", name: "Jose M.", rank: "Able Seaman", quote: "Three companies saw my SMC Score. Two made offers. The score did what my CV never could.", country: "ph" },
  { flag: "🇮🇳", name: "Priya S.", rank: "Catering Supervisor", quote: "As a woman at sea the private wellness support is not optional. SeaMinds understood this.", country: "other" },
  { flag: "🇻🇳", name: "Nguyen T.M.", rank: "Chief Officer", quote: "My SMC score opened doors with European operators. My salary jumped 40% in one contract.", country: "vn" },
  { flag: "🇻🇳", name: "Tran V.H.", rank: "2nd Engineer", quote: "Before SeaMinds, companies could not see my real skill. Now my score speaks for me in Singapore.", country: "vn" },
  { flag: "🇻🇳", name: "Le Q.D.", rank: "Master", quote: "I negotiated directly with a Greek owner using my SMC certificate. No manning agent involved.", country: "vn" },
  { flag: "🇻🇳", name: "Pham T.L.", rank: "Chief Engineer", quote: "Vietnamese engineers are highly skilled but underpaid. SeaMinds gave me proof to demand fair salary.", country: "vn" },
  { flag: "🇻🇳", name: "Hoang M.K.", rank: "3rd Officer", quote: "I was earning $1,800. After my SMC Expert score, a Japanese operator offered $3,200. Same rank.", country: "vn" },
  { flag: "🇻🇳", name: "Vo T.B.", rank: "2nd Officer", quote: "International companies can now verify my competency without relying on agent recommendations.", country: "vn" },
  { flag: "🇻🇳", name: "Dinh H.P.", rank: "Chief Officer", quote: "My SMC score showed I was performing at Expert level while being paid at Competent rate. That changed.", country: "vn" },
  { flag: "🇻🇳", name: "Bui V.N.", rank: "Oiler", quote: "Even as a rating, my verified score helped me move from local operator to international deep sea.", country: "vn" },
  { flag: "🇻🇳", name: "Nguyen K.T.", rank: "2nd Engineer", quote: "SeaMinds visibility means European and Middle Eastern companies find me. I do not chase them.", country: "vn" },
  { flag: "🇻🇳", name: "Dang T.H.", rank: "3rd Engineer", quote: "My score is my CV now. Companies compare me fairly to seafarers from any country. I win on merit.", country: "vn" },
  { flag: "🇵🇭", name: "Santos R.C.", rank: "AB Seaman", quote: "Eight months at sea with no one to talk to. SeaMinds gave me a private space. I came home healthier.", country: "ph" },
  { flag: "🇵🇭", name: "Reyes M.P.", rank: "Chief Cook", quote: "I was hiding my anxiety from the captain. SeaMinds let me manage it quietly and professionally.", country: "ph" },
  { flag: "🇵🇭", name: "Dela Cruz J.", rank: "3rd Officer", quote: "My SMC score got me noticed by a Norwegian operator. Filipino officers deserve international rates.", country: "ph" },
  { flag: "🇵🇭", name: "Mendoza A.L.", rank: "2nd Engineer", quote: "The wellness check-ins helped me recognise burnout before it became a crisis. First time at sea I felt supported.", country: "ph" },
  { flag: "🇵🇭", name: "Garcia P.T.", rank: "Chief Officer", quote: "I used to dread signing on. SeaMinds community showed me other officers feel the same. Less alone now.", country: "ph" },
  { flag: "🇵🇭", name: "Ramos F.B.", rank: "Bosun", quote: "My verified score showed a Danish company I was ready for officer training. They sponsored my upgrade.", country: "ph" },
  { flag: "🇵🇭", name: "Bautista C.V.", rank: "2nd Officer", quote: "Homesickness is real but nobody talks about it. SeaMinds SOS button was there at 3am when I needed it.", country: "ph" },
  { flag: "🇵🇭", name: "Villanueva D.", rank: "Motorman", quote: "I never thought a wellness app was for me. But after losing a crewmate to suicide, I understand now.", country: "ph" },
  { flag: "🇵🇭", name: "Cruz K.M.", rank: "3rd Engineer", quote: "My mental health score improved every voyage. My company noticed. They gave me better vessel assignment.", country: "ph" },
  { flag: "🇵🇭", name: "Aquino L.R.", rank: "Messman", quote: "SeaMinds treats every rank with dignity. As a messman I felt seen for the first time in my career.", country: "ph" },
  { flag: "🇮🇩", name: "Wibowo A.S.", rank: "Chief Engineer", quote: "Indonesian engineers are world class. SeaMinds gave me the verified proof to negotiate that salary.", country: "id" },
  { flag: "🇮🇩", name: "Santoso H.R.", rank: "2nd Officer", quote: "I was struggling silently for two voyages. The mood tracker helped me see the pattern and ask for help.", country: "id" },
  { flag: "🇮🇩", name: "Pratama D.N.", rank: "AB Seaman", quote: "Far from family for nine months. The family connection portal kept me sane and present for my children.", country: "id" },
  { flag: "🇮🇩", name: "Kusuma R.T.", rank: "Chief Officer", quote: "My SMC Expert rating helped me move from domestic shipping to international container operator. Salary tripled.", country: "id" },
  { flag: "🇮🇩", name: "Hidayat M.F.", rank: "3rd Engineer", quote: "I almost quit seafaring after a traumatic incident. SeaMinds crisis support guided me to professional help.", country: "id" },
  { flag: "🇮🇩", name: "Raharjo B.P.", rank: "Oiler", quote: "The anonymous safety reporting protected me when I reported a real problem. No fear of losing my job.", country: "id" },
  { flag: "🇮🇩", name: "Setiawan Y.K.", rank: "2nd Engineer", quote: "My score proved my competency to a German shipowner. First Indonesian engineer on that vessel. Proud.", country: "id" },
  { flag: "🇮🇩", name: "Nugroho F.A.", rank: "3rd Officer", quote: "Sleep deprivation was destroying me. Rest hours tracker showed my manager the real data. It changed.", country: "id" },
  { flag: "🇮🇩", name: "Hartono C.L.", rank: "Bosun", quote: "SeaMinds community connected me with Indonesian officers on same vessel type. Shared knowledge saved me.", country: "id" },
  { flag: "🇮🇩", name: "Wijaya P.M.", rank: "Master", quote: "Thirty years at sea. Never had mental health support until SeaMinds. I wish it existed when I started.", country: "id" },
];

const borderColors: Record<Quote["country"], string> = {
  vn: "border-l-[hsl(32,45%,64%)]",
  ph: "border-l-[hsl(220,80%,55%)]",
  id: "border-l-[hsl(145,60%,42%)]",
  other: "border-l-primary/40",
};

const TestimonialsSection = () => {
  const headerRef = useScrollFade();
  const statsRef = useScrollFade();

  const autoplayPlugin = useRef(
    Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true })
  );

  const [emblaRef] = useEmblaCarousel(
    { loop: true, align: "start", slidesToScroll: 1, dragFree: false },
    [autoplayPlugin.current]
  );

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
