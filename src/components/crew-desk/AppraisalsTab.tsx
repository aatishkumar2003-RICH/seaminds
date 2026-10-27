import { useEffect, useState } from "react";
import { FileDown, Lock, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CRITERIA, PROMO_LABEL, REHIRE_LABEL, ROLE_LABEL, TRAINING_OPTIONS, badgeFor, buildAppraisalPdf, finalizeProblems, overallScore, type Appraisal } from "@/lib/crewAppraisal";

type Row = { application_id: string; crew_name: string; rank: string };
type Contract = { id: string; application_id: string; status: string; vessel_name: string; rank: string; start_date: string; duration_months: number; employer_name: string };
const ERR: Record<string, string> = { appraisal_locked: "This appraisal is final and cannot be changed.", contract_not_signed: "The contract must be signed first.", not_owner: "This contract is not yours.", appraiser_required: "Enter the appraiser's name.", training_required: "Pick at least one training need." };
const errMsg = (e: any) => { const k = Object.keys(ERR).find(k => String(e?.message || "").includes(k)); return k ? ERR[k] : "Could not save. Please retry."; };
const TONE = { good: "border-[#22c55e] text-[#22c55e]", warn: "border-[#f59e0b] text-[#f59e0b]", bad: "border-destructive text-destructive" };
const endOf = (start: string, m: number) => { const d = new Date(start); d.setMonth(d.getMonth() + (m || 0)); return d.toISOString().slice(0, 10); };

