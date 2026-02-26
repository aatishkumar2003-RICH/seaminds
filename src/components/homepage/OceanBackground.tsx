import { useMemo } from "react";

const OceanBackground = () => {
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

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Stars */}
      <div className="absolute inset-0">
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

      {/* Waves */}
      <svg
        className="absolute bottom-0 left-0 w-full"
        style={{ height: "30%" }}
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path className="animate-wave1" opacity="0.15" fill="#0D4F5C"
          d="M0,224 C120,200 240,260 360,240 C480,220 600,180 720,192 C840,204 960,260 1080,256 C1200,252 1320,200 1440,224 L1440,320 L0,320 Z"
        />
        <path className="animate-wave2" opacity="0.12" fill="#0D4F5C"
          d="M0,256 C160,240 320,280 480,272 C640,264 800,220 960,240 C1120,260 1280,280 1440,256 L1440,320 L0,320 Z"
        />
        <path className="animate-wave3" opacity="0.08" fill="#0D4F5C"
          d="M0,288 C200,270 400,300 600,290 C800,280 1000,260 1200,280 C1300,290 1400,300 1440,288 L1440,320 L0,320 Z"
        />
      </svg>

      {/* Ship + light reflection group */}
      <div className="absolute w-full animate-ship-move" style={{ top: "52%" }}>
        {/* Light reflection on water */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            top: 38,
            width: 120,
            height: 60,
            background: "radial-gradient(ellipse, hsla(35,55%,72%,0.18) 0%, transparent 70%)",
            filter: "blur(8px)",
          }}
        />
        {/* Ship silhouette */}
        <svg
          width="180" height="50" viewBox="0 0 180 50"
          className="block mx-auto opacity-20"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Hull */}
          <path d="M10,40 L30,48 L150,48 L170,40 L160,40 L155,44 L25,44 L20,40 Z" fill="#0a1628" />
          {/* Superstructure */}
          <rect x="110" y="22" width="30" height="18" rx="1" fill="#0c1e30" />
          <rect x="115" y="14" width="20" height="10" rx="1" fill="#0c1e30" />
          {/* Bridge */}
          <rect x="120" y="8" width="10" height="8" rx="1" fill="#0e2238" />
          {/* Mast */}
          <line x1="125" y1="2" x2="125" y2="8" stroke="#0e2238" strokeWidth="2" />
          {/* Containers */}
          <rect x="40" y="30" width="12" height="10" rx="0.5" fill="#0b1a2a" />
          <rect x="54" y="28" width="12" height="12" rx="0.5" fill="#0a1628" />
          <rect x="68" y="30" width="12" height="10" rx="0.5" fill="#0b1a2a" />
          <rect x="82" y="26" width="12" height="14" rx="0.5" fill="#0a1628" />
          <rect x="96" y="28" width="12" height="12" rx="0.5" fill="#0b1a2a" />
          {/* Bow */}
          <path d="M30,40 L10,40 L28,36 L40,34 L40,40 Z" fill="#0c1e30" />
          {/* Small light on bridge */}
          <circle cx="125" cy="11" r="1" fill="hsl(35,55%,72%)" opacity="0.6" />
        </svg>
      </div>
    </div>
  );
};

export default OceanBackground;
