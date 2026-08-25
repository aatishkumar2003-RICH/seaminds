import { useNavigate } from "react-router-dom";

const GOLD = "#D4AF37";
const NAVY = "#0D1B2A";
const BORDER = "rgba(212,175,55,0.3)";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Path to return to after the Quick Sea Profile is completed. */
  next?: string;
}

/** Bottom sheet shown when a signed-in seafarer applies before completing their Sea Profile. */
const ApplyGateSheet = ({ open, onClose, next }: Props) => {
  const navigate = useNavigate();
  if (!open) return null;

  const target = `/quick-profile${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: NAVY, border: `1px solid ${BORDER}`, borderRadius: "20px 20px 0 0",
          width: "100%", maxWidth: 520, padding: "22px 20px calc(22px + env(safe-area-inset-bottom))",
        }}
      >
        <p style={{ color: "#fff", fontSize: 18, fontWeight: 900 }}>⚓ Complete your Sea Profile first</p>
        <p style={{ color: "#94A3B8", fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
          2 minutes, just taps — managers receive your verified profile with every application.
        </p>
        <button
          onClick={() => navigate(target)}
          style={{ marginTop: 16, width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: GOLD, color: NAVY, fontWeight: 900, fontSize: 14.5, cursor: "pointer" }}
        >
          Complete Sea Profile →
        </button>
        <button
          onClick={onClose}
          style={{ marginTop: 10, width: "100%", padding: "12px 0", borderRadius: 12, background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          Not now
        </button>
      </div>
    </div>
  );
};

export default ApplyGateSheet;
