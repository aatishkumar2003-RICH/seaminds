import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, FileDown, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { buildPayslipPdf, type PortageContract, type PortageEntry } from "@/lib/portageBill";

type C = PortageContract & { employer_name: string };
const money = (cur: string, v: number) => `${cur} ${(Number(v) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function MyPayslips() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contracts, setContracts] = useState<C[] | null>(null);
  const [slips, setSlips] = useState<PortageEntry[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [c, p] = await Promise.all([
        (supabase as any).from("sea_contracts").select("id,application_id,status,vessel_name,rank,currency,start_date,duration_months,basic_wage,fixed_overtime,leave_pay,extra_ot_rate,allowances,employer_name").eq("crew_id", user.id).in("status", ["issued", "signed", "completed"]).order("created_at", { ascending: false }),
        supabase.from("crew_profiles").select("first_name,last_name").eq("id", user.id).maybeSingle(),
      ]);
      if (c.error) { toast.error("Could not load your contracts."); setContracts([]); return; }
      const list = (c.data || []).map((d: any) => ({ ...d, allowances: Array.isArray(d.allowances) ? d.allowances : [] }));
      setContracts(list);
      setName([p.data?.first_name, p.data?.last_name].filter(Boolean).join(" "));
      if (list.length) {
        const { data } = await (supabase as any).from("portage_entries").select("*").in("contract_id", list.map((x: C) => x.id)).in("status", ["finalized", "paid"]).order("year_month", { ascending: false });
        setSlips(data || []);
      }
    })();
  }, [user]);

  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-primary/30 bg-background/95 px-3 py-3 backdrop-blur">
        <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/app"))} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full text-primary hover:bg-secondary"><ChevronLeft /></button>
        <div><h1 className="text-base font-bold">My Contracts & Payslips</h1><p className="text-[11px] text-muted-foreground">Your employment agreements and monthly wage accounts</p></div>
      </header>
      <main className="mx-auto max-w-2xl space-y-3 p-4">
        {!user && <p className="text-sm text-muted-foreground">Please sign in to see your contracts.</p>}
        {user && contracts === null && <p className="text-sm text-muted-foreground">Loading…</p>}
        {contracts?.length === 0 && <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">No contracts yet. When your manager issues an employment agreement, it appears here with your monthly payslips.</p>}
        {contracts?.map(c => {
          const mine = slips.filter(s => s.contract_id === c.id);
          return (
            <section key={c.id} className="rounded-2xl border border-primary/30 bg-card p-4">
              <div className="flex items-start gap-2"><ScrollText size={18} className="text-primary mt-0.5" />
                <div className="flex-1"><p className="font-bold">{c.rank} · {c.vessel_name || "Vessel"}</p>
                  <p className="text-xs text-muted-foreground">{c.employer_name} · from {c.start_date || "—"} · {c.duration_months} months · {c.status}</p></div></div>
              <div className="mt-3 space-y-2">
                {!mine.length && <p className="text-xs text-muted-foreground">No payslips yet. They appear once your manager finalizes a month.</p>}
                {mine.map(s => (
                  <div key={s.id} className="flex items-center gap-2 rounded-xl border border-border p-2">
                    <div className="flex-1"><p className="text-sm font-semibold">{s.year_month}{s.sign_off_date ? ` · signed off ${s.sign_off_date}` : ""}</p>
                      <p className="text-xs text-muted-foreground">Net {money(s.currency, s.net_payable)} · {s.status === "paid" ? "Paid" : "Finalized"}</p></div>
                    <button onClick={() => buildPayslipPdf(c, s, name || "Seafarer", c.employer_name).save(`Payslip_${s.year_month}.pdf`)} className="flex items-center gap-1 rounded-xl bg-primary px-3 min-h-[40px] text-sm font-bold text-primary-foreground"><FileDown size={14} /> PDF</button>
                  </div>))}
              </div>
            </section>);
        })}
        <p className="text-[10px] text-muted-foreground">Payslips are prepared by your manager under MLC 2006 Standard A2.2. If something looks wrong, raise it with your manager first.</p>
      </main>
    </div>
  );
}
