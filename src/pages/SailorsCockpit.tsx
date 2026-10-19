import { useNavigate } from "react-router-dom";
import { ChevronLeft, Lock } from "lucide-react";
import SOSButton from "@/components/SOSButton";

const TILES = [
  { icon: "⏱", title: "Rest Hours", text: "Log today's rest and check MLC compliance.", tab: "resthours" },
  { icon: "💬", title: "Wellness Check-in", text: "Private chat and mood check. Never shared with employers.", tab: "chat", private: true },
  { icon: "🛡️", title: "Safety & Crew Tools", text: "Anonymous safety reports, vessel ratings, crew tools.", tab: "community" },
  { icon: "🧰", title: "Bridge & Engine Help", text: "Technical assistant for equipment and procedures.", tab: "bridge" },
];

const SailorsCockpit = () => {
  const navigate = useNavigate();
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/app"));
  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-primary/30 bg-background/95 px-3 py-3 backdrop-blur">
        <button onClick={back} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-secondary"><ChevronLeft /></button>
        <div>
          <h1 className="text-base font-bold">Sailor's Cockpit</h1>
          <p className="text-[11px] text-muted-foreground">Everything you need while sailing, in one place</p>
        </div>
      </header>
      <main className="mx-auto grid max-w-2xl grid-cols-1 gap-3 p-4 sm:grid-cols-2">
        {TILES.map((t) => (
          <button key={t.tab} onClick={() => navigate(`/app?tab=${t.tab}`)} className="flex flex-col items-start gap-2 rounded-2xl border border-primary/30 bg-card p-4 text-left transition hover:border-primary">
            <span className="text-3xl">{t.icon}</span>
            <span className="flex items-center gap-1.5 text-sm font-bold">{t.title}{t.private && <Lock size={12} className="text-primary" />}</span>
            <span className="text-xs text-muted-foreground">{t.text}</span>
          </button>
        ))}
        <div className="rounded-2xl border border-destructive/40 bg-card p-4 sm:col-span-2">
          <p className="mb-2 text-sm font-bold">Emergency</p>
          <p className="mb-3 text-xs text-muted-foreground">Reach your company DPA or international seafarer helplines immediately.</p>
          <SOSButton onOpenChat={() => navigate("/app?tab=chat")} firstName="" shipName="" inline />
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground sm:col-span-2">
          Wellness conversations and mood check-ins are private to you. Safety tools support, but do not replace, your vessel's Safety Management System and the instructions of the Master. In an emergency, always follow onboard procedures first.
        </p>
      </main>
    </div>
  );
};

export default SailorsCockpit;
