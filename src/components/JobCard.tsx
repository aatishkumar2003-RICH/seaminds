import { useState } from "react";
import { BadgeCheck, MapPin, Ship, Calendar, X } from "lucide-react";
import type { UnifiedVacancy } from "@/lib/vacancyFeed";
import { vacancySalary } from "@/lib/vacancyFeed";
import { jobPath } from "@/lib/jobSlug";
import { routeLabel, resolveApplyRoute, isSeaMindsPublished, hasSecondaryEmail, applyByEmail, reopenWhatsApp } from "@/lib/applicationRouter";
import { getCachedCrewCardInfo, fetchQuickProfileDone } from "@/lib/applyMessage";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import ApplyGateSheet from "@/components/ApplyGateSheet";

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
  /** Optional Smart Match result, shown as a gold badge. */
  match?: { score: number; reason: string } | null;
  onApply: () => void;
}

/** Button label for a vacancy, decided only by its channel. */
/** Button label for a vacancy, decided only by its route. */
export const applyLabel = (v: UnifiedVacancy) => routeLabel(v);

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

/** Share text + public link for a vacancy, for WhatsApp groups. */
export const shareVacancyOnWhatsApp = (v: UnifiedVacancy, href?: string) => {
  const path = href || jobPath({ id: v.id, rank: v.rank, vessel: v.vessel, port: v.port });
  const url = `https://seaminds.life${path}`;
  const lines = [
    `⚓ ${v.rank}${v.positions > 1 ? ` ×${v.positions}` : ""} — ${v.company}`,
    [v.vessel, v.port].filter(Boolean).join(" · "),
    vacancySalary(v) || "",
    "",
    `Apply free on SeaMinds (no agent fees):`,
    url,
  ].filter(Boolean);
  window.open(`https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener,noreferrer");
};



/** One vacancy, rendered identically (data + channel + applied state) on every surface. */
const JobCard = ({ vacancy: v, variant, applied: appliedProp, busy, href, match, onApply }: JobCardProps) => {
  const [flierOpen, setFlierOpen] = useState(false);
  const [emailState, setEmailState] = useState<"idle" | "busy" | "done">("idle");
  const [gateOpen, setGateOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const salary = vacancySalary(v);
  const compact = variant === "row";
  const route = resolveApplyRoute(v, null);
  const house = isSeaMindsPublished(v);
  const noContact = route.channel === "none";
  const applied = appliedProp;
  // WhatsApp can't confirm Send — keep the chat re-openable after applying.
  const canReopen = !!applied && route.channel === "whatsapp" ;
  // A saved record doesn't prove the recruiter email was accepted (e.g. after reload) —
  // keep email-only retryable; the server never re-sends an accepted email.
  const canRetryEmail = !!applied && route.channel === "email";
  const disabled = (!!applied && !canReopen && !canRetryEmail) || !!busy || noContact;
  const secondaryEmail = hasSecondaryEmail(v);

  const sendEmail = async () => {
    // Same gates as the primary Apply: sign in first, then Quick Sea Profile.
    if (!user) {
      navigate(`/join?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (!(await fetchQuickProfileDone(user.id))) { setGateOpen(true); return; }
    setEmailState("busy");
    try {
      const out = await applyByEmail(v);
      const t = out.toast;
      (t.tone === "error" ? toast.error : t.tone === "warning" ? toast.warning : toast.success)(`${t.title} — ${t.description}`);
      setEmailState(out.emailSent ? "done" : "idle");
    } catch {
      toast.error("Could not send email. Try again.");
      setEmailState("idle");
    }
  };

  const label = canReopen
    ? "💬 RE-OPEN WHATSAPP"
    : canRetryEmail
    ? (emailState === "busy" ? "Sending…" : emailState === "done" ? "Emailed ✓" : "✉️ RESEND SEA PROFILE BY EMAIL")
    : applied === "dup"
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
      {match && match.score >= 50 && (
        <span
          style={{
            alignSelf: "flex-start", borderRadius: 999, padding: "4px 10px",
            fontSize: 10, fontWeight: 800, letterSpacing: 0.3,
            background: "linear-gradient(90deg, #D4AF37, #C5941F)", color: NAVY,
          }}
        >
          🎯 {match.score}% match{match.reason ? ` · ${match.reason}` : ""}
        </span>
      )}

      {v.kind === "direct" && (
        <span
          style={{
            alignSelf: "flex-start", borderRadius: 999, padding: "3px 9px",
            fontSize: 9.5, fontWeight: 800, letterSpacing: 0.8,
            background: "rgba(212,175,55,0.12)", color: GOLD, border: "1px solid rgba(212,175,55,0.35)",
          }}
        >
          {house ? "ADVERTISED ON SEAMINDS" : "DIRECT — POSTED ON SEAMINDS"}
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
        onClick={canReopen ? () => reopenWhatsApp(v, getCachedCrewCardInfo()) : canRetryEmail ? sendEmail : route.channel === "flyer" ? () => setFlierOpen(true) : onApply}
        disabled={disabled || (canRetryEmail && emailState !== "idle")}
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
      {canReopen && (
        <p style={{ textAlign: "center", fontSize: 11, color: "#94A3B8", margin: 0 }}>
          WhatsApp opened ✓ — not sent yet? Tap to re-open.
        </p>
      )}

      {secondaryEmail && emailState === "done" && (
        <p style={{ textAlign: "center", fontSize: 11.5, color: "#22c55e", margin: 0 }}>✉️ Sea Profile emailed to recruiter ✓</p>
      )}
      {secondaryEmail && emailState !== "done" && (
        <button
          onClick={sendEmail}
          disabled={emailState === "busy"}
          style={{ background: "transparent", border: "none", textAlign: "center", fontSize: 12, fontWeight: 700, color: GOLD, textDecoration: "underline", cursor: "pointer" }}
        >
          {emailState === "busy" ? "Sending…" : "✉️ Or let SeaMinds email my Sea Profile"}
        </button>
      )}

      <button
        onClick={() => shareVacancyOnWhatsApp(v, href)}
        style={{
          width: "100%", padding: compact ? "8px 0" : "10px 0", borderRadius: 12,
          background: "transparent", color: GOLD, border: `1px solid ${GOLD}`,
          fontWeight: 700, fontSize: 12, cursor: "pointer",
        }}
      >
        Share to WhatsApp group
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
      <ApplyGateSheet open={gateOpen} onClose={() => setGateOpen(false)} next={typeof window !== "undefined" ? window.location.pathname : undefined} />
    </article>
  );
};

export default JobCard;
