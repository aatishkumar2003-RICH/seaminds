import { useState } from "react";
import { BadgeCheck, MapPin, Ship, Calendar, X } from "lucide-react";
import type { UnifiedVacancy } from "@/lib/vacancyFeed";
import { vacancySalary } from "@/lib/vacancyFeed";

const GOLD = "#D4AF37";
const NAVY = "#0D1B2A";
const CARD = "#112240";
const BORDER = "#1e3a5f";

export interface JobCardProps {
  vacancy: UnifiedVacancy;
  variant: "row" | "card";
  applied?: "ok" | "dup";
  busy?: boolean;
  /** Optional crawlable link for the vacancy title. */
  href?: string;
  onApply: () => void;
}

/** Button label for a vacancy, decided only by its channel. */
export const applyLabel = (v: UnifiedVacancy) => {
  if (v.kind === "direct") return "APPLY WITH SEA PROFILE →";
  if (v.applyUrl) return "APPLY →";
  if (v.whatsapp) return "APPLY VIA WHATSAPP";
  if (v.email) return "✉️ APPLY BY EMAIL";
  return "APPLY →";
};

const timeAgo = (iso: string | null) => {
  if (!iso) return "";
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
};

const joinDateText = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

/** One vacancy, rendered identically (data + channel + applied state) on every surface. */
const JobCard = ({ vacancy: v, variant, applied, busy, href, onApply }: JobCardProps) => {
  const [flierOpen, setFlierOpen] = useState(false);
  const salary = vacancySalary(v);
  const compact = variant === "row";
  const disabled = !!applied || !!busy;

  const label = applied === "dup"
    ? "Already applied ✓"
    : applied === "ok"
      ? "Applied ✓"
      : busy
        ? "Sending…"
        : applyLabel(v);

  return (
    <article
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: compact ? 12 : 16,
        display: "flex",
        flexDirection: "column",
        gap: compact ? 7 : 10,
      }}
    >
      {v.kind === "direct" && (
        <span
          style={{
            alignSelf: "flex-start", borderRadius: 999, padding: "3px 9px",
            fontSize: 9.5, fontWeight: 800, letterSpacing: 0.8,
            background: "rgba(212,175,55,0.12)", color: GOLD, border: "1px solid rgba(212,175,55,0.35)",
          }}
        >
          DIRECT — POSTED ON SEAMINDS
        </span>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ color: GOLD, fontSize: compact ? 15 : 18, fontWeight: 800, lineHeight: 1.2 }}>
            {href ? <a href={href} style={{ color: GOLD, textDecoration: "none" }}>{v.rank}</a> : v.rank}
            {v.positions > 1 && (
              <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700 }}> ×{v.positions}</span>
            )}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
            <span style={{ color: "#e2e8f0", fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {v.company}
            </span>
            {v.verified && <BadgeCheck size={13} style={{ color: "#3B82F6", flexShrink: 0 }} />}
          </div>
        </div>
        <span style={{ fontSize: 10, color: "#94a3b8", whiteSpace: "nowrap" }}>{timeAgo(v.postedAt)}</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11.5, color: "#cbd5e1" }}>
        {(v.vessel || v.contractDuration) && (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Ship size={12} style={{ color: "#94a3b8" }} />
            {[v.vessel, v.contractDuration].filter(Boolean).join(" · ")}
          </span>
        )}
        {v.port && (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <MapPin size={12} style={{ color: "#94a3b8" }} />{v.port}
          </span>
        )}
        {joinDateText(v.joiningDate) && (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Calendar size={12} style={{ color: "#94a3b8" }} />{joinDateText(v.joiningDate)}
          </span>
        )}
      </div>

      <p style={{ color: salary ? "#22c55e" : "#94a3b8", fontWeight: 800, fontSize: compact ? 13 : 15 }}>
        {salary || "Negotiable"}
      </p>

      {v.notes && (
        <p
          style={{
            color: "#94a3b8", fontSize: 11.5, lineHeight: 1.55,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}
        >
          {v.notes}
        </p>
      )}

      {v.flierUrl && (
        <button
          onClick={() => setFlierOpen(true)}
          style={{ alignSelf: "flex-start", background: "transparent", border: "none", color: GOLD, fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: 0, textDecoration: "underline" }}
        >
          📄 View original company flyer
        </button>
      )}

      <button
        onClick={onApply}
        disabled={disabled}
        style={{
          marginTop: 2, width: "100%", padding: compact ? "10px 0" : "12px 0", borderRadius: 12,
          background: applied ? "rgba(34,197,94,0.15)" : GOLD,
          color: applied ? "#22c55e" : NAVY,
          border: applied ? "1px solid #22c55e" : "none",
          fontWeight: 800, fontSize: 13,
          cursor: disabled ? "default" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        {label}
      </button>

      {flierOpen && v.flierUrl && (
        <div
          onClick={() => setFlierOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}
        >
          <button
            onClick={() => setFlierOpen(false)}
            aria-label="Close flyer"
            style={{ position: "absolute", top: 14, right: 14, background: "transparent", border: "none", color: "#fff", cursor: "pointer" }}
          >
            <X size={26} />
          </button>
          <img
            src={v.flierUrl}
            alt={`${v.rank} vacancy flyer`}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        </div>
      )}
    </article>
  );
};

export default JobCard;
