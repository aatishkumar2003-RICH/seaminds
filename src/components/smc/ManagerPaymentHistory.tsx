import { useState, useEffect } from "react";
import { CreditCard, TrendingUp, Clock, DollarSign, X, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Payment {
  id: string;
  payment_type: string;
  amount_paid: number;
  status: string;
  created_at: string;
  crew_profile_id: string | null;
}

interface CrewInfo {
  name: string;
  role: string;
  ship_name: string;
}

interface AssessmentData {
  overall_score: number | null;
  score_band: string | null;
  status: string;
  completed_at: string | null;
  technical_score: number | null;
  english_score: number | null;
  experience_score: number | null;
  behavioural_score: number | null;
  wellness_score: number | null;
  report?: any;
  red_flags?: any[];
  recommendation?: string;
}

interface ManagerPaymentHistoryProps {
  managerUserId: string;
}

const BAND_COLORS: Record<string, string> = {
  ELITE: "#D4AF37",
  EXPERT: "#22c55e",
  COMPETENT: "#3b82f6",
  DEVELOPING: "#f59e0b",
  BELOW_STANDARD: "#ef4444",
};

const REC_STYLES: Record<string, { bg: string; label: string }> = {
  SUITABLE: { bg: "#16a34a", label: "SUITABLE" },
  SUITABLE_WITH_TRAINING: { bg: "#d97706", label: "SUITABLE WITH TRAINING" },
  HIGH_RISK: { bg: "#dc2626", label: "HIGH RISK" },
  NOT_RECOMMENDED: { bg: "#7f1d1d", label: "NOT RECOMMENDED" },
};

const ManagerPaymentHistory = ({ managerUserId }: ManagerPaymentHistoryProps) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [crewInfo, setCrewInfo] = useState<Record<string, CrewInfo>>({});
  const [assessments, setAssessments] = useState<Record<string, AssessmentData>>({});
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<{ assessment: AssessmentData; crew: CrewInfo } | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("smc_payments")
        .select("*")
        .eq("user_id", managerUserId)
        .order("created_at", { ascending: false });

      const paymentData = (data || []) as Payment[];
      setPayments(paymentData);

      const crewIds = [...new Set(paymentData.filter(p => p.crew_profile_id).map(p => p.crew_profile_id!))];
      if (crewIds.length > 0) {
        const { data: crews } = await supabase
          .from("crew_profiles")
          .select("id, first_name, last_name, role, ship_name")
          .in("id", crewIds);
        const infoMap: Record<string, CrewInfo> = {};
        (crews || []).forEach(c => {
          infoMap[c.id] = {
            name: `${c.first_name} ${c.last_name || ""}`.trim(),
            role: c.role,
            ship_name: c.ship_name,
          };
        });
        setCrewInfo(infoMap);

        // Fetch assessments for these crew
        const { data: assData } = await supabase
          .from("smc_assessments")
          .select("*")
          .in("crew_profile_id", crewIds)
          .eq("status", "completed");
        const assMap: Record<string, AssessmentData> = {};
        (assData || []).forEach((a: any) => {
          assMap[a.crew_profile_id] = a;
        });
        setAssessments(assMap);
      }
      setLoading(false);
    };
    load();
  }, [managerUserId]);

  const completedPayments = payments.filter(p => p.status === "completed");
  const totalSpend = completedPayments.reduce((sum, p) => sum + p.amount_paid, 0);
  const bulkCredits = completedPayments
    .filter(p => p.payment_type === "bulk")
    .reduce((sum, p) => {
      if (p.amount_paid === 39900) return sum + 10;
      if (p.amount_paid === 84900) return sum + 25;
      if (p.amount_paid === 149900) return sum + 50;
      return sum;
    }, 0);
  const usedThisMonth = completedPayments.filter(p => {
    const d = new Date(p.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && p.payment_type !== "bulk";
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0s" }} />
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0.3s" }} />
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0.6s" }} />
        </div>
      </div>
    );
  }

  const ScoreBar = ({ label, score }: { label: string; score: number | null }) => (
    <div style={{ marginBottom: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
        <span style={{ color: "#e0e0e0" }}>{label}</span>
        <span style={{ color: "#D4AF37", fontWeight: "bold" }}>{score != null ? `${score}/10` : "—"}</span>
      </div>
      <div style={{ background: "#0a1929", borderRadius: "4px", height: "8px", overflow: "hidden" }}>
        <div style={{ width: `${((score || 0) / 10) * 100}%`, height: "100%", background: "#D4AF37", borderRadius: "4px", transition: "width 0.5s" }} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Report Modal */}
      {selectedReport && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#0D1B2A", overflowY: "auto" }}>
          <div style={{ maxWidth: "720px", margin: "0 auto", padding: "24px 16px" }}>
            {/* Close */}
            <button onClick={() => setSelectedReport(null)} style={{ position: "fixed", top: "16px", right: "16px", background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 10000 }}>
              <X size={18} color="#fff" />
            </button>

            {/* Header */}
            <div style={{ marginBottom: "24px" }}>
              <h2 style={{ color: "#D4AF37", fontSize: "20px", fontWeight: "bold", marginBottom: "4px" }}>{selectedReport.crew.name}</h2>
              <div style={{ color: "#aaa", fontSize: "13px" }}>
                {selectedReport.crew.role} · {selectedReport.crew.ship_name}
                {selectedReport.assessment.completed_at && ` · ${new Date(selectedReport.assessment.completed_at).toLocaleDateString()}`}
              </div>
              {selectedReport.assessment.overall_score != null && (
                <div style={{ marginTop: "8px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ background: BAND_COLORS[selectedReport.assessment.score_band || ""] || "#555", color: "#fff", borderRadius: "6px", padding: "4px 12px", fontSize: "14px", fontWeight: "bold" }}>
                    SMC {selectedReport.assessment.overall_score} — {selectedReport.assessment.score_band}
                  </span>
                </div>
              )}
            </div>

            {/* Recommendation Banner */}
            {(() => {
              const rec = (selectedReport.assessment as any).report?.recommendation || (selectedReport.assessment as any).recommendation;
              const style = REC_STYLES[rec];
              return style ? (
                <div style={{ background: style.bg, borderRadius: "8px", padding: "14px 16px", marginBottom: "20px", textAlign: "center" }}>
                  <span style={{ color: "#fff", fontWeight: "bold", fontSize: "16px", letterSpacing: "1px" }}>{style.label}</span>
                </div>
              ) : null;
            })()}

            {/* Dimension Scores */}
            <div style={{ background: "#1a2e47", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
              <div style={{ color: "#D4AF37", fontWeight: "bold", marginBottom: "12px", fontSize: "14px" }}>DIMENSION SCORES</div>
              <ScoreBar label="Technical" score={selectedReport.assessment.technical_score} />
              <ScoreBar label="Safety" score={selectedReport.assessment.wellness_score} />
              <ScoreBar label="Operational" score={selectedReport.assessment.experience_score} />
              <ScoreBar label="Leadership" score={selectedReport.assessment.behavioural_score} />
              <ScoreBar label="Communication" score={selectedReport.assessment.english_score} />
            </div>

            {/* Findings */}
            {(selectedReport.assessment as any).report?.findings?.length > 0 && (
              <div style={{ background: "#1a2e47", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
                <div style={{ color: "#D4AF37", fontWeight: "bold", marginBottom: "8px", fontSize: "14px" }}>FINDINGS</div>
                {(selectedReport.assessment as any).report.findings.map((f: string, i: number) => (
                  <div key={i} style={{ color: "#e0e0e0", fontSize: "13px", marginBottom: "6px", paddingLeft: "8px", borderLeft: "2px solid #D4AF37" }}>
                    {i + 1}. {f}
                  </div>
                ))}
              </div>
            )}

            {/* Professional Remarks */}
            {(selectedReport.assessment as any).report?.remarks && (
              <div style={{ background: "#1a2e47", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
                <div style={{ color: "#D4AF37", fontWeight: "bold", marginBottom: "8px", fontSize: "14px" }}>PROFESSIONAL REMARKS</div>
                <div style={{ color: "#e0e0e0", fontSize: "13px", lineHeight: "1.6", whiteSpace: "pre-line" }}>
                  {(selectedReport.assessment as any).report.remarks}
                </div>
              </div>
            )}

            {/* Red Flags */}
            {(() => {
              const flags = (selectedReport.assessment as any).red_flags;
              if (!Array.isArray(flags) || flags.length === 0) return null;
              return (
                <div style={{ background: "#2a1015", borderRadius: "8px", padding: "16px", marginBottom: "16px", border: "1px solid #dc2626" }}>
                  <div style={{ color: "#ef4444", fontWeight: "bold", marginBottom: "4px", fontSize: "14px" }}>RED FLAGS</div>
                  <div style={{ color: "#ef4444", fontSize: "10px", fontWeight: "bold", marginBottom: "12px", letterSpacing: "1px" }}>CONFIDENTIAL — MANAGER ONLY</div>
                  {flags.map((rf: any, i: number) => (
                    <div key={i} style={{ marginBottom: "10px" }}>
                      <span style={{ background: "#dc2626", color: "#fff", borderRadius: "4px", padding: "2px 6px", fontSize: "11px", fontWeight: "bold", marginRight: "8px" }}>{rf.category}</span>
                      <span style={{ color: "#e0e0e0", fontSize: "13px", fontStyle: "italic" }}>"{rf.evidence}"</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Improvement Areas */}
            {(selectedReport.assessment as any).report?.improvement_areas?.length > 0 && (
              <div style={{ background: "#1a2e47", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
                <div style={{ color: "#D4AF37", fontWeight: "bold", marginBottom: "8px", fontSize: "14px" }}>IMPROVEMENT AREAS</div>
                {(selectedReport.assessment as any).report.improvement_areas.map((item: any, i: number) => (
                  <div key={i} style={{ marginBottom: "8px" }}>
                    <span style={{ background: item.severity === "Critical" ? "#c0392b" : item.severity === "Moderate" ? "#d4801a" : "#555", color: "white", borderRadius: "4px", padding: "2px 6px", fontSize: "11px", marginRight: "8px" }}>{item.severity}</span>
                    <span style={{ color: "#e0e0e0", fontSize: "13px", fontWeight: "bold" }}>{item.area}</span>
                    <div style={{ color: "#aaa", fontSize: "12px", marginTop: "2px", paddingLeft: "4px" }}>{item.detail}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Training Recommendations */}
            {(selectedReport.assessment as any).report?.training_recommendations?.length > 0 && (
              <div style={{ background: "#1a2e47", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
                <div style={{ color: "#D4AF37", fontWeight: "bold", marginBottom: "8px", fontSize: "14px" }}>TRAINING RECOMMENDATIONS</div>
                {(selectedReport.assessment as any).report.training_recommendations.map((r: string, i: number) => (
                  <div key={i} style={{ color: "#e0e0e0", fontSize: "13px", marginBottom: "4px" }}>• {r}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-secondary rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={14} className="text-primary" />
            <p className="text-xs text-muted-foreground">Available Credits</p>
          </div>
          <p className="text-2xl font-bold text-primary">{bulkCredits}</p>
        </div>
        <div className="bg-secondary rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Used This Month</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{usedThisMonth}</p>
        </div>
        <div className="bg-secondary rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Total Spend</p>
          </div>
          <p className="text-2xl font-bold text-foreground">${(totalSpend / 100).toLocaleString()}</p>
        </div>
        <div className="bg-secondary rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Total Transactions</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{payments.length}</p>
        </div>
      </div>

      {/* Transaction table */}
      <div className="bg-secondary/50 rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Transaction History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase">Date</th>
                <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase">Crew Name</th>
                <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase">Type</th>
                <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase">Amount</th>
                <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase">Status</th>
                <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase">Report</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No transactions yet.
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const ass = p.crew_profile_id ? assessments[p.crew_profile_id] : null;
                  const crew = p.crew_profile_id ? crewInfo[p.crew_profile_id] : null;
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/80 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {crew ? crew.name : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.payment_type === "bulk"
                            ? "bg-primary/15 text-primary"
                            : p.payment_type === "manager"
                            ? "bg-blue-500/15 text-blue-400"
                            : "bg-emerald-500/15 text-emerald-400"
                        }`}>
                          {p.payment_type === "bulk" ? "Pack" : p.payment_type === "manager" ? "Request" : "Crew"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground font-medium">${(p.amount_paid / 100).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.status === "completed"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-amber-500/15 text-amber-400"
                        }`}>
                          {p.status === "completed" ? "Completed" : "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {ass && ass.status === "completed" && crew ? (
                          <button
                            onClick={() => setSelectedReport({ assessment: ass, crew })}
                            style={{ background: "none", border: "1px solid #D4AF37", color: "#D4AF37", borderRadius: "6px", padding: "4px 10px", fontSize: "11px", fontWeight: "bold", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            <FileText size={12} /> View Full Report
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManagerPaymentHistory;