export default function AppraisalsTab({ rows }: { rows: Row[] | null }) {
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [items, setItems] = useState<Record<string, Appraisal>>({});
  const [openId, setOpenId] = useState("");
  const [draft, setDraft] = useState<Appraisal | null>(null);
  const [busy, setBusy] = useState(false);
  const nameOf = (id: string) => rows?.find(r => r.application_id === id)?.crew_name || "Crew";

  const load = async () => {
    const { data, error } = await (supabase as any).from("sea_contracts").select("id,application_id,status,vessel_name,rank,start_date,duration_months,employer_name").in("status", ["signed", "completed"]);
    if (error) { toast.error("Could not load contracts."); setContracts([]); return; }
    setContracts(data || []);
    const { data: ap } = await (supabase as any).from("crew_appraisals").select("*");
    const m: Record<string, Appraisal> = {}; (ap || []).forEach((a: Appraisal) => { m[a.contract_id] = a; }); setItems(m);
  };
  useEffect(() => { load(); }, []);

  const open = (c: Contract) => {
    setOpenId(c.id);
    setDraft(items[c.id] ? { ...items[c.id] } : {
      contract_id: c.id, appraiser_name: "", appraiser_role: "master", period_from: c.start_date, period_to: endOf(c.start_date, c.duration_months),
      safety: 3, technical: 3, emergency: 3, teamwork: 3, english: 3, leadership: 3, rehire_verdict: "rehire", promotion_verdict: "maintain_rank",
      training_needs: [], remarks: "", status: "draft",
    });
  };

  const save = async (finalize: boolean) => {
    if (!draft) return;
    if (finalize) {
      const p = finalizeProblems(draft); if (p.length) { toast.error(p[0]); return; }
      if (!confirm("Finalize this appraisal? It cannot be changed afterwards.")) return;
    }
    setBusy(true);
    const { id, overall, finalized_at, ...body } = draft as any;
    const payload = { ...body, training_needs: draft.rehire_verdict === "rehire_with_training" ? draft.training_needs : draft.training_needs, status: finalize ? "finalized" : "draft" };
    const q = id ? (supabase as any).from("crew_appraisals").update(payload).eq("id", id) : (supabase as any).from("crew_appraisals").insert(payload);
    const { error } = await q; setBusy(false);
    if (error) { toast.error(errMsg(error)); return; }
    toast.success(finalize ? "Appraisal finalized." : "Draft saved.");
    setOpenId(""); setDraft(null); load();
  };

  if (!contracts) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!contracts.length) return <p className="text-sm text-muted-foreground rounded-xl border border-border p-4">No signed contracts yet. Appraisals open once a crew member has a signed contract in SEA Contracts. <a href="/manager/crew-desk?tab=contracts" className="ml-1 font-bold text-primary underline">Open SEA Contracts →</a></p>;

  const ro = draft?.status === "finalized";
  const c = contracts.find(x => x.id === openId);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground bg-secondary">Crew with signed contracts</div>
        {contracts.map(k => {
          const a = items[k.id]; const b = a ? badgeFor(a) : null;
          return (
            <button key={k.id} onClick={() => open(k)} className={`w-full text-left px-3 py-3 border-t border-border flex items-center justify-between gap-2 hover:bg-secondary ${openId === k.id ? "bg-secondary" : ""}`}>
              <span><span className="block text-sm font-semibold text-foreground">{nameOf(k.application_id)}</span>
                <span className="block text-xs text-muted-foreground">{k.rank} · {k.vessel_name || "Unassigned"} · {k.status === "completed" ? "Signed off" : "Onboard"}</span></span>
              {b ? <span className={`text-[11px] border rounded-full px-2 py-0.5 ${TONE[b.tone]}`}>{b.label}</span>
                : <span className="text-[11px] text-muted-foreground">{a ? "Draft" : "Not appraised"}</span>}
            </button>
          );
        })}
      </div>

      {draft && c ? (
        <div className="rounded-xl border border-border p-4 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground">{nameOf(c.application_id)} — {c.rank}</h3>
            <span className="text-sm text-primary font-bold flex items-center gap-1"><Star size={14} /> Overall {overallScore(draft).toFixed(2)} / 5.00</span>
          </div>
          {ro && <p className="text-xs text-muted-foreground flex items-center gap-1"><Lock size={12} /> Finalized — read only.</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-muted-foreground">Appraiser name
              <input disabled={ro} value={draft.appraiser_name} onChange={e => setDraft({ ...draft, appraiser_name: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>
            <label className="text-xs text-muted-foreground">Appraiser role
              <select disabled={ro} value={draft.appraiser_role} onChange={e => setDraft({ ...draft, appraiser_role: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                {Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="text-xs text-muted-foreground">Period from
              <input type="date" disabled={ro} value={draft.period_from || ""} onChange={e => setDraft({ ...draft, period_from: e.target.value || null })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>
            <label className="text-xs text-muted-foreground">Period to
              <input type="date" disabled={ro} value={draft.period_to || ""} onChange={e => setDraft({ ...draft, period_to: e.target.value || null })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>
          </div>

          <div className="space-y-2">
            {CRITERIA.map(cr => (
              <div key={cr.k} className="flex items-center gap-3">
                <span className="text-sm text-foreground flex-1">{cr.l}</span>
                <input type="range" min={1} max={5} step={0.5} disabled={ro} value={draft[cr.k]} onChange={e => setDraft({ ...draft, [cr.k]: Number(e.target.value) })} className="w-40 accent-primary" aria-label={cr.l} />
                <span className="w-10 text-right text-sm font-semibold text-primary">{Number(draft[cr.k]).toFixed(1)}</span>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-muted-foreground">Re-employment verdict
              <select disabled={ro} value={draft.rehire_verdict} onChange={e => setDraft({ ...draft, rehire_verdict: e.target.value as any })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                {Object.entries(REHIRE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="text-xs text-muted-foreground">Promotion
              <select disabled={ro} value={draft.promotion_verdict} onChange={e => setDraft({ ...draft, promotion_verdict: e.target.value as any })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                {Object.entries(PROMO_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Training needs {draft.rehire_verdict === "rehire_with_training" && <span className="text-[#f59e0b]">(required)</span>}</p>
            <div className="flex flex-wrap gap-2">
              {TRAINING_OPTIONS.map(t => {
                const on = draft.training_needs.includes(t);
                return <button key={t} type="button" disabled={ro} onClick={() => setDraft({ ...draft, training_needs: on ? draft.training_needs.filter(x => x !== t) : [...draft.training_needs, t] })}
                  className={`text-xs rounded-full px-3 py-1 border ${on ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>{t}</button>;
              })}
            </div>
          </div>

          <label className="block text-xs text-muted-foreground">Remarks
            <textarea disabled={ro} rows={3} value={draft.remarks} onChange={e => setDraft({ ...draft, remarks: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" /></label>

          <div className="flex flex-wrap gap-2">
            {!ro && <Button disabled={busy} variant="outline" onClick={() => save(false)}>Save draft</Button>}
            {!ro && <Button disabled={busy} onClick={() => save(true)}>Finalize appraisal</Button>}
            <Button variant="outline" onClick={() => buildAppraisalPdf(draft, { crew: nameOf(c.application_id), rank: c.rank, vessel: c.vessel_name, employer: c.employer_name })}><FileDown size={14} className="mr-1" /> Appraisal PDF</Button>
          </div>
        </div>
      ) : <p className="text-sm text-muted-foreground rounded-xl border border-border p-4">Pick a crew member to write or view their appraisal.</p>}
    </div>
  );
}
