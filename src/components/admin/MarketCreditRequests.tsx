import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

type Req = { id: string; user_id: string; requested: number; reason: string; status: string; created_at: string };
const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a: unknown) => Promise<{ data: any; error: any }> };

/** Admin review of supplier free-credit requests (launch phase). */
export default function MarketCreditRequests() {
  const [rows, setRows] = useState<Req[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const load = async () => {
    const { data } = await db.from('market_credit_requests').select('*').eq('status', 'pending').order('created_at');
    setRows(data ?? []);
    const ids = (data ?? []).map((r: Req) => r.user_id);
    if (ids.length) {
      const { data: v } = await db.from('marketplace_vendors').select('user_id,company_name').in('user_id', ids);
      setNames(Object.fromEntries((v ?? []).map((x: any) => [x.user_id, x.company_name])));
    }
  };
  useEffect(() => { void load(); }, []);
  const decide = async (id: string, approve: boolean) => {
    const { data, error } = await db.rpc('admin_decide_credit_request', { p_id: id, p_approve: approve });
    if (error || !data?.ok) return toast.error('Could not update request');
    toast.success(approve ? 'Credits granted' : 'Request declined'); load();
  };
  return <section className="space-y-3 border-b border-border pb-5">
    <h3 className="font-semibold text-primary">Supplier free-credit requests ({rows.length})</h3>
    {rows.length === 0 ? <p className="text-sm text-muted-foreground">No pending requests.</p> : rows.map(r => (
      <div key={r.id} className="rounded-xl border border-border p-3 text-sm space-y-1">
        <p className="font-semibold">{names[r.user_id] ?? 'Supplier'} · {r.requested} credits</p>
        <p className="text-muted-foreground">{r.reason}</p>
        <div className="flex gap-2"><Button size="sm" onClick={() => decide(r.id, true)}>Approve</Button><Button size="sm" variant="outline" onClick={() => decide(r.id, false)}>Decline</Button></div>
      </div>
    ))}
  </section>;
}
