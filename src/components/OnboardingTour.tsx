import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronRight, ChevronLeft, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ────────────────────────────────────────────
   Tour step types
   ──────────────────────────────────────────── */

interface FullScreenStep {
  type: "fullscreen";
  icon: string;
  title: string;
  subtitle: string;
  bullets: { emoji: string; text: string }[];
  accent: string; // HSL accent color for this slide
}

interface SpotlightStep {
  type: "spotlight";
  targetSelector: string;
  title: string;
  description: string;
  emoji: string;
  position: "top" | "bottom";
  navigateTo?: string; // screen to tap into
}

type TourStep = FullScreenStep | SpotlightStep;

/* ────────────────────────────────────────────
   Tour content — value-driven storytelling
   ──────────────────────────────────────────── */

const TOUR_STEPS: TourStep[] = [
  // Step 1: Welcome — what is SeaMinds
  {
    type: "fullscreen",
    icon: "⚓",
    title: "Welcome to SeaMinds",
    subtitle: "Your private companion at sea — built with 10,000+ seafarers across 35 countries.",
    bullets: [
      { emoji: "🛡️", text: "Everything here is private — your company never sees your data" },
      { emoji: "🤖", text: "AI-powered tools designed specifically for merchant seafarers" },
      { emoji: "🌍", text: "Works offline & on low-bandwidth satellite connections" },
    ],
    accent: "199 89% 48%", // ocean blue
  },

  // Step 2: Pillar 1 — Mental Wellness
  {
    type: "fullscreen",
    icon: "💬",
    title: "Private Mental Health Support",
    subtitle: "Talk to an AI trained on maritime life — no judgement, no records shared with anyone.",
    bullets: [
      { emoji: "🧠", text: "24/7 confidential AI chat — understands isolation, fatigue & homesickness" },
      { emoji: "🔥", text: "Daily wellness streak — build a habit of checking in with yourself" },
      { emoji: "🚨", text: "SOS button — instant access to ISWAN, ITF & DPA emergency contacts" },
    ],
    accent: "142 71% 45%", // sea green
  },

  // Step 3: Pillar 2 — Career & Competency
  {
    type: "fullscreen",
    icon: "🏆",
    title: "Verified Competency & Career",
    subtitle: "Your skills, certified. Your next job, found.",
    bullets: [
      { emoji: "📊", text: "SMC Score — AI-assessed competency rating that employers trust" },
      { emoji: "💼", text: "Job marketplace — matching you with verified positions worldwide" },
      { emoji: "📄", text: "Maritime CV Builder — professional resume in minutes, not hours" },
    ],
    accent: "43 96% 56%", // gold
  },

  // Step 4: Pillar 3 — Protection & Knowledge
  {
    type: "fullscreen",
    icon: "🛡️",
    title: "Protection & Maritime Knowledge",
    subtitle: "Know your rights. Stay compliant. Report safely.",
    bullets: [
      { emoji: "📜", text: "Certificate Tracker — never miss an expiry, get early reminders" },
      { emoji: "⏱", text: "STCW Rest Hours log — automatic compliance tracking" },
      { emoji: "🎓", text: "Academy — SIRE 2.0, PSC inspections, ITF rights & more" },
    ],
    accent: "262 83% 58%", // purple
  },

  // Step 5: Pillar 4 — Community & Tools
  {
    type: "fullscreen",
    icon: "🔧",
    title: "Onboard Tools & Community",
    subtitle: "Everything you need on one screen — from PMS checklists to anonymous crew connections.",
    bullets: [
      { emoji: "🔧", text: "Bridge PMS — equipment diagnosis, maintenance scheduling & AI lookups" },
      { emoji: "👥", text: "Anonymous community — connect with crew worldwide without identity exposure" },
      { emoji: "⭐", text: "Vessel ratings — rate your ship & help fellow seafarers choose better" },
    ],
    accent: "199 89% 48%",
  },

  // Step 6: Spotlight on navigation — show them where to start
  {
    type: "spotlight",
    targetSelector: '[data-tour="sos"]',
    title: "SOS — Always One Tap Away",
    description: "In a crisis, tap SOS for immediate access to emergency contacts: DPA, ISWAN helpline, and ITF. Private. Always available.",
    emoji: "🚨",
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
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, [enabled]);

  useEffect(() => {
    if (forceShow && enabled) {
      setStep(0);
      setVisible(true);
      onForceShowConsumed?.();
    }
  }, [forceShow, enabled, onForceShowConsumed]);

  const currentStep = TOUR_STEPS[step];

  // Measure spotlight target
  const measureTarget = useCallback(() => {
    if (!visible) return;
    if (currentStep?.type !== "spotlight") { setRect(null); return; }
    const el = document.querySelector(currentStep.targetSelector);
    if (el) setRect(el.getBoundingClientRect());
    else setRect(null);
  }, [step, visible, currentStep]);

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

  const playCelebrationChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.6);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.6);
      });
    } catch {}
  };

  const next = () => {
    if (step < TOUR_STEPS.length - 1) {
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
    if (step > 0) setStep(step - 1);
  };

  useEffect(() => {
    return () => {
      if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
    };
  }, []);

  if (!visible) return null;

  const isLast = step === TOUR_STEPS.length - 1;

  // ─── Confetti celebration ───
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

  if (showConfetti) {
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
          <p className="text-base font-bold text-foreground">You're ready to go!</p>
          <p className="text-xs text-muted-foreground mt-1">Start by chatting with your AI companion</p>
        </motion.div>
      </div>
    );
  }

  // ─── Full-screen value slide ───
  if (currentStep.type === "fullscreen") {
    const fs = currentStep;
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center px-6"
          style={{ background: "hsl(213 44% 10% / 0.97)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Skip */}
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg"
          >
            Skip <X size={14} />
          </button>

          {/* Icon */}
          <motion.div
            className="text-5xl mb-4"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
          >
            {fs.icon}
          </motion.div>

          {/* Title */}
          <motion.h2
            className="text-xl font-bold text-foreground text-center mb-2 max-w-xs"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            {fs.title}
          </motion.h2>

          {/* Subtitle */}
          <motion.p
            className="text-sm text-muted-foreground text-center leading-relaxed mb-8 max-w-sm"
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.4 }}
          >
            {fs.subtitle}
          </motion.p>

          {/* Bullets */}
          <div className="w-full max-w-sm space-y-3 mb-10">
            {fs.bullets.map((b, i) => (
              <motion.div
                key={i}
                className="flex items-start gap-3 rounded-xl px-4 py-3"
                style={{
                  background: `hsl(${fs.accent} / 0.08)`,
                  border: `1px solid hsl(${fs.accent} / 0.15)`,
                }}
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.35 }}
              >
                <span className="text-lg flex-shrink-0 mt-0.5">{b.emoji}</span>
                <span className="text-sm text-foreground/90 leading-snug">{b.text}</span>
              </motion.div>
            ))}
          </div>

          {/* Footer nav */}
          <motion.div
            className="flex items-center justify-between w-full max-w-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.3 }}
          >
            {/* Dots */}
            <div className="flex gap-2">
              {TOUR_STEPS.map((_, i) => (
                <motion.div
                  key={i}
                  className="rounded-full"
                  style={{ width: i === step ? 20 : 6, height: 6 }}
                  animate={{
                    background: i === step ? `hsl(${fs.accent})` : "hsl(var(--muted-foreground) / 0.25)",
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  onClick={prev}
                  className="flex items-center gap-1 text-xs px-3 py-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft size={14} /> Back
                </button>
              )}
              <motion.button
                onClick={next}
                className="flex items-center gap-1.5 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
                style={{ background: `hsl(${fs.accent})`, color: "#0D1B2A" }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                {isLast ? "Let's go!" : "Next"} <ChevronRight size={14} />
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ─── Spotlight step ───
  if (currentStep.type === "spotlight" && rect) {
    const sp = currentStep;

    const tooltipStyle: React.CSSProperties = {
      position: "fixed",
      zIndex: 200,
      maxWidth: 300,
      width: "calc(100vw - 32px)",
    };

    const OFFSET = 14;
    if (sp.position === "bottom") {
      tooltipStyle.top = rect.bottom + OFFSET;
      tooltipStyle.left = Math.max(16, Math.min(rect.left + rect.width / 2 - 150, window.innerWidth - 316));
    } else {
      tooltipStyle.bottom = window.innerHeight - rect.top + OFFSET;
      tooltipStyle.left = Math.max(16, Math.min(rect.left + rect.width / 2 - 150, window.innerWidth - 316));
    }

    const pad = 6;
    const spotStyle: React.CSSProperties = {
      position: "fixed",
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
      borderRadius: 14,
      zIndex: 199,
      boxShadow: "0 0 0 9999px rgba(0,0,0,0.75)",
      pointerEvents: "none",
    };

    return (
      <>
        <motion.div className="fixed inset-0 z-[198]" onClick={dismiss} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} />
        <motion.div style={spotStyle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, delay: 0.05 }} />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            style={tooltipStyle}
            className="rounded-2xl border p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: sp.position === "top" ? 8 : -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: sp.position === "top" ? 8 : -8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
          >
            <div className="absolute inset-0 rounded-2xl -z-10" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--gold) / 0.25)" }} />

            <div className="flex items-center justify-between mb-2">
              <motion.div className="flex items-center gap-2" initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
                <span className="text-xl">{sp.emoji}</span>
                <h3 className="text-sm font-bold text-foreground">{sp.title}</h3>
              </motion.div>
              <button onClick={dismiss} className="p-1 rounded-full hover:bg-secondary transition-colors">
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>

            <motion.p className="text-xs text-muted-foreground leading-relaxed mb-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.3 }}>
              {sp.description}
            </motion.p>

            <motion.div className="flex items-center justify-between" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="flex gap-2">
                {TOUR_STEPS.map((_, i) => (
                  <motion.div
                    key={i}
                    className="rounded-full"
                    style={{ width: i === step ? 20 : 6, height: 6 }}
                    animate={{
                      background: i === step ? "hsl(var(--gold))" : "hsl(var(--muted-foreground) / 0.25)",
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {step > 0 && (
                  <button onClick={prev} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground">
                    <ChevronLeft size={12} /> Back
                  </button>
                )}
                <motion.button
                  onClick={next}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: "hsl(var(--gold))", color: "hsl(var(--primary-foreground))" }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {isLast ? "Start Exploring!" : "Next"} {!isLast && <ChevronRight size={12} />}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </>
    );
  }

  // Spotlight step but target not found — skip forward
  if (currentStep.type === "spotlight" && !rect) {
    return null;
  }

  return null;
};

export default OnboardingTour;
