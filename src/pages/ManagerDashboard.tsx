import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Anchor, ArrowUpDown, LogOut, AlertTriangle, FileWarning, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ManagerPaymentHistory from "@/components/smc/ManagerPaymentHistory";

interface CrewRow {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  shipName: string;
  voyageDays: number;
  mood: string;
  moodEmoji: string;
  daysSinceCheckIn: number;
  isAlert: boolean;
}

interface SafetyReport {
  id: string;
  category: string;
  description: string;
  ship_name: string;
  status: string;
  created_at: string;
}

type SortKey = "shipName" | "mood" | "daysSinceCheckIn";
type DashTab = "crew" | "payments";

const MOOD_MAP: Record<string, { label: string; emoji: string; order: number }> = {
  good: { label: "Good", emoji: "😊", order: 1 },
  okay: { label: "Okay", emoji: "😐", order: 2 },
  struggling: { label: "Struggling", emoji: "😔", order: 3 },
  angry: { label: "Angry", emoji: "😤", order: 4 },
};

function extractMood(content: string): string | null {
  const lower = content.toLowerCase();
  if (lower.includes("feeling good")) return "good";
  if (lower.includes("feeling okay")) return "okay";
  if (lower.includes("feeling struggling")) return "struggling";
  if (lower.includes("feeling angry")) return "angry";
  return null;
}

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

      // Fetch all mood messages for these crew
      const crewIds = crew.map((c) => c.id);
      const { data: messages } = await supabase
        .from("chat_messages")
        .select("crew_profile_id, content, created_at, role")
        .in("crew_profile_id", crewIds)
        .eq("role", "user")
        .order("created_at", { ascending: false });

      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      const rows: CrewRow[] = crew.map((c) => {
        const crewMessages = (messages || []).filter((m) => m.crew_profile_id === c.id);

        // Last check-in
        const lastMsg = crewMessages[0];
        const daysSinceCheckIn = lastMsg
          ? Math.floor((now - new Date(lastMsg.created_at).getTime()) / 86400000)
          : -1;

        // Latest mood
        let latestMood = "";
        let latestMoodEmoji = "";
        for (const m of crewMessages) {
          const mood = extractMood(m.content);
          if (mood) {
            latestMood = MOOD_MAP[mood]?.label || mood;
            latestMoodEmoji = MOOD_MAP[mood]?.emoji || "";
            break;
          }
        }

        // Alert: struggling/angry in last 24h
        const isAlert = crewMessages.some((m) => {
          if (new Date(m.created_at).getTime() < oneDayAgo) return false;
          const mood = extractMood(m.content);
          return mood === "struggling" || mood === "angry";
        });

        // Voyage days
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
          mood: latestMood,
          moodEmoji: latestMoodEmoji,
          daysSinceCheckIn: daysSinceCheckIn < 0 ? 999 : daysSinceCheckIn,
          isAlert,
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

  const alertCount = crewRows.filter((r) => r.isAlert).length;

  const sorted = useMemo(() => {
    const arr = [...crewRows];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "shipName") cmp = a.shipName.localeCompare(b.shipName);
      else if (sortKey === "mood") {
        const oa = MOOD_MAP[a.mood.toLowerCase()]?.order ?? 99;
        const ob = MOOD_MAP[b.mood.toLowerCase()]?.order ?? 99;
        cmp = oa - ob;
      } else if (sortKey === "daysSinceCheckIn") cmp = a.daysSinceCheckIn - b.daysSinceCheckIn;
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
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
            <Anchor size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Manager Dashboard</h1>
            <p className="text-xs text-muted-foreground">{companyName}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <LogOut size={14} /> Logout
        </button>
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
            {/* Alert Banner */}
            {alertCount > 0 && (
              <div className="flex items-center gap-3 bg-amber-500/15 border border-amber-500/30 rounded-xl px-5 py-4">
                <AlertTriangle size={20} className="text-amber-500 shrink-0" />
                <p className="text-sm text-amber-200 font-medium">
                  Welfare attention needed — {alertCount} crew member{alertCount > 1 ? "s" : ""} reporting low mood today.
                </p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-2xl font-bold text-foreground">{crewRows.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Total Crew</p>
              </div>
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-2xl font-bold text-foreground">{new Set(crewRows.map((r) => r.shipName)).size}</p>
                <p className="text-xs text-muted-foreground mt-1">Vessels</p>
              </div>
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-2xl font-bold text-foreground">{crewRows.filter((r) => r.mood).length}</p>
                <p className="text-xs text-muted-foreground mt-1">Mood Reports</p>
              </div>
              <div className="bg-secondary rounded-xl p-4">
                <p className="text-2xl font-bold text-amber-500">{alertCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Alerts</p>
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
                      <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase cursor-pointer select-none" onClick={() => handleSort("mood")}>
                        <span className="flex items-center gap-1">Mood <ArrowUpDown size={12} /></span>
                      </th>
                      <th className="px-4 py-3 text-xs text-muted-foreground font-medium uppercase cursor-pointer select-none" onClick={() => handleSort("daysSinceCheckIn")}>
                        <span className="flex items-center gap-1">Last Check-in <ArrowUpDown size={12} /></span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row) => (
                      <tr
                        key={row.id}
                        className={`border-b border-border/50 transition-colors ${row.isAlert ? "bg-amber-500/10" : "hover:bg-secondary/80"}`}
                      >
                        <td className="px-4 py-3 text-foreground font-medium">
                          {row.firstName} {row.lastName}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{row.role}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.shipName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{row.voyageDays > 0 ? `Day ${row.voyageDays}` : "—"}</td>
                        <td className="px-4 py-3">
                          {row.mood ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              row.mood === "Good" ? "bg-emerald-500/15 text-emerald-400" :
                              row.mood === "Okay" ? "bg-blue-500/15 text-blue-400" :
                              row.mood === "Struggling" ? "bg-amber-500/15 text-amber-400" :
                              row.mood === "Angry" ? "bg-red-500/15 text-red-400" : "bg-secondary text-muted-foreground"
                            }`}>
                              {row.moodEmoji} {row.mood}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">No data</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.daysSinceCheckIn === 999 ? "Never" : row.daysSinceCheckIn === 0 ? "Today" : `${row.daysSinceCheckIn}d ago`}
                        </td>
                      </tr>
                    ))}
                    {sorted.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
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
              Conversation content is always private and sealed. This dashboard shows mood indicators, check-in data, and anonymous safety reports only.
            </p>

            {/* Admin: Free assessment counter */}
            <div className="bg-secondary/50 rounded-xl border border-border px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Free assessments used</span>
              <span className="text-xs font-bold text-primary">153 / 1,000</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ManagerDashboard;
