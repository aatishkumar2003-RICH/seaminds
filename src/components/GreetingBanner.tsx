import { MapPin } from "lucide-react";
import { UserLocation } from "@/hooks/useLocationDetection";
import { countryToFlag, getCountryTheme } from "@/lib/countryThemes";

interface GreetingBannerProps {
  firstName: string;
  location: UserLocation | null;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const GreetingBanner = ({ firstName, location }: GreetingBannerProps) => {
  if (!location) return null;

  const theme = getCountryTheme(location.countryCode);
  const flag = location.countryCode ? countryToFlag(location.countryCode) : "";

  return (
    <div
      className="mx-4 mt-3 rounded-xl px-4 py-3 flex items-center gap-3 border border-border/50"
      style={{ backgroundColor: `${theme.accent}15` }}
    >
      <MapPin size={14} className="text-muted-foreground flex-shrink-0" />
      <p className="text-xs text-foreground leading-relaxed">
        {getTimeGreeting()}, <span className="font-semibold">{firstName}</span>.{" "}
        Connecting from {location.city && `${location.city}, `}
        {flag} {location.country}
      </p>
    </div>
  );
};

export default GreetingBanner;
