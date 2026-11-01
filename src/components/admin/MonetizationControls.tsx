import { useEffect, useState } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import MarketCreditRequests from './MarketCreditRequests';
import { COST_FIELDS, DEFAULT_MONETIZATION, validateMonetization, type MonetizationSettings } from '@/lib/monetization';

export default function MonetizationControls({ onSaved }: { onSaved: () => void }) {
  const [settings, setSettings] = useState<MonetizationSettings>(DEFAULT_MONETIZATION);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('monetization_settings').select('*').eq('id', true).single();
    if (error) setError(error.message);
    else { setSettings(data); setError(''); }
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);
  const save = async () => {
    const invalid = validateMonetization(settings);
    if (invalid) return toast.error(invalid);
    setBusy(true);
    const payload = Object.fromEntries(Object.keys(DEFAULT_MONETIZATION).map(key => [key, settings[key as keyof MonetizationSettings]])) as MonetizationSettings;
    const { error } = await supabase.from('monetization_settings').update(payload).eq('id', true).select('id').single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(settings.enabled ? 'Credit charging enabled for selected audiences; checkout remains unavailable' : 'Free mode saved — existing credits preserved');
    await load(); onSaved();
  };
  return <section className="space-y-4 border-y border-border py-5">
    <h3 className="font-semibold text-primary">Monetization · Tazapay standby</h3>
    {loading ? <p className="text-sm text-muted-foreground">Loading payment settings…</p> : error ? <div><p role="alert" className="text-destructive">{error}</p><Button variant="outline" onClick={load}><RefreshCw />Retry</Button></div> : <>
      <div className="flex flex-wrap gap-5">
        {([['enabled', 'Enable credit charging'], ['crew_enabled', 'Crew paid features'], ['manager_enabled', 'Manager paid features']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><Switch aria-label={label} checked={settings[key]} disabled={busy} onCheckedChange={value => setSettings({ ...settings, [key]: value })} />{label}</label>)}
      </div>
      <p className="text-sm text-muted-foreground">{settings.enabled ? 'Paid credit usage selected. No subscriptions or purchases start until Tazapay checkout is connected.' : 'Free mode: boosts and promotions use zero credits. Existing balances stay unchanged.'} Crew search remains locked. Applications and standard vacancy posting stay free.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{COST_FIELDS.map(([key, label]) => <label key={key} className="text-sm space-y-2">{label}<Input aria-label={label} type="number" min="0" max="1000000" step="1" value={Number.isNaN(settings[key]) ? '' : settings[key]} onChange={e => setSettings({ ...settings, [key]: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>)}</div>
      <p className="text-sm text-muted-foreground">Package prices exclude tax. Applicable tax and banking/payment charges are added for the customer before checkout. Tazapay rates and payment confirmation are not connected yet.</p>
      <Button onClick={save} disabled={busy}><Save />{busy ? 'Saving…' : 'Save monetization settings'}</Button>
      <MarketCreditRequests />
    </>}
  </section>;
}