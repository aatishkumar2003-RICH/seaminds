import { useEffect, useMemo, useState } from "react";
import { FileDown, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { buildSeaPdf, missingForIssue, monthlyTotal, suggestedLeavePay, MLC_MIN_LEAVE_DAYS, type SeaContract } from "@/lib/seaContract";

type Row = { application_id: string; crew_name: string; rank: string; vessel: string; joining_date: string | null; crew_confirmed: boolean };
const STATUS_LABEL: Record<string, string> = { draft: "Draft", issued: "Issued to crew", signed: "Signed / Active", completed: "Completed", cancelled: "Cancelled" };
const PRESETS = [{ l: "4 ± 1", d: 4 }, { l: "6 ± 1", d: 6 }, { l: "9 ± 1", d: 9 }];
const ERR: Record<string, string> = { crew_not_confirmed: "Crew must confirm joining first.", signed_terms_locked: "Wage and period are locked after signing.", contract_closed: "This contract is closed.", invalid_transition: "That status change is not allowed.", not_owner: "This crew is not in your roster." };

const blank = (r: Row, employer: string): SeaContract => ({
  application_id: r.application_id, employer_name: employer, employer_address: "", rank: r.rank || "",
  vessel_name: "", imo_number: "", flag_state: "", vessel_type: r.vessel || "", port_of_engagement: "", repatriation_port: "",
  start_date: r.joining_date, duration_months: 6, tolerance_months: 1, notice_days: 30, cba_reference: "", currency: "USD",
  basic_wage: 0, fixed_overtime: 0, overtime_hours: 103, extra_ot_rate: 0, leave_days_per_month: MLC_MIN_LEAVE_DAYS, leave_pay: 0, allowances: [], notes: "",
});
const errMsg = (e: any) => { const k = Object.keys(ERR).find(k => String(e?.message || "").includes(k)); return k ? ERR[k] : "Could not save. Please retry."; };

export default function SeaContractsTab({ rows }: { rows: Row[] | null }) {
  const [list, setList] = useState<(SeaContract & { id: string; status: string })[] | null>(null);
  const [edit, setEdit] = useState<SeaContract | null>(null);
  const [pick, setPick] = useState("");
  const [employer, setEmployer] = useState("");
  const [busy, setBusy] = useState(false);
  const confirmed = (rows || []).filter(r => r.crew_confirmed);
  const nameOf = (id: string) => rows?.find(r => r.application_id === id)?.crew_name || "Crew";

  const load = async () => {
    const { data, error } = await (supabase as any).from("sea_contracts").select("*").order("created_at", { ascending: false });
    if (error) { toast.error("Could not load contracts."); setList([]); return; }
    setList((data || []).map((d: any) => ({ ...d, allowances: Array.isArray(d.allowances) ? d.allowances : [] })));
  };
  useEffect(() => {
    load();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: mp } = await supabase.from("manager_profiles").select("company_name").eq("user_id", data.user.id).maybeSingle();
      setEmployer((mp as any)?.company_name || "");
    });
  }, []);

  const total = useMemo(() => (edit ? monthlyTotal(edit) : 0), [edit]);
  const locked = edit?.status === "signed" || edit?.status === "completed" || edit?.status === "cancelled";
  const set = (k: keyof SeaContract, v: any) => setEdit(e => (e ? { ...e, [k]: v } : e));
  const num = (k: keyof SeaContract) => (ev: React.ChangeEvent<HTMLInputElement>) => set(k, ev.target.value === "" ? 0 : Number(ev.target.value));

  const save = async (status?: string) => {
    if (!edit) return;
    if (status === "issued") { const m = missingForIssue(edit); if (m.length) { toast.error("Fill before issuing: " + m.join(", ")); return; } }
    setBusy(true);
    const { id, status: cur, issued_at, signed_at, ...fields } = edit as any;
    const payload = { ...fields, allowances: (edit.allowances || []).filter(a => a.label.trim()), ...(status ? { status } : {}) };
    const q = id ? (supabase as any).from("sea_contracts").update(payload).eq("id", id) : (supabase as any).from("sea_contracts").insert(payload);
    const { error } = await q;
    setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success(status ? `Contract ${STATUS_LABEL[status].toLowerCase()}` : "Contract saved");
    setEdit(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this draft contract?")) return;
    const { error } = await (supabase as any).from("sea_contracts").delete().eq("id", id);
    if (error) toast.error("Only drafts can be deleted."); else load();
  };

  const download = async (c: SeaContract) => {
    setBusy(true);
    try {
      const { data } = await supabase.rpc("crew_desk_master_record" as any, { _application_id: c.application_id });
      const d: any = data || {}; const p = d.personal || {}, pr = d.profile || {};
      const name = [p.firstName || pr.first_name, p.lastName || pr.last_name].filter(Boolean).join(" ") || nameOf(c.application_id);
      const pdf = buildSeaPdf(c, { name, nationality: p.nationality || pr.nationality, dob: p.dob || p.dateOfBirth || pr.date_of_birth, passport: p.passportNumber || p.passport, cdc: p.cdcNumber || p.seamanBook, crewId: d.crew_unique_id || pr.crew_unique_id });
      pdf.save(`SEA_${name.replace(/\s+/g, "_")}.pdf`);
    } catch { toast.error("PDF could not be created."); }
    setBusy(false);
  };

  const inp = "w-full rounded-xl border border-border bg-background px-3 min-h-[44px] text-sm text-foreground disabled:opacity-60";
  const F = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block"><span className="text-xs text-muted-foreground">{label}</span><div className="mt-1">{children}</div></label>;

  if (edit) return (
    <div className="space-y-4 pb-bottom-nav">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-primary">{edit.id ? "Edit SEA" : "New SEA"} — {nameOf(edit.application_id)}</h2>
        <button aria-label="Close" onClick={() => setEdit(null)} className="w-10 h-10 flex items-center justify-center rounded-xl text-muted-foreground"><X size={18} /></button>
      </div>
      {locked && <p className="text-xs text-amber-400">Signed contract: wage and period are locked. You may only mark it completed or cancelled.</p>}
      <fieldset disabled={locked} className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-3 grid gap-3 sm:grid-cols-2">
          <p className="sm:col-span-2 text-sm font-semibold text-foreground">Employer & vessel</p>
          <F label="Employer / shipowner"><input className={inp} value={edit.employer_name} onChange={e => set("employer_name", e.target.value)} /></F>
          <F label="Employer address"><input className={inp} value={edit.employer_address} onChange={e => set("employer_address", e.target.value)} /></F>
          <F label="Rank"><input className={inp} value={edit.rank} onChange={e => set("rank", e.target.value)} /></F>
          <F label="Vessel name"><input className={inp} value={edit.vessel_name} onChange={e => set("vessel_name", e.target.value)} /></F>
          <F label="IMO number"><input className={inp} inputMode="numeric" maxLength={7} value={edit.imo_number} onChange={e => set("imo_number", e.target.value.replace(/\D/g, ""))} /></F>
          <F label="Flag state"><input className={inp} value={edit.flag_state} onChange={e => set("flag_state", e.target.value)} /></F>
          <F label="Vessel type"><input className={inp} value={edit.vessel_type} onChange={e => set("vessel_type", e.target.value)} /></F>
          <F label="CBA (e.g. ITF IBF) — optional"><input className={inp} value={edit.cba_reference} onChange={e => set("cba_reference", e.target.value)} /></F>
        </section>
        <section className="rounded-xl border border-border bg-card p-3 grid gap-3 sm:grid-cols-2">
          <p className="sm:col-span-2 text-sm font-semibold text-foreground">Engagement period</p>
          <F label="Port of engagement"><input className={inp} value={edit.port_of_engagement} onChange={e => set("port_of_engagement", e.target.value)} /></F>
          <F label="Repatriation port"><input className={inp} value={edit.repatriation_port} onChange={e => set("repatriation_port", e.target.value)} /></F>
          <F label="Start date"><input type="date" className={inp} value={edit.start_date || ""} onChange={e => set("start_date", e.target.value || null)} /></F>
          <F label="Notice period (days)"><input type="number" min={7} max={90} className={inp} value={edit.notice_days} onChange={num("notice_days")} /></F>
          <div className="sm:col-span-2">
            <span className="text-xs text-muted-foreground">Contract length (months)</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {PRESETS.map(p => <button type="button" key={p.d} onClick={() => setEdit(e => e && { ...e, duration_months: p.d, tolerance_months: 1 })} className={`rounded-xl border px-3 min-h-[40px] text-sm ${edit.duration_months === p.d ? "bg-primary text-primary-foreground border-primary font-semibold" : "border-border text-muted-foreground"}`}>{p.l}</button>)}
              <input type="number" min={1} max={12} step={0.5} aria-label="Custom months" className={inp + " w-24"} value={edit.duration_months} onChange={num("duration_months")} />
            </div>
          </div>
        </section>
        <section className="rounded-xl border border-border bg-card p-3 grid gap-3 sm:grid-cols-2">
          <p className="sm:col-span-2 text-sm font-semibold text-foreground">Monthly wage breakdown ({edit.currency})</p>
          <F label="Basic wage"><input type="number" min={0} className={inp} value={edit.basic_wage || ""} onChange={e => { const b = Number(e.target.value) || 0; setEdit(x => x && { ...x, basic_wage: b, leave_pay: suggestedLeavePay(b, x.leave_days_per_month) }); }} /></F>
          <F label="Guaranteed overtime (amount)"><input type="number" min={0} className={inp} value={edit.fixed_overtime || ""} onChange={num("fixed_overtime")} /></F>
          <F label="Guaranteed OT hours / month"><input type="number" min={0} max={200} className={inp} value={edit.overtime_hours} onChange={num("overtime_hours")} /></F>
          <F label="Extra OT rate per hour"><input type="number" min={0} className={inp} value={edit.extra_ot_rate || ""} onChange={num("extra_ot_rate")} /></F>
          <F label="Leave days / month (MLC min 2.5)"><input type="number" min={2.5} step={0.5} className={inp} value={edit.leave_days_per_month} onChange={e => { const d = Math.max(MLC_MIN_LEAVE_DAYS, Number(e.target.value) || MLC_MIN_LEAVE_DAYS); setEdit(x => x && { ...x, leave_days_per_month: d, leave_pay: suggestedLeavePay(x.basic_wage, d) }); }} /></F>
          <F label="Leave pay (auto, editable)"><input type="number" min={0} className={inp} value={edit.leave_pay || ""} onChange={num("leave_pay")} /></F>
          <div className="sm:col-span-2 space-y-2">
            <span className="text-xs text-muted-foreground">Allowances (tanker, subsistence, uniform…)</span>
            {edit.allowances.map((a, i) => (
              <div key={i} className="flex gap-2">
                <input className={inp} placeholder="Label" value={a.label} onChange={e => set("allowances", edit.allowances.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                <input type="number" min={0} className={inp + " w-32"} placeholder="Amount" value={a.amount || ""} onChange={e => set("allowances", edit.allowances.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) || 0 } : x))} />
                <button type="button" aria-label="Remove allowance" onClick={() => set("allowances", edit.allowances.filter((_, j) => j !== i))} className="w-11 shrink-0 flex items-center justify-center rounded-xl border border-border text-muted-foreground"><Trash2 size={14} /></button>
              </div>
            ))}
            {edit.allowances.length < 12 && <button type="button" onClick={() => set("allowances", [...edit.allowances, { label: "", amount: 0 }])} className="text-sm text-primary flex items-center gap-1"><Plus size={14} /> Add allowance</button>}
          </div>
          <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-primary/40 p-3">
            <span className="text-sm text-muted-foreground">Total guaranteed monthly</span>
            <span className="text-lg font-bold text-primary">{edit.currency} {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
        </section>
        <F label="Additional terms (optional)"><textarea rows={3} className={inp + " py-2"} value={edit.notes} onChange={e => set("notes", e.target.value)} /></F>
      </fieldset>
      <div className="grid gap-2 sm:grid-cols-2">
        {!locked && <Button disabled={busy} variant="outline" onClick={() => save()} className="min-h-12">Save draft</Button>}
        {edit.id && (!edit.status || edit.status === "draft") && <Button disabled={busy} onClick={() => save("issued")} className="min-h-12">Issue to crew</Button>}
        {edit.status === "issued" && <Button disabled={busy} onClick={() => save("signed")} className="min-h-12">Mark signed</Button>}
        {edit.status === "signed" && <Button disabled={busy} onClick={() => save("completed")} className="min-h-12">Mark completed (signed off)</Button>}
        {edit.id && edit.status && !["completed", "cancelled", "draft"].includes(edit.status) && <Button disabled={busy} variant="outline" onClick={() => confirm("Cancel this contract?") && save("cancelled")} className="min-h-12">Cancel contract</Button>}
        <Button disabled={busy} variant="outline" onClick={() => download(edit)} className="min-h-12"><FileDown size={16} /> Download SEA (PDF)</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        <p className="text-sm font-semibold text-foreground">Create a Seafarer Employment Agreement</p>
        <p className="text-xs text-muted-foreground">MLC 2006 layout with automatic wage, leave-pay and total calculation. Only crew who confirmed joining can be selected.</p>
        <div className="flex gap-2">
          <select value={pick} onChange={e => setPick(e.target.value)} className={inp}>
            <option value="">Select confirmed crew…</option>
            {confirmed.map(r => <option key={r.application_id} value={r.application_id}>{r.crew_name} — {r.rank}</option>)}
          </select>
          <Button disabled={!pick} onClick={() => { const r = confirmed.find(x => x.application_id === pick); if (r) setEdit(blank(r, employer)); }} className="min-h-[44px]"><Plus size={16} /> New</Button>
        </div>
        {rows && confirmed.length === 0 && <p className="text-xs text-muted-foreground">No crew has confirmed joining yet.</p>}
      </div>
      {list === null && <p className="text-sm text-muted-foreground">Loading contracts…</p>}
      {list?.length === 0 && <p className="text-sm text-muted-foreground">No contracts yet.</p>}
      {list?.map(c => (
        <div key={c.id} className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[180px]">
            <p className="font-semibold text-foreground">{nameOf(c.application_id)} — {c.rank}</p>
            <p className="text-xs text-muted-foreground">{[c.vessel_name, c.start_date, `${c.duration_months}±${c.tolerance_months} mo`].filter(Boolean).join(" • ")}</p>
            <p className="text-xs text-primary">{c.currency} {monthlyTotal(c).toLocaleString("en-US", { minimumFractionDigits: 2 })} / month</p>
          </div>
          <span className="text-[11px] rounded-full border border-primary/40 text-primary px-2 py-0.5">{STATUS_LABEL[c.status]}</span>
          <button onClick={() => setEdit(c)} className="rounded-xl bg-primary text-primary-foreground font-bold px-3 min-h-[40px] text-sm">Open</button>
          <button aria-label="Download PDF" disabled={busy} onClick={() => download(c)} className="w-10 h-10 flex items-center justify-center rounded-xl border border-border text-primary"><FileDown size={16} /></button>
          {c.status === "draft" && <button aria-label="Delete draft" onClick={() => remove(c.id)} className="w-10 h-10 flex items-center justify-center rounded-xl border border-border text-muted-foreground"><Trash2 size={16} /></button>}
        </div>
      ))}
    </div>
  );
}
