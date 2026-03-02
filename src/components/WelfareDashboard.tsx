import { useState, useEffect } from "react";
import { Shield, TrendingUp, TrendingDown, Users, Globe, Calendar, UserCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DashboardProps {
  shipName: string;
}

interface MoodData {
  good: number;
  okay: number;
  struggling: number;
  angry: number;
  total: number;
}

const MOOD_LABELS = [
  { key: "good" as const, emoji: "😊", label: "Good", color: "hsl(var(--sea-green))" },
  { key: "okay" as const, emoji: "😐", label: "Okay", color: "hsl(var(--gold))" },
  { key: "struggling" as const, emoji: "😔", label: "Struggling", color: "hsl(32, 80%, 50%)" },
  { key: "angry" as const, emoji: "😤", label: "Angry", color: "hsl(var(--destructive))" },
];

const MLC_ITEMS = [
  "Crew have access to confidential welfare support",
  "Anonymous reporting mechanism available",
  "Mental health resources accessible 24/7",
  "Welfare data reviewed weekly",
];

const WelfareDashboard = ({ shipName }: DashboardProps) => {
  const [loading, setLoading] = useState(true);
  const [crewCount, setCrewCount] = useState(0);
  const [avgDaysIntoVoyage, setAvgDaysIntoVoyage] = useState(0);
  const [topNationality, setTopNationality] = useState("—");
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [thisWeekMood, setThisWeekMood] = useState<MoodData>({ good: 0, okay: 0, struggling: 0, angry: 0, total: 0 });
  const [lastWeekMood, setLastWeekMood] = useState<MoodData>({ good: 0, okay: 0, struggling: 0, angry: 0, total: 0 });
  const [recentDistressPercent, setRecentDistressPercent] = useState(0);

  useEffect(() => {
    loadDashboardData();
  }, [shipName]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch all crew on the same ship
      const { data: crewProfiles } = await supabase
        .from("crew_profiles")
        .select("id, nationality, voyage_start_date, gender, whatsapp_number, years_at_sea")
        .eq("ship_name", shipName);

      if (!crewProfiles || crewProfiles.length === 0) {
        setLoading(false);
        return;
      }

      setCrewCount(crewProfiles.length);

      // Average days into voyage
      const now = Date.now();
      const voyageDays = crewProfiles
        .filter((p) => p.voyage_start_date)
        .map((p) => Math.max(1, Math.ceil((now - new Date(p.voyage_start_date!).getTime()) / 86400000)));
      setAvgDaysIntoVoyage(voyageDays.length > 0 ? Math.round(voyageDays.reduce((a, b) => a + b, 0) / voyageDays.length) : 0);

      // Top nationality
      const natCounts: Record<string, number> = {};
      crewProfiles.forEach((p) => {
        if (p.nationality) natCounts[p.nationality] = (natCounts[p.nationality] || 0) + 1;
      });
      const sorted = Object.entries(natCounts).sort((a, b) => b[1] - a[1]);
      setTopNationality(sorted.length > 0 ? sorted[0][0] : "—");

      // Profile completion (has nationality, gender, whatsapp, years_at_sea)
      const complete = crewProfiles.filter(
        (p) => p.nationality && p.gender && p.whatsapp_number && p.years_at_sea
      ).length;
      setProfileCompletion(Math.round((complete / crewProfiles.length) * 100));

      // Fetch mood messages from chat
      const crewIds = crewProfiles.map((p) => p.id);
      const twoWeeksAgo = new Date(now - 14 * 86400000).toISOString();

      const { data: moodMessages } = await supabase
        .from("chat_messages")
        .select("content, created_at, crew_profile_id")
        .eq("role", "user")
        .in("crew_profile_id", crewIds)
        .gte("created_at", twoWeeksAgo);

      const oneWeekAgo = new Date(now - 7 * 86400000).getTime();
      const fortyEightHoursAgo = new Date(now - 48 * 3600000).getTime();

      const thisWeek: MoodData = { good: 0, okay: 0, struggling: 0, angry: 0, total: 0 };
      const lastWeek: MoodData = { good: 0, okay: 0, struggling: 0, angry: 0, total: 0 };
      let recentTotal = 0;
      let recentDistress = 0;

      (moodMessages || []).forEach((msg) => {
        const lower = msg.content.toLowerCase();
        let mood: keyof MoodData | null = null;
        if (lower.includes("feeling good")) mood = "good";
        else if (lower.includes("feeling okay")) mood = "okay";
        else if (lower.includes("feeling struggling")) mood = "struggling";
        else if (lower.includes("feeling angry")) mood = "angry";

        if (!mood) return;

        const ts = new Date(msg.created_at).getTime();
        if (ts >= oneWeekAgo) {
          thisWeek[mood]++;
          thisWeek.total++;
        } else {
          lastWeek[mood]++;
          lastWeek.total++;
        }

        if (ts >= fortyEightHoursAgo) {
          recentTotal++;
          if (mood === "struggling" || mood === "angry") recentDistress++;
        }
      });

      setThisWeekMood(thisWeek);
      setLastWeekMood(lastWeek);
      setRecentDistressPercent(recentTotal > 0 ? Math.round((recentDistress / recentTotal) * 100) : 0);
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const calcScore = (mood: MoodData): number => {
    if (mood.total === 0) return 0;
    const weighted = mood.good * 9 + mood.okay * 6.5 + mood.struggling * 3 + mood.angry * 1.5;
    return Math.round((weighted / mood.total) * 10) / 10;
  };

  const thisWeekScore = calcScore(thisWeekMood);
  const lastWeekScore = calcScore(lastWeekMood);
  const scoreDiff = Math.round((thisWeekScore - lastWeekScore) * 10) / 10;

  const moodPercent = (key: keyof Omit<MoodData, "total">) =>
    thisWeekMood.total > 0 ? Math.round((thisWeekMood[key] / thisWeekMood.total) * 100) : 0;

  // Gauge angle (score 1-10 mapped to 0-180 degrees)
  const gaugeAngle = thisWeekScore > 0 ? ((thisWeekScore - 1) / 9) * 180 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0s" }} />
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0.3s" }} />
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0.6s" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 border-b border-border">
        <p className="text-sm text-muted-foreground tracking-wide uppercase">Welfare Officer</p>
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-xs text-muted-foreground mt-1">{shipName}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">

        {/* SECTION 1 — Ship Morale Gauge */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-5 text-center">
            Ship Morale Overview
          </p>

          {/* Semicircle Gauge */}
          <div className="flex justify-center mb-4">
            <div className="relative w-48 h-24 overflow-hidden">
              {/* Background arc */}
              <svg viewBox="0 0 200 100" className="w-full h-full">
                <path
                  d="M 10 95 A 85 85 0 0 1 190 95"
                  fill="none"
                  stroke="hsl(var(--secondary))"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                {/* Colored arc */}
                <path
                  d="M 10 95 A 85 85 0 0 1 190 95"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${(gaugeAngle / 180) * 267} 267`}
                />
              </svg>
              {/* Score in center */}
              <div className="absolute inset-0 flex items-end justify-center pb-0">
                <span className="text-4xl font-bold text-primary score-glow">
                  {thisWeekScore > 0 ? thisWeekScore.toFixed(1) : "—"}
                </span>
                <span className="text-lg text-muted-foreground font-light ml-1 mb-1">/10</span>
              </div>
            </div>
          </div>

          <p className="text-sm text-foreground text-center font-medium">
            {shipName} — {thisWeekScore > 0 ? `${thisWeekScore.toFixed(1)}/10 this week` : "No data this week"}
          </p>

          {lastWeekScore > 0 && (
            <div className="flex items-center justify-center gap-1.5 mt-2">
              {scoreDiff >= 0 ? (
                <TrendingUp size={14} className="text-[hsl(var(--sea-green))]" />
              ) : (
                <TrendingDown size={14} className="text-destructive" />
              )}
              <p className="text-xs text-muted-foreground">
                {scoreDiff >= 0 ? "Up" : "Down"} from {lastWeekScore.toFixed(1)} last week
                {scoreDiff !== 0 && ` (${scoreDiff > 0 ? "+" : ""}${scoreDiff.toFixed(1)})`}
              </p>
            </div>
          )}
        </div>

        {/* SECTION 2 — Mood Breakdown */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">
            Mood Breakdown — This Week
          </p>

          {thisWeekMood.total === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No mood responses recorded this week
            </p>
          ) : (
            <div className="space-y-3">
              {MOOD_LABELS.map((m) => {
                const pct = moodPercent(m.key);
                return (
                  <div key={m.key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">
                        {m.emoji} {m.label}
                      </span>
                      <span className="text-muted-foreground font-medium">{pct}%</span>
                    </div>
                    <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: m.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground mt-3 text-center">
            Based on {thisWeekMood.total} mood response{thisWeekMood.total !== 1 ? "s" : ""}
          </p>
        </div>

        {/* SECTION 3 — Voyage Statistics */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">
            Voyage Statistics
          </p>
          <div className="grid grid-cols-2 gap-4">
            <StatCard icon={Users} label="Crew Using SeaMinds" value={String(crewCount)} />
            <StatCard icon={Calendar} label="Avg Days Into Voyage" value={avgDaysIntoVoyage > 0 ? String(avgDaysIntoVoyage) : "—"} />
            <StatCard icon={Globe} label="Top Nationality" value={topNationality} />
            <StatCard icon={UserCheck} label="Profile Completion" value={`${profileCompletion}%`} />
          </div>
        </div>

        {/* SECTION 4 — Welfare Alerts */}
        <div
          className={`rounded-2xl border p-5 ${
            recentDistressPercent > 20
              ? "bg-[hsl(32,80%,50%,0.08)] border-[hsl(32,80%,50%,0.3)]"
              : "bg-card border-border"
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={20}
              className={`flex-shrink-0 mt-0.5 ${
                recentDistressPercent > 20 ? "text-[hsl(32,80%,50%)]" : "text-[hsl(var(--sea-green))]"
              }`}
            />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">
                Welfare Alert Status
              </p>
              {recentDistressPercent > 20 ? (
                <p className="text-sm text-foreground leading-relaxed">
                  <span className="font-semibold text-[hsl(32,80%,50%)]">Welfare attention recommended</span> — {recentDistressPercent}% of crew reported low mood (Struggling or Angry) in the past 48 hours. Consider initiating a welfare officer check-in.
                </p>
              ) : (
                <p className="text-sm text-foreground leading-relaxed">
                  <span className="font-semibold text-[hsl(var(--sea-green))]">No active alerts.</span> Crew morale within normal range. {recentDistressPercent}% reported low mood in the past 48 hours.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 5 — MLC 2006 Compliance */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">
            MLC 2006 Compliance Summary
          </p>
          <div className="space-y-3">
            {MLC_ITEMS.map((item) => (
              <div key={item} className="flex items-start gap-3">
                <CheckCircle2 size={16} className="text-[hsl(var(--sea-green))] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="flex items-start gap-3 bg-card rounded-2xl px-5 py-4 border border-border">
          <Shield size={16} className="text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            All individual data is sealed and private. This dashboard shows aggregate patterns only. No individual crew member names are visible.
          </p>
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="bg-secondary rounded-xl p-4 flex flex-col items-center text-center gap-2">
    <Icon size={18} className="text-primary" />
    <span className="text-xl font-bold text-foreground">{value}</span>
    <span className="text-[10px] text-muted-foreground uppercase tracking-wide leading-tight">{label}</span>
  </div>
);

export default WelfareDashboard;
