import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import seamindsLogo from "@/assets/seaminds-logo.png";
import type { Screen } from "@/components/layout/types";

/* ─── Tour step definition ─── */

interface TourStep {
  icon: string;
  label: string;
  title: string;
  description: string;
  accent: string;
  tip?: string;
  screen?: Screen;
}

const TOUR_STEPS: TourStep[] = [
  {
    icon: "__LOGO__",
    label: "Welcome",
    title: "Welcome to SeaMinds",
    description: "Your private companion at sea. Everything here is confidential — your company never sees your data. Works offline & on satellite.",
    accent: "199 89% 48%",
    tip: "Swipe from the left edge to open the menu anytime",
  },
  {
    icon: "💬",
    label: "Chat",
    title: "AI Wellness Chat",
    description: "Talk to an AI trained on maritime life — isolation, fatigue, homesickness. 100% confidential. Available 24/7, even on low bandwidth.",
    accent: "199 89% 48%",
    tip: "Your conversations are never shared with anyone",
    screen: "chat",
  },
  {
    icon: "❤️",
    label: "Welfare",
    title: "Daily Wellness Check-In",
    description: "Track your mood daily and build a wellness streak. See patterns, get AI insights, and take care of your mental health on board.",
    accent: "0 84% 60%",
    tip: "Check in daily to build your streak — it takes 10 seconds",
    screen: "dashboard",
  },
  {
    icon: "⏱",
    label: "Rest Hours",
    title: "STCW Rest Hours Log",
    description: "Log work and rest hours with automatic MLC 2006 compliance checking. Never fail a PSC inspection on rest hours again.",
    accent: "199 89% 48%",
    screen: "resthours",
  },
  {
    icon: "🏆",
    label: "SMC Score",
    title: "Competency Score",
    description: "Get your AI-verified competency rating from 0.00 to 5.00. Technical skills, communication, behaviour — all assessed. Employers trust it.",
    accent: "43 96% 56%",
    tip: "Free for the first 1,000 seafarers",
    screen: "smc",
  },
  {
    icon: "💼",
    label: "Jobs",
    title: "Job Marketplace",
    description: "Find verified maritime positions worldwide. Filter by rank, vessel type, and salary. Apply directly — no agent middlemen.",
    accent: "142 71% 45%",
    screen: "opportunities",
  },
  {
    icon: "📄",
    label: "CV Builder",
    title: "Maritime CV Builder",
    description: "Build a professional maritime resume in minutes. AI auto-fills from your profile. Download as PDF with QR verification.",
    accent: "262 83% 58%",
    screen: "resume",
  },
  {
    icon: "🎓",
    label: "Academy",
    title: "Maritime Academy",
    description: "SIRE 2.0 prep, PSC inspection guides, ITF rights, vessel-specific drills. Study smart for your next promotion or inspection.",
    accent: "199 89% 48%",
    screen: "academy",
  },
  {
    icon: "🔧",
    label: "Bridge PMS",
    title: "Equipment & PMS Tools",
    description: "AI-powered equipment diagnosis, maintenance scheduling, and technical lookups. Your digital toolkit for onboard operations.",
    accent: "43 96% 56%",
    screen: "bridge",
  },
  {
    icon: "👥",
    label: "Community",
    title: "Anonymous Crew Community",
    description: "Connect with seafarers worldwide. Share experiences, ask questions, rate vessels — all completely anonymous.",
    accent: "142 71% 45%",
    screen: "community",
  },
  {
    icon: "⭐",
    label: "Vessel Rating",
    title: "Rate Your Vessel",
    description: "Rate your ship anonymously across food, accommodation, safety, internet & more. Help fellow seafarers choose better vessels — your identity is never revealed.",
    accent: "43 96% 56%",
    tip: "Ratings are 100% anonymous — no user ID is ever stored",
    screen: "vesselrating",
  },
  {
    icon: "📜",
    label: "Certificates",
    title: "Certificate Wallet",
    description: "Store all your certificates digitally. Get reminders before expiry. Never miss a renewal deadline again.",
    accent: "262 83% 58%",
    screen: "certs",
  },
  {
    icon: "📰",
    label: "News",
    title: "Maritime News",
    description: "Stay updated with curated maritime news, safety bulletins, and industry updates relevant to your rank and vessel type.",
    accent: "199 89% 48%",
    screen: "news",
  },
  {
    icon: "🚨",
    label: "SOS",
    title: "Emergency SOS",
    description: "One tap to reach emergency contacts — DPA, ISWAN helpline, ITF. Always available, always private. Your lifeline at sea.",
    accent: "0 84% 60%",
    tip: "The SOS button is always visible in the top bar",
  },
];

const STORAGE_KEY = "seamind_tour_completed";

interface OnboardingTourProps {
  enabled: boolean;
  forceShow?: boolean;
  onForceShowConsumed?: () => void;
  onNavigate?: (screen: Screen) => void;
  onDismiss?: () => void;
}

