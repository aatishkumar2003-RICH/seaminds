import { Shield, Heart, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import seamindsLogo from "@/assets/seaminds-logo.png";

interface LandingScreenProps {
  onGetStarted: () => void;
  onManagerLogin: () => void;
}

const LandingScreen = ({ onGetStarted, onManagerLogin }: LandingScreenProps) => {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <img src={seamindsLogo} alt="SeaMinds Logo" className="w-24 h-24 mb-4" />

      <h1 className="text-3xl font-bold text-foreground gold-glow mb-1">SeaMinds</h1>
      <p className="text-muted-foreground text-sm mb-10">Your Private Companion at Sea</p>

      <div className="space-y-4 mb-10 w-full max-w-xs">
        <div className="flex items-start gap-3 text-left">
          <Shield size={16} className="text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Confidential conversations — never shared with your company
          </p>
        </div>
        <div className="flex items-start gap-3 text-left">
          <Heart size={16} className="text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Built by a Master Mariner who understands your world
          </p>
        </div>
        <div className="flex items-start gap-3 text-left">
          <Globe size={16} className="text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Available 24/7 — wherever your voyage takes you
          </p>
        </div>
      </div>

      <Button
        className="w-full max-w-xs h-12 text-base font-semibold"
        onClick={() => { window.location.href = '/auth'; }}
      >
        Get Started
      </Button>

      <p className="text-[11px] text-muted-foreground mt-4">Free for crew members</p>

      <button
        onClick={() => { window.location.href = '/auth'; }}
        className="mt-6 text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors"
      >
        Manager Login
      </button>
    </div>
  );
};

export default LandingScreen;
