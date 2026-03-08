import { Flame } from "lucide-react";

interface StreakDisplayProps {
  currentStreak: number;
  longestStreak: number;
  checkedInToday: boolean;
}

const StreakDisplay = ({ currentStreak, longestStreak, checkedInToday }: StreakDisplayProps) => {
  if (currentStreak === 0 && !checkedInToday) return null;

  const encouragement = currentStreak >= 30
    ? "Incredible dedication! 🏆"
    : currentStreak >= 14
    ? "Two weeks strong! 💪"
    : currentStreak >= 7
    ? "One week streak! 🌟"
    : currentStreak >= 3
    ? "Keep it going! 🔥"
    : checkedInToday
    ? "Great start! ✨"
    : "";

  return (
    <div className="flex items-center justify-center gap-3 px-4 py-2" style={{ background: "rgba(212,175,55,0.08)", borderBottom: "1px solid rgba(212,175,55,0.12)" }}>
      <div className="flex items-center gap-1.5">
        <Flame size={14} className="text-primary" />
        <span className="text-xs font-bold text-primary">{currentStreak}</span>
        <span className="text-[10px] text-muted-foreground">day streak</span>
      </div>
      {longestStreak > currentStreak && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">Best: {longestStreak}d</span>
        </div>
      )}
      {encouragement && (
        <span className="text-[10px] text-muted-foreground">{encouragement}</span>
      )}
    </div>
  );
};

export default StreakDisplay;
