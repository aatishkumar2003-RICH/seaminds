import { useState } from "react";
import { Phone, ExternalLink, MessageCircle, X, ShieldAlert } from "lucide-react";

interface SOSButtonProps {
  onOpenChat?: () => void;
}

const SOSButton = ({ onOpenChat }: SOSButtonProps) => {
  const [open, setOpen] = useState(false);

  const handleChatNow = () => {
    setOpen(false);
    onOpenChat?.();
  };

  return (
    <>
      {/* Floating SOS trigger */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 right-4 z-50 flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg transition-colors"
        aria-label="SOS Emergency"
      >
        <ShieldAlert size={14} />
        SOS
      </button>

      {/* Emergency overlay */}
      {open && (
        <div className="fixed inset-0 z-[100] bg-background/98 backdrop-blur-sm flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-6 pt-6 pb-2">
            <span className="text-xs text-red-500 font-bold uppercase tracking-wider">Emergency</span>
            <button onClick={() => setOpen(false)} className="p-2 rounded-full hover:bg-secondary transition-colors">
              <X size={20} className="text-muted-foreground" />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center px-6 pb-8 max-w-md mx-auto w-full">
            <h1 className="text-xl font-bold text-foreground text-center mt-4 mb-8 leading-snug">
              You Are Not Alone —<br />Help Is Here Right Now
            </h1>

            <div className="w-full space-y-4">
              {/* DPA */}
              <a
                href="tel:+000000000"
                className="flex items-start gap-4 w-full bg-red-600/15 border border-red-500/30 rounded-2xl p-5 transition-colors hover:bg-red-600/25"
              >
                <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center shrink-0">
                  <Phone size={22} className="text-white" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">Call DPA Now</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Your Designated Person Ashore — available 24/7 for safety emergencies
                  </p>
                </div>
              </a>

              {/* ITF */}
              <a
                href="https://www.itfseafarers.org"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-4 w-full bg-orange-500/15 border border-orange-500/30 rounded-2xl p-5 transition-colors hover:bg-orange-500/25"
              >
                <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center shrink-0">
                  <ExternalLink size={22} className="text-white" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">Contact ITF</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    International Transport Workers Federation — protects your rights confidentially
                  </p>
                </div>
              </a>

              {/* ISWAN */}
              <a
                href="tel:+442073232737"
                className="flex items-start gap-4 w-full bg-blue-500/15 border border-blue-500/30 rounded-2xl p-5 transition-colors hover:bg-blue-500/25"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
                  <Phone size={22} className="text-white" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">ISWAN Helpline</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    International Seafarers Welfare — free confidential support in multiple languages
                  </p>
                  <p className="text-sm font-mono text-blue-400 mt-2">+44 20 7323 2737</p>
                </div>
              </a>

              {/* SeaMinds Chat */}
              <button
                onClick={handleChatNow}
                className="flex items-start gap-4 w-full bg-emerald-500/15 border border-emerald-500/30 rounded-2xl p-5 transition-colors hover:bg-emerald-500/25 text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                  <MessageCircle size={22} className="text-white" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">Talk to SeaMinds AI Now</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Private conversation — nothing shared with your company
                  </p>
                </div>
              </button>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-8 leading-relaxed px-4">
              Your conversations with SeaMinds are sealed. Pressing SOS does not alert your company or captain. You are in control.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default SOSButton;
