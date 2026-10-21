# Edge function rules

- Pure AI/email provider adapters live in `supabase/functions/_shared/finalAi.ts` with no imports so vitest can test them. Why: deterministic mocked-fetch tests without a new test runtime.
- DORA answers go through `dora-assist`: deterministic exam-integrity block and no-article fallback before any AI call; AI sees only retrieved published articles + `dora_get_my_context`. Why: no invented procedures, no exam leakage, minimal AI cost.
- Recruiter outreach only via `recruiter-outreach` (daily cron, capped; contacts from `recruiter_outreach_sync()`); stops on replied/joined/unsubscribed/bounced. Why: sender reputation and opt-out respect.
- Assessment recovery emails go through `recovery_outbox` (leased, attempt-fenced, stable idempotency key); never send from `recovery_claim_due`. Why: crashes must not strand work or mint new links.
- Crew recruiter-email delivery status is read via `notify-application` `kind: "delivery_status"` (own applications, ids only), cached in `vacancyFeed` and refreshed on app resume. Why: an application row alone does not prove the email was accepted.
- Weekly blog briefing only via `weekly-briefing` (cron Tue–Fri, one region/audience per day, per-run cap, stands down near the shared free email ceiling; 90-day no-repeat via `briefing_log`, opt-out in `briefing_optout`). Why: protect the email quota for critical alerts.
