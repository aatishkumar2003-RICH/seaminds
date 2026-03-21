import { useState, useMemo } from "react";
import { X } from "lucide-react";

const RANKS = [
  "Captain", "Chief Officer", "2nd Officer", "3rd Officer",
  "Chief Engineer", "2nd Engineer", "3rd Engineer", "ETO",
  "Bosun", "AB", "OS", "Cook", "Cadet",
];

const VESSEL_TYPES = [
  "Container", "Tanker (Chemical)", "Tanker (Crude)",
  "Bulk Carrier", "General Cargo", "LNG", "LPG",
  "Car Carrier", "Offshore", "Cruise",
];

interface SalaryRange { min: number; max: number }

const SALARY_DATA: Record<string, SalaryRange> = {
  "Captain|Container": { min: 7500, max: 11400 },
  "Captain|Tanker (Crude)": { min: 8000, max: 13200 },
  "Captain|Tanker (Chemical)": { min: 7500, max: 12000 },
  "Captain|LNG": { min: 10000, max: 16800 },
  "Captain|LPG": { min: 9000, max: 14400 },
  "Captain|Bulk Carrier": { min: 7000, max: 10800 },
  "Captain|General Cargo": { min: 6500, max: 10200 },
  "Captain|Car Carrier": { min: 7500, max: 11400 },
  "Captain|Offshore": { min: 9000, max: 15600 },
  "Captain|Cruise": { min: 8500, max: 14400 },
  "Chief Officer|Container": { min: 4500, max: 7800 },
  "Chief Officer|Tanker (Crude)": { min: 5000, max: 8400 },
  "Chief Officer|Tanker (Chemical)": { min: 4800, max: 8200 },
  "Chief Officer|LNG": { min: 6000, max: 10200 },
  "Chief Officer|Bulk Carrier": { min: 4200, max: 7200 },
  "Chief Officer|General Cargo": { min: 4000, max: 6600 },
  "Chief Officer|LPG": { min: 5500, max: 9000 },
  "Chief Officer|Car Carrier": { min: 4500, max: 7800 },
  "Chief Officer|Offshore": { min: 5500, max: 9600 },
  "Chief Officer|Cruise": { min: 5000, max: 8400 },
  "2nd Officer|Container": { min: 3200, max: 5400 },
  "2nd Officer|Tanker (Crude)": { min: 3500, max: 5800 },
  "2nd Officer|Tanker (Chemical)": { min: 3300, max: 5500 },
  "2nd Officer|LNG": { min: 4000, max: 6600 },
  "2nd Officer|Bulk Carrier": { min: 3000, max: 5000 },
  "2nd Officer|General Cargo": { min: 2800, max: 4800 },
  "2nd Officer|LPG": { min: 3500, max: 6000 },
  "2nd Officer|Car Carrier": { min: 3200, max: 5400 },
  "2nd Officer|Offshore": { min: 3800, max: 6200 },
  "2nd Officer|Cruise": { min: 3400, max: 5800 },
  "3rd Officer|Container": { min: 2500, max: 4200 },
  "3rd Officer|Tanker (Crude)": { min: 2700, max: 4600 },
  "3rd Officer|Tanker (Chemical)": { min: 2600, max: 4300 },
  "3rd Officer|LNG": { min: 3000, max: 5000 },
  "3rd Officer|Bulk Carrier": { min: 2300, max: 3800 },
  "3rd Officer|General Cargo": { min: 2200, max: 3600 },
  "3rd Officer|LPG": { min: 2800, max: 4600 },
  "3rd Officer|Car Carrier": { min: 2500, max: 4200 },
  "3rd Officer|Offshore": { min: 2800, max: 4800 },
  "3rd Officer|Cruise": { min: 2600, max: 4300 },
  "Chief Engineer|Container": { min: 6500, max: 10200 },
  "Chief Engineer|Tanker (Crude)": { min: 7000, max: 12000 },
  "Chief Engineer|Tanker (Chemical)": { min: 6800, max: 11400 },
  "Chief Engineer|LNG": { min: 9000, max: 15600 },
  "Chief Engineer|Bulk Carrier": { min: 6000, max: 9600 },
  "Chief Engineer|General Cargo": { min: 5500, max: 9000 },
  "Chief Engineer|LPG": { min: 8000, max: 13200 },
  "Chief Engineer|Car Carrier": { min: 6500, max: 10200 },
  "Chief Engineer|Offshore": { min: 8500, max: 14400 },
  "Chief Engineer|Cruise": { min: 7500, max: 12000 },
  "2nd Engineer|Container": { min: 4000, max: 6600 },
  "2nd Engineer|Tanker (Crude)": { min: 4500, max: 7200 },
  "2nd Engineer|Tanker (Chemical)": { min: 4200, max: 7000 },
  "2nd Engineer|LNG": { min: 5500, max: 9000 },
  "2nd Engineer|Bulk Carrier": { min: 3800, max: 6200 },
  "2nd Engineer|General Cargo": { min: 3500, max: 6000 },
  "2nd Engineer|LPG": { min: 5000, max: 8400 },
  "2nd Engineer|Car Carrier": { min: 4000, max: 6600 },
  "2nd Engineer|Offshore": { min: 5000, max: 8400 },
  "2nd Engineer|Cruise": { min: 4500, max: 7200 },
  "3rd Engineer|Container": { min: 2800, max: 4600 },
  "3rd Engineer|Tanker (Crude)": { min: 3000, max: 5000 },
  "3rd Engineer|Tanker (Chemical)": { min: 2900, max: 4800 },
  "3rd Engineer|LNG": { min: 3500, max: 6000 },
  "3rd Engineer|Bulk Carrier": { min: 2600, max: 4300 },
  "3rd Engineer|General Cargo": { min: 2400, max: 4100 },
  "3rd Engineer|LPG": { min: 3200, max: 5400 },
  "3rd Engineer|Car Carrier": { min: 2800, max: 4600 },
  "3rd Engineer|Offshore": { min: 3200, max: 5400 },
  "3rd Engineer|Cruise": { min: 3000, max: 4800 },
  "ETO|Container": { min: 3500, max: 6000 },
  "ETO|Tanker (Crude)": { min: 3800, max: 6600 },
  "ETO|Tanker (Chemical)": { min: 3600, max: 6200 },
  "ETO|LNG": { min: 4500, max: 7800 },
  "ETO|Bulk Carrier": { min: 3200, max: 5400 },
  "ETO|General Cargo": { min: 3000, max: 5000 },
  "ETO|LPG": { min: 4000, max: 7000 },
  "ETO|Car Carrier": { min: 3500, max: 6000 },
  "ETO|Offshore": { min: 4000, max: 7200 },
  "ETO|Cruise": { min: 3800, max: 6600 },
  "Bosun|Container": { min: 1800, max: 2900 },
  "Bosun|Tanker (Crude)": { min: 2000, max: 3200 },
  "Bosun|Tanker (Chemical)": { min: 1900, max: 3100 },
  "Bosun|LNG": { min: 2200, max: 3600 },
  "Bosun|Bulk Carrier": { min: 1700, max: 2800 },
  "Bosun|General Cargo": { min: 1600, max: 2600 },
  "Bosun|LPG": { min: 2000, max: 3400 },
  "Bosun|Car Carrier": { min: 1800, max: 2900 },
  "Bosun|Offshore": { min: 2200, max: 3600 },
  "Bosun|Cruise": { min: 2000, max: 3200 },
  "AB|Container": { min: 1400, max: 2200 },
  "AB|Tanker (Crude)": { min: 1500, max: 2400 },
  "AB|Tanker (Chemical)": { min: 1450, max: 2300 },
  "AB|LNG": { min: 1800, max: 2900 },
  "AB|Bulk Carrier": { min: 1300, max: 2000 },
  "AB|General Cargo": { min: 1200, max: 1900 },
  "AB|LPG": { min: 1600, max: 2600 },
  "AB|Car Carrier": { min: 1400, max: 2200 },
  "AB|Offshore": { min: 1700, max: 2800 },
  "AB|Cruise": { min: 1500, max: 2400 },
  "OS|Container": { min: 1000, max: 1700 },
  "OS|Tanker (Crude)": { min: 1100, max: 1800 },
  "OS|Tanker (Chemical)": { min: 1050, max: 1700 },
  "OS|LNG": { min: 1300, max: 2200 },
  "OS|Bulk Carrier": { min: 950, max: 1600 },
  "OS|General Cargo": { min: 900, max: 1400 },
  "OS|LPG": { min: 1200, max: 1900 },
  "OS|Car Carrier": { min: 1000, max: 1700 },
  "OS|Offshore": { min: 1200, max: 2000 },
  "OS|Cruise": { min: 1100, max: 1800 },
  "Cook|Container": { min: 1200, max: 1900 },
  "Cook|Tanker (Crude)": { min: 1300, max: 2000 },
  "Cook|Tanker (Chemical)": { min: 1250, max: 2000 },
  "Cook|LNG": { min: 1500, max: 2400 },
  "Cook|Bulk Carrier": { min: 1100, max: 1800 },
  "Cook|General Cargo": { min: 1000, max: 1700 },
  "Cook|LPG": { min: 1400, max: 2200 },
  "Cook|Car Carrier": { min: 1200, max: 1900 },
  "Cook|Offshore": { min: 1400, max: 2300 },
  "Cook|Cruise": { min: 1300, max: 2000 },
  "Cadet|Container": { min: 600, max: 1100 },
  "Cadet|Tanker (Crude)": { min: 650, max: 1100 },
  "Cadet|Tanker (Chemical)": { min: 630, max: 1100 },
  "Cadet|LNG": { min: 750, max: 1300 },
  "Cadet|Bulk Carrier": { min: 550, max: 1000 },
  "Cadet|General Cargo": { min: 500, max: 1000 },
  "Cadet|LPG": { min: 700, max: 1200 },
  "Cadet|Car Carrier": { min: 600, max: 1100 },
  "Cadet|Offshore": { min: 700, max: 1300 },
  "Cadet|Cruise": { min: 650, max: 1100 },
};

