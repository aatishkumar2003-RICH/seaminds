export type MonetizationSettings = {
  enabled: boolean; crew_enabled: boolean; manager_enabled: boolean;
  boost_day_credits: number; boost_week_credits: number; urgent_block_credits: number;
  fleet_block_credits: number; contact_credits: number; market_contact_credits: number;
};
export const DEFAULT_MONETIZATION: MonetizationSettings = {
  enabled: false, crew_enabled: true, manager_enabled: true,
  boost_day_credits: 1, boost_week_credits: 5, urgent_block_credits: 5, fleet_block_credits: 5, contact_credits: 1, market_contact_credits: 1,
};
export const COST_FIELDS = [
  ['boost_day_credits', 'Crew priority · 24 hours'],
  ['boost_week_credits', 'Crew priority · 7 days'],
  ['urgent_block_credits', 'Urgent promotion · per 5 vacancies / 48h'],
  ['fleet_block_credits', 'Fleet promotion · per 10 vacancies / 7 days'],
  ['contact_credits', 'Contact reveal · owner preview only'],
  ['market_contact_credits', 'Marketplace inquiry / supplier contact · once per item'],
] as const;
export function validateMonetization(s: MonetizationSettings): string | null {
  if ([s.enabled, s.crew_enabled, s.manager_enabled].some(v => typeof v !== 'boolean')) return 'Select valid payment switches';
  if (COST_FIELDS.some(([key]) => !Number.isInteger(s[key]) || s[key] < 0 || s[key] > 1000000)) return 'Enter whole credit costs from 0 to 1,000,000';
  return null;
}
export type CreditPricing = { crew_paid: boolean; manager_paid: boolean; boost_day_credits: number; boost_week_credits: number; urgent_block_credits: number; fleet_block_credits: number; contact_credits: number; market_contact_credits: number; checkout_ready: boolean };
export function effectivePricing(s: MonetizationSettings): CreditPricing {
  const crew = s.enabled && s.crew_enabled, manager = s.enabled && s.manager_enabled;
  return { crew_paid: crew, manager_paid: manager, boost_day_credits: crew ? s.boost_day_credits : 0, boost_week_credits: crew ? s.boost_week_credits : 0, urgent_block_credits: manager ? s.urgent_block_credits : 0, fleet_block_credits: manager ? s.fleet_block_credits : 0, contact_credits: manager ? s.contact_credits : 0, market_contact_credits: s.enabled ? s.market_contact_credits : 0, checkout_ready: false };
}
