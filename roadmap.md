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

## Stage 5 — Autonomous Match Alerts & Activation ✅
- [x] 1-tap WhatsApp calling card (apply message with no-login Sea Profile link)
- [x] Daily smart-match alert pipeline (rank + vessel + availability), capped 5,000/run
- [x] Admin live pulse: intake + applications per port/nationality (Activity tab)

## Fleet Track
- [x] Step 1 — Multi-vessel foundation + fleet switcher (/management/fleet)
- [x] Step 2 — Front-space Sign In + staff access requests (/fleet/login)
- [x] Step 3 — Admin approvals & authority limits console
- [x] M1 — Admin-issued Staff IDs + module access control
- [x] W1 — Fleet & PMS Workspace as parent (/management/fleet tabs) + admin entry
- [x] Security — cached stats and interview matrix reads locked down; scan clear of criticals

## Fleet Track v5 — Architecture Freeze (decisions locked 2026-10-06)
Frozen: manager-first (we hold DOC) then software; device-only offline, no onboard box;
Flag acceptance required for e-recordbooks; accounts = operational subledger only;
first ship is one we manage; scope = generators + auxiliaries (~30 assets);
DPA signs auto-accept policy and KPI targets; crew use shared ship tablets/laptops.

Slices are ~3 credits each, one vertical per turn, stop and report after each.
No slice starts without a written instruction naming it.

- [ ] S1 — Identity, membership, assignment + shared-device session, per-person offline partition
- [ ] S2 — Policy engine (minimal) + action registry with authority source on every type
- [ ] S3 — Event and provenance store + device queue, idempotent upload
- [ ] S4 — Asset register onboarding + import with confidence flags (generators/auxiliaries)
- [ ] S5 — Job library and due logic + running-hour inheritance from one daily reading
- [ ] S6 — Crew Today list: Done / Problem / Couldn't, one photo, voice note
- [ ] S7 — C/E decisions box + RED/AMBER/GREEN exceptions with sampled assurance
- [ ] S8 — Superintendent cockpit, own vessel only
- [ ] S9 — Record books, first book: Flag format, sequential entries, supersession

### Open gates before S1 (need answers from owner)
- Ship name + IMO number, and the chief engineer who will champion it
- Make, OS and browser of the ship tablets/laptops (decides if a browser app is enough offline)
- Flag administration: accepted electronic record-book format and acceptance route
- DPA-signed policy v1: which job types may be auto-accepted, sampling %, KPI targets
- Baseline on the ship: touches and time a routine job takes today
- Marketplace stages 4 and 5 are complete; nothing queued there.

## Two-tier scoring (CV optional)
- [x] Slice 1: tier columns + server trigger; candidate chooses Quick Profile or CV-Verified without penalty copy
- [x] Slice 2: tier badge on score/certificate; rescoring options (retake quick / upgrade to CV)
- [ ] Slice 3: manager "Request CV & Round 2" on interview board
- [ ] Next build: Yes/No chips for "Available for work now?" on Quick Sea Profile