// Tips based on vessel type premiums
const TIPS: Record<string, string> = {
  "LNG": "💡 LNG vessels typically pay 30-40% more than standard tankers due to specialised cargo handling requirements.",
  "LPG": "💡 LPG carriers offer premium rates, typically 20-30% above bulk carrier scales.",
  "Offshore": "💡 Offshore rates include rotation premiums — shorter contracts but higher daily rates.",
  "Tanker (Crude)": "💡 Crude tankers pay above average due to hazardous cargo allowances under ITF scales.",
  "Cruise": "💡 Cruise ship roles often include tips/gratuities on top of base salary for certain positions.",
  "Container": "💡 Container vessel rates are the industry benchmark — most ITF scales are based on these.",
};

const fmt = (n: number) => `$${n.toLocaleString()}`;

interface SalaryBenchmarkProps {
  open: boolean;
  onClose: () => void;
}

const SalaryBenchmark = ({ open, onClose }: SalaryBenchmarkProps) => {
  const [rank, setRank] = useState("");
  const [vessel, setVessel] = useState("");

  const result = useMemo(() => {
    if (!rank || !vessel) return null;
    const key = `${rank}|${vessel}`;
    return SALARY_DATA[key] || null;
  }, [rank, vessel]);

  // Calculate percentile among all ranges for this rank
  const percentile = useMemo(() => {
    if (!rank || !result) return 0;
    const rankRanges = Object.entries(SALARY_DATA)
      .filter(([k]) => k.startsWith(`${rank}|`))
      .map(([, v]) => (v.min + v.max) / 2);
    const mid = (result.min + result.max) / 2;
    const below = rankRanges.filter((r) => r <= mid).length;
    return Math.round((below / rankRanges.length) * 100);
  }, [rank, result]);

  const tip = vessel ? TIPS[vessel] || `💡 Always compare offers against ITF published scales before signing your contract.` : "";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div
        className="w-full max-w-md rounded-t-2xl overflow-y-auto"
        style={{
          background: "linear-gradient(to bottom, #0d1b2a, #1b2838)",
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgba(212,175,55,0.15)" }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: "#D4AF37" }}>💰 Market Salary Benchmark</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Based on ITF/BIMCO published scales 2026</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Dropdowns */}
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Your Rank
              </label>
              <select
                value={rank}
                onChange={(e) => setRank(e.target.value)}
                className="w-full rounded-xl px-3 py-3 text-sm text-foreground appearance-none"
                style={{
                  background: "rgba(13,27,42,0.8)",
                  border: "1px solid rgba(212,175,55,0.3)",
                }}
              >
                <option value="">Select rank...</option>
                {RANKS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Vessel Type
              </label>
              <select
                value={vessel}
                onChange={(e) => setVessel(e.target.value)}
                className="w-full rounded-xl px-3 py-3 text-sm text-foreground appearance-none"
                style={{
                  background: "rgba(13,27,42,0.8)",
                  border: "1px solid rgba(212,175,55,0.3)",
                }}
              >
                <option value="">Select vessel type...</option>
                {VESSEL_TYPES.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Result Card */}
          {result && (
            <div
              className="rounded-xl p-4 space-y-4"
              style={{
                background: "rgba(212,175,55,0.06)",
                border: "1px solid rgba(212,175,55,0.2)",
              }}
            >
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Your Market Rate
                </p>
                <p className="text-2xl font-bold" style={{ color: "#D4AF37" }}>
                  {fmt(result.min)} — {fmt(result.max)}
                  <span className="text-sm font-normal text-muted-foreground"> / month</span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Source: ITF/BIMCO Scale 2026</p>
              </div>

              {/* Percentile bar */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <p className="text-[10px] text-muted-foreground">Market Position for {rank}</p>
                  <p className="text-[10px] font-bold" style={{ color: percentile >= 50 ? "#22c55e" : "#ef4444" }}>
                    Top {100 - percentile}%
                  </p>
                </div>
                <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${percentile}%`,
                      background: percentile >= 50
                        ? "linear-gradient(to right, #22c55e, #4ade80)"
                        : "linear-gradient(to right, #ef4444, #f87171)",
                    }}
                  />
                </div>
                <p className="text-[11px] mt-1.5 font-medium" style={{ color: percentile >= 50 ? "#4ade80" : "#fca5a5" }}>
                  {percentile >= 75
                    ? "🔥 Top earner bracket for your rank"
                    : percentile >= 50
                    ? "✅ Above market average — solid rate"
                    : "⚠️ Below market — consider negotiating!"}
                </p>
              </div>

              {/* Tip */}
              {tip && (
                <div
                  className="rounded-lg p-3"
                  style={{
                    background: "rgba(212,175,55,0.08)",
                    border: "1px solid rgba(212,175,55,0.12)",
                  }}
                >
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{tip}</p>
                </div>
              )}
            </div>
          )}

          {!result && rank && vessel && (
            <div className="rounded-xl p-4 text-center" style={{ background: "rgba(13,27,42,0.8)" }}>
              <p className="text-xs text-muted-foreground">No data available for this combination.</p>
            </div>
          )}

          {/* Disclaimer */}
          <div className="rounded-xl p-3" style={{ background: "rgba(13,27,42,0.6)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <p className="text-[10px] text-muted-foreground text-center leading-tight">
              Salary ranges are indicative and based on published ITF/BIMCO 2026 scales. Actual offers vary by company, flag state, and experience.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalaryBenchmark;
