import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastCheckinDate: string | null;
  checkedInToday: boolean;
}

export const useWellnessStreak = (profileId: string) => {
  const [streak, setStreak] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    lastCheckinDate: null,
    checkedInToday: false,
  });
  const [loading, setLoading] = useState(true);

  const todayStr = () => new Date().toISOString().slice(0, 10);

  const fetchStreak = useCallback(async () => {
    const { data } = await supabase
      .from("wellness_streaks")
      .select("*")
      .eq("crew_profile_id", profileId)
      .maybeSingle();

    if (data) {
      const today = todayStr();
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const isToday = data.last_checkin_date === today;
      const isYesterday = data.last_checkin_date === yesterday;

      setStreak({
        currentStreak: isToday || isYesterday ? data.current_streak : 0,
        longestStreak: data.longest_streak,
        lastCheckinDate: data.last_checkin_date,
        checkedInToday: isToday,
      });
    }
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    fetchStreak();
  }, [fetchStreak]);

  const recordCheckin = useCallback(async () => {
    const today = todayStr();
    const { data: existing } = await supabase
      .from("wellness_streaks")
      .select("*")
      .eq("crew_profile_id", profileId)
      .maybeSingle();

    if (existing) {
      if (existing.last_checkin_date === today) return; // Already checked in today

      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const isConsecutive = existing.last_checkin_date === yesterday;
      const newStreak = isConsecutive ? existing.current_streak + 1 : 1;
      const newLongest = Math.max(existing.longest_streak, newStreak);

      await supabase
        .from("wellness_streaks")
        .update({
          current_streak: newStreak,
          longest_streak: newLongest,
          last_checkin_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq("crew_profile_id", profileId);

      setStreak({
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastCheckinDate: today,
        checkedInToday: true,
      });
    } else {
      await supabase.from("wellness_streaks").insert({
        crew_profile_id: profileId,
        current_streak: 1,
        longest_streak: 1,
        last_checkin_date: today,
      });

      setStreak({
        currentStreak: 1,
        longestStreak: 1,
        lastCheckinDate: today,
        checkedInToday: true,
      });
    }
  }, [profileId]);

  return { streak, loading, recordCheckin };
};
