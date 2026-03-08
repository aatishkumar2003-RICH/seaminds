import { useState, useEffect } from "react";
import { Anchor, BarChart3, Calendar, Ship, Award, Heart, Save, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VoyageReportProps {
  profileId: string;
  firstName: string;
  role: string;
  shipName: string;
  voyageStartDate: string;
  nationality: string;
  onClose: () => void;
}

const VOYAGE_REPORT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voyage-report`;
const FAMILY_EMAIL_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/family-email`;

const MOOD_COLORS: Record<string, string> = {
  Good: "bg-emerald-500",
  Okay: "bg-amber-500",
  Struggling: "bg-orange-500",
  Angry: "bg-red-500",
};

const VoyageReport = ({ profileId, firstName, role, shipName, voyageStartDate, nationality, onClose }: VoyageReportProps) => {
  const [loading, setLoading] = useState(true);
  const [aiMessage, setAiMessage] = useState("");
  const [totalDays, setTotalDays] = useState(0);
  const [totalCheckins, setTotalCheckins] = useState(0);
  const [moodBreakdown, setMoodBreakdown] = useState<Record<string, number>>({});
  const [longestStreak, setLongestStreak] = useState(0);
  const [saved, setSaved] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showFarewell, setShowFarewell] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

  const endDate = new Date().toISOString().split("T")[0];
  const days = voyageStartDate
    ? Math.max(1, Math.ceil((Date.now() - new Date(voyageStartDate).getTime()) / 86400000))
    : 0;

  useEffect(() => {
    generateReport();
  }, []);

  const generateReport = async () => {
    setLoading(true);
    setTotalDays(days);

    try {
      // Get all user messages for mood analysis
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("content, created_at")
        .eq("crew_profile_id", profileId)
        .eq("role", "user")
        .order("created_at", { ascending: true });

      const allMsgs = msgs || [];
      setTotalCheckins(allMsgs.length);

      // Mood breakdown
      const moods: Record<string, number> = { Good: 0, Okay: 0, Struggling: 0, Angry: 0 };
      allMsgs.forEach((m) => {
        const lower = m.content.toLowerCase();
        if (lower.includes("good") || lower.includes("great") || lower.includes("happy") || lower.includes("motivated") || lower.includes("grateful")) moods.Good++;
        else if (lower.includes("okay") || lower.includes("fine") || lower.includes("calm") || lower.includes("hopeful")) moods.Okay++;
        else if (lower.includes("struggling") || lower.includes("lonely") || lower.includes("homesick") || lower.includes("tired") || lower.includes("sad")) moods.Struggling++;
        else if (lower.includes("angry") || lower.includes("frustrated") || lower.includes("annoyed")) moods.Angry++;
      });
      setMoodBreakdown(moods);

      // Longest streak (consecutive days with messages)
      const uniqueDays = [...new Set(allMsgs.map((m) => m.created_at.split("T")[0]))].sort();
      let streak = 0;
      let maxStreak = 0;
      for (let i = 0; i < uniqueDays.length; i++) {
        if (i === 0) { streak = 1; }
        else {
          const prev = new Date(uniqueDays[i - 1]);
          const curr = new Date(uniqueDays[i]);
          const diff = (curr.getTime() - prev.getTime()) / 86400000;
          streak = diff === 1 ? streak + 1 : 1;
        }
        maxStreak = Math.max(maxStreak, streak);
      }
      setLongestStreak(maxStreak);

      // Generate AI message
      const resp = await fetch(VOYAGE_REPORT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          firstName,
          nationality,
          role,
          shipName,
          totalDays: days,
          moodBreakdown: moods,
          totalCheckins: allMsgs.length,
          longestStreak: maxStreak,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        setAiMessage(data.message);
      } else {
        setAiMessage(`${days} days at sea, ${firstName}. That takes real strength. Well done on completing this voyage.`);
      }
    } catch (e) {
      console.error("Report generation error:", e);
      setAiMessage(`${days} days at sea, ${firstName}. That takes real strength. Well done on completing this voyage.`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const { data, error } = await supabase.from("voyage_reports").insert({
      crew_profile_id: profileId,
      ship_name: shipName,
      role,
      voyage_start_date: voyageStartDate,
      voyage_end_date: endDate,
      total_days: totalDays,
      total_checkins: totalCheckins,
      mood_breakdown: moodBreakdown,
      longest_streak: longestStreak,
      ai_message: aiMessage,
    }).select("id").single();

    if (error) {
      toast.error("Failed to save report");
      return;
    }
    setReportId(data.id);
    setSaved(true);
    toast.success("Voyage report saved to your profile");
  };

  const handleShareWithFamily = async () => {
    setSharing(true);
    try {
      // Check if family connection exists
      const { data: family } = await supabase
        .from("family_connections")
        .select("family_email, family_name")
        .eq("crew_profile_id", profileId)
        .single();

      if (!family) {
        toast.error("No family connection found. Set one up in Community first.");
        setSharing(false);
        return;
      }

      const maxMood = Object.entries(moodBreakdown).sort(([, a], [, b]) => b - a)[0];
      const summaryHtml = `
        <p style="color: #e2e8f0; font-size: 15px; line-height: 1.7;">${firstName} has completed his voyage on <strong>${shipName}</strong>.</p>
        <div style="background: #1a2744; padding: 20px; border-radius: 12px; margin: 20px 0;">
          <p style="color: #d4a843; font-size: 16px; margin: 0 0 12px; font-weight: 600;">Voyage Summary</p>
          <p style="color: #94a3b8; font-size: 13px; margin: 4px 0;">📅 Total days at sea: <strong style="color: #e2e8f0;">${totalDays}</strong></p>
          <p style="color: #94a3b8; font-size: 13px; margin: 4px 0;">🚢 Ship: <strong style="color: #e2e8f0;">${shipName}</strong></p>
          <p style="color: #94a3b8; font-size: 13px; margin: 4px 0;">💬 SeaMinds check-ins: <strong style="color: #e2e8f0;">${totalCheckins}</strong></p>
          <p style="color: #94a3b8; font-size: 13px; margin: 4px 0;">🏆 Longest streak: <strong style="color: #e2e8f0;">${longestStreak} days</strong></p>
          ${maxMood ? `<p style="color: #94a3b8; font-size: 13px; margin: 4px 0;">😊 Most frequent mood: <strong style="color: #e2e8f0;">${maxMood[0]}</strong></p>` : ""}
        </div>
        <p style="color: #e2e8f0; font-size: 14px; line-height: 1.7; font-style: italic;">"${aiMessage}"</p>
      `;

      const res = await fetch(FAMILY_EMAIL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          to: family.family_email,
          familyName: family.family_name,
          crewName: firstName,
          shipName,
          voyageDay: totalDays,
          personalMessage: `🎉 VOYAGE COMPLETE!\n\n${firstName} has completed ${totalDays} days at sea on ${shipName}.\n\nCheck-ins: ${totalCheckins}\nLongest streak: ${longestStreak} days\n${maxMood ? `Most frequent mood: ${maxMood[0]}` : ""}\n\n"${aiMessage}"`,
        }),
      });

      if (res.ok) {
        toast.success(`Voyage summary sent to ${family.family_name}`);
      } else {
        toast.error("Failed to send to family");
      }
    } catch {
      toast.error("Failed to send to family");
    }
    setSharing(false);
  };

  if (showFarewell) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center">
        <Anchor size={48} className="text-primary mb-6" />
        <h1 className="text-2xl font-bold text-foreground mb-3">Safe travels home, {firstName}.</h1>
        <p className="text-muted-foreground text-sm mb-8">See you on your next voyage.</p>
        <button
          onClick={onClose}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl text-sm font-medium"
        >
          Return to SeaMinds <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Anchor size={32} className="text-primary animate-pulse" />
        <p className="text-sm text-muted-foreground">Generating your voyage report...</p>
      </div>
    );
  }

  const maxMoodCount = Math.max(...Object.values(moodBreakdown), 1);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-4 lg:pt-8 pb-4 border-b border-border text-center">
        <Anchor size={24} className="text-primary mx-auto mb-2" />
        <h1 className="text-xl font-bold text-foreground">Voyage Complete — Well Done {firstName}</h1>
        <p className="text-xs text-muted-foreground mt-1">Here is your personal SeaMinds voyage summary</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">

        {/* Voyage Stats */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">Voyage Stats</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Calendar size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{totalDays}</p>
                <p className="text-[10px] text-muted-foreground">Days at sea</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Ship size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{shipName}</p>
                <p className="text-[10px] text-muted-foreground">{role}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border flex justify-between text-xs text-muted-foreground">
            <span>Start: {voyageStartDate}</span>
            <span>End: {endDate}</span>
          </div>
        </div>

        {/* Wellness Journey */}
        <div className="bg-card rounded-2xl border border-border p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-4">Wellness Journey</p>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{totalCheckins}</p>
              <p className="text-[10px] text-muted-foreground">Check-ins</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-primary">{longestStreak}</p>
              <p className="text-[10px] text-muted-foreground">Day streak</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{Object.values(moodBreakdown).reduce((a, b) => a + b, 0)}</p>
              <p className="text-[10px] text-muted-foreground">Mood logs</p>
            </div>
          </div>

          {/* Mood bar chart */}
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3">Mood Breakdown</p>
          <div className="space-y-2.5">
            {(["Good", "Okay", "Struggling", "Angry"] as const).map((mood) => {
              const count = moodBreakdown[mood] || 0;
              const pct = maxMoodCount > 0 ? (count / maxMoodCount) * 100 : 0;
              return (
                <div key={mood} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16 text-right">{mood}</span>
                  <div className="flex-1 h-5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${MOOD_COLORS[mood]} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-foreground w-6 text-right font-medium">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Personal Message */}
        <div className="bg-card rounded-2xl border border-primary/30 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Award size={16} className="text-primary" />
            <p className="text-xs text-primary uppercase tracking-widest font-medium">Personal Message</p>
          </div>
          <p className="text-sm text-foreground leading-relaxed italic">"{aiMessage}"</p>
          <p className="text-[10px] text-muted-foreground mt-3 text-right">— SeaMinds</p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleShareWithFamily}
            disabled={sharing}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-opacity"
          >
            <Heart size={16} />
            {sharing ? "Sending..." : "Share with Family"}
          </button>

          <button
            onClick={handleSave}
            disabled={saved}
            className="w-full flex items-center justify-center gap-2 bg-secondary text-foreground py-3.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-opacity"
          >
            <Save size={16} />
            {saved ? "Report Saved ✓" : "Save My Report"}
          </button>
        </div>

        {/* Continue button */}
        <button
          onClick={() => setShowFarewell(true)}
          className="w-full flex items-center justify-center gap-2 text-primary text-sm font-medium py-3"
        >
          Continue <ArrowRight size={14} />
        </button>

        <div className="h-4" />
      </div>
    </div>
  );
};

export default VoyageReport;
