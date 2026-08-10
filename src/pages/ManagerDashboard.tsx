import { useState, useEffect, useMemo } from "react";
import MyPostsPanel from "@/components/manager/MyPostsPanel";
import { useNavigate } from "react-router-dom";
import { Anchor, ArrowUpDown, LogOut, FileWarning, CreditCard } from "lucide-react";
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
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/manager"); return; }
      setManagerUserId(user.id);

      const { data: profile } = await supabase
        .from("manager_profiles")
        .select("company_name")
        .eq("user_id", user.id)
        .single();

      if (!profile) { navigate("/manager"); return; }
      setCompanyName(profile.company_name);

      // Fetch crew from this company
      const { data: crew } = await supabase
        .from("crew_profiles")
        .select("id, first_name, last_name, role, ship_name, voyage_start_date")
        .eq("manning_agency", profile.company_name);

      if (!crew || crew.length === 0) { setLoading(false); return; }

      const now = Date.now();

      const rows: CrewRow[] = crew.map((c) => {
        const voyageDays = c.voyage_start_date
          ? Math.max(1, Math.ceil((now - new Date(c.voyage_start_date).getTime()) / 86400000))
          : 0;

        return {
          id: c.id,
          firstName: c.first_name,
          lastName: c.last_name || "",
          role: c.role,
          shipName: c.ship_name,
          voyageDays,
        };
      });


      setCrewRows(rows);

      // Fetch safety reports for this company
      const { data: reports } = await supabase
        .from("safety_reports")
        .select("*")
        .eq("manning_agency", profile.company_name)
        .order("created_at", { ascending: false });
      setSafetyReports(reports || []);

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
                          No crew members from {companyName} have signed up yet.
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
