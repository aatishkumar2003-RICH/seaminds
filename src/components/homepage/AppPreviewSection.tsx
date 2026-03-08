import { useState } from "react";

const tabs = [
  { emoji: "💬", label: "AI Wellness Chat" },
  { emoji: "🏆", label: "SMC Certified Score" },
  { emoji: "⏱", label: "Rest Hours Tracker" },
  { emoji: "📜", label: "Certificate Wallet" },
  { emoji: "💼", label: "Maritime Jobs" },
  { emoji: "🔧", label: "PMS Reference" },
];

const ChatPreview = () => (
  <div className="flex flex-col gap-3 p-4 text-xs">
    <div className="self-end max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 bg-secondary text-secondary-foreground">
      I've been at sea 3 months, feeling lonely
    </div>
    <div className="self-start max-w-[85%] rounded-2xl rounded-bl-sm px-3 py-2 bg-muted text-foreground">
      That's completely normal. 1 in 4 seafarers experience this. Here are 3 things that help tonight...
    </div>
    <div className="flex gap-2 justify-center pt-2">
      {["😊", "😐", "😔", "😤", "😴"].map((m) => (
        <button key={m} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-base hover:bg-accent/30 transition-colors">{m}</button>
      ))}
    </div>
  </div>
);

const SMCPreview = () => (
  <div className="flex flex-col items-center gap-3 p-4 text-xs">
    <p className="text-3xl font-bold text-primary font-mono-score score-glow">4.83</p>
    <p className="text-[10px] text-muted-foreground font-mono-score">/ 5.00</p>
    <span className="px-3 py-0.5 rounded-full border border-primary text-primary text-[10px] font-bold tracking-widest">ELITE</span>
    <div className="w-full space-y-2 pt-2">
      {[
        { label: "Technical", val: 92 },
        { label: "Experience", val: 88 },
        { label: "Communication", val: 95 },
        { label: "Behavioural", val: 97 },
        { label: "Wellness", val: 90 },
      ].map((b) => (
        <div key={b.label} className="flex items-center gap-2">
          <span className="w-24 text-muted-foreground text-[10px]">{b.label}</span>
          <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${b.val}%` }} />
          </div>
        </div>
      ))}
    </div>
    <p className="text-[10px] text-sea-green mt-1">997 free spots remaining</p>
  </div>
);

const RestHoursPreview = () => (
  <div className="flex flex-col gap-3 p-4 text-xs">
    <div className="rounded-lg bg-secondary p-3">
      <p className="text-sea-green font-semibold">✅ Today: 11.5h rest — COMPLIANT</p>
    </div>
    <div className="flex items-end gap-1.5 justify-center h-16">
      {[10, 11, 9, 12, 11, 5, 11.5].map((h, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div
            className={`w-5 rounded-sm ${h < 10 ? "bg-destructive" : "bg-sea-green"}`}
            style={{ height: `${(h / 12) * 48}px` }}
          />
          <span className="text-[8px] text-muted-foreground">{["M", "T", "W", "T", "F", "S", "S"][i]}</span>
        </div>
      ))}
    </div>
    <span className="mx-auto px-2 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground">MLC 2006 Protected</span>
  </div>
);

const CertPreview = () => (
  <div className="flex flex-col gap-2.5 p-4 text-xs">
    {[
      { name: "STCW Basic Safety", days: 89, color: "text-sea-green" },
      { name: "Medical Certificate", days: 23, color: "text-primary" },
      { name: "CoC Master", days: 412, color: "text-sea-green" },
    ].map((c) => (
      <div key={c.name} className="rounded-lg bg-secondary p-3 flex justify-between items-center">
        <span className="text-foreground">{c.name}</span>
        <span className={`text-[10px] font-bold ${c.color}`}>{c.days} days</span>
      </div>
    ))}
  </div>
);

const JobsPreview = () => (
  <div className="flex flex-col gap-2.5 p-4 text-xs">
    {[
      { title: "Captain — VLCC Tanker", salary: "$9,500/mo", co: "Anglo-Eastern · Singapore" },
      { title: "Chief Engineer — Container", salary: "$7,200/mo", co: "Fleet Management · Manila" },
    ].map((j) => (
      <div key={j.title} className="rounded-lg bg-secondary p-3">
        <p className="text-foreground font-semibold">{j.title}</p>
        <p className="text-primary font-bold">{j.salary}</p>
        <p className="text-muted-foreground text-[10px] mt-0.5">{j.co}</p>
      </div>
    ))}
  </div>
);

const PMSPreview = () => (
  <div className="flex flex-col gap-3 p-4 text-xs">
    <div className="rounded-lg bg-secondary p-3">
      <p className="text-destructive font-semibold">⚠ Main Engine ME-001 — CRITICAL</p>
      <p className="text-muted-foreground text-[10px] mt-1">Next: 4,000hr overhaul — due in 340hrs</p>
    </div>
    <button className="w-full rounded-lg bg-primary/20 border border-primary/40 text-primary py-2 text-[11px] font-medium">
      📷 Diagnose Equipment from Photo
    </button>
  </div>
);

const previewComponents = [ChatPreview, SMCPreview, RestHoursPreview, CertPreview, JobsPreview, PMSPreview];

const AppPreviewSection = () => {
  const [activeTab, setActiveTab] = useState(0);
  const Preview = previewComponents[activeTab];

  return (
    <section id="features-section" className="relative" style={{ background: "linear-gradient(to bottom, transparent, hsl(var(--navy-deep) / 0.8))" }}>
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          {/* Left */}
          <div className="lg:w-1/2 w-full">
            <h2 className="text-3xl font-bold text-foreground mb-8">Everything a Seafarer Needs</h2>
            <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              {tabs.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTab(i)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left text-sm font-medium transition-all whitespace-nowrap
                    ${activeTab === i
                      ? "border-l-2 border-primary text-primary bg-primary/5"
                      : "border-l-2 border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <span className="text-base">{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right - Phone mockup */}
          <div className="lg:w-1/2 flex justify-center">
            <div
              className="relative overflow-hidden flex flex-col"
              style={{
                width: 280,
                height: 520,
                borderRadius: 24,
                border: "2px solid hsl(var(--primary))",
                background: "hsl(var(--navy-deep))",
                boxShadow: "0 0 40px hsl(var(--primary) / 0.2)",
              }}
            >
              {/* Status bar */}
              <div className="flex items-center justify-between px-5 pt-3 pb-1">
                <span className="text-[10px] text-muted-foreground font-mono-score">SeaMinds</span>
                <span className="text-[10px] text-muted-foreground font-mono-score">●●●</span>
              </div>
              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                <Preview />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AppPreviewSection;
