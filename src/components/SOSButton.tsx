import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { Phone, ExternalLink, MessageCircle, Mail, X, ShieldAlert } from "lucide-react";

interface SOSButtonProps {
  onOpenChat?: () => void;
  firstName?: string;
  shipName?: string;
  inline?: boolean;
}

interface SosContact {
  company: string | null;
  dpa_name: string | null;
  phone: string | null;
  email: string | null;
  updated_at: string | null;
}

const SOSButton = ({ onOpenChat, inline }: SOSButtonProps) => {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<SosContact[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.rpc("get_my_sos_contacts" as any);
      const list = Array.isArray(data) ? (data as unknown as SosContact[]) : [];
      setContacts(list);
      setLoaded(true);
    })();
  }, [open]);

  const handleChatNow = () => {
    setOpen(false);
    onOpenChat?.();
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
                ⚠️ In immediate danger, follow your vessel's emergency procedures and alert the bridge/master.
              </p>
            </div>

            <div className="w-full space-y-3">
              {/* Company / DPA contacts */}
              {contacts.map((c, i) => (
                <div
                  key={`${c.company || "company"}-${i}`}
                  className="w-full rounded-2xl p-4 border"
                  style={{ background: "#1B283899", borderColor: "#D4AF3744" }}
                >
                  <p className="text-base font-bold" style={{ color: "#FFFFFF" }}>
                    🏢 {c.company || "Your company"} — {c.dpa_name || "Emergency contact"}
                  </p>
                  {c.phone && (
                    <p className="text-sm font-mono mt-0.5" style={{ color: "#93C5FD" }}>{c.phone}</p>
                  )}
                  <div className="flex gap-2 mt-3">
                    {c.phone && (
                      <button
                        onClick={() => window.open(`tel:${c.phone}`, "_self")}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                        style={{ background: "#DC2626", color: "#FFFFFF" }}
                      >
                        <Phone size={16} /> Call Now
                      </button>
                    )}
                    {c.email && (
                      <button
                        onClick={() => window.open(`mailto:${c.email}?subject=${encodeURIComponent("URGENT — Seafarer emergency")}`, "_self")}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                        style={{ background: "#1D4ED8", color: "#FFFFFF" }}
                      >
                        <Mail size={16} /> Email
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {loaded && contacts.length === 0 && (
                <div className="w-full rounded-2xl p-4 border" style={{ background: "#1F293766", borderColor: "#37415188" }}>
                  <p className="text-xs leading-relaxed" style={{ color: "#9CA3AF" }}>
                    Your company's emergency contact appears here once your company adds it on SeaMinds.
                  </p>
                </div>
              )}

              {/* ISWAN SeafarerHelp — always shown */}
              <a
                href="https://www.iswan.org.uk/seafarerhelp/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-4 w-full rounded-2xl p-4 border transition-colors"
                style={{ background: "#10B98122", borderColor: "#10B98144" }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#10B981" }}>
                  <ExternalLink size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-base font-semibold" style={{ color: "#FFFFFF" }}>🌍 ISWAN SeafarerHelp</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: "#9CA3AF" }}>
                    Free, confidential, 24/7, multilingual
                  </p>
                </div>
              </a>

              {/* ITF */}
              <a
                href="https://www.itfseafarers.org"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-4 w-full rounded-2xl p-4 border transition-colors"
                style={{ background: "#F9731622", borderColor: "#F9731644" }}
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
                style={{ background: "#1B283899", borderColor: "#D4AF3744" }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#D4AF37" }}>
                  <MessageCircle size={20} style={{ color: "#0D1B2A" }} />
                </div>
                <div>
                  <p className="text-base font-semibold" style={{ color: "#FFFFFF" }}>Talk to SeaMinds AI Now</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: "#9CA3AF" }}>
                    Private conversation — nothing shared with your company
                  </p>
                </div>
              </button>
            </div>

            <p className="text-xs text-center mt-8 leading-relaxed px-4" style={{ color: "#6B7280" }}>
              In immediate danger, follow your vessel's emergency procedures and alert the bridge/master. Your conversations with SeaMinds are sealed — pressing SOS does not alert your company or captain.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default SOSButton;
