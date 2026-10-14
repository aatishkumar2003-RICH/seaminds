# Edge function rules

- Pure AI/email provider adapters live in `supabase/functions/_shared/finalAi.ts` with no imports so vitest can test them. Why: deterministic mocked-fetch tests without a new test runtime.
- DORA answers go through `dora-assist`: deterministic exam-integrity block and no-article fallback before any AI call; AI sees only retrieved published articles + `dora_get_my_context`. Why: no invented procedures, no exam leakage, minimal AI cost.
