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
      (event, session) => {
        setSession(session);
        if (session) {
          resetRefreshFailureCount();
        }
        if (event === "SIGNED_IN" && session?.user) {
          const uid = session.user.id;
          const key = `seamind_login_notified_${uid}`;
          const last = Number(localStorage.getItem(key) || 0);
          // Throttle: notify at most once every 12 hours per user
          if (Date.now() - last > 12 * 60 * 60 * 1000) {
            localStorage.setItem(key, String(Date.now()));
            const meta: any = session.user.user_metadata || {};
            const email = session.user.email || "";
            const provider = (session.user.app_metadata as any)?.provider || "email";
            const firstName = meta.first_name || meta.given_name || (meta.name ? String(meta.name).split(" ")[0] : "");
            const lastName = meta.last_name || meta.family_name || (meta.name ? String(meta.name).split(" ").slice(1).join(" ") : "");
            const phone = session.user.phone || meta.phone || "";
            // Persist to email_leads DB (email + name + phone + source)
            supabase.rpc("upsert_email_lead", {
              p_email: email,
              p_first_name: firstName,
              p_last_name: lastName,
              p_whatsapp: phone,
              p_source: `login_${provider}`,
              p_crew_profile_id: uid,
            } as any).then(() => {}, () => {});
            // Admin email alert on every login
            supabase.functions.invoke("notify-signup", {
              body: {
                email,
                first_name: firstName,
                last_name: lastName,
                nationality: "",
                whatsapp_number: phone,
                role: `Login via ${provider}`,
                vessel_type: "",
                ship_name: "",
              },
            }).catch(() => {});
          }
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
