# Frontend architecture rules

- Adaptive maritime practice uses `/maritime-interview` with memory-only candidate state and end-only feedback; never replace existing company assessments or persist client scores. Why: server-owned sessions and manager reports belong to Phase 4.
- Interview voice uses optional browser speech recognition and synthesis with explicit microphone activation, editable text and unavailable-language fallback. Why: Phase 3 stays lean without telephony or new speech-provider charges.- Phase 4: AI interviews are server-owned sessions in `maritime_interview_sessions`; managers see a report only via `manager_maritime_report` when crew opted in and applied to their vacancy. Why: client cannot forge transcripts; consent-gated.
