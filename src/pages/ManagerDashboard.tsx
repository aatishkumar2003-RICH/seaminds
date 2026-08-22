import { useState, useEffect, useMemo } from "react";
import MyPostsPanel from "@/components/manager/MyPostsPanel";
import { useNavigate } from "react-router-dom";
import { Anchor, ArrowUpDown, LogOut, FileWarning, CreditCard, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ManagerPaymentHistory from "@/components/smc/ManagerPaymentHistory";

interface CrewRow {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  shipName: string;
  voyageDays: number;
}

interface SafetyReport {
  id: string;
  category: string;
  description: string;
  ship_name: string;
  status: string;
  created_at: string;
}

interface Applicant {
  application_id: string;
  applied_at: string;
  outcome: string;
  rank: string;
  vessel: string;
  crew_name: string;
  nationality: string;
  crew_rank: string;
  available_from: string;
  offered_joining_date: string;
}

interface FleetCrew {
  link_id: string;
  name: string;
  rank: string;
  nationality: string;
  certs_total: number;
  certs_expiring_90d: number;
  rest_hours_updated: string | null;
  contract_end: string | null;
}

interface FleetResult {
  ok?: boolean;
  error?: string;
  crew?: FleetCrew[];
}

type SortKey = "shipName";
type DashTab = "crew" | "payments";


const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [crewRows, setCrewRows] = useState<CrewRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("shipName");
  const [sortAsc, setSortAsc] = useState(true);
  const [safetyReports, setSafetyReports] = useState<SafetyReport[]>([]);
  const [dashTab, setDashTab] = useState<DashTab>("crew");
  const [managerUserId, setManagerUserId] = useState("");
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [applicantsLoading, setApplicantsLoading] = useState(false);
  const [offerDrafts, setOfferDrafts] = useState<Record<string, { joiningDate: string; contractMonths: number; open: boolean }>>({});
  const [fleet, setFleet] = useState<FleetResult | null>(null);
  const [fleetEmail, setFleetEmail] = useState("");
  const [fleetAdding, setFleetAdding] = useState(false);
  const [dpaName, setDpaName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyEmail, setEmergencyEmail] = useState("");
  const [savingEmergency, setSavingEmergency] = useState(false);

  const saveEmergencyContact = async () => {
    setSavingEmergency(true);
    const { error } = await supabase
      .from("manager_profiles")
      .update({
        dpa_name: dpaName.trim() || null,
        emergency_phone: emergencyPhone.trim() || null,
        emergency_email: emergencyEmail.trim() || null,
        emergency_updated_at: new Date().toISOString(),
      })
      .eq("user_id", managerUserId);
    setSavingEmergency(false);
    if (error) { toast.error("Could not save emergency contact"); return; }
    toast.success("Emergency contact saved");
  };

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/manager"); return; }
      setManagerUserId(user.id);

      const { data: profile } = await supabase
        .from("manager_profiles")
        .select("company_name, dpa_name, emergency_phone, emergency_email")
        .eq("user_id", user.id)
        .single();

      if (!profile) { navigate("/manager"); return; }
      setCompanyName(profile.company_name);
      setDpaName(profile.dpa_name || "");
      setEmergencyPhone(profile.emergency_phone || "");
      setEmergencyEmail(profile.emergency_email || "");


      // Safety reports come through the approved-manager RPC (RLS-safe)
      const { data: safety } = await supabase.rpc("get_my_safety_reports" as any);
      const safetyResult = safety as unknown as { ok?: boolean; reports?: SafetyReport[] } | null;
      setSafetyReports(safetyResult?.ok ? (safetyResult.reports || []) : []);

      setLoading(false);
    };
    load();
  }, [navigate]);

  const sorted = useMemo(() => {
    const arr = [...crewRows];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "shipName") cmp = a.shipName.localeCompare(b.shipName);
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [crewRows, sortKey, sortAsc]);


  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const loadApplicants = async () => {
    setApplicantsLoading(true);
    const { data, error } = await supabase.rpc("get_my_applicants");
    setApplicantsLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setApplicants(((data as unknown) as Applicant[]) || []);
  };

  const openOfferDraft = (id: string) => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    const defaultDate = d.toISOString().split("T")[0];
    setOfferDrafts((prev) => ({ ...prev, [id]: { joiningDate: defaultDate, contractMonths: 9, open: true } }));
  };

  const handleApplicationAction = async (
    applicationId: string,
    action: "shortlist" | "decline" | "offer",
    joiningDate?: string,
    contractMonths?: number
  ) => {
    const params: { p_application_id: string; p_action: string; p_joining_date?: string; p_contract_months?: number } = {
      p_application_id: applicationId,
      p_action: action,
    };
    if (action === "offer") {
      params.p_joining_date = joiningDate;
      params.p_contract_months = contractMonths;
    }
    const { data, error } = await supabase.rpc("manager_update_application", params);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { ok?: boolean; error?: string } | null;
    if (result && !result.ok) {
      toast.error(result.error || "Update failed");
      return;
    }
    toast("Done");
    loadApplicants();
  };

  const loadFleet = async () => {
    const { data } = await supabase.rpc("get_my_fleet" as any);
    setFleet((data as unknown as FleetResult) || null);
  };

  const addFleetCrew = async () => {
    setFleetAdding(true);
    const { data, error } = await supabase.rpc("fleet_add_crew" as any, { p_crew_email: fleetEmail.trim() });
    setFleetAdding(false);
    if (error) { toast.error(error.message); return; }
    const result = data as { ok?: boolean; error?: string } | null;
    if (!result?.ok) { toast.error(result?.error || "Could not add crew"); return; }
    toast.success("Invite sent — waiting for crew confirmation");
    setFleetEmail("");
    loadFleet();
  };

  useEffect(() => {
    if (companyName) { loadApplicants(); loadFleet(); }
  }, [companyName]);

  // Crew overview is built from the linked fleet (crew_profiles is not readable by managers)
  useEffect(() => {
    const crew = fleet?.ok ? (fleet.crew || []) : [];
    setCrewRows(
      crew.map((c) => ({
        id: c.link_id,
        firstName: c.name,
        lastName: "",
        role: c.rank,
        shipName: c.contract_end ? "On contract" : "—",
        voyageDays: 0,
      }))
    );
  }, [fleet]);


  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0s" }} />
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0.3s" }} />
          <span className="w-2 h-2 rounded-full bg-primary pulse-dot" style={{ animationDelay: "0.6s" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
            <Anchor size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Manager Dashboard</h1>
            <p className="text-xs text-muted-foreground">{companyName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate("/manager-search")}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#0D1B2A] text-[#D4AF37] border border-[#D4AF37]/40 hover:bg-[#D4AF37]/10 transition-colors"
          >
            🔍 Search Crew
          </button>
          <button
            onClick={() => navigate("/manager/interviews")}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#D4AF37] text-[#0D1B2A] border border-[#D4AF37] hover:opacity-90 transition-opacity"
          >
            🎓 Arrange Interview
          </button>
          <button
            onClick={() => navigate("/company-post")}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#D4AF37] text-[#0D1B2A] border border-[#D4AF37] hover:opacity-90 transition-opacity"
          >
            ✍️ Create Post
          </button>
          <button
            onClick={() => navigate("/post-vacancy")}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#0D1B2A] text-[#D4AF37] border border-[#D4AF37]/40 hover:bg-[#D4AF37]/10 transition-colors"
          >
            📢 Post Vacancy
          </button>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Tab switcher */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1">
          <button
            onClick={() => setDashTab("crew")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
              dashTab === "crew" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Crew Overview
          </button>
          <button
            onClick={() => setDashTab("payments")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              dashTab === "payments" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CreditCard size={14} /> Credits & Payments
          </button>
        </div>

        {dashTab === "payments" ? (
          <ManagerPaymentHistory managerUserId={managerUserId} />
        ) : (
          <>
            {/* Applicants */}
            <div className="bg-secondary rounded-xl border border-border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">👥 Applicants</h2>
                <button
                  onClick={loadApplicants}
                  disabled={applicantsLoading}
                  className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  aria-label="Refresh applicants"
                >
                  <RefreshCw size={16} className={applicantsLoading ? "animate-spin" : ""} />
                </button>
              </div>

              {applicants.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground">Applications to your posts will appear here.</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Post a vacancy to start receiving applications.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {applicants.map((a) => {
                    const draft = offerDrafts[a.application_id];
                    const statusClass = (() => {
                      switch (a.outcome) {
                        case "awaiting": return "bg-muted text-muted-foreground";
                        case "shortlisted": return "bg-[#D4AF37]/15 text-[#D4AF37]";
                        case "offered": return "bg-blue-500/15 text-blue-400";
                        case "placed": return "bg-green-500/15 text-green-400";
                        case "declined":
                        case "offer_declined": return "bg-secondary text-muted-foreground/70";
                        case "released": return "bg-muted text-muted-foreground";
                        default: return "bg-muted text-muted-foreground";
                      }
                    })();
                    const statusLabel = (() => {
                      switch (a.outcome) {
                        case "awaiting": return "New";
                        case "shortlisted": return "⭐ Shortlisted";
                        case "offered": return "📨 Offered";
                        case "placed": return "⚓ Placed";
                        case "declined":
                        case "offer_declined": return "Declined";
                        case "released": return "Released";
                        default: return a.outcome;
                      }
                    })();
                    return (
                      <div key={a.application_id} className="bg-secondary/50 rounded-xl border border-border/50 p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-foreground">
                            {a.crew_name} <span className="font-normal text-muted-foreground">· {a.nationality}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{a.rank} · {a.vessel}</p>
                          {a.available_from && (
                            <p className="text-xs text-muted-foreground">Available from {new Date(a.available_from).toLocaleDateString()}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusClass}`}>{statusLabel}</span>
                          {a.outcome === "awaiting" && (
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => handleApplicationAction(a.application_id, "shortlist")}
                                className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-[#D4AF37] text-[#0D1B2A] border border-[#D4AF37] hover:opacity-90 transition-opacity"
                              >
                                ⭐ Shortlist
                              </button>
                              <button
                                onClick={() => handleApplicationAction(a.application_id, "decline")}
                                className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-secondary text-muted-foreground border border-border hover:bg-secondary/80 transition-colors"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                          {a.outcome === "shortlisted" && (
                            <>
                              {!draft?.open ? (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => openOfferDraft(a.application_id)}
                                    className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-[#0D1B2A] text-[#D4AF37] border border-[#D4AF37]/40 hover:bg-[#D4AF37]/10 transition-colors"
                                  >
                                    📨 Offer joining
                                  </button>
                                  <button
                                    onClick={() => handleApplicationAction(a.application_id, "decline")}
                                    className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-secondary text-muted-foreground border border-border hover:bg-secondary/80 transition-colors"
                                  >
                                    Decline
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-2 w-full sm:w-auto">
                                  <div className="flex flex-wrap gap-2">
                                    <input
                                      type="date"
                                      value={draft.joiningDate}
                                      onChange={(e) => setOfferDrafts((prev) => {
                                        const current = prev[a.application_id] || { joiningDate: "", contractMonths: 9, open: true };
                                        return { ...prev, [a.application_id]: { ...current, joiningDate: e.target.value } };
                                      })}
                                      className="bg-background text-foreground text-xs rounded-lg px-2 py-1.5 border border-border"
                                    />
                                    <input
                                      type="number"
                                      min={1}
                                      max={36}
                                      value={draft.contractMonths}
                                      onChange={(e) => setOfferDrafts((prev) => {
                                        const current = prev[a.application_id] || { joiningDate: "", contractMonths: 9, open: true };
                                        return { ...prev, [a.application_id]: { ...current, contractMonths: parseInt(e.target.value) || 1 } };
                                      })}
                                      className="bg-background text-foreground text-xs rounded-lg px-2 py-1.5 border border-border w-24"
                                    />
                                  </div>
                                  <button
                                    onClick={() => handleApplicationAction(a.application_id, "offer", draft.joiningDate, draft.contractMonths)}
                                    className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-[#D4AF37] text-[#0D1B2A] border border-[#D4AF37] hover:opacity-90 transition-opacity"
                                  >
                                    Confirm offer
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                          {a.outcome === "offered" && (
                            <p className="text-xs text-muted-foreground italic">Waiting for crew to accept…</p>
                          )}
                          {a.outcome === "placed" && (
                            <p className="text-xs text-green-400">🎉 Placed — congratulations!</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* My Fleet */}
            <div className="bg-secondary rounded-xl border border-border p-4 space-y-4">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">🚢 My Fleet</h2>

              {fleet?.error === "fleet_subscription_required" ? (
                <div className="bg-secondary/50 rounded-xl border border-[#D4AF37]/30 p-4 space-y-2">
                  <h3 className="text-base font-bold text-[#D4AF37]">Fleet Compliance Dashboard</h3>
                  <p className="text-sm text-muted-foreground">
                    See your crew's MLC rest hours, certificate expiry warnings and CVs in one audit-ready view. Contact SeaMinds to activate your fleet subscription.
                  </p>
                  <button
                    onClick={() => window.open("mailto:info@indossol.com?subject=Fleet subscription")}
                    className="text-xs font-medium px-3 py-2 rounded-lg bg-transparent text-[#D4AF37] border border-[#D4AF37] hover:bg-[#D4AF37]/10 transition-colors"
                  >
                    Contact us
                  </button>
                </div>
              ) : fleet?.ok ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      value={fleetEmail}
                      onChange={(e) => setFleetEmail(e.target.value)}
                      placeholder="crew@email.com"
                      className="flex-1 bg-background text-foreground text-sm rounded-lg px-3 py-2 border border-border"
                    />
                    <button
                      onClick={addFleetCrew}
                      disabled={fleetAdding || !fleetEmail.trim()}
                      className="text-sm font-bold px-4 py-2 rounded-xl bg-[#D4AF37] text-[#0D1B2A] border border-[#D4AF37] hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      Add crew
                    </button>
                  </div>

                  {(fleet.crew || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No linked crew yet — add your crew by email above, or crew placed through SeaMinds link automatically.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {(fleet.crew || []).map((c) => (
                        <div key={c.link_id} className="bg-secondary/50 rounded-xl border border-border/50 p-4 space-y-2">
                          <p className="text-sm font-bold text-foreground">
                            {c.name} <span className="font-normal text-muted-foreground">· {c.rank}{c.nationality ? ` · ${c.nationality}` : ""}</span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground">📜 {c.certs_total || 0} certs</span>
                            {(c.certs_expiring_90d || 0) > 0 ? (
                              <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-500/15 text-amber-400">⚠️ {c.certs_expiring_90d} expiring ≤90d</span>
                            ) : (
                              <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/15 text-green-400">✓ Certs OK</span>
                            )}
                          </div>
                          {c.rest_hours_updated ? (
                            <p className="text-xs text-green-400">⏱ Rest hours updated {new Date(c.rest_hours_updated).toLocaleDateString()}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">⏱ No rest-hour records yet</p>
                          )}
                          {c.contract_end && (
                            <p className="text-xs text-muted-foreground">Contract ends {new Date(c.contract_end).toLocaleDateString()}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground/70">
                    You see rest hours, certificates and CV data of linked crew only — wellness data is never shared.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Loading fleet…</p>
              )}
            </div>

            {/* Emergency / DPA contact */}
            <div className="bg-secondary rounded-xl border border-border p-4 space-y-3">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">🆘 Emergency / DPA contact</h2>
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  value={dpaName}
                  onChange={(e) => setDpaName(e.target.value)}
                  placeholder="DPA / contact person name"
                  className="bg-background text-foreground text-sm rounded-lg px-3 py-2 border border-border"
                />
                <input
                  type="tel"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="Emergency phone"
                  className="bg-background text-foreground text-sm rounded-lg px-3 py-2 border border-border"
                />
                <input
                  type="email"
                  value={emergencyEmail}
                  onChange={(e) => setEmergencyEmail(e.target.value)}
                  placeholder="Emergency email"
                  className="bg-background text-foreground text-sm rounded-lg px-3 py-2 border border-border"
                />
              </div>
              <button
                onClick={saveEmergencyContact}
                disabled={savingEmergency}
                className="text-sm font-bold px-4 py-2 rounded-xl bg-[#D4AF37] text-[#0D1B2A] border border-[#D4AF37] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {savingEmergency ? "Saving…" : "Save"}
              </button>
              <p className="text-xs text-muted-foreground/70">
                Shown to YOUR linked crew in their SOS screen — per ISM practice, crew must always be able to reach their company.
              </p>
            </div>





            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-2xl font-bold text-foreground">{crewRows.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Total Crew</p>
              </div>
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-2xl font-bold text-foreground">{new Set(crewRows.map((r) => r.shipName)).size}</p>
                <p className="text-xs text-muted-foreground mt-1">Vessels</p>
              </div>
            </div>

            {/* Table */}
            <div className="bg-secondary/50 rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase">Name</th>
                      <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase">Rank</th>
                      <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase cursor-pointer select-none" onClick={() => handleSort("shipName")}>
                        <span className="flex items-center gap-1">Ship <ArrowUpDown size={12} /></span>
                      </th>
                      <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase">Voyage Day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row) => (
                      <tr key={row.id} className="border-b border-border/50 transition-colors hover:bg-secondary/80">
                        <td className="px-4 py-3 text-foreground font-medium">
                          {row.firstName} {row.lastName}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{row.role}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.shipName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.voyageDays > 0 ? `Day ${row.voyageDays}` : "—"}</td>
                      </tr>
                    ))}
                    {sorted.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                          No linked crew yet — add crew in My Fleet above.
                        </td>
                      </tr>
                    )}

                  </tbody>
                </table>
              </div>
            </div>

            {/* Safety Reports */}
            {safetyReports.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileWarning size={18} className="text-red-400" />
                  <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Anonymous Safety Reports</h2>
                  <span className="bg-red-500/15 text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">{safetyReports.length}</span>
                </div>
                <div className="bg-secondary/50 rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left">
                          <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase">Date</th>
                          <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase">Ship</th>
                          <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase">Category</th>
                          <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase">Description</th>
                          <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {safetyReports.map((report) => (
                          <tr key={report.id} className="border-b border-border/50">
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                              {new Date(report.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{report.ship_name}</td>
                            <td className="px-4 py-3 text-foreground font-medium capitalize">{report.category}</td>
                            <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{report.description}</td>
                            <td className="px-4 py-3">
                              <select
                                value={report.status}
                                onChange={async (e) => {
                                  const newStatus = e.target.value;
                                  await supabase.from("safety_reports").update({ status: newStatus }).eq("id", report.id);
                                  setSafetyReports((prev) => prev.map((r) => r.id === report.id ? { ...r, status: newStatus } : r));
                                }}
                                className="bg-secondary text-foreground text-xs rounded-lg px-2 py-1 border border-border"
                              >
                                <option value="New">🔴 New</option>
                                <option value="Under Review">🟡 Under Review</option>
                                <option value="Resolved">🟢 Resolved</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Privacy note */}
            <p className="text-xs text-muted-foreground text-center py-4">
              Wellness conversations and mood check-ins are private to each seafarer and are never shown to companies or manning agents. This dashboard shows crew assignments and anonymous safety reports only.
            </p>


            {/* Admin: Free assessment counter */}
            <div className="bg-secondary/50 rounded-xl border border-border px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Free assessments used</span>
              <span className="text-xs font-bold text-primary">153 / 1,000</span>
            </div>
          </>
        )}

        {managerUserId && <MyPostsPanel managerId={managerUserId} />}
      </div>

    </div>
  );
};

export default ManagerDashboard;
