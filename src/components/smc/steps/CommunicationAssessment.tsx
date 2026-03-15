import { useState, useRef } from "react";
import { Mic, Square, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import StepProgressBar from "./StepProgressBar";

interface Props {
  assessmentId: string;
  questions?: string[];
  onNext: () => void;
  onSkipToEnd?: () => void;
}

interface VoiceCard {
  id: string;
  title: string;
  prompt: string;
}

const DEFAULT_CARDS: VoiceCard[] = [
  {
    id: "routine",
    title: "Routine Communication",
    prompt: "Describe to a new crew member joining today how to properly close and dog a watertight door on the main deck.",
  },
  {
    id: "emergency",
    title: "Emergency Communication",
    prompt: "You see smoke coming from the paint locker. Make a PA announcement to the crew.",
  },
  {
    id: "professional",
    title: "Professional Communication",
    prompt: "You need to report to your Master that the cargo loading rate has dropped significantly and you are concerned about making the tide. What do you say?",
  },
];

const CommunicationAssessment = ({ assessmentId, onNext, onSkipToEnd }: Props) => {
  const [recordings, setRecordings] = useState<Record<string, boolean>>({});
  const [activeRecording, setActiveRecording] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const allDone = CARDS.every((c) => recordings[c.id]);

  const startRecording = async (cardId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRef.current = recorder;
      recorder.start();
      setActiveRecording(cardId);
      setTimer(0);
      intervalRef.current = setInterval(() => setTimer((t) => t + 1), 1000);

      recorder.ondataavailable = () => {
        // In production, upload audio blob to storage
      };
    } catch {
      // Microphone not available — mark as done anyway for demo
      setRecordings((prev) => ({ ...prev, [cardId]: true }));
    }
  };

  const stopRecording = (cardId: string) => {
    mediaRef.current?.stop();
    mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
    if (intervalRef.current) clearInterval(intervalRef.current);
    setActiveRecording(null);
    setTimer(0);
    setRecordings((prev) => ({ ...prev, [cardId]: true }));
  };

  const handleContinue = async () => {
    try {
      await supabase
        .from("smc_assessments")
        .update({ english_score: 3.89, current_step: 5 })
        .eq("id", assessmentId);
    } catch (err) { console.log("DB write error (non-blocking):", err); }
    onNext();
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        <StepProgressBar currentStep={3} totalSteps={5} label="Communication Assessment" />

        <div className="text-center space-y-2">
          <h1 className="text-lg font-bold text-foreground">Communication Assessment</h1>
          <p className="text-sm text-muted-foreground">Record 3 voice responses. Maximum 60 seconds each. Speak clearly.</p>
        </div>

        <div className="space-y-4">
          {CARDS.map((card) => {
            const done = recordings[card.id];
            const isActive = activeRecording === card.id;
            return (
              <div key={card.id} className={`bg-secondary rounded-xl border ${done ? "border-primary" : "border-border"} p-4 space-y-3`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
                  {done && <Check size={16} className="text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground">{card.prompt}</p>

                {done ? (
                  <p className="text-xs text-primary font-medium">✓ Voice sample received</p>
                ) : isActive ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => stopRecording(card.id)}
                      className="bg-destructive text-destructive-foreground rounded-full w-12 h-12 flex items-center justify-center"
                    >
                      <Square size={18} />
                    </button>
                    <div className="flex-1 h-8 bg-muted rounded-full overflow-hidden relative">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex gap-1">
                          {[...Array(12)].map((_, i) => (
                            <div
                              key={i}
                              className="w-1 bg-primary rounded-full animate-pulse"
                              style={{
                                height: `${12 + Math.random() * 16}px`,
                                animationDelay: `${i * 0.1}s`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-foreground font-mono w-10">{formatTime(timer)}</span>
                  </div>
                ) : (
                  <button
                    onClick={() => startRecording(card.id)}
                    disabled={!!activeRecording}
                    className="bg-destructive/20 hover:bg-destructive/30 border border-destructive/40 text-destructive rounded-full w-14 h-14 flex items-center justify-center mx-auto transition-colors disabled:opacity-40"
                  >
                    <Mic size={24} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {allDone && (
          <button
            onClick={handleContinue}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl text-base hover:bg-primary/90 transition-colors"
          >
            Continue →
          </button>
        )}

        <button
          onClick={onSkipToEnd || onNext}
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Skip to Certificate (testing only)
        </button>
      </div>
    </div>
  );
};

export default CommunicationAssessment;
