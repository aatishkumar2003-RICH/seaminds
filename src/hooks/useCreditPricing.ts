import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CreditPricing } from '@/lib/monetization';

export function useCreditPricing() {
  const [pricing, setPricing] = useState<CreditPricing | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.rpc('get_credit_pricing');
      if (alive) setPricing(error ? null : data as unknown as CreditPricing);
    };
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    window.addEventListener('focus', load);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener('focus', load); };
  }, []);
  return pricing;
}