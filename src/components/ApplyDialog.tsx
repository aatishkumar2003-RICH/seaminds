import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
import { trackPixel } from "@/lib/metaPixel";
import { fetchCrewCardInfo, waApplyLink, CrewCardInfo } from "@/lib/applyMessage";

const GOLD = "#D4AF37";
const NAVY = "#0D1B2A";
const CARD = "#112240";
const BORDER = "#1e3a5f";

export interface ApplyTarget {
  rawId: string;
  isCompanyPost: boolean;
  rank?: string;
  vessel?: string;
  port?: string | null;
  company?: string;
  applyUrl?: string | null;
  whatsapp?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  profileId: string;
  target: ApplyTarget | null;
  onGoToCv: () => void;
}

const ApplyDialog = ({ open, onClose, profileId, target, onGoToCv }: Props) => {
  const [readiness, setReadiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<null | { duplicate: boolean }>(null);
  const [error, setError] = useState("");
  const [cardInfo, setCardInfo] = useState<CrewCardInfo | null>(null);

  useEffect(() => {
    if (!open || !profileId) return;
    fetchCrewCardInfo(profileId).then(setCardInfo);
  }, [open, profileId]);

  useEffect(() => {
    if (!open) return;
    if (!profileId) { setReadiness(null); setLoading(false); return; }
    setLoading(true); setDone(null); setError("");
    (async () => {
      try {
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
        const rpcCall = supabase.rpc("cv_interview_readiness" as any, {
          p_crew_id: profileId, p_target_rank: target?.rank || null,
        }).then(({ data, error }) => {
          if (error) return null;
          if (!data) return null;
          return data;
        });
        const result = await Promise.race([rpcCall, timeout]);
        setReadiness(result);
      } catch {
        setReadiness(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, profileId, target?.rank]);

  if (!open || !target) return null;

  const missing: string[] = Array.isArray(readiness?.missing) ? readiness.missing : [];
  const ready = readiness?.ready === true;
  const unknownReadiness = readiness === null;

  const apply = async () => {
    if (saving) return;                 // guards double-tap
    setSaving(true); setError("");
    try {
      const { data, error: rpcErr } = await supabase.rpc("submit_application" as any, {
        p_vacancy_id: target.isCompanyPost ? null : target.rawId,
        p_company_post_id: target.isCompanyPost ? target.rawId : null,
        p_company_name: target.company || null,
        p_rank: target.rank || null,
        p_vessel: target.vessel || null,
        p_external_url: target.applyUrl || null,
      });
      if (rpcErr) throw rpcErr;
      const r: any = data;
      if (!r?.ok) {
        setError(r?.error === "not_signed_in"
          ? "Please sign in to apply."
          : "Could not save your application. Please try again.");
        return;
      }

      trackPixel("Contact", { content_name: "job_apply", content_category: target.rank || "crew" });

      if (target.whatsapp) {
        const d = String(target.whatsapp).replace(/[^\d]/g, "");
        if (d) window.open(`https://wa.me/${d}?text=${encodeURIComponent(`Hello, I am interested in the ${target.rank || "advertised"} position (seen on SeaMinds).`)}`, "_blank");
      }


      if (ready !== true) {
        onClose();
        onGoToCv();
        return;
      }

      setDone({ duplicate: !!r.duplicate });
    } catch {
      setError("Could not save your application. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: NAVY, borderRadius: 20, width: "100%", maxWidth: 480, maxHeight: "82vh", overflowY: "auto", border: `1px solid ${BORDER}`, paddingBottom: "env(safe-area-inset-bottom)" }}>

        <div style={{ display: "flex", alignItems: "center", padding: "16px 18px 10px" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: "#fff", fontSize: 16, fontWeight: 800 }}>{target.rank || "Apply"}</p>
            <p style={{ color: "#94a3b8", fontSize: 12 }}>
              {[target.vessel, target.company].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer", color: "#94a3b8" }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: "0 18px 22px" }}>
          {loading && <p style={{ color: "#94a3b8", fontSize: 13, padding: "32px 0", textAlign: "center" }}>Checking your profile…</p>}

          {!loading && done && (
            <div style={{ textAlign: "center", padding: "14px 0" }}>
              <CheckCircle2 size={44} style={{ color: "#22c55e" }} />
              <p style={{ color: "#fff", fontSize: 17, fontWeight: 800, marginTop: 10 }}>
                {done.duplicate ? "Already applied" : "Application saved"}
              </p>
              <p style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
                {done.duplicate
                  ? "You have already applied to this vacancy. The company can see your SeaMinds profile."
                  : `${target.company || "The company"} can see your SeaMinds profile and CV. Keep your availability date up to date so they can reach you.`}
              </p>
              <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 12, lineHeight: 1.55 }}>
                The SeaMinds team will forward your application to the company.
              </p>

              <button onClick={onClose}
                style={{ marginTop: 12, width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: GOLD, color: NAVY, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                See more jobs
              </button>

            </div>
          )}

          {!loading && !done && (
            <>
              {unknownReadiness ? (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ color: "#94a3b8", fontSize: 12.5 }}>
                    We couldn't check your profile right now — you can still apply.
                  </p>
                </div>
              ) : ready ? (
                <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.35)", borderRadius: 12, padding: 13, marginBottom: 14 }}>
                  <p style={{ color: "#22c55e", fontSize: 13, fontWeight: 800, marginBottom: 3 }}>✅ Your profile is ready</p>
                  <p style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.55 }}>
                    Your CV, certificates and availability go with this application.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 12, padding: 13, marginBottom: 14 }}>
                    <p style={{ color: "#f59e0b", fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
                      <AlertCircle size={14} style={{ display: "inline", marginRight: 5, verticalAlign: "-2px" }} />
                      {missing.length} thing{missing.length === 1 ? "" : "s"} would make you stand out
                    </p>
                    <p style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.55 }}>
                      Companies choose from your CV. Complete these once — they work for every job.
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                    {missing.slice(0, 5).map((m, i) => (
                      <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start", background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 12px" }}>
                        <span style={{ color: "#f59e0b", fontSize: 13, lineHeight: 1.3 }}>○</span>
                        <span style={{ color: "#e2e8f0", fontSize: 12.5, lineHeight: 1.5 }}>{m}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {error && (
                <p style={{ color: "#ef4444", fontSize: 12.5, marginBottom: 10, textAlign: "center" }}>{error}</p>
              )}

              <button onClick={apply} disabled={saving}
                style={{ width: "100%", padding: "15px 0", borderRadius: 13, border: "none", background: GOLD, color: NAVY, fontWeight: 900, fontSize: 15, cursor: saving ? "default" : "pointer", opacity: saving ? 0.5 : 1 }}>
                {saving ? "Applying…" : ready ? "Apply with my SeaMinds CV →" : "Apply & Complete CV →"}
              </button>

              {ready === false && (
                <button onClick={onGoToCv}
                  style={{ width: "100%", marginTop: 9, padding: "12px 0", borderRadius: 12, background: "transparent", color: GOLD, border: `1px solid ${GOLD}`, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Complete my profile first
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApplyDialog;
