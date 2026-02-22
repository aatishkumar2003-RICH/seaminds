import { useState, useEffect } from "react";
import { CreditCard, TrendingUp, Clock, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Payment {
  id: string;
  payment_type: string;
  amount_paid: number;
  status: string;
  created_at: string;
  crew_profile_id: string | null;
}

interface ManagerPaymentHistoryProps {
  managerUserId: string;
}

const ManagerPaymentHistory = ({ managerUserId }: ManagerPaymentHistoryProps) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [crewNames, setCrewNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("smc_payments")
        .select("*")
        .eq("user_id", managerUserId)
        .order("created_at", { ascending: false });

      const paymentData = (data || []) as Payment[];
      setPayments(paymentData);

      // Fetch crew names for payments that have crew_profile_id
      const crewIds = [...new Set(paymentData.filter(p => p.crew_profile_id).map(p => p.crew_profile_id!))];
      if (crewIds.length > 0) {
        const { data: crews } = await supabase
          .from("crew_profiles")
          .select("id, first_name, last_name")
          .in("id", crewIds);
        const nameMap: Record<string, string> = {};
        (crews || []).forEach(c => {
          nameMap[c.id] = `${c.first_name} ${c.last_name || ""}`.trim();
        });
        setCrewNames(nameMap);
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

  return (
    <div className="space-y-6">
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
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No transactions yet.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/80 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {p.crew_profile_id ? crewNames[p.crew_profile_id] || "—" : "—"}
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManagerPaymentHistory;