const OnboardingTour = ({ enabled, forceShow, onForceShowConsumed, onNavigate, onDismiss }: OnboardingTourProps) => {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [direction, setDirection] = useState(1);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, [enabled]);

  useEffect(() => {
    if (forceShow && enabled) {
      setStep(0);
      setDirection(1);
      setVisible(true);
      onForceShowConsumed?.();
    }
  }, [forceShow, enabled, onForceShowConsumed]);

  // Auto-navigate to the corresponding screen when step changes
  useEffect(() => {
    if (!visible || !onNavigate) return;
    const current = TOUR_STEPS[step];
    if (current?.screen) {
      onNavigate(current.screen);
    }
  }, [step, visible, onNavigate]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "1");
    onDismiss?.();
  };

  const playCelebrationChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.5);
      });
    } catch {}
  };

  const next = () => {
    if (step < TOUR_STEPS.length - 1) {
      setDirection(1);
      setStep(step + 1);
    } else {
      setShowConfetti(true);
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      playCelebrationChime();
      confettiTimerRef.current = setTimeout(() => {
        setShowConfetti(false);
        dismiss();
      }, 2500);
    }
  };

  const prev = () => {
    if (step > 0) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  const jumpTo = (i: number) => {
    setDirection(i > step ? 1 : -1);
    setStep(i);
  };

  useEffect(() => {
    return () => {
      if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
    };
  }, []);

  if (!visible) return null;

  const current = TOUR_STEPS[step];
  const isFirst = step === 0;
  const isLast = step === TOUR_STEPS.length - 1;
  const progress = ((step + 1) / TOUR_STEPS.length) * 100;

  // ─── Confetti celebration ───
  if (showConfetti) {
    const confettiPieces = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1.5 + Math.random() * 1,
      size: 6 + Math.random() * 6,
      color: ['#D4AF37', '#FFD700', '#FFA500', '#FF6347', '#4FC3F7', '#81C784', '#BA68C8'][i % 7],
      rotation: Math.random() * 720 - 360,
      drift: Math.random() * 80 - 40,
    }));

    return (
      <div className="fixed inset-0 z-[300] pointer-events-none overflow-hidden">
        {confettiPieces.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-sm"
            style={{ left: `${p.x}%`, top: -12, width: p.size, height: p.size * 0.6, backgroundColor: p.color }}
            initial={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
            animate={{ y: window.innerHeight + 40, x: p.drift, rotate: p.rotation, opacity: [1, 1, 0.8, 0] }}
            transition={{ duration: p.duration, delay: p.delay, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        ))}
        <motion.div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 text-center"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
        >
          <div className="text-5xl mb-3">🎉</div>
          <p className="text-base font-bold text-foreground">You're all set!</p>
          <p className="text-xs text-muted-foreground mt-1">Explore SeaMinds — your digital companion at sea</p>
        </motion.div>
      </div>
    );
  }

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0, scale: 0.95 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0, scale: 0.95 }),
  };

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(3px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={dismiss}
    >
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-[calc(100vw-32px)] max-w-sm rounded-2xl overflow-hidden"
          style={{
            background: "hsl(213 44% 11%)",
            border: `1px solid hsl(${current.accent} / 0.2)`,
            boxShadow: `0 0 60px hsl(${current.accent} / 0.1), 0 20px 40px rgba(0,0,0,0.4)`,
          }}
        >
          {/* Progress bar */}
          <div className="h-1 w-full" style={{ background: "hsl(var(--muted) / 0.3)" }}>
            <motion.div
              className="h-full rounded-r-full"
              style={{ background: `hsl(${current.accent})` }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>

          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
                {step + 1} / {TOUR_STEPS.length}
              </span>
              <button
                onClick={dismiss}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip tour <X size={12} />
              </button>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <motion.div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{
                  background: `hsl(${current.accent} / 0.12)`,
                  border: `1px solid hsl(${current.accent} / 0.25)`,
                }}
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.05 }}
              >
                {current.icon === "__LOGO__" ? (
                  <img src={seamindsLogo} alt="SeaMinds" className="w-8 h-8 rounded-lg object-contain" />
                ) : (
                  current.icon
                )}
              </motion.div>
              <div>
                <span
                  className="inline-block text-[10px] font-bold tracking-wider uppercase rounded-full px-2.5 py-0.5 mb-1"
                  style={{
                    background: `hsl(${current.accent} / 0.15)`,
                    color: `hsl(${current.accent})`,
                  }}
                >
                  {current.label}
                </span>
                <motion.h2
                  className="text-base font-bold text-foreground leading-tight"
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                >
                  {current.title}
                </motion.h2>
              </div>
            </div>

            <motion.p
              className="text-sm text-muted-foreground leading-relaxed mb-4"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.3 }}
            >
              {current.description}
            </motion.p>

            {current.tip && (
              <motion.div
                className="flex items-start gap-2 rounded-lg px-3 py-2.5 mb-4"
                style={{
                  background: `hsl(${current.accent} / 0.06)`,
                  border: `1px solid hsl(${current.accent} / 0.12)`,
                }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                <Sparkles size={14} className="flex-shrink-0 mt-0.5" style={{ color: `hsl(${current.accent})` }} />
                <span className="text-xs text-foreground/80 leading-snug">{current.tip}</span>
              </motion.div>
            )}

            <div className="flex flex-wrap gap-1.5 mb-5">
              {TOUR_STEPS.map((s, i) => (
                <motion.button
                  key={i}
                  onClick={() => jumpTo(i)}
                  className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] transition-all cursor-pointer"
                  style={{
                    background: i === step ? `hsl(${s.accent} / 0.2)` : "hsl(var(--muted) / 0.15)",
                    border: i === step ? `1px solid hsl(${s.accent} / 0.4)` : "1px solid transparent",
                    color: i === step ? `hsl(${s.accent})` : "hsl(var(--muted-foreground) / 0.5)",
                    fontWeight: i === step ? 700 : 400,
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="text-xs">{s.icon === "__LOGO__" ? "⚙️" : s.icon}</span>
                  {i === step && <span>{s.label}</span>}
                </motion.button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              {!isFirst ? (
                <button
                  onClick={prev}
                  className="flex items-center gap-1 text-xs px-3 py-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft size={14} /> Back
                </button>
              ) : (
                <div />
              )}

              <motion.button
                onClick={next}
                className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
                style={{ background: `hsl(${current.accent})`, color: "#0D1B2A" }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                {isLast ? "Start Exploring!" : "Next"}{" "}
                {!isLast && <ChevronRight size={14} />}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};

export default OnboardingTour;
