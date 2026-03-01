import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  rank: string | null;
  department: string | null;
  nationality: string | null;
  vessel_type: string | null;
  total_sea_months: number;
  vessel_imo: string | null;
  company_name: string | null;
  is_company: boolean;
  home_country: string | null;
  home_country_code: string | null;
  last_seen: string | null;
  location_personalisation: boolean;
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

export function UserProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("crew_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) setUser(data as any);
    return data;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (authUser) await fetchProfile(authUser.id);
  }, [authUser, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (session?.user) {
          setAuthUser(session.user);
          await fetchProfile(session.user.id);
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (event === 'SIGNED_IN' && session?.user) {
          setAuthUser(session.user);
          await fetchProfile(session.user.id);
          setLoading(false);
        }
        if (event === 'SIGNED_OUT') {
          setAuthUser(null);
          setUser(null);
          setLoading(false);
        }
      }
    );

    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 3000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
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
