import { Shield, Heart, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import seamindsLogo from "@/assets/seaminds-logo.png";
import { supabase } from "@/integrations/supabase/client";

interface LandingScreenProps {
  onGetStarted: () => void;
  onManagerLogin: () => void;
}

const LandingScreen = ({ onGetStarted, onManagerLogin }: LandingScreenProps) => {
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://seaminds.life/app',
      },
    });
  };

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

      <button
        onClick={handleGoogleLogin}
        className="w-full max-w-xs h-12 text-base font-semibold bg-white text-gray-800 rounded-md flex items-center justify-center gap-3 hover:bg-gray-100 transition-colors mb-3"
      >
        <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.01 24.01 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        Continue with Google
      </button>

      <div className="flex items-center gap-3 w-full max-w-xs mb-3">
        <div className="flex-1 h-px bg-gray-700" />
        <span className="text-gray-500 text-xs">or</span>
        <div className="flex-1 h-px bg-gray-700" />
      </div>

      <Button
        className="w-full max-w-xs h-12 text-base font-semibold"
        onClick={onGetStarted}
      >
        Sign in with Email
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
