import { useMemo } from "react";

export type TimeOfDay = "dawn" | "day" | "dusk" | "night";

export function useTimeOfDay(): TimeOfDay {
  return useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 7) return "dawn";
    if (hour >= 7 && hour < 17) return "day";
    if (hour >= 17 && hour < 19) return "dusk";
    return "night";
  }, []);
}

export function getGreeting(time: TimeOfDay): string {
  switch (time) {
    case "dawn": return "Good Morning, Captain";
    case "day": return "Welcome to SeaMinds";
    case "dusk": return "Good Evening, Captain";
    case "night": return "Good Night, Captain";
  }
}
