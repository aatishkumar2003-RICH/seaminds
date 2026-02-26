import { useMemo } from "react";
import { type TimeOfDay } from "@/hooks/useTimeOfDay";

interface Props {
  timeOfDay: TimeOfDay;
}

const skyGradients: Record<TimeOfDay, string> = {
  dawn: "linear-gradient(180deg, #1a0533 0%, #4a1942 30%, #FF6B35 80%, #FFa040 100%)",
  day: "linear-gradient(180deg, #1a6eb5 0%, #4a9ad4 50%, #87CEEB 100%)",
  dusk: "linear-gradient(180deg, #2D1B69 0%, #8B3A62 35%, #FF4500 80%, #FF6B35 100%)",
  night: "linear-gradient(180deg, #0D1B2A 0%, #112240 50%, #0D1B2A 100%)",
};

const waveColors: Record<TimeOfDay, [string, string, string]> = {
  dawn: ["#0D4F5C", "#1a3a40", "#0D4F5C"],
  day: ["#1a6eb5", "#2980b9", "#1a6eb5"],
  dusk: ["#1a2a3a", "#2D1B69", "#1a2a3a"],
  night: ["#0D1B2A", "#112240", "#0a1525"],
};

const waveOpacities: Record<TimeOfDay, [number, number, number]> = {
  dawn: [0.25, 0.2, 0.15],
  day: [0.3, 0.25, 0.18],
  dusk: [0.3, 0.22, 0.15],
  night: [0.25, 0.2, 0.12],
};

