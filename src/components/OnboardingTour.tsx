import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TourStep {
  targetSelector: string;
  title: string;
  description: string;
  emoji: string;
  position: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    targetSelector: '[data-tour="sos"]',
    title: "SOS — Emergency Help",
    description: "Tap this anytime to reach DPA contacts, ISWAN helpline, and ITF. Your calls are private and never shared with your company.",
    emoji: "🚨",
    position: "bottom",
  },
  {
    targetSelector: '[data-tour="smc"]',
    title: "Your SMC Score",
    description: "Get your Seafarer Competency Score — verified by AI assessment. Stand out to recruiters and track your professional growth.",
    emoji: "🏆",
    position: "bottom",
  },
  {
    targetSelector: '[data-tour="streak"]',
    title: "Wellness Streak",
    description: "Check in daily with the AI chat to build your wellness streak. Stay consistent for your mental health at sea.",
    emoji: "🔥",
    position: "bottom",
  },
  {
    targetSelector: '[data-tour="certs"]',
    title: "Certificate Tracker",
    description: "Never miss an expiry. Upload your certificates and get reminders before they lapse.",
    emoji: "📜",
    position: "bottom",
  },
];

const STORAGE_KEY = "seamind_tour_completed";

interface OnboardingTourProps {
  enabled: boolean;
  forceShow?: boolean;
  onForceShowConsumed?: () => void;
}

const OnboardingTour = ({ enabled, forceShow, onForceShowConsumed }: OnboardingTourProps) => {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    const t = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(t);
  }, [enabled]);

  useEffect(() => {
    if (forceShow && enabled) {
      setStep(0);
      setVisible(true);
      onForceShowConsumed?.();
    }
  }, [forceShow, enabled, onForceShowConsumed]);

  const measureTarget = useCallback(() => {
    if (!visible) return;
    const el = document.querySelector(TOUR_STEPS[step]?.targetSelector);
    if (el) {
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [step, visible]);

  useEffect(() => {
    measureTarget();
    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);
    return () => {
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
    };
  }, [measureTarget]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "1");
  };

  const next = () => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      setShowConfetti(true);
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      confettiTimerRef.current = setTimeout(() => {
        setShowConfetti(false);
        dismiss();
      }, 2200);
    }
  };

  useEffect(() => {
    return () => {
      if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
    };
  }, []);

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!visible || !rect) return null;

  const current = TOUR_STEPS[step];
  const isLast = step === TOUR_STEPS.length - 1;

  // Tooltip positioning
  const tooltipStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 200,
    maxWidth: 300,
    width: "calc(100vw - 32px)",
  };

  const OFFSET = 12;
  if (current.position === "bottom") {
    tooltipStyle.top = rect.bottom + OFFSET;
    tooltipStyle.left = Math.max(16, Math.min(rect.left + rect.width / 2 - 150, window.innerWidth - 316));
  } else if (current.position === "top") {
    tooltipStyle.bottom = window.innerHeight - rect.top + OFFSET;
    tooltipStyle.left = Math.max(16, Math.min(rect.left + rect.width / 2 - 150, window.innerWidth - 316));
  }

  // Spotlight cutout
  const pad = 6;
  const spotStyle: React.CSSProperties = {
    position: "fixed",
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
    borderRadius: 14,
    zIndex: 199,
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.7)",
    pointerEvents: "none",
  };

  const confettiPieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1.5 + Math.random() * 1,
    size: 6 + Math.random() * 6,
    color: ['#D4AF37', '#FFD700', '#FFA500', '#FF6347', '#4FC3F7', '#81C784', '#BA68C8'][i % 7],
    rotation: Math.random() * 720 - 360,
    drift: Math.random() * 80 - 40,
  }));

  if (showConfetti) {
    return (
      <div className="fixed inset-0 z-[300] pointer-events-none overflow-hidden">
        {confettiPieces.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-sm"
            style={{
              left: `${p.x}%`,
              top: -12,
              width: p.size,
              height: p.size * 0.6,
              backgroundColor: p.color,
            }}
            initial={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
            animate={{
              y: window.innerHeight + 40,
              x: p.drift,
              rotate: p.rotation,
              opacity: [1, 1, 0.8, 0],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          />
        ))}
        <motion.div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 text-center"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
        >
          <div className="text-4xl mb-2">🎉</div>
          <p className="text-sm font-bold text-foreground">You're all set!</p>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      {/* Overlay */}
      <motion.div
        className="fixed inset-0 z-[198]"
        onClick={dismiss}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      />

      {/* Spotlight */}
      <motion.div
        style={spotStyle}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.05 }}
      />

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          style={tooltipStyle}
          className="rounded-2xl border p-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, y: current.position === "top" ? 8 : -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: current.position === "top" ? 8 : -8, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
        >
          <div
            className="absolute inset-0 rounded-2xl -z-10"
            style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--gold) / 0.25)" }}
          />

          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <motion.div
              className="flex items-center gap-2"
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.25 }}
            >
              <span className="text-xl">{current.emoji}</span>
              <h3 className="text-sm font-bold text-foreground">{current.title}</h3>
            </motion.div>
            <button
              onClick={dismiss}
              className="p-1 rounded-full hover:bg-secondary transition-colors"
            >
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>

          {/* Body */}
          <motion.p
            className="text-xs text-muted-foreground leading-relaxed mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.3 }}
          >
            {current.description}
          </motion.p>

          {/* Footer */}
          <motion.div
            className="flex items-center justify-between"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.25 }}
          >
            {/* Dots */}
            <div className="flex gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  animate={{
                    background: i === step ? "hsl(var(--gold))" : "hsl(var(--muted-foreground) / 0.3)",
                    scale: i === step ? 1.3 : 1,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  onClick={prev}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft size={12} /> Back
                </button>
              )}
              <motion.button
                onClick={next}
                className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: "hsl(var(--gold))", color: "hsl(var(--primary-foreground))" }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
              >
                {isLast ? "Got it!" : "Next"} {!isLast && <ChevronRight size={12} />}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};

export default OnboardingTour;
