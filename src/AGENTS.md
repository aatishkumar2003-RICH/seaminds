# Frontend architecture rules

- Adaptive maritime practice uses `/maritime-interview` with memory-only candidate state and end-only feedback; never replace existing company assessments or persist client scores. Why: server-owned sessions and manager reports belong to Phase 4.
- Interview voice uses optional browser speech recognition and synthesis with explicit microphone activation, editable text and unavailable-language fallback. Why: Phase 3 stays lean without telephony or new speech-provider charges.- Phase 4: AI interviews are server-owned sessions in `maritime_interview_sessions`; managers see a report only via `manager_maritime_report` when crew opted in and applied to their vacancy. Why: client cannot forge transcripts; consent-gated.

- Homepage training tracks come only from RPC `public_training_tracks` (titles/tags of published `training_modules`, no quizzes). Why: new courses appear on the public page automatically without leaking answer keys.

- Vacancy posting is open to any manager with a `manager_profiles` row (RLS `managers_*_own_postings`); `normalize_job_posting` sets `verified` from admin_approved OR company_verified only. Approval gates only Crew Search and Crew Desk. Why: third-party agents must post; the badge, not a block, signals trust.
- Bulk WhatsApp/Excel/PDF vacancy exports live in `src/lib/whatsappBroadcast.ts` (`buildDigests` splits by message length). Why: one tested place for broadcast text.
