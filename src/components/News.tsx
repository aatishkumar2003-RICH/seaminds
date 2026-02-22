import { useState } from "react";
import { Newspaper, ArrowRight, Globe, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

type CountryKey = "india" | "philippines" | "indonesia" | "ukraine" | "russia" | "china" | "myanmar" | "bangladesh" | "croatia" | "greece" | "uk" | "usa";

const COUNTRIES: { key: CountryKey; name: string; flag: string }[] = [
  { key: "india", name: "India", flag: "🇮🇳" },
  { key: "philippines", name: "Philippines", flag: "🇵🇭" },
  { key: "indonesia", name: "Indonesia", flag: "🇮🇩" },
  { key: "ukraine", name: "Ukraine", flag: "🇺🇦" },
  { key: "russia", name: "Russia", flag: "🇷🇺" },
  { key: "china", name: "China", flag: "🇨🇳" },
  { key: "myanmar", name: "Myanmar", flag: "🇲🇲" },
  { key: "bangladesh", name: "Bangladesh", flag: "🇧🇩" },
  { key: "croatia", name: "Croatia", flag: "🇭🇷" },
  { key: "greece", name: "Greece", flag: "🇬🇷" },
  { key: "uk", name: "United Kingdom", flag: "🇬🇧" },
  { key: "usa", name: "USA", flag: "🇺🇸" },
];

const COUNTRY_NEWS: Record<CountryKey, { headlines: { title: string; summary: string }[]; moreUrl: string; moreLabel: string }> = {
  india: {
    headlines: [
      { title: "Indian Elections 2025 — State Assembly Results", summary: "Maharashtra and Bihar state assemblies announced results this week. BJP alliance maintains majority in Maharashtra while Bihar sees close contest." },
      { title: "India Economy — GDP Growth 7.2% Forecast", summary: "IMF projects India as fastest growing major economy in 2025. Remittance flows from overseas workers hit record $125 billion." },
      { title: "Indian Seafarers — New DG Shipping Circular", summary: "Directorate General of Shipping issues updated guidelines on certificate renewal. Online processing now available for CDC renewals." },
      { title: "Mumbai Port Expansion — Phase 2 Approved", summary: "Government approves ₹15,000 crore expansion of Mumbai port facilities. New container terminal expected to double capacity by 2027." },
      { title: "India-UAE Maritime Corridor Agreement", summary: "India and UAE sign new bilateral maritime agreement. Faster customs clearance and crew change facilities for Indian seafarers in Dubai." },
    ],
    moreUrl: "https://ndtv.com",
    moreLabel: "ndtv.com",
  },
  philippines: {
    headlines: [
      { title: "OFW Remittances Hit Record $38 Billion", summary: "Bangko Sentral ng Pilipinas reports record remittances in 2024. Seafarers contribute 25% of total OFW remittances." },
      { title: "Philippine Elections 2025 — Midterm Campaign Begins", summary: "Campaign period opens for May 2025 midterm elections. Senate and local government positions contested nationwide." },
      { title: "POEA New Deployment Rules", summary: "Philippine Overseas Employment Administration issues updated deployment guidelines. New standard employment contracts for seafarers effective March 2025." },
      { title: "MARINA Certification Updates", summary: "Maritime Industry Authority streamlines STCW certification process. Online applications now accepted for certificate upgrades." },
      { title: "Typhoon Season Preparedness — PCG Advisory", summary: "Philippine Coast Guard issues early typhoon season advisory for 2025. Enhanced monitoring for vessels in Philippine waters." },
    ],
    moreUrl: "https://inquirer.net",
    moreLabel: "inquirer.net",
  },
  indonesia: {
    headlines: [
      { title: "Indonesia Economy — New Cabinet Economic Policies", summary: "President Prabowo's cabinet announces infrastructure investment program. Maritime sector receives priority funding allocation." },
      { title: "Indonesian Seafarers — BP2MI Updates", summary: "Agency for Protection of Indonesian Migrant Workers issues new certification requirements. Online registration portal launched for seafarers." },
      { title: "Tanjung Priok Port Modernisation", summary: "Jakarta's main port receives major upgrade to cargo handling systems. Turnaround time for vessels expected to decrease by 30%." },
      { title: "Indonesia Maritime Training Centres Expanded", summary: "Government opens five new maritime training centres across the archipelago. Focus on STCW compliance and advanced navigation skills." },
      { title: "Indonesia-Japan Seafarer Exchange Programme", summary: "New bilateral agreement creates training opportunities for Indonesian cadets. Japanese shipping companies to recruit 2,000 Indonesian officers annually." },
    ],
    moreUrl: "https://kompas.com",
    moreLabel: "kompas.com",
  },
  ukraine: {
    headlines: [
      { title: "Ukraine Latest Developments", summary: "International support continues for Ukraine reconstruction efforts. Seafarer welfare organizations increase support for Ukrainian crew members at sea." },
      { title: "Ukrainian Seafarers — ITF Support Programme", summary: "ITF expands financial support programme for Ukrainian seafarers and families. Emergency assistance available through ITF welfare fund." },
      { title: "Odessa Port Operations Update", summary: "Black Sea grain corridor operations continue under UN agreement. Ukrainian port workers maintain essential operations despite challenges." },
      { title: "Ukraine Maritime Academy — Distance Learning", summary: "Odessa National Maritime Academy expands online learning programmes. Certificate renewal courses available remotely for seafarers abroad." },
      { title: "EU Support for Ukrainian Seafarer Families", summary: "European Union announces additional welfare support for families of Ukrainian seafarers. Assistance includes housing, education, and healthcare." },
    ],
    moreUrl: "https://ukrinform.net",
    moreLabel: "ukrinform.net",
  },
  russia: {
    headlines: [
      { title: "Russian Maritime Fleet Modernisation", summary: "Government announces shipbuilding programme for domestic fleet expansion. Focus on Arctic-capable vessels and LNG carriers." },
      { title: "Russian Seafarer Certification Changes", summary: "Maritime authority updates seafarer qualification requirements. New digital certification system to be implemented by mid-2025." },
      { title: "Northern Sea Route — Record Traffic", summary: "Arctic shipping route sees record cargo volumes in 2024. Infrastructure investment continues along the Northern Sea Route." },
      { title: "Russian Maritime Education Reform", summary: "Federal agency announces reforms to maritime training curriculum. Emphasis on modern navigation technology and environmental compliance." },
      { title: "Vladivostok Port Expansion Plans", summary: "Far East port expansion approved to increase Pacific trade capacity. New terminal construction begins in 2025." },
    ],
    moreUrl: "https://tass.com",
    moreLabel: "tass.com",
  },
  china: {
    headlines: [
      { title: "China Shipbuilding — Global Market Leader", summary: "Chinese shipyards capture 60% of global new-build orders in 2024. Focus shifts to LNG carriers and green vessel technology." },
      { title: "Chinese MSA — New Inspection Standards", summary: "China Maritime Safety Administration introduces updated PSC inspection protocols. Digital documentation now accepted at all major Chinese ports." },
      { title: "Shanghai Port — Record Container Throughput", summary: "Port of Shanghai maintains position as world's busiest container port. Annual throughput exceeds 50 million TEU for the first time." },
      { title: "China Maritime Silk Road — Investment Update", summary: "Belt and Road maritime investments continue across Southeast Asia. New port facilities under construction in Myanmar and Sri Lanka." },
      { title: "Chinese Seafarer Training — AI Navigation", summary: "Maritime universities introduce AI-assisted navigation training programmes. China targets 100,000 new qualified seafarers by 2026." },
    ],
    moreUrl: "https://chinadaily.com.cn",
    moreLabel: "chinadaily.com.cn",
  },
  myanmar: {
    headlines: [
      { title: "Myanmar Seafarers — Welfare Updates", summary: "International maritime welfare organisations increase support for Myanmar seafarers abroad. Consular assistance expanded at major crew change ports." },
      { title: "Myanmar Maritime Training Recognition", summary: "STCW certification from Myanmar maritime academies gains wider international recognition. European flag states accept updated Myanmar certificates." },
      { title: "Yangon Port Infrastructure Development", summary: "Asian Development Bank funds port modernisation project in Yangon. Container handling capacity to increase significantly by 2026." },
      { title: "Myanmar Seafarer Remittance Channels", summary: "New mobile banking options available for Myanmar seafarers to send money home. Lower transaction fees through licensed digital platforms." },
      { title: "ILO Support for Myanmar Maritime Workers", summary: "International Labour Organization launches new programme for Myanmar maritime workers. Focus on fair wages and contract compliance." },
    ],
    moreUrl: "https://mmtimes.com",
    moreLabel: "mmtimes.com",
  },
  bangladesh: {
    headlines: [
      { title: "Bangladesh Shipbreaking — New Safety Standards", summary: "Government implements updated Hong Kong Convention requirements for shipbreaking yards. Worker safety training programmes expanded in Chittagong." },
      { title: "Bangladeshi Seafarers — Growing Global Presence", summary: "Bangladesh now supplies over 30,000 seafarers to international shipping. Maritime training institutes expand capacity to meet demand." },
      { title: "Chittagong Port Modernisation", summary: "Major upgrade programme underway at Bangladesh's largest port. New deep-water terminal to accommodate larger vessels by 2026." },
      { title: "Bangladesh Maritime Academy Expansion", summary: "Government announces two new maritime training academies. Scholarship programmes available for candidates from coastal communities." },
      { title: "Bangladesh-Singapore Maritime Cooperation", summary: "New bilateral agreement enhances seafarer placement with Singapore-based shipping companies. Training exchange programmes established." },
    ],
    moreUrl: "https://thedailystar.net",
    moreLabel: "thedailystar.net",
  },
  croatia: {
    headlines: [
      { title: "Croatia — EU Maritime Policy Updates", summary: "Croatia implements latest EU maritime safety directives. Croatian seafarers benefit from updated European qualification recognition." },
      { title: "Croatian Seafarers — Tax Reforms", summary: "Government announces favourable tax treatment for Croatian seafarers working internationally. New regulations effective from January 2025." },
      { title: "Rijeka Port — Adriatic Gateway Expansion", summary: "Port of Rijeka receives EU funding for capacity expansion. New container terminal positions Croatia as key Adriatic logistics hub." },
      { title: "Croatian Maritime Heritage Centre", summary: "New maritime heritage and training centre opens in Split. Modern simulation facilities available for seafarer training." },
      { title: "Croatia Yacht Industry — Record Growth", summary: "Croatian yacht charter industry sees 15% growth in 2024. Demand for qualified maritime crew increases across the Adriatic." },
    ],
    moreUrl: "https://jutarnji.hr",
    moreLabel: "jutarnji.hr",
  },
  greece: {
    headlines: [
      { title: "Greek Shipping — Fleet Expansion Continues", summary: "Greek-owned fleet remains world's largest by deadweight tonnage. New orders focus on dual-fuel LNG vessels and eco-friendly designs." },
      { title: "Greek Seafarer Employment — Strong Demand", summary: "Greek shipping companies increase hiring of Greek officers. Competitive salary packages reflect global officer shortage." },
      { title: "Piraeus Port — Mediterranean Hub Status", summary: "Port of Piraeus strengthens position as leading Mediterranean transhipment hub. COSCO investment drives continued capacity growth." },
      { title: "Greek Maritime Education — University Reforms", summary: "Merchant Marine Academies undergo curriculum modernisation. New focus on digital navigation and environmental compliance training." },
      { title: "Greece — IMO Green Shipping Initiative", summary: "Greek shipowners lead IMO decarbonisation initiative. Commitment to 40% carbon reduction in fleet operations by 2030." },
    ],
    moreUrl: "https://ekathimerini.com",
    moreLabel: "ekathimerini.com",
  },
  uk: {
    headlines: [
      { title: "UK Maritime — National Shipping Strategy 2025", summary: "Government publishes updated national shipping strategy. Focus on seafarer training, green shipping, and maintaining Red Ensign standards." },
      { title: "UK MCA — Seafarer Certification Updates", summary: "Maritime and Coastguard Agency streamlines certificate of competency process. Online applications and digital certificates now available." },
      { title: "UK Tonnage Tax — Attracting Shipowners", summary: "Treasury confirms enhanced tonnage tax regime to attract shipping companies. UK-flagged fleet expected to grow under new incentives." },
      { title: "Southampton Port — Expansion Plans Approved", summary: "Major expansion plans approved for Port of Southampton. New cruise terminal and cargo facilities to be completed by 2027." },
      { title: "UK Nautical Institute — New Training Standards", summary: "Nautical Institute publishes updated competency frameworks for merchant navy officers. Emphasis on leadership and human element training." },
    ],
    moreUrl: "https://bbc.co.uk",
    moreLabel: "bbc.co.uk",
  },
  usa: {
    headlines: [
      { title: "US Maritime — Jones Act Enforcement Update", summary: "USCG increases enforcement of Jones Act cabotage requirements. New guidance issued for foreign-flagged vessels in US waters." },
      { title: "US Coast Guard — PSC Focus Areas 2025", summary: "USCG announces priority inspection areas for 2025. Cybersecurity and ballast water management added to key focus areas." },
      { title: "US Port Infrastructure — Federal Investment", summary: "Biden administration allocates $3 billion for port infrastructure modernisation. Focus on electrification and reducing emissions at major US ports." },
      { title: "American Maritime Officers — Shortage Concerns", summary: "US Maritime Administration warns of growing officer shortage in domestic fleet. New incentive programmes for maritime academy graduates." },
      { title: "US LNG Exports — Record Volumes", summary: "United States becomes world's largest LNG exporter in 2024. Gulf Coast terminals operating at full capacity with new facilities planned." },
    ],
    moreUrl: "https://reuters.com",
    moreLabel: "reuters.com",
  },
};

const MARITIME_ARTICLES = [
  {
    id: 1,
    headline: "MLC 2006 Amendment 2024 — What Every Seafarer Must Know",
    summary: "New amendments strengthen seafarer rights on rest hours and repatriation. Key changes affect all vessels over 500GT.",
    tag: "Rights & Welfare",
  },
  {
    id: 2,
    headline: "Mental Health at Sea — Breaking the Silence",
    summary: "New ITF report shows 1 in 4 seafarers experience depression during long voyages. Support resources now available 24/7.",
    tag: "Mental Health",
  },
  {
    id: 3,
    headline: "Port State Control Inspections — Top 10 Deficiencies in 2025",
    summary: "Paris MOU releases annual report highlighting fatigue management and safety equipment as top concerns.",
    tag: "Safety",
  },
];

const News = () => {
  const [selectedCountry, setSelectedCountry] = useState<CountryKey | null>(null);

  const handleReadMore = (headline: string) => {
    toast({ title: "Opening Article", description: `Loading: ${headline}` });
  };

  const countryData = selectedCountry ? COUNTRY_NEWS[selectedCountry] : null;
  const countryInfo = selectedCountry ? COUNTRIES.find(c => c.key === selectedCountry) : null;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Maritime News</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Stay informed on industry updates</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Country Selector */}
        <div className="rounded-xl bg-card border border-border p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Globe size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              {selectedCountry ? `${countryInfo?.flag} ${countryInfo?.name} News` : "Select your home country for local news"}
            </h2>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {COUNTRIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setSelectedCountry(c.key)}
                className={`flex flex-col items-center gap-1 rounded-lg p-2 transition-colors ${
                  selectedCountry === c.key
                    ? "bg-primary/20 border border-primary/40"
                    : "bg-secondary/50 border border-transparent hover:bg-secondary"
                }`}
              >
                <span className="text-xl">{c.flag}</span>
                <span className="text-[9px] text-muted-foreground leading-tight text-center">{c.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Country News */}
        {countryData && (
          <div className="space-y-3">
            {countryData.headlines.map((article, i) => (
              <div key={i} className="rounded-xl bg-card border border-border p-4 space-y-2">
                <h3 className="font-semibold text-foreground text-sm leading-snug">{article.title}</h3>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                  {countryInfo?.name}
                </Badge>
                <p className="text-xs text-muted-foreground leading-relaxed">{article.summary}</p>
              </div>
            ))}
            <a
              href={countryData.moreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-secondary/50 border border-border p-3 text-xs text-primary hover:bg-secondary transition-colors"
            >
              <ExternalLink size={12} />
              Full news available at {countryData.moreLabel}
            </a>
          </div>
        )}

        {/* Maritime Industry News */}
        <div className="pt-2">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Newspaper size={14} className="text-primary" />
            Maritime Industry News
          </h2>
          <div className="space-y-3">
            {MARITIME_ARTICLES.map((article) => (
              <div key={article.id} className="rounded-xl bg-card border border-border p-4 space-y-3">
                <h3 className="font-semibold text-foreground text-sm leading-snug">{article.headline}</h3>
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{article.tag}</Badge>
                <p className="text-xs text-muted-foreground leading-relaxed">{article.summary}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full justify-between text-primary hover:text-primary"
                  onClick={() => handleReadMore(article.headline)}
                >
                  Read More
                  <ArrowRight size={14} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default News;
