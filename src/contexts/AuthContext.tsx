import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { resetRefreshFailureCount } from "@/lib/authErrorHandler";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isReady: boolean;
  accessToken: string;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isReady: false,
  accessToken: "",
});

export const useAuth = () => useContext(AuthContext);

/**
 * Helper to get the current access token for edge function calls.
 * Components should prefer useAuth().accessToken, but this is available
 * for cases where the context isn't accessible (rare).
 */
export const getAccessToken = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || "";
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 1. Restore session from storage
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsReady(true);
    });

    // 2. Single listener for all auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session) {
          resetRefreshFailureCount();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const value: AuthContextType = {
    session,
    user: session?.user ?? null,
    isReady,
    accessToken: session?.access_token || "",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
