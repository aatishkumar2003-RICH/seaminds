import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// R5: in-app recovery message, shown only after the server health gate marked the attempt recoverable.
const RecoveryBanner = () => {
  const { user } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();
  const [item, setItem] = useState<{ mode: string } | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!user) { setItem(null); return; }
    supabase.rpc("get_my_recovery" as any).then(({ data }) => {
      const arr = (data as any[]) || [];
      setItem(arr[0] || null);
    }, () => {});
  }, [user, loc.pathname]);

  if (!item || hidden || loc.pathname.includes("/exam") || loc.pathname.startsWith("/recover")) return null;
  return (
    <div className="fixed bottom-20 left-3 right-3 z-50 rounded-xl p-3 shadow-lg md:left-auto md:w-96"
      style={{ background: "#112240", border: "1px solid rgba(212,175,55,0.3)" }}>
      <p className="text-sm font-bold" style={{ color: "#D4AF37" }}>Your assessment is ready to resume</p>
      <p className="text-xs mt-1" style={{ color: "#94A3B8" }}>
        The earlier interruption was a technical issue. Your answers are saved and you are not penalised.
      </p>
      <div className="flex gap-2 mt-2">
        {item.mode === "self" && (
          <button onClick={() => navigate("/app?tab=smc")} className="px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: "#D4AF37", color: "#0D1B2A" }}>
            Resume
          </button>
        )}
        {item.mode === "company" && (
          <span className="text-xs" style={{ color: "#94A3B8" }}>Open the interview link from your notifications to resume.</span>
        )}
        <button onClick={() => setHidden(true)} className="px-3 py-1.5 rounded-xl text-xs" style={{ color: "#D4AF37", border: "1px solid #D4AF37" }}>
          Later
        </button>
      </div>
    </div>
  );
};

export default RecoveryBanner;
