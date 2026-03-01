import { useUser } from "@/contexts/UserContext";
import { countryToFlag, getCountryTheme } from "@/lib/countryThemes";

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

const AuthGreetingBanner = () => {
  const { user } = useUser();

  if (!user || !user.full_name) return null;

  const theme = getCountryTheme(user.home_country_code ?? undefined);
  const flag = user.home_country_code ? countryToFlag(user.home_country_code) : "";

  return (
    <div
      className="mx-4 mt-3 rounded-xl px-4 py-3 border border-border/50"
      style={{
        backgroundColor: `${theme.accent}15`,
        borderLeftWidth: "3px",
        borderLeftColor: theme.accent,
      }}
    >
      <p className="text-sm text-foreground font-medium">
        {getTimeGreeting()}, {user.full_name} {flag}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {user.rank} · {user.nationality} {user.vessel_type ? `· ${user.vessel_type}` : ""}
      </p>
    </div>
  );
};

export default AuthGreetingBanner;
