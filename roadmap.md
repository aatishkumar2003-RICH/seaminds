# SeaMinds — Global Vacancy Growth Roadmap

Queued stages (~2 credits each). Execute in order, on user's go-ahead.

## Stage 1 — Multi-Region Ingestion Engine & Channel Injection
- [ ] Add Philippine rank dictionary (Kapitan, Hepe, Makinista, Timonel, Mandaragat, Kadete) + PHP salary parsing + +63 phone normalization to vacancy-agent
- [ ] Expand Indonesian Bahasa rank coverage, +62 sanitization, IDR parsing
- [ ] Seed 15+ verified PH/ID Telegram channels and POEA/DMW + Jakarta/Surabaya agency career pages into vacancy_sources (migration)
- [ ] Re-balance vacancy-agent cron rotation groups for high-yield regional cycles
- [ ] Deploy + run immediate ingestion sweep, verify live PH/ID listings

## Stage 2 — Zero-Login Employer Loop
- [ ] Auto-indexer writing agency identity/email/WhatsApp into company_contacts on ingestion
- [ ] Passwordless secure "View Sea Profile" magic link in manager application notifications
- [ ] Inbound forward-to-post parser (agency emails vacancy text → AI parse → published listing)

## Stage 3 — PH/ID Seafarer Funnels + Viral Sharing
- [ ] Philippines Country Hub /jobs/country/philippines (Manila, Cebu, Batangas, Subic, Davao, Iloilo)
- [ ] "Share to WhatsApp Group" action on every job card
- [ ] Auto country code detect (+62/+63) + 1-tap "make me visible to employers" prompt

## Stage 4 — Global Expansion (India & Eastern Europe)
- [ ] India engine: RPSL agency feeds, Indian rank conventions, INR parsing, /jobs/country/india
- [ ] Ukraine/Eastern Europe engine: Odesa/Constanta/Varna sources, /jobs/country/ukraine
- [ ] Cross-channel deduplication + 21-day auto-expiry garbage collector

## Stage 5 — Autonomous Match Alerts & Activation
- [ ] 1-tap professional WhatsApp maritime calling card generator
- [ ] Daily smart-match alert pipeline (rank + vessel + availability), bounded batch job
- [ ] Admin live pulse: intake rate and application counts per country
