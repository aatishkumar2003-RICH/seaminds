import { useCallback, useEffect, useState } from "react";
import { Plus, Save, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditAudience, CreditPlan, DEFAULT_REWARDS, RewardSettings, validateCreditPlan, validateRewards, creditReasonLabel } from "@/lib/creditProgram";

const AUDIENCES: Record<CreditAudience, string> = { crew: "Crew", manager: "Ship managers", fleet: "Fleet management" };
type Report = { totals: { balance: number; awarded: number; spent: number }; ledger: { id: string; email: string; delta: number; reason: string; created_at: string }[]; referrals: { id: string; referred_email: string; referrer_email: string; completed: boolean; credits: number }[] };
type Audit = { id: string; entity: string; created_at: string; before_value: unknown; after_value: unknown };

export default function PlansCreditsTab() {
  const [audience, setAudience] = useState<CreditAudience>("crew");
  const [plans, setPlans] = useState<CreditPlan[]>([]);
  const [settings, setSettings] = useState<RewardSettings>(DEFAULT_REWARDS);
  const [form, setForm] = useState<CreditPlan | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    const [p, s, r, a] = await Promise.all([
      supabase.from("credit_plans").select("*").order("updated_at", { ascending: false }),
      supabase.from("credit_program_settings").select("*").eq("id", true).maybeSingle(),
      supabase.rpc("admin_credit_report", { p_offset: offset, p_search: filter }),
      supabase.from("credit_control_audit").select("*").order("created_at", { ascending: false }).limit(20),
    ]);
    const err = p.error || s.error || r.error || a.error;
    if (err) setError(err.message);
    else { setPlans((p.data || []) as CreditPlan[]); setSettings(s.data || DEFAULT_REWARDS); setReport(r.data as unknown as Report); setAudit((a.data || []) as Audit[]); }
    setLoading(false);
  }, [offset, filter]);
  useEffect(() => { void load(); }, [load]);
  const savePlan = async () => {
    if (!form || busy) return;
    const invalid = validateCreditPlan(form); if (invalid) return toast.error(invalid);
    setBusy(true);
    const payload = { ...form, name: form.name.trim() };
    const result = form.id ? await supabase.from("credit_plans").update(payload).eq("id", form.id).select("id").single() : await supabase.from("credit_plans").insert(payload).select("id").single();
    setBusy(false);
    if (result.error) return toast.error(result.error.message);
    toast.success("Plan saved as a private draft"); setForm(null); void load();
  };
  const saveSettings = async () => {
    const invalid = validateRewards(settings); if (invalid) return toast.error(invalid);
    setBusy(true);
    const { error } = await supabase.from("credit_program_settings").upsert({ id: true, ...settings }).select("id").single();
    setBusy(false); if (error) return toast.error(error.message);
    toast.success("Reward rules saved — earned credits stay unchanged"); void load();
  };
  if (loading) return <p className="py-6 text-muted-foreground">Loading plans and credit activity…</p>;
  if (error) return <div className="py-6 space-y-3"><p role="alert" className="text-destructive">{error}</p><Button variant="outline" onClick={load}><RefreshCw /> Retry</Button></div>;
  return <div className="py-6 space-y-8 text-foreground">
    <header className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-bold text-primary">Plans & Credits</h2><p className="text-sm text-muted-foreground mt-1">Global USD pricing · Free growth remains active · Plans are private, not purchasable</p></div><Button variant="outline" onClick={load}><RefreshCw /> Refresh</Button></header>
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">{Object.entries(AUDIENCES).map(([key, label]) => <Button key={key} variant={audience === key ? "default" : "outline"} onClick={() => { setAudience(key as CreditAudience); setForm(null); }}>{label}</Button>)}</div>
      <div className="flex justify-between items-center gap-2"><h3 className="font-semibold">{AUDIENCES[audience]} plans</h3><Button onClick={() => setForm({ audience, name: "", price_usd: 0, credits: 50, interval: "once", active: true })}><Plus /> Add plan</Button></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-primary border-b border-border"><tr>{["Plan name", "Price (USD)", "Credits", "Interval", "State", ""].map((h,i) => <th key={i} className="p-3 text-left whitespace-nowrap">{h}</th>)}</tr></thead><tbody>
        {plans.filter(p => p.audience === audience).map(p => <tr key={p.id} className="border-b border-border"><td className="p-3">{p.name}</td><td className="p-3">${Number(p.price_usd).toFixed(2)}</td><td className="p-3">{p.credits}</td><td className="p-3">{p.interval === "once" ? "One-time" : p.interval === "month" ? "Monthly" : "Annual"}</td><td className="p-3">{p.active ? "Draft" : "Archived"}</td><td className="p-3"><Button variant="outline" size="sm" onClick={() => setForm(p)}>Edit</Button></td></tr>)}
        {!plans.some(p => p.audience === audience) && <tr><td colSpan={6} className="p-4 text-muted-foreground">No plans for this audience yet.</td></tr>}
      </tbody></table></div>
      {form && <form onSubmit={e => { e.preventDefault(); void savePlan(); }} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 border-y border-border py-4">
        <label className="text-sm space-y-2">Plan name<Input aria-label="Plan name" maxLength={80} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></label>
        <label className="text-sm space-y-2">Price (USD)<Input aria-label="Price (USD)" type="number" min="0" step="0.01" value={form.price_usd} onChange={e => setForm({ ...form, price_usd: e.target.value === "" ? NaN : Number(e.target.value) })} required /></label>
        <label className="text-sm space-y-2">Credits<Input aria-label="Plan credits" type="number" min="0" step="1" value={form.credits} onChange={e => setForm({ ...form, credits: e.target.value === "" ? NaN : Number(e.target.value) })} required /></label>
        <div className="text-sm space-y-2"><span>Interval</span><Select value={form.interval} onValueChange={v => setForm({ ...form, interval: v as CreditPlan["interval"] })}><SelectTrigger aria-label="Plan interval"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="once">One-time</SelectItem><SelectItem value="month">Monthly</SelectItem><SelectItem value="year">Annual</SelectItem></SelectContent></Select></div>
        <label className="flex gap-3 items-center text-sm"><Switch checked={form.active} onCheckedChange={active => setForm({ ...form, active })} />Keep draft (off = archive)</label>
        <div className="flex gap-2"><Button disabled={busy} type="submit"><Save /> Save plan</Button><Button variant="ghost" type="button" onClick={() => setForm(null)}>Cancel</Button></div>
      </form>}
    </section>
    <section className="space-y-4 border-t border-border pt-6"><h3 className="font-semibold text-primary">Earning rules & reminders</h3><p className="text-sm text-muted-foreground">One-time milestones only. Referral rewards go to the inviter after a completed crew profile, never just signup. Maximum 50 rewarded referrals per 24 hours. Credits never unlock crew search or contacts. Changes apply to future awards only.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{([['welcome_credits','Welcome credits'],['profile_credits','Completed CV / company profile'],['score_credits','First completed crew score'],['referral_credits','Completed referral']] as const).map(([key,label]) => <label key={key} className="text-sm space-y-2">{label}<Input aria-label={label} type="number" min="0" max="100000" step="1" value={settings[key]} onChange={e => setSettings({ ...settings, [key]: e.target.value === "" ? NaN : Number(e.target.value) })} /></label>)}</div>
      <div className="flex flex-wrap items-center gap-4"><label className="flex gap-2 items-center text-sm"><Switch aria-label="Earning reminders" checked={settings.reminders_enabled} onCheckedChange={reminders_enabled => setSettings({ ...settings, reminders_enabled })} />Earning reminders</label><label className="text-sm flex gap-2 items-center">Repeat after (hours)<Input aria-label="Reminder hours" className="w-24" type="number" min="1" max="720" value={settings.reminder_hours} onChange={e => setSettings({ ...settings, reminder_hours: Number(e.target.value) })} /></label><Button disabled={busy} onClick={saveSettings}><Save /> Save reward rules</Button></div>
    </section>
    <section className="space-y-4 border-t border-border pt-6"><h3 className="font-semibold text-primary">Credit activity & personal referrals</h3><div className="flex flex-wrap gap-6 text-sm"><span>Awarded: <strong>{report?.totals.awarded ?? 0}</strong></span><span>Spent: <strong>{report?.totals.spent ?? 0}</strong></span><span>Outstanding: <strong>{report?.totals.balance ?? 0}</strong></span></div>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setOffset(0); setFilter(search.trim()); }}><Input aria-label="Search credit activity by email" placeholder="Search member email" value={search} onChange={e => setSearch(e.target.value)} /><Button type="submit" variant="outline">Search</Button></form>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{["Member email","Credits","Reason","Time"].map(h => <th key={h} className="text-left p-2 text-primary">{h}</th>)}</tr></thead><tbody>{report?.ledger.map(l => <tr key={l.id} className="border-b border-border"><td className="p-2 break-all">{l.email}</td><td className="p-2">{l.delta>0?"+":""}{l.delta}</td><td className="p-2">{creditReasonLabel(l.reason)}</td><td className="p-2 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td></tr>)}</tbody></table>{!report?.ledger.length && <p className="py-3 text-muted-foreground">No credit activity found.</p>}</div>
      <h4 className="text-sm font-semibold">Personal member-to-member referrals</h4><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{["Inviter email","Referred crew email","Profile","Awarded"].map(h => <th key={h} className="p-2 text-left text-primary">{h}</th>)}</tr></thead><tbody>{report?.referrals.map(r => <tr key={r.id} className="border-b border-border"><td className="p-2 break-all">{r.referrer_email}</td><td className="p-2 break-all">{r.referred_email}</td><td className="p-2">{r.completed ? "Complete" : "Pending"}</td><td className="p-2">{r.credits}</td></tr>)}</tbody></table>{!report?.referrals.length && <p className="py-3 text-muted-foreground">No personal referrals found. Campaign codes remain in the Referrals tab.</p>}</div>
      <div className="flex gap-3 items-center"><Button variant="outline" size="icon" aria-label="Previous activity page" disabled={offset===0} onClick={() => setOffset(Math.max(0,offset-50))}><ChevronLeft /></Button><span className="text-sm">Page {offset/50+1}</span><Button variant="outline" size="icon" aria-label="Next activity page" disabled={(report?.ledger.length ?? 0)<50 && (report?.referrals.length ?? 0)<50} onClick={() => setOffset(offset+50)}><ChevronRight /></Button></div>
    </section>
    <section className="border-t border-border pt-6 space-y-3"><h3 className="text-primary font-semibold">Recent control changes</h3>{!audit.length && <p className="text-sm text-muted-foreground">No changes recorded yet.</p>}{audit.map(a => <details key={a.id} className="border-b border-border pb-2 text-sm"><summary className="cursor-pointer">{a.entity === "credit_plans" ? "Plan" : "Reward rules"} · {new Date(a.created_at).toLocaleString()}</summary><pre className="mt-2 whitespace-pre-wrap break-all text-xs text-muted-foreground">{JSON.stringify({ before: a.before_value, after: a.after_value },null,2)}</pre></details>)}</section>
  </div>;
}