import { useEffect, useMemo, useState } from "react";
import { FileDown, Lock, RotateCcw, CheckCircle2, Banknote } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { buildPayslipPdf, buildVesselPortagePdf, computePortage, daysInMonth, daysServed, totalsByCurrency, type PortageContract, type PortageEntry } from "@/lib/portageBill";

type Row = { application_id: string; crew_name: string; rank: string };
const NUM: { k: keyof PortageEntry; l: string }[] = [
  { k: "extra_ot_hours", l: "Extra OT h" }, { k: "bonus", l: "Bonus" }, { k: "allotment", l: "Allotment" },
  { k: "cash_advance", l: "Advance" }, { k: "bond_store", l: "Bond store" }, { k: "communication", l: "Comms" }, { k: "other_deduction", l: "Other" },
];
const ERR: Record<string, string> = { portage_locked: "This month is locked. Reopen it first.", contract_not_signed: "Contract must be signed first.", not_owner: "This contract is not yours.", invalid_transition: "Finalize before marking paid." };
const errMsg = (e: any) => { const k = Object.keys(ERR).find(k => String(e?.message || "").includes(k)); return k ? ERR[k] : "Could not save. Please retry."; };
const thisMonth = () => new Date().toISOString().slice(0, 7);
const prevMonth = (ym: string) => { const [y, m] = ym.split("-").map(Number); const d = new Date(Date.UTC(y, m - 2, 1)); return d.toISOString().slice(0, 7); };
const fmt = (cur: string, v: number) => `${cur} ${(Number(v) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const STATUS: Record<string, string> = { draft: "Draft", finalized: "Finalized", paid: "Paid" };

export default function PortageBillTab({ rows }: { rows: Row[] | null }) {
  const [ym, setYm] = useState(thisMonth());
  const [vessel, setVessel] = useState("");
  const [contracts, setContracts] = useState<PortageContract[] | null>(null);
  const [entries, setEntries] = useState<Record<string, PortageEntry>>({});
  const [saved, setSaved] = useState<Record<string, PortageEntry>>({});
  const [employer, setEmployer] = useState("");
  const [busy, setBusy] = useState("");
  const nameOf = (id: string) => rows?.find(r => r.application_id === id)?.crew_name || "Crew";

  useEffect(() => {
    (supabase as any).from("sea_contracts").select("id,application_id,status,vessel_name,rank,currency,start_date,duration_months,basic_wage,fixed_overtime,leave_pay,extra_ot_rate,allowances,employer_name").in("status", ["signed", "completed"])
      .then(({ data, error }: any) => {
        if (error) { toast.error("Could not load contracts."); setContracts([]); return; }
        setContracts((data || []).map((d: any) => ({ ...d, allowances: Array.isArray(d.allowances) ? d.allowances : [] })));
        setEmployer(data?.[0]?.employer_name || "");
      });
  }, []);

  const active = useMemo(() => (contracts || []).filter(c => daysServed(ym, c.start_date, c.duration_months) > 0), [contracts, ym]);
  const vessels = useMemo(() => Array.from(new Set(active.map(c => c.vessel_name || "Unassigned"))).sort(), [active]);
  useEffect(() => { if (vessel && !vessels.includes(vessel)) setVessel(""); }, [vessels, vessel]);
  const shown = active.filter(c => !vessel || (c.vessel_name || "Unassigned") === vessel);

  const load = async () => {
    if (!contracts) return;
    const ids = active.map(c => c.id);
    if (!ids.length) { setEntries({}); setSaved({}); return; }
    const { data, error } = await (supabase as any).from("portage_entries").select("*").in("contract_id", ids).in("year_month", [ym, prevMonth(ym)]);
    if (error) { toast.error("Could not load portage bill."); return; }
    const cur: Record<string, PortageEntry> = {}, prev: Record<string, PortageEntry> = {};
    (data || []).forEach((e: PortageEntry) => { (e.year_month === ym ? cur : prev)[e.contract_id] = e; });
    const next: Record<string, PortageEntry> = {};
    const dim = daysInMonth(ym);
    for (const c of active) {
      next[c.id] = cur[c.id] || {
        contract_id: c.id, year_month: ym, days_served: daysServed(ym, c.start_date, c.duration_months), days_in_month: dim,
        extra_ot_hours: 0, bonus: 0, allotment: 0, cash_advance: 0, bond_store: 0, communication: 0, other_deduction: 0,
        // Carry forward last month's balance only if it was not paid out.
        prev_balance: prev[c.id] && prev[c.id].status !== "paid" ? Number(prev[c.id].net_payable) || 0 : 0,
        gross: 0, deductions: 0, net_payable: 0, currency: c.currency, status: "draft", notes: "",
      };
    }
    setEntries(next); setSaved(cur);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [contracts, ym]);

  const calc = (c: PortageContract) => { const e = entries[c.id]; return e ? { ...e, ...computePortage(c, e.days_served, e.days_in_month, e) } : null; };
  const setSignOff = (c: PortageContract, v: string) => {
    const [mS, mE] = [`${ym}-01`, `${ym}-${String(daysInMonth(ym)).padStart(2, "0")}`];
    if (v && (v < mS || v > mE || (c.start_date && v < c.start_date))) { toast.error("Sign-off date must fall inside this month and after sign-on."); return; }
    setEntries(s => ({ ...s, [c.id]: { ...s[c.id], sign_off_date: v || null, days_served: daysServed(ym, c.start_date, c.duration_months, v || null) } }));
  };
  const setField = (id: string, k: keyof PortageEntry, v: string) => setEntries(s => ({ ...s, [id]: { ...s[id], [k]: Math.max(0, Number(v) || 0) } }));

  const save = async (c: PortageContract, status?: string) => {
    const e = calc(c); if (!e) return;
    setBusy(c.id);
    const { fixed, extraOt, id, ...rest } = e as any;
    const payload = { ...rest, ...(status ? { status } : {}) };
    const q = saved[c.id]?.id ? (supabase as any).from("portage_entries").update(payload).eq("id", saved[c.id].id) : (supabase as any).from("portage_entries").insert({ ...payload, manager_id: (await supabase.auth.getUser()).data.user?.id });
    const { error } = await q;
    setBusy("");
    if (error) { toast.error(errMsg(error)); return; }
    if (status && !saved[c.id]?.id) { // newly inserted rows start as draft; apply the requested status
      const { data } = await (supabase as any).from("portage_entries").select("id").eq("contract_id", c.id).eq("year_month", ym).maybeSingle();
      if (data?.id && status !== "draft") { const r = await (supabase as any).from("portage_entries").update({ status }).eq("id", data.id); if (r.error) toast.error(errMsg(r.error)); }
    }
    toast.success(status === "finalized" ? "Month finalized" : status === "paid" ? "Marked as paid" : status === "draft" ? "Reopened" : "Saved");
    load();
  };

  const lines = shown.map(c => ({ c, e: calc(c)! })).filter(l => l.e);
  const totals = totalsByCurrency(lines.map(l => l.e));

  const vesselPdf = () => {
    if (!vessel) { toast.info("Choose a vessel first."); return; }
    buildVesselPortagePdf(vessel, ym, lines.map(l => ({ name: nameOf(l.c.application_id), rank: l.c.rank, e: l.e })), employer).save(`Portage_${vessel}_${ym}.pdf`);
  };

  if (contracts === null) return <p className="text-sm text-muted-foreground">Loading portage bill…</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3">
        <label className="text-xs text-muted-foreground">Month<input type="month" value={ym} onChange={e => e.target.value && setYm(e.target.value)} className="block mt-1 rounded-lg border border-border bg-background px-2 min-h-[40px] text-sm text-foreground" /></label>
        <label className="text-xs text-muted-foreground">Vessel<select value={vessel} onChange={e => setVessel(e.target.value)} className="block mt-1 rounded-lg border border-border bg-background px-2 min-h-[40px] text-sm text-foreground min-w-[180px]">
          <option value="">All vessels</option>{vessels.map(v => <option key={v} value={v}>{v}</option>)}
        </select></label>
        <Button variant="outline" onClick={vesselPdf} disabled={!vessel || !lines.length} className="ml-auto"><FileDown size={14} /> Vessel portage bill PDF</Button>
        <Button variant="outline" onClick={() => {
          const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
          const head = ["Crew", "Rank", "Vessel", "Month", "Currency", "Days served", "Earnings", "Allotment", "Advance", "Bond store", "Communication", "Other deduction", "Net payable"];
          const body = lines.map(l => [nameOf(l.c.application_id), l.c.rank, l.c.vessel_name, ym, l.e.currency, l.e.days_served, l.e.gross, l.e.allotment, l.e.cash_advance, l.e.bond_store, l.e.communication, l.e.other_deduction, l.e.net_payable].map(q).join(","));
          const url = URL.createObjectURL(new Blob(["\uFEFF" + [head.map(q).join(","), ...body].join("\r\n")], { type: "text/csv;charset=utf-8" }));
          const a = document.createElement("a"); a.href = url; a.download = `Portage_${vessel || "all"}_${ym}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
        }} disabled={!lines.length}><FileDown size={14} /> Excel (CSV)</Button>
      </div>

      {Object.keys(totals).length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(totals).map(([cur, t]) => (
            <div key={cur} className="rounded-xl border border-primary/30 bg-card p-3">
              <p className="text-xs text-muted-foreground">{cur} · {t.count} crew</p>
              <p className="text-lg font-bold text-primary">{fmt(cur, t.net)}</p>
              <p className="text-[11px] text-muted-foreground">Earnings {fmt(cur, t.gross)} · Deductions {fmt(cur, t.deductions)}</p>
            </div>
          ))}
        </div>
      )}

      {!lines.length && <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">No crew with a signed contract served in this month. Sign a contract in SEA Contracts and it appears here automatically.</div>}

      {lines.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-secondary text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-2">Crew</th><th className="text-right p-2">Days</th><th className="text-left p-2">Sign-off</th><th className="text-right p-2">Fixed wages</th><th className="text-right p-2">B/F</th>
                {NUM.map(f => <th key={f.k} className="text-right p-2">{f.l}</th>)}
                <th className="text-right p-2">Net payable</th><th className="p-2">Status</th><th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(({ c, e }) => {
                const locked = (saved[c.id]?.status || "draft") !== "draft";
                const st = saved[c.id]?.status || "draft";
                return (
                  <tr key={c.id} className="border-t border-border align-middle">
                    <td className="p-2 min-w-[150px]"><p className="font-semibold text-foreground">{nameOf(c.application_id)}</p><p className="text-[11px] text-muted-foreground">{c.rank} · {c.vessel_name}</p></td>
                    <td className="p-2 text-right">{e.days_served}/{e.days_in_month}</td>
                    <td className="p-1"><input type="date" disabled={locked} value={e.sign_off_date || ""} onChange={ev => setSignOff(c, ev.target.value)} aria-label="Sign-off date" title="Actual sign-off date — leave blank if still onboard" className="w-36 rounded-lg border border-border bg-background px-2 min-h-[36px] text-foreground disabled:opacity-60" /></td>
                    <td className="p-2 text-right whitespace-nowrap">{fmt(c.currency, e.fixed)}</td>
                    <td className="p-2 text-right whitespace-nowrap">{fmt(c.currency, e.prev_balance)}</td>
                    {NUM.map(f => (
                      <td key={f.k} className="p-1"><input type="number" min={0} step="0.01" disabled={locked} value={(e as any)[f.k] || ""} placeholder="0"
                        onChange={ev => setField(c.id, f.k, ev.target.value)} aria-label={f.l}
                        className="w-20 rounded-lg border border-border bg-background px-2 min-h-[36px] text-right text-foreground disabled:opacity-60" /></td>
                    ))}
                    <td className={`p-2 text-right font-bold whitespace-nowrap ${e.net_payable < 0 ? "text-destructive" : "text-primary"}`}>{fmt(c.currency, e.net_payable)}</td>
                    <td className="p-2"><span className="text-[11px] rounded-full border border-primary/40 text-primary px-2 py-0.5 whitespace-nowrap">{locked && <Lock size={10} className="inline mr-1" />}{STATUS[st]}</span></td>
                    <td className="p-2">
                      <div className="flex gap-1 justify-end">
                        {st === "draft" && <><Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => save(c)}>Save</Button>
                          <Button size="sm" disabled={busy === c.id} onClick={() => save(c, "finalized")} title="Finalize month"><CheckCircle2 size={14} /></Button></>}
                        {st === "finalized" && <><Button size="sm" disabled={busy === c.id} onClick={() => save(c, "paid")} title="Mark paid"><Banknote size={14} /></Button>
                          <Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => save(c, "draft")} title="Reopen"><RotateCcw size={14} /></Button></>}
                        <Button size="sm" variant="outline" title="Payslip PDF" onClick={() => buildPayslipPdf(c, e, nameOf(c.application_id), employer).save(`Payslip_${nameOf(c.application_id).replace(/\s+/g, "_")}_${ym}.pdf`)}><FileDown size={14} /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Fixed wages = contract monthly total × days served ÷ days in month. Sign-off = actual sign-off day for the final settlement (counted as a day served). B/F = last month's balance if it was not marked paid. Paid months are permanently locked.</p>
    </div>
  );
}
