import { useState } from "react";
import { ArrowLeft, Search } from "lucide-react";

const QUICK_TAPS = ["MARPOL", "SOLAS", "ISM Code", "MLC 2006", "STCW"];

const DEPARTMENTS = [
  { emoji: "⚙️", title: "MACHINERY", subtitle: "Engine, pumps, systems", questions: [
    "How to troubleshoot a fuel injector?", "Main engine lube oil pressure low — causes?", "Purifier not separating properly — steps?",
    "Emergency generator won't start — checklist?", "Boiler water test limits and treatment?", "How to overhaul a centrifugal pump?"
  ]},
  { emoji: "🧭", title: "NAVIGATION", subtitle: "Charts, ECDIS, colregs", questions: [
    "Rule 19 — conduct in restricted visibility?", "ECDIS alarm management best practices?", "How to plan a passage through a TSS?",
    "When to use radar plotting vs ARPA?", "Gyro compass error correction methods?", "Bridge team resource management essentials?"
  ]},
  { emoji: "🔥", title: "CARGO OPS", subtitle: "Loading, stability, tankers", questions: [
    "Cargo securing manual requirements?", "Tanker inerting system operation?", "How to calculate cargo stowage factor?",
    "Container lashing inspection checklist?", "Bulk cargo liquefaction risks and prevention?", "Loading computer vs manual stability calc?"
  ]},
  { emoji: "📡", title: "COMMS", subtitle: "GMDSS, VHF, Inmarsat", questions: [
    "GMDSS sea area equipment requirements?", "How to send a DSC distress alert?", "NAVTEX receiver setup and frequencies?",
    "Inmarsat-C polling and EGC explained?", "VHF channel 16 procedures and protocols?", "EPIRB testing and maintenance schedule?"
  ]},
  { emoji: "⚖️", title: "SAFETY", subtitle: "SOLAS, fire, LSA", questions: [
    "Fire drill frequency requirements per SOLAS?", "Lifeboat launching procedure step by step?", "SCBA donning time and inspection checks?",
    "Enclosed space entry permit requirements?", "Fire extinguisher types and applications?", "Muster list — who does what in emergency?"
  ]},
  { emoji: "🌊", title: "STABILITY", subtitle: "Trim, stress, flooding", questions: [
    "How to calculate GM and GZ curve?", "Free surface effect — how to minimize?", "Damage stability requirements per SOLAS?",
    "What is angle of loll and correction?", "Trim optimization for fuel efficiency?", "Stress limits on hull — hogging vs sagging?"
  ]},
  { emoji: "📋", title: "ISM/DOCS", subtitle: "SMS, audits, certificates", questions: [
    "ISM Code document of compliance requirements?", "How to prepare for a PSC inspection?", "Non-conformity vs major non-conformity?",
    "Safety management certificate renewal process?", "Internal audit checklist for ISM?", "Master review — what to include annually?"
  ]},
  { emoji: "🔧", title: "MAINTENANCE", subtitle: "Planned maintenance, repairs", questions: [
    "PMS software best practices onboard?", "Critical equipment maintenance intervals?", "Class survey preparation checklist?",
    "How to manage spare parts inventory?", "Dry dock preparation and planning?", "Running hours vs calendar-based maintenance?"
  ]},
];

const Bridge = () => {
  const [searchValue, setSearchValue] = useState("");
  const [activeDept, setActiveDept] = useState<typeof DEPARTMENTS[number] | null>(null);

  const handleChipClick = (question: string) => {
    setSearchValue(question);
    setActiveDept(null);
  };

  const handleQuickTap = (term: string) => {
    setSearchValue(term);
  };

  if (activeDept) {
    return (
      <div className="flex flex-col h-full px-4 py-3 overflow-y-auto">
        <button onClick={() => setActiveDept(null)} className="flex items-center gap-2 mb-4" style={{ color: "#D4AF37" }}>
          <ArrowLeft size={18} /> <span className="text-sm font-medium">Back</span>
        </button>
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">{activeDept.emoji}</div>
          <h2 className="text-lg font-bold" style={{ color: "#D4AF37" }}>{activeDept.title}</h2>
          <p className="text-xs text-muted-foreground">{activeDept.subtitle}</p>
        </div>
        <div className="flex flex-col gap-2">
          {activeDept.questions.map((q) => (
            <button
              key={q}
              onClick={() => handleChipClick(q)}
              className="text-left text-sm px-4 py-3 rounded-xl transition-colors"
              style={{ background: "rgba(13,27,42,0.8)", border: "1px solid rgba(212,175,55,0.3)", color: "#e2e8f0" }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full px-4 py-3 overflow-y-auto">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold tracking-wider" style={{ color: "#D4AF37" }}>BRIDGE</h1>
        <p className="text-xs text-muted-foreground">Technical Reference & Guidance</p>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Ask any technical question..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#D4AF37]"
        />
      </div>

      {/* Quick taps */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {QUICK_TAPS.map((t) => (
          <button
            key={t}
            onClick={() => handleQuickTap(t)}
            className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors"
            style={{ border: "1px solid #D4AF37", color: "#D4AF37", background: "transparent" }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Department grid */}
      <div className="grid grid-cols-2 gap-3">
        {DEPARTMENTS.map((dept) => (
          <button
            key={dept.title}
            onClick={() => setActiveDept(dept)}
            className="flex flex-col items-start p-4 rounded-xl text-left transition-all hover:border-[#D4AF37]"
            style={{ background: "rgba(13,27,42,0.85)", border: "1px solid rgba(212,175,55,0.15)" }}
          >
            <span className="text-2xl mb-2">{dept.emoji}</span>
            <span className="text-xs font-bold tracking-wide" style={{ color: "#D4AF37" }}>{dept.title}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">{dept.subtitle}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Bridge;
