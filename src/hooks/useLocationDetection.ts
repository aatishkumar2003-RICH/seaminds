import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserLocation {
  country: string;
  countryCode: string;
  city: string;
  lat: number;
  lng: number;
  timezone: string;
}

export function useLocationDetection(profileId: string, locationEnabled: boolean) {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId || !locationEnabled) {
      setLoading(false);
      return;
    }

    const detect = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (!res.ok) throw new Error("Location API failed");
        const data = await res.json();

        const loc: UserLocation = {
          country: data.country_name || "",
          countryCode: data.country_code || "",
          city: data.city || "",
          lat: data.latitude || 0,
          lng: data.longitude || 0,
          timezone: data.timezone || "",
        };
        setLocation(loc);

        // Store in profile — fire and forget
        await supabase
          .from("crew_profiles")
          .update({
            home_country: loc.country,
            home_country_code: loc.countryCode,
            home_city: loc.city,
            last_login_lat: loc.lat,
            last_login_lng: loc.lng,
            last_seen: new Date().toISOString(),
          } as any)
          .eq("id", profileId);
      } catch (e) {
        console.warn("Location detection failed:", e);
      } finally {
        setLoading(false);
      }
    };

    detect();
  }, [profileId, locationEnabled]);

  return { location, loading };
}
