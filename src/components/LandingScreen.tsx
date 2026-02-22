import { Anchor, Shield, Heart, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LandingScreenProps {
  onGetStarted: () => void;
  onManagerLogin: () => void;
}

const LandingScreen = ({ onGetStarted, onManagerLogin }: LandingScreenProps) => {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-8">
        <Anchor size={32} className="text-primary" />
      </div>

      <h1 className="text-3xl font-bold text-foreground gold-glow mb-2">SeaMinds</h1>
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
        onClick={onGetStarted}
      >
        Get Started
      </Button>

      <p className="text-[11px] text-muted-foreground mt-4">Free for crew members</p>

      <button
        onClick={onManagerLogin}
        className="mt-6 text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors"
      >
        Manager Login
      </button>
    </div>
  );
};

export default LandingScreen;