const OceanBackground = ({ timeOfDay }: Props) => {
  const stars = useMemo(() => {
    return Array.from({ length: 90 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 55,
      size: Math.random() * 2 + 1,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 2,
    }));
  }, []);

  const showStars = timeOfDay === "night" || timeOfDay === "dawn";
  const showMoon = timeOfDay === "night";
  const showSun = timeOfDay === "day" || timeOfDay === "dawn" || timeOfDay === "dusk";
  const colors = waveColors[timeOfDay];
  const opacities = waveOpacities[timeOfDay];

  const sunConfig = {
    dawn: { cx: "85%", cy: "68%", r: 30, fill: "#FF6B35", glowColor: "rgba(255,107,53,0.3)", glowR: 70 },
    day: { cx: "70%", cy: "18%", r: 28, fill: "#FFD700", glowColor: "rgba(255,215,0,0.2)", glowR: 65 },
    dusk: { cx: "15%", cy: "65%", r: 35, fill: "#FF4500", glowColor: "rgba(255,69,0,0.35)", glowR: 80 },
    night: { cx: "0", cy: "0", r: 0, fill: "none", glowColor: "none", glowR: 0 },
  };

  const reflectionColor: Record<TimeOfDay, string> = {
    dawn: "rgba(255,160,64,0.2)",
    day: "rgba(255,255,255,0.1)",
    dusk: "rgba(255,180,50,0.3)",
    night: "rgba(192,216,255,0.12)",
  };

  const shipReflectionColor: Record<TimeOfDay, string> = {
    dawn: "hsla(30,80%,60%,0.2)",
    day: "hsla(0,0%,100%,0.08)",
    dusk: "hsla(35,90%,55%,0.25)",
    night: "hsla(35,55%,72%,0.18)",
  };

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" style={{ opacity: 0.4 }} aria-hidden="true">
      {/* Sky gradient */}
      <div className="absolute inset-0 transition-colors duration-1000" style={{ background: skyGradients[timeOfDay] }} />

      {/* Stars (night + dawn fading) */}
      {showStars && (
        <div className="absolute inset-0" style={{ opacity: timeOfDay === "dawn" ? 0.3 : 1 }}>
          {stars.map((s) => (
            <div
              key={s.id}
              className="absolute rounded-full bg-white animate-twinkle"
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: s.size,
                height: s.size,
                opacity: 0,
                animationDelay: `${s.delay}s`,
                animationDuration: `${s.duration}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Moon (night only) */}
      {showMoon && (
        <div className="absolute" style={{ right: "15%", top: "10%" }}>
          <div className="rounded-full" style={{
            width: 50, height: 50,
            background: "radial-gradient(circle, #e8e8f0 0%, #c0c8d8 60%, transparent 100%)",
            boxShadow: "0 0 40px 15px rgba(192,216,255,0.15), 0 0 80px 30px rgba(192,216,255,0.08)",
          }} />
          {/* Moon water reflection */}
          <div className="absolute animate-moon-reflect" style={{
            top: 200, left: -20, width: 90, height: 120,
            background: "linear-gradient(180deg, rgba(192,216,255,0.12) 0%, transparent 100%)",
            filter: "blur(12px)",
            borderRadius: "50%",
          }} />
        </div>
      )}

      {/* Sun (dawn/day/dusk) */}
      {showSun && (
        <div className="absolute inset-0">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="sunGlow">
                <stop offset="0%" stopColor={sunConfig[timeOfDay].fill} stopOpacity="1" />
                <stop offset="40%" stopColor={sunConfig[timeOfDay].glowColor} />
                <stop offset="100%" stopColor="transparent" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx={sunConfig[timeOfDay].cx} cy={sunConfig[timeOfDay].cy}
              r={sunConfig[timeOfDay].glowR} fill="url(#sunGlow)" />
            <circle cx={sunConfig[timeOfDay].cx} cy={sunConfig[timeOfDay].cy}
              r={sunConfig[timeOfDay].r} fill={sunConfig[timeOfDay].fill} opacity="0.9" />
          </svg>
          {/* Sun water reflection */}
          <div style={{
            position: "absolute",
            bottom: "15%",
            left: timeOfDay === "dusk" ? "10%" : timeOfDay === "dawn" ? "80%" : "65%",
            width: 150, height: 80,
            background: `radial-gradient(ellipse, ${reflectionColor[timeOfDay]} 0%, transparent 70%)`,
            filter: "blur(10px)",
          }} />
        </div>
      )}

      {/* Clouds (day + dusk) */}
      {(timeOfDay === "day" || timeOfDay === "dusk" || timeOfDay === "dawn") && (
        <div className="absolute inset-0">
          {[
            { top: "12%", left: "10%", w: 200, h: 30, delay: 0, dur: 60 },
            { top: "22%", left: "50%", w: 160, h: 24, delay: 15, dur: 80 },
            { top: "8%", left: "75%", w: 180, h: 28, delay: 30, dur: 70 },
          ].map((c, i) => (
            <div key={i} className="absolute animate-cloud-drift" style={{
              top: c.top, left: c.left,
              width: c.w, height: c.h,
              borderRadius: "50px",
              background: timeOfDay === "day"
                ? "rgba(255,255,255,0.15)"
                : timeOfDay === "dawn"
                  ? "rgba(255,180,120,0.12)"
                  : "rgba(255,100,50,0.15)",
              filter: "blur(8px)",
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.dur}s`,
            }} />
          ))}
        </div>
      )}

      {/* Bioluminescence (night only) */}
      {timeOfDay === "night" && (
        <div className="absolute bottom-0 left-0 w-full" style={{ height: "25%" }}>
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="absolute rounded-full animate-biolum" style={{
              left: `${8 + i * 8}%`,
              bottom: `${Math.random() * 40 + 5}%`,
              width: 4 + Math.random() * 6,
              height: 4 + Math.random() * 6,
              background: "rgba(0,180,255,0.4)",
              filter: "blur(3px)",
              animationDelay: `${Math.random() * 4}s`,
            }} />
          ))}
        </div>
      )}

      {/* Waves — 3 layers */}
      <svg
        className="absolute bottom-0 left-0 w-full"
        style={{ height: "30%" }}
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path className="animate-wave3" opacity={opacities[2]} fill={colors[2]}
          d="M0,288 C200,270 400,300 600,290 C800,280 1000,260 1200,280 C1300,290 1400,300 1440,288 L1440,320 L0,320 Z"
        />
        <path className="animate-wave2" opacity={opacities[1]} fill={colors[1]}
          d="M0,256 C160,240 320,280 480,272 C640,264 800,220 960,240 C1120,260 1280,280 1440,256 L1440,320 L0,320 Z"
        />
        <path className="animate-wave1" opacity={opacities[0]} fill={colors[0]}
          d="M0,224 C120,200 240,260 360,240 C480,220 600,180 720,192 C840,204 960,260 1080,256 C1200,252 1320,200 1440,224 L1440,320 L0,320 Z"
        />
      </svg>

      {/* Ship + light reflection */}
      <div className="absolute w-full animate-ship-move" style={{ top: "50%" }}>
        {/* Ship water reflection */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            top: 62,
            width: 200,
            height: 80,
            background: `radial-gradient(ellipse, ${shipReflectionColor[timeOfDay]} 0%, transparent 70%)`,
            filter: "blur(10px)",
          }}
        />
        {/* Cargo ship SVG — larger & detailed */}
        <svg
          width="320" height="100" viewBox="0 0 320 100"
          className="block mx-auto"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Hull */}
          <path d="M15,75 L50,90 L270,90 L305,75 L290,75 L280,84 L40,84 L30,75 Z" fill="#2C3E50" />
          {/* Bow */}
          <path d="M50,75 L15,75 L40,68 L60,62 L65,75 Z" fill="#34495E" />
          {/* Deck line */}
          <rect x="50" y="72" width="240" height="3" fill="#2C3E50" rx="1" />

          {/* Containers row 1 */}
          <rect x="65" y="55" width="18" height="17" rx="1" fill="#3d566e" />
          <rect x="85" y="52" width="18" height="20" rx="1" fill="#2C3E50" />
          <rect x="105" y="55" width="18" height="17" rx="1" fill="#3d566e" />
          <rect x="125" y="50" width="18" height="22" rx="1" fill="#2C3E50" />
          <rect x="145" y="53" width="18" height="19" rx="1" fill="#3d566e" />
          <rect x="165" y="55" width="18" height="17" rx="1" fill="#2C3E50" />

          {/* Superstructure */}
          <rect x="200" y="38" width="55" height="34" rx="2" fill="#34495E" />
          <rect x="208" y="25" width="40" height="15" rx="2" fill="#3d566e" />
          {/* Bridge */}
          <rect x="215" y="14" width="26" height="13" rx="2" fill="#445a6e" />
          {/* Bridge windows */}
          <rect x="218" y="17" width="6" height="4" rx="1" fill={timeOfDay === "night" || timeOfDay === "dusk" ? "#FFD700" : "#8ab4d8"} opacity="0.7" />
          <rect x="226" y="17" width="6" height="4" rx="1" fill={timeOfDay === "night" || timeOfDay === "dusk" ? "#FFD700" : "#8ab4d8"} opacity="0.6" />
          <rect x="234" y="17" width="6" height="4" rx="1" fill={timeOfDay === "night" || timeOfDay === "dusk" ? "#FFD700" : "#8ab4d8"} opacity="0.7" />

          {/* Mast */}
          <line x1="228" y1="3" x2="228" y2="14" stroke="#445a6e" strokeWidth="2.5" />
          {/* Masthead white light */}
          <circle cx="228" cy="4" r="2" fill="white" opacity={timeOfDay === "night" || timeOfDay === "dusk" ? "0.9" : "0.3"}>
            {(timeOfDay === "night" || timeOfDay === "dusk") && (
              <animate attributeName="opacity" values="0.9;0.5;0.9" dur="3s" repeatCount="indefinite" />
            )}
          </circle>

          {/* Funnel */}
          <rect x="240" y="20" width="12" height="18" rx="1" fill="#2C3E50" />
          <rect x="242" y="18" width="8" height="4" rx="1" fill="#34495E" />

          {/* Smoke */}
          <g className="animate-smoke">
            <ellipse cx="246" cy="14" rx="6" ry="3" fill="rgba(160,160,180,0.25)" />
            <ellipse cx="250" cy="10" rx="8" ry="4" fill="rgba(160,160,180,0.15)" />
            <ellipse cx="255" cy="6" rx="10" ry="3" fill="rgba(160,160,180,0.08)" />
          </g>

          {/* Portholes — yellow dots along hull */}
          {[80, 100, 120, 140, 160, 180, 210, 230, 245].map((x, i) => (
            <circle key={i} cx={x} cy={78} r={1.5}
              fill={timeOfDay === "night" || timeOfDay === "dusk" ? "#FFD700" : "#c8a84e"}
              opacity={timeOfDay === "night" || timeOfDay === "dusk" ? 0.8 : 0.3}
            />
          ))}

          {/* Navigation lights */}
          {/* Red - port (left) */}
          <circle cx="35" cy="72" r="2" fill="#ff3333"
            opacity={timeOfDay === "night" || timeOfDay === "dusk" ? "0.9" : "0.2"}>
            {(timeOfDay === "night" || timeOfDay === "dusk") && (
              <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2.5s" repeatCount="indefinite" />
            )}
          </circle>
          {/* Green - starboard (right) */}
          <circle cx="290" cy="72" r="2" fill="#33ff33"
            opacity={timeOfDay === "night" || timeOfDay === "dusk" ? "0.9" : "0.2"}>
            {(timeOfDay === "night" || timeOfDay === "dusk") && (
              <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2.8s" repeatCount="indefinite" />
            )}
          </circle>

          {/* Seagulls (day only) */}
          {timeOfDay === "day" && (
            <>
              <path d="M90,20 Q95,15 100,20" fill="none" stroke="#556" strokeWidth="1.2" />
              <path d="M140,12 Q144,8 148,12" fill="none" stroke="#556" strokeWidth="1" />
              <path d="M180,25 Q183,21 186,25" fill="none" stroke="#556" strokeWidth="1" />
            </>
          )}
        </svg>
      </div>
    </div>
  );
};

export default OceanBackground;
