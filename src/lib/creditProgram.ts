export type CreditAudience = "crew" | "manager" | "fleet";
export type CreditPlan = { id?: string; audience: CreditAudience; name: string; price_usd: number; credits: number; interval: "once" | "month" | "year"; active: boolean };
export type RewardSettings = { welcome_credits: number; profile_credits: number; score_credits: number; referral_credits: number; reminders_enabled: boolean; reminder_hours: number };
export const DEFAULT_REWARDS: RewardSettings = { welcome_credits: 50, profile_credits: 5, score_credits: 5, referral_credits: 1, reminders_enabled: true, reminder_hours: 24 };
export function validateCreditPlan(plan: CreditPlan): string | null {
  if (!plan.name.trim() || plan.name.trim().length > 80) return "Enter a plan name (up to 80 characters)";
  if (!Number.isFinite(plan.price_usd) || plan.price_usd < 0 || plan.price_usd > 9999999999.99 || Math.abs(plan.price_usd * 100 - Math.round(plan.price_usd * 100)) > 0.0001) return "Enter a USD amount with no more than two decimal places";
  if (!Number.isInteger(plan.credits) || plan.credits < 0 || plan.credits > 1000000) return "Enter whole credits from 0 to 1,000,000";
  if (!["crew", "manager", "fleet"].includes(plan.audience) || !["once", "month", "year"].includes(plan.interval)) return "Select an audience and interval";
  return null;
}
export function validateRewards(settings: RewardSettings): string | null {
  if ([settings.welcome_credits, settings.profile_credits, settings.score_credits, settings.referral_credits].some(n => !Number.isInteger(n) || n < 0 || n > 100000)) return "Rewards must be whole credits from 0 to 100,000";
  if (!Number.isInteger(settings.reminder_hours) || settings.reminder_hours < 1 || settings.reminder_hours > 720) return "Reminder interval must be 1–720 hours";
  return null;
}
export function reminderDue(settings: RewardSettings, lastSeen: number, now: number): boolean {
  return settings.reminders_enabled && (!Number.isFinite(lastSeen) || lastSeen <= 0 || now - lastSeen >= settings.reminder_hours * 3600000);
}
export const CREDIT_REASON_LABELS: Record<string, string> = { welcome_launch: "Welcome bonus", cv_completed: "Completed CV & profile", manager_profile_completed: "Completed company profile", assessment_completed: "First completed score", monthly_free: "Monthly complimentary credits", referral_joined: "Legacy invite bonus" };
export function creditReasonLabel(reason: string) { return CREDIT_REASON_LABELS[reason] || (reason.startsWith("referral_") ? "Completed referral" : reason.startsWith("reveal:") ? "Legacy contact access" : reason); }