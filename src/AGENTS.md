# Frontend architecture rules

- Adaptive maritime practice uses `/maritime-interview` with memory-only candidate state and end-only feedback; never replace existing company assessments or persist client scores. Why: server-owned sessions and manager reports belong to Phase 4.
- Interview voice uses optional browser speech recognition and synthesis with explicit microphone activation, editable text and unavailable-language fallback. Why: Phase 3 stays lean without telephony or new speech-provider charges.- Phase 4: AI interviews are server-owned sessions in `maritime_interview_sessions`; managers see a report only via `manager_maritime_report` when crew opted in and applied to their vacancy. Why: client cannot forge transcripts; consent-gated.

- Homepage training tracks come only from RPC `public_training_tracks` (titles/tags of published `training_modules`, no quizzes). Why: new courses appear on the public page automatically without leaking answer keys.

- Vacancy posting is open to any manager with a `manager_profiles` row (RLS `managers_*_own_postings`); `normalize_job_posting` sets `verified` from admin_approved OR company_verified only. Approval gates only Crew Search and Crew Desk. Why: third-party agents must post; the badge, not a block, signals trust.
- Bulk WhatsApp/Excel/PDF vacancy exports live in `src/lib/whatsappBroadcast.ts` (`buildDigests` splits by message length). Why: one tested place for broadcast text.

- Paid vacancy promotion only via RPC `promote_vacancies` (credits debited atomically, one active promotion per posting); crew see promoted ads via `sponsored_vacancies` (3-hour fair rotation) filtered by rank and one per recruiter in `src/lib/vacancyPromotion.ts`. Why: rank relevance and no agency flooding.
- Excel CVs: browser unzip in `src/lib/xlsxCv.ts`, text to `parse-cv-documents`; CV declaration versioned in `crew_cv_data.medical.declaration`. Why: no schema change.
- Principal CV templates: owner-private `principal_cv_templates` + `principal-templates` storage; reviewed mappings populate original DOCX/XLSX locally, declaration-gated. Why: no repeated AI cost or cross-manager access.

- Crew menu = `NAV_ITEMS` sections rendered by `GroupedNav`. Why: one menu.
- Crew priority boost only via RPC `boost_my_profile` (1d=1cr, 7d=5cr, extends) into read-only `crew_boosts`; `manager-search` floats boosted crew within each page with 3-hour rotation. Why: crew cannot forge visibility.

- Promotion assessments: manager requests via RPC `manager_invite_promotion` (own roster only) into `promotion_invites`; crew finishes `/maritime-interview?promo=` and `crew_complete_promotion` links the session; managers read only via `manager_promotion_board`. Why: result goes only to the inviting company, no client-forged links.
- Admin Crew Manning Matrix (`src/components/admin/CrewManningMatrix.tsx`) derives nationality/status via `src/lib/crewManning.ts` (declared → WhatsApp code → email domain) at read time; no stored guesses. Why: never overwrite what crew declared.
- Manager Crew Search (`/manager-search`): free browse + Quick CV; contact/full CV only after `reveal_contact` (1 credit, once per manager per crew via `contact_reveals`); `manager-search` returns `is_unlocked` + real contacts only for revealed crew and action `unlocked` lists the manager's roster. Why: never charge twice, no contact leaks.
