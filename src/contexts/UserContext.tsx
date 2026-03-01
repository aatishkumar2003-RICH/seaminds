import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  rank: string | null;
  department: string | null;
  nationality: string | null;
  vessel_type: string | null;
  total_sea_months: number;
  currently_at_sea: boolean;
  vessel_imo: string | null;
  company_name: string | null;
  home_country: string | null;
  home_country_code: string | null;
  last_seen: string | null;
  profile_completed: boolean;
}

interface UserContextType {
  user: UserProfile | null;
  authUser: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  authUser: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useUser = () => useContext(UserContext);

async function detectAndUpdateLocation(userId: string) {
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) return;
    const data = await res.json();
    await supabase
      .from("profiles")
      .update({
        home_country: data.country_name,
        home_country_code: data.country_code,
        last_seen: new Date().toISOString(),
      } as any)
      .eq("id", userId);
  } catch (e) {
    console.warn("Location detection failed:", e);
  }
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single() as any;
    if (data) setUser(data as UserProfile);
    return data;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (authUser) await fetchProfile(authUser.id);
  }, [authUser, fetchProfile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setAuthUser(session.user);
          await fetchProfile(session.user.id);
          if (event === "SIGNED_IN") {
            // Update last_seen + detect location
            detectAndUpdateLocation(session.user.id);
          }
        } else {
          setAuthUser(null);
          setUser(null);
        }
        setLoading(false);
      }
    );

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAuthUser(session.user);
        fetchProfile(session.user.id);
        detectAndUpdateLocation(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setAuthUser(null);
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, authUser, loading, signOut, refreshProfile }}>
      {children}
    </UserContext.Provider>
  );
}
