# SeaMinds — Global Vacancy Growth Roadmap

Queued stages (~2 credits each). Execute in order, on user's go-ahead.

## Stage 1 — Multi-Region Ingestion Engine & Channel Injection ✅
- [x] Philippine rank dictionary + PHP salary rule + +63 normalization
- [x] Indonesian coverage + +62 (done earlier)
- [x] Seeded 7 live-verified Telegram channels + 3 Manila agency pages (most guessed PH/ID channel names don't exist publicly)
- [x] Deployed + sweep: 38 new jobs saved (global channels; no PH/ID-specific posts yet)

## Stage 2 — Zero-Login Employer Loop ✅ (email routing setup pending user)
- [x] Auto-indexer writing agency identity/email/WhatsApp into company_contacts on ingestion
- [x] Passwordless secure "View Sea Profile" magic link in manager application notifications
- [x] Inbound forward-to-post parser (agency emails vacancy text → AI parse → published listing)

## Stage 3 — PH/ID Seafarer Funnels + Viral Sharing ✅
- [x] Philippines/Indonesia country hubs live at /jobs/country/:slug
- [x] "Share to WhatsApp group" action on every job card
- [x] Nationality/phone country detect + 1-tap "make me visible to employers" prompt


## Stage 4 — Global Expansion (India & Eastern Europe) ✅ (hubs match by crew nationality; 14-day DB expiry already enforced)
- [x] India engine: RPSL agency feeds, Indian rank conventions, INR parsing, /jobs/country/india
- [x] Ukraine/Eastern Europe engine: Odesa/Constanta/Varna sources, /jobs/country/ukraine
- [x] Cross-channel deduplication + 21-day auto-expiry garbage collector

## Stage 5 — Autonomous Match Alerts & Activation
- [ ] 1-tap professional WhatsApp maritime calling card generator
- [ ] Daily smart-match alert pipeline (rank + vessel + availability), bounded batch job
- [ ] Admin live pulse: intake rate and application counts per country
