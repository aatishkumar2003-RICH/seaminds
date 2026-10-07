# Architecture rules

- Assessment recovery emails go through `recovery_outbox` (one row per reminder, leased, fenced by attempt, stable idempotency key); never send directly from `recovery_claim_due`. Why: a crashed worker must not strand recoverable work or mint new links per retry.
- Heartbeat `save_checkpoint` never clears an interruption; only `confirm_resume` (same paper + persisted answer) does. Why: a reconnect is not proof of recovery.
- Final scoring is single-flight via `final_scoring_lease` on `scoring_jobs`; a validated AI result is cached before commit and reused. Why: polling and concurrent requests must not trigger repeated AI calls.
- Pre-paper start failures are recorded in `assessment_start_incidents` (owner-bound, server-classified); no fake checkpoint or paper. Why: failures before issuance must be visible and recoverable without bypassing readiness.
- Readiness and recovery health are computed per exact rank/context blueprint coverage (`blueprint_coverage*`), never global counts. Why: a row existing does not prove a paper can be issued.
- Pure AI/email provider adapters live in `supabase/functions/_shared/finalAi.ts` with no imports so vitest can test them. Why: deterministic mocked-fetch tests without a new test runtime.
