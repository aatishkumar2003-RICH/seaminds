import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ChevronLeft, Lock, Mail, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isPreviewOwner } from "@/components/OwnerPreviewGate";

/** Private partner phase: only the owner browses the full exchange until it is opened in admin settings. */
const MarketplaceGate = ({ children }: { children: ReactNode }) => {
  const { user, isReady } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "open" | "closed">("loading");
  const [isVendor, setIsVendor] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    if (isPreviewOwner(user)) { setState("open"); return; }
    (async () => {
      const { data: open } = await supabase.rpc("marketplace_is_open");
      if (user) {
        const { data } = await supabase.rpc("is_marketplace_vendor", { _uid: user.id });
        setIsVendor(!!data);
      }
      setState(open ? "open" : "closed");
    })();
  }, [isReady, user]);

  if (state === "loading") return null;
  if (state === "open") return <>{children}</>;

  const body = encodeURIComponent("Hello SeaMinds team,\n\nWe procure marine spares / repair services and would like early buyer access to the Maritime Exchange.\n\nCompany:\nCity / country:\nWhat we usually buy:\n");

  return (
    <div className="min-h-screen bg-background p-4">
      <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))} className="flex items-center gap-1 text-sm text-primary">
        <ChevronLeft size={18} /> Back
      </button>
      <div className="mx-auto mt-8 max-w-md space-y-4">
        <div className="rounded-2xl border border-primary/30 bg-card p-6 text-center">
          <Lock className="mx-auto mb-3 text-primary" size={34} />
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Partner preview</p>
          <h1 className="mt-1 text-lg font-bold text-foreground">SeaMinds Maritime Industrial Exchange</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Spares suppliers, shipyards, workshops, ship brokers and marine stores are listing now. Every company sees only its own listings until the exchange opens to buyers.
          </p>
          <Link to="/marketplace/vendor" className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground no-underline">
            <Store size={16} /> {isVendor ? "Open my supplier desk" : "Supplier / Yard / Broker login"}
          </Link>
          <a href={`mailto:admin@seaminds.life?subject=${encodeURIComponent("Buyer early access: Maritime Exchange")}&body=${body}`}
            className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-primary px-5 py-3 text-sm font-bold text-primary no-underline">
            <Mail size={16} /> Buyer early access
          </a>
        </div>
        <ul className="space-y-1.5 rounded-2xl border border-primary/30 bg-card p-4 text-xs text-muted-foreground">
          <li>✓ Free listing during the partner phase · no commission</li>
          <li>✓ Your stock, prices and contacts stay private to your company</li>
          <li>✓ Quote requests reach you by email, WhatsApp or online</li>
        </ul>
      </div>
    </div>
  );
};

export default MarketplaceGate;
