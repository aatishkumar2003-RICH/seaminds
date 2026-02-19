import { Shield, TrendingUp, AlertTriangle } from "lucide-react";

const stressThemes = [
  { label: "Workload", icon: TrendingUp, level: "High" },
  { label: "Family Separation", icon: AlertTriangle, level: "Moderate" },
  { label: "Sleep Quality", icon: AlertTriangle, level: "Moderate" },
];

const WelfareDashboard = () => {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 border-b border-border">
        <p className="text-sm text-muted-foreground tracking-wide uppercase">Welfare Officer</p>
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8">
        {/* Score */}
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground uppercase tracking-widest mb-3">
            Crew Wellbeing Score This Week
          </p>
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-7xl font-bold text-primary score-glow">7.2</span>
            <span className="text-2xl text-muted-foreground font-light">/ 10</span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* Stress Themes */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">
            Top Stress Themes
          </p>
          <div className="space-y-3">
            {stressThemes.map((theme) => (
              <div
                key={theme.label}
                className="flex items-center gap-3 bg-secondary rounded-xl px-4 py-3"
              >
                <theme.icon size={18} className="text-primary flex-shrink-0" />
                <span className="text-sm font-medium text-foreground flex-1">{theme.label}</span>
                <span className="text-xs text-muted-foreground">{theme.level}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="flex items-start gap-3 bg-card rounded-xl px-4 py-4 border border-border">
          <Shield size={16} className="text-gold-dim flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Individual crew conversations are private. This dashboard shows collective patterns only. No names. No individual data.
          </p>
        </div>
      </div>
    </div>
  );
};

export default WelfareDashboard;
