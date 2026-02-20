import { useState } from "react";
import { Mail, Sparkles } from "lucide-react";

interface WelcomeScreensProps {
  onComplete: () => void;
}

const WelcomeScreens = ({ onComplete }: WelcomeScreensProps) => {
  const [step, setStep] = useState<1 | 2>(1);

  if (step === 1) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center">
        <div className="w-full max-w-xs space-y-8">
          <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
            <Mail size={36} className="text-primary" />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Everything you share with SeaMinds is completely private. Your conversations cannot be read by your Captain or company. No reporting. No consequences. Just someone to talk to.
          </p>
          <button
            onClick={() => setStep(2)}
            className="w-full bg-primary text-primary-foreground font-medium text-sm rounded-xl py-3.5 transition-opacity"
          >
            I Understand — Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <div className="w-full max-w-xs space-y-8">
        <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center mx-auto">
          <Sparkles size={36} className="text-primary" />
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          You have been selected as one of a small group of crew members to help shape something built for seafarers worldwide. Your honest feedback matters.
        </p>
        <button
          onClick={onComplete}
          className="w-full bg-primary text-primary-foreground font-medium text-sm rounded-xl py-3.5 transition-opacity"
        >
          Let's Begin
        </button>
      </div>
    </div>
  );
};

export default WelcomeScreens;
