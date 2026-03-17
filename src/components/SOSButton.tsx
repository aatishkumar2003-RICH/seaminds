import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { Phone, ExternalLink, MessageCircle, X, ShieldAlert } from "lucide-react";

interface SOSButtonProps {
  onOpenChat?: () => void;
  firstName?: string;
  shipName?: string;
  inline?: boolean;
}

interface DPAContact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  region: string | null;
  is_default: boolean | null;
  active: boolean | null;
  sort_order: number | null;
}

const FALLBACK_CONTACTS: DPAContact[] = [
  {
    id: "iswan-fallback",
    name: "ISWAN Helpline",
    phone: "+442073232737",
    email: null,
    region: "Global",
    is_default: true,
    active: true,
    sort_order: 0,
  },
];

const SOSButton = ({ onOpenChat, firstName, shipName, inline }: SOSButtonProps) => {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<DPAContact[]>(FALLBACK_CONTACTS);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("dpa_contacts")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (data && data.length > 0) {
        // Ensure ISWAN fallback is always present
        const hasISWAN = data.some((c) => c.phone.replace(/\D/g, "") === "442073232737");
        if (!hasISWAN) {
          setContacts([...FALLBACK_CONTACTS, ...data]);
        } else {
          setContacts(data);
        }
      }
    })();
  }, [open]);

  const handleChatNow = () => {
    setOpen(false);
    onOpenChat?.();
  };

  const nowUTC = () => new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

  const emergencyWhatsApp = () => {
    const text = encodeURIComponent(
      `EMERGENCY: I need urgent assistance. Name: ${firstName || "Unknown"}, Ship: ${shipName || "Unknown"}, Location: ${nowUTC()}`
    );
    window.open(`https://wa.me/6221000000?text=${text}`, "_blank");
  };

  return (
    <>
      {/* Floating SOS trigger */}
      <button
        onClick={() => { setOpen(true); trackEvent("sos_button_click"); }}
        className={`${inline ? 'relative' : 'fixed top-4 right-4'} z-50 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg transition-colors`}
        style={{ background: "#DC2626", color: "#FFFFFF" }}
        aria-label="SOS Emergency"
      >
        <ShieldAlert size={14} />
        SOS
      </button>

      {/* Emergency overlay */}
      {open && (
        <div className="fixed inset-0 z-[100] flex flex-col overflow-y-auto" style={{ background: "#0A1628F8" }}>
          {/* Red header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-3" style={{ background: "#7F1D1D" }}>
            <span className="text-base font-bold tracking-wide" style={{ color: "#FDE68A" }}>
              🚨 EMERGENCY — SOS
            </span>
            <button onClick={() => setOpen(false)} className="p-2 rounded-full transition-colors" style={{ color: "#FDE68A" }}>
              <X size={22} />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center px-5 pb-8 max-w-md mx-auto w-full">
            {/* Warning */}
            <div className="w-full rounded-xl p-4 mt-5 mb-6 border" style={{ background: "#1B283866", borderColor: "#D4AF3744" }}>
              <p className="text-xs leading-relaxed" style={{ color: "#FDE68A" }}>
                ⚠️ This will connect you to maritime welfare and safety contacts. For life-threatening emergencies call your vessel's emergency number first.
              </p>
            </div>

            <h1 className="text-xl font-bold text-center mb-6 leading-snug" style={{ color: "#FFFFFF" }}>
              You Are Not Alone —<br />Help Is Here Right Now
            </h1>

            {/* DPA Contact List */}
            <div className="w-full space-y-3">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="w-full rounded-2xl p-4 border"
                  style={{ background: "#1B283899", borderColor: "#D4AF3744" }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-base font-bold" style={{ color: "#FFFFFF" }}>{c.name}</p>
                      <p className="text-sm font-mono mt-0.5" style={{ color: "#93C5FD" }}>{c.phone}</p>
                    </div>
                    {c.region && (
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full" style={{ background: "#D4AF3733", color: "#D4AF37" }}>
                        {c.region}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => window.open(`tel:${c.phone}`, "_self")}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                      style={{ background: "#DC2626", color: "#FFFFFF" }}
                    >
                      <Phone size={16} /> Call Now
                    </button>
                    <button
                      onClick={() => window.open(`https://wa.me/${c.phone.replace(/\D/g, "")}`, "_blank")}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                      style={{ background: "#16A34A", color: "#FFFFFF" }}
                    >
                      <MessageCircle size={16} /> WhatsApp
                    </button>
                  </div>
                </div>
              ))}

              {/* ITF */}
              <a
                href="https://www.itfseafarers.org"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-4 w-full rounded-2xl p-4 border transition-colors"
                style={{ background: "#F97316" + "22", borderColor: "#F9731644" }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#F97316" }}>
                  <ExternalLink size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-base font-semibold" style={{ color: "#FFFFFF" }}>Contact ITF</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: "#9CA3AF" }}>
                    International Transport Workers Federation — protects your rights confidentially
                  </p>
                </div>
              </a>

              {/* SeaMinds AI Chat */}
              <button
                onClick={handleChatNow}
                className="flex items-start gap-4 w-full rounded-2xl p-4 border transition-colors text-left"
                style={{ background: "#10B98122", borderColor: "#10B98144" }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#10B981" }}>
                  <MessageCircle size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-base font-semibold" style={{ color: "#FFFFFF" }}>Talk to SeaMinds AI Now</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: "#9CA3AF" }}>
                    Private conversation — nothing shared with your company
                  </p>
                </div>
              </button>

              {/* Emergency WhatsApp to SeaMinds */}
              <button
                onClick={emergencyWhatsApp}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold border transition-colors"
                style={{ background: "#D4AF3722", borderColor: "#D4AF3744", color: "#D4AF37" }}
              >
                <MessageCircle size={16} /> Send Emergency WhatsApp to SeaMinds
              </button>
            </div>

            <p className="text-xs text-center mt-8 leading-relaxed px-4" style={{ color: "#6B7280" }}>
              Your conversations with SeaMinds are sealed. Pressing SOS does not alert your company or captain. You are in control.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default SOSButton;
