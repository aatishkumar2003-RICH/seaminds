import { describe, expect, it } from 'vitest';
import { DEFAULT_MONETIZATION, effectivePricing, validateMonetization } from '@/lib/monetization';

describe('owner monetization controls', () => {
  it('starts OFF', () => expect(DEFAULT_MONETIZATION.enabled).toBe(false));
  it('charges zero for every configured feature in free mode', () => {
    const p = effectivePricing({ ...DEFAULT_MONETIZATION, boost_day_credits: 20, contact_credits: 50 });
    expect([p.boost_day_credits,p.boost_week_credits,p.urgent_block_credits,p.fleet_block_credits,p.contact_credits]).toEqual([0,0,0,0,0]);
  });
  it('uses owner edited costs when enabled', () => {
    const p = effectivePricing({ ...DEFAULT_MONETIZATION, enabled: true, boost_week_credits: 37, urgent_block_credits: 21 });
    expect(p.boost_week_credits).toBe(37); expect(p.urgent_block_credits).toBe(21);
  });
  it('allows separate crew free mode', () => {
    const p = effectivePricing({ ...DEFAULT_MONETIZATION, enabled: true, crew_enabled: false });
    expect(p.boost_day_credits).toBe(0); expect(p.urgent_block_credits).toBe(5);
  });
  it('does not activate checkout with the charging switch', () => expect(effectivePricing({ ...DEFAULT_MONETIZATION, enabled: true }).checkout_ready).toBe(false));
  it('allows a zero cost and rejects fractional or negative costs', () => {
    expect(validateMonetization({ ...DEFAULT_MONETIZATION, contact_credits: 0 })).toBeNull();
    for (const value of [-1, 1.5, NaN, 1000001]) expect(validateMonetization({ ...DEFAULT_MONETIZATION, contact_credits: value })).not.toBeNull();
  });
});