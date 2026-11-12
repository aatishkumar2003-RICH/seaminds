# Library rules

- Bulk WhatsApp/Excel/PDF vacancy exports live in `src/lib/whatsappBroadcast.ts` (`buildDigests` splits by message length). Why: one tested place for broadcast text.
- Paid vacancy promotion only via RPC `promote_vacancies` (credits debited atomically, one active promotion per posting); crew see promoted ads via `sponsored_vacancies` (3-hour fair rotation) filtered by rank and one per recruiter in `src/lib/vacancyPromotion.ts`. Why: rank relevance and no agency flooding.
- Excel CVs: browser unzip in `src/lib/xlsxCv.ts`, text to `parse-cv-documents`; CV declaration versioned in `crew_cv_data.medical.declaration`. Why: no schema change.
- Fleet drill results are written only via RPC `record_fleet_drill` (server grades the choice) into own-read `fleet_drill_results`; interview gaps map to drills in `src/lib/drillPrescription.ts`. Why: crew cannot forge passes; one tested gap→drill map.
- Service-worker runtime caching rules live in `src/lib/pwaCacheRules.ts`: only listed public tables may be cached; every other backend call is NetworkOnly. Why: cached personal responses showed stale application state.
- Shore RFQs use `buildInquiryPayload` to preserve buyer/company in existing inquiry notes and delivery location in `port`; all channels share the same procurement fields. Why: online records retain buyer identity without changing legacy columns.
