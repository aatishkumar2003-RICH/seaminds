# SeaMinds Fleet — Architecture Freeze Review (v2, review only)

Status: strict plan mode. No code, schema, UI, package, config or data was changed. This document is shown only so you can review it; it lives in Lovable's plan area, not in the app. **Approving this card does NOT authorize any build.** Build needs a separate, explicit instruction after the freeze gates in N6 are met.

## 0. Corrections adopted from v1
1. **Pay trigger:** pay is governed by the signed SEA/CBA/company wage policy, applied per pay component. Travel start, embarkation, Actual Join, sign-off and repatriation are only factual events. The payroll rules engine maps events to the start or stop of each component. Actual Join is never a universal trigger.
2. **Position and other multi-source values:** a versioned source-selection and validation policy applies per data point and per report. All readings are kept. The formal value is chosen by policy, plus officer confirmation where the policy requires it. GNSS is not hard-coded as preferred.
3. **Complaint channels:** the complaint procedure is policy-driven (company, Flag, SEA, MLC). Internal and external channels are configured per vessel, not assumed equivalent.
4. **Integrity:** hashing is one integrity aid only. Trust comes from:
   - versioning and supersession
   - signatures or attestations where required
   - access control and audit
   - backups and tested restores
   - provenance
   - acceptance by Flag, Class and the company

   No claim of legal immutability is made.
5. **Build:** nothing is approved. G0 and F1 are candidate slices only.

---

## A. Red-team of the current concept

### Contradictions and unsafe assumptions
- **"Most autonomous" versus maritime accountability.** Autonomy must be framed as reducing touches on routine work. Decisions are not removed. Any feature that "decides" deferrals, return to service, permit closure or pay is out of scope by design.
- **Exception-only shore review can hide slow drift.** A fleet where everything is green can still be degrading. A sampled-assurance stream is needed: random and risk-weighted review of green work, plus trend detection. Without it the "false satisfactory" rate is unmeasurable.
- **One-tap "Normal" completion invites pencil-whipping.** Mitigate with:
  - per-job evidence policy (critical jobs never allow one-tap)
  - plausibility checks (impossible time, location or running-hour sequences)
  - periodic evidence spot-requests
  - the KPI "false satisfactory rate"
- **A PWA alone is not a shipboard system.** iOS evicts storage and offers no background sync. Large video uploads and multi-device consistency need a ship-local authority. Section G sets a hard boundary.
- **Multi-company SaaS plus synthetic staff emails** (the current M1) conflicts with real identity, MFA and offline revocation.
- **Vessel administrator versus Master.** If "Master = vessel admin" also means managing office master data, the office–ship split breaks. The Master administers the vessel scope only: onboard user roster within office-provisioned limits, onboard designations, factual events.
- **AI as "superintendent per vessel".** The naming implies authority. Rename it to *Vessel Assistant*: advisory, cited, no command language.
- **Scope risk.** The 40+ domains listed are a multi-year ERP. Without a hard pilot boundary, the platform will be broad and shallow, and seafarers abandon shallow tools fast.

### Duplicate or overlapping workflows to merge
- Takeover inspection, PMS condition survey, superintendent visit and vetting/PSC prep all collect the same thing: an observation against an asset or area with evidence. Use **one Observation/Evidence object** with multiple purposes, not four modules.
- Defects, inspection findings, PSC deficiencies, near-miss corrective actions and audit NCs share one lifecycle. Use **one Finding → Corrective Action engine** with a type and authority class.
- Requisitions from PMS, defects and stores minimums: **one Requisition object** with an origin link.
- Approvals in each module: **one policy engine** (section H).

### Over-automation risks
- Auto-closing defects when a job is done. Closure needs a verification step by policy.
- Auto-adjusting stock on job completion without ship confirmation of the actual quantity used.
- Auto-generated reports sent externally without accountable sign-off.
- AI translation replacing the original statement in legal records.

### Under-automation risks
- Running hours typed per machine instead of a once-per-day per-meter reading with derived children.
- Certificate expiry tracking typed manually instead of extracted from scans with confirmation.
- Port-call forms re-keying crew lists, stores and voyage data that already exist.

### Onboard workload traps
- Mandatory fields on routine jobs, forced photo on every job, multi-screen sign-off, English-only free text, login per action. Avoid all of them.

### Missing or understated
- Sampled assurance, clock and time governance, device fleet management, master-data stewardship (who owns the equipment register), data retention per record class, training/release management for crews rotating every 4–9 months, and a support model for ships at sea.

---

## B. Final operating model

```text
Platform
 └─ Tenant = Manager company (DOC holder)
     ├─ Owners (legal entities, per vessel, effective-dated)
     ├─ Vessels (stable ID, IMO; management period: start/end per owner)
     │    └─ Areas / Systems / Equipment / Components
     ├─ Org units (Technical, Marine/QHSE, Crewing, Procurement, Accounts, Fleet cells)
     └─ Policies (versioned, scoped: tenant > owner > vessel)
Person (one identity, MFA/passkey)
 └─ Membership (tenant, effective dates)
     └─ Assignment (scope: vessel | cell | org unit | owner portfolio,
                    position, effective from/to, source: office | onboard-relief)
          ├─ Role grants (permission bundles)
          ├─ Designations (DPA, CSO, SSO, Safety Officer, Medical Officer, PFSO contact)
          └─ Competence evidence (CoC/endorsements, expiry) -> gates actions
Delegation (from assignment A to person B, scope subset, dates, reason)
```

- **Role, designation and competence are separate.** A role grants screens and data. A designation grants statutory functions (e.g. DPA, SSO). Competence gates specific actions (e.g. an enclosed-space attendant needs valid training). An action is allowed only if all three permit it.
- **Authority class on every record type:**
  - O (office): wage scales, vendor master, approved jobs, policies, account codes.
  - S (ship): actual events, readings, work done, receipts, cash spent.
  - J (joint): deferral, payroll correction, stock adjustment, defect closure, certificate discrepancy.
  - X (external): Class, Flag, bank, medical certificate, MSW acknowledgement.

  The wrong party can never edit a record. They raise a Discrepancy.
- **Vessel administrator = Master by default; delegable to the C/O.** It can:
  - activate office-provisioned crew accounts onboard
  - set onboard designations from the eligible list
  - record the factual join and sign-off
  - approve onboard-only items under the vessel policy

  It cannot create office roles, change wages, edit vendor or job masters, or see other vessels.
- **Acting roles and relief:** office-provisioned in advance where possible. If the ship is offline, the Master may appoint an acting person from those already onboard and eligible. This becomes a ship-authority event that syncs, and the office may countersign or revoke it.
- **Shore staff covering many vessels:** an assignment scoped to a cell or a vessel list, with dates. Removing a vessel from the cell removes access at once (server side) and at the next sync (device side).
- **Crew joining or leaving offline:** office pre-provisions a *Planned Join* package (identity, role, keys) that syncs to the ship before arrival. The Master activates it on the factual join. Sign-off deactivates the account locally at once. The server revokes it on sync, and keeps read access to the person's own pay and documents through the public crew app.
- **Transfer between vessels:** the old assignment ends and a new one starts. History stays attributed to the original vessel. Personal records (pay, documents) follow the person; vessel records never follow.
- **Isolation:** every row carries `tenant_id` and `vessel_id` where applicable. RLS is enforced on the server, and offline caches are scoped by the same keys. No cross-tenant joins exist outside platform-admin break-glass.

---

## C. Exception-driven UX

### Colour definitions (policy-configurable, not hard-coded)
- **RED (needs a named person now):** critical job overdue or test failed; critical equipment down; Class/statutory deadline at risk; open permit expiring; safety-critical spare at zero; emergency or incident; security event; policy breach (e.g. self-approval attempt); conflicting consequential records.
- **AMBER (needs a decision within the policy window):** due soon within threshold; deferral requested; Problem Found; Could Not Complete with a reason; implausible reading; low critical stock; approval waiting; certificate expiring within the window; sync stale beyond threshold.
- **GREEN (no review unless sampled):** routine job completed with the required evidence, plausible readings and no problem.
- **Auto-accept** is allowed only for job types the policy flags as eligible (non-critical, has a plausibility rule, evidence rule met). Everything else needs a named reviewer. Sampled green items (e.g. 5%, risk-weighted) go to the superintendent for assurance.

### Daily screens (the smallest useful set)
| Role | Home shows | Primary actions |
|---|---|---|
| Rating | My jobs now (3–8), by area/route | Scan asset, Show how, Done / Problem / Couldn't, voice note |
| Officer | My dept jobs + my team's open items | Same, plus assign within team, readings |
| C/E | Decisions today (deferrals, failed tests, implausible running hours, low critical spares, overdue) | Accept / Return / Escalate, sign critical work |
| Master | Authority items (joins, sign-offs, permits, record-book signatures, cash, acting appointments), awareness feed | Confirm / Sign / Appoint, emergency mode |
| Superintendent | RED/AMBER across vessels, sampled green, trends | Approve within policy, request info, visit scope |
| Crewing | Assignment pipeline exceptions (compliance gaps, travel disruptions, reliefs due) | Plan, approve, reconcile |
| Procurement | Requisitions to source, quotes to compare, POs awaiting receipt | RFQ, compare, issue under policy |
| Accounts | Match exceptions, Master Cash variances, payroll exceptions, close checklist | Resolve, post, release |
| DPA / designated | Safety-critical escalations, incidents, grievances routed to them, emergency | Acknowledge, escalate, record |
| Owner | Risk, cost vs budget, downtime, upcoming exposure (surveys, drydock) | Read, comment, approve owner-reserved items |

---

## D. Maximum safe automation
Key: **R** = deterministic rule, **AI** = assist, **H** = human decision, **X** = external authority.

| Automation | R | AI | H | X |
|---|---|---|---|---|
| Today list / work packages by area, route, shutdown, port, rank, workload | due logic, grouping | suggest sequence | officer adjusts | – |
| Running-hour reuse to children and intervals | inheritance, monotonic checks | anomaly hint | C/E resolves conflicts | – |
| QR/NFC asset entry | resolve asset ID | – | – | – |
| Voice reporting, multilingual | store original audio and text | transcribe, translate, structure draft | reporter confirms | – |
| Guided photo/video evidence | evidence rule per job | quality check (blur, framing) | reviewer if required | – |
| Evidence reuse (PMS → inspection → PSC/readiness) | link by asset and objective | suggest matches | inspector accepts | Class/PSC decide |
| Monthly technical report | aggregate accepted state | narrative draft | C/E/Master sign | – |
| Stores and critical spares | min/max, deduct on confirmed use | forecast | ship confirms count | – |
| Requisition drafts | trigger at min or defect | fill specs from library | ship submits, shore reviews | – |
| Bid extraction and comparison | normalize currency and terms | extract line items | procurement selects | – |
| Payroll preparation | rules engine over events | flag anomalies | Master inputs variables, office releases | bank settles |
| Travel / assignment reconciliation | match events across 3 state machines | – | crewing resolves | – |
| Port-call package (FAL / crew list / stores) | assemble from accepted data | fill free text | Master/agent submit | MSW acknowledges |
| Agency / husbandry PDA/FDA | 3-way match | extract invoices | ops/accounts approve | – |
| Emissions (DCS/CII/ETS/FuelEU) | calculate from accepted fuel and voyage data | gap detection | Master/office sign | verifier |
| Superintendent visit scope | collect open RED/AMBER, sampled items | summarize | Supt edits | – |
| Drydock spec (later) | collect deferred/yard jobs | draft spec | Supt/TM approve | Class |
| Management review dashboards | KPIs from accepted data | commentary draft | management | – |

---

## E. PMS for old ships

### Onboarding pipeline
```text
Sources (Excel, paper, scans, photos/video, manuals, old PMS export)
 -> Candidate register (AI extract + human tagging), each with source refs
 -> Identity resolution (maker/model/serial/location; confidence score)
 -> Technical review (C/E onboard + Supt) -> Approved register (stable IDs)
 -> Job library: maker interval + company standard + class/statutory (cited, versioned)
 -> Maintenance plan per asset (approved by Supt/TM)
 -> Baseline: history import with confidence flags; unknown = UNKNOWN
```

- **Hierarchy:** Vessel → System → Equipment → Component, with stable IDs. Location and function are separate from physical identity: when a pump is swapped, the position stays and the serial moves.
- **Unknown history:**
  - Never fabricate a "last done" date. Mark the item *Unknown – baseline required*.
  - The plan schedules a baseline inspection or overhaul, prioritised by criticality.
  - Until then, due status shows "Baseline due by X".
- **Baseline survey:** reuses the takeover 282-item inspection as a first source of Observations. Critical equipment gets a condition check within N days of takeover, by policy.
- **Recurrence types:** fixed calendar (statutory, which never drifts with late completion), post-completion (from last done), running hours, cycles, event-based (after grounding, after bunkering), and combined (whichever comes first).
- **Overhaul, replacement and meter reset:** these are events. A component replacement starts a new life record. A meter replacement records a reset with offset, so history stays continuous.
- **Critical equipment:** a flag from an approved criticality assessment (SMS and Class). It drives the evidence rule, deferral authority and red thresholds.
- **Job library:** versioned and cited (manual section, company procedure, rule reference). A job change creates a new version; history references the version used.
- **Spares linkage:** asset to part numbers, with criticality-driven minimums.
- **Condition trends:** readings stored as time series. Thresholds come only from an approved source; otherwise trends are shown without a limit.
- **Migration rule:** imported history keeps its source, an "imported" quality tag and confidence. It is never upgraded to verified without evidence.

---

## F. Data fabric

```text
RAW (immutable)      : device/manual/import payloads, audio, images, files, API messages
NORMALIZED (immut.)  : parsed value + unit + mapped asset/data-point
VALIDATED (immut.)   : rule results (range, monotonic, plausibility), quality flag
DERIVED (recomputable): calculated values (daily RH, consumption, CII), versioned by algorithm
ACCEPTED (event)     : selection/confirmation event per policy -> the formal fact
STATE (projection)   : current due dates, stock, crew onboard, open findings (rebuildable)
REPORTED (snapshot)  : frozen report/submission referencing accepted facts + version
```

- **Provenance on every consequential value:**
  - source and data point
  - raw value, normalized value and unit
  - event time, device time, ship receipt time, server receipt time
  - user and device
  - quality and confidence
  - validator rule version
  - override reason
  - accepted by and policy version
  - supersedes / superseded by
- **Immutable events:** readings, work completions, signatures, approvals, joins and sign-offs, receipts, cash entries, submissions, corrections.
- **Mutable projections:** schedules, balances, dashboards, current crew list, stock. They are always rebuildable from events.
- **Corrections** are new events that supersede earlier ones and point to them. The original is never deleted.

---

## G. Offline-first architecture

### Device
- Local DB (IndexedDB/SQLite) with an append-only event queue and client UUIDs.
- Signed policy and master-data snapshots, each carrying a version and validity window.

### Sync
- Priority order: safety events, then authority events, then structured records, then thumbnails, then full media.
- Chunked, resumable uploads. Idempotent on event ID. Acknowledgement per event.

### Conflicts
- Consequential records are never last-write-wins.
- Concurrent events are both stored and flagged.
- Resolution happens by rule (e.g. monotonic RH violations) or by a named human.

### Edge cases
| Situation | Handling |
|---|---|
| Revoked user while offline | Device token has a short offline validity (policy, e.g. 72 h) with Master re-authorization. Events from revoked users after the revocation time are quarantined for review, not dropped. |
| Stale snapshot | Actions show "policy version X, may be outdated" past the validity window. Safety actions still proceed under onboard authority. |
| Device loss | Remote revoke; local data encrypted with a device key; unsynced events lost unless a ship node exists. Hence the edge node. |
| Storage pressure | Media evicted after confirmed upload; quotas per device. |
| Failed app update | Versioned schema migrations, rollback to the last good version, server accepts N-1 clients. |
| Clock drift | Record device time and a monotonic counter; ship node acts as time reference; flag drift beyond threshold. |
| Long outage | Reconciliation report lists conflicts, quarantined events and stale approvals. |
| Emergency fallback | Printable or exported cached checklists and contact lists; a paper log template that can be back-entered later, marked as such. |

### PWA verdict
- A PWA is enough for the pilot on Android/desktop with one vessel and limited media.
- A native wrapper (Capacitor) is needed for reliable background sync, large media, NFC on iOS and secure key storage.
- A **shipboard edge node** (small server onboard) is needed for:
  - multi-device consistency offline
  - a recovery copy if a device is lost
  - OT data ingestion (M4/M5)
  - a local time reference

  It is outside the Lovable web stack, so it is a separate component and a pilot dependency only if pilot scope includes multi-device offline.

---

## H. Policy and approval engine
- **Policy object:**
  - ID and version, effective from/to
  - scope (tenant / owner / vessel)
  - transaction type
  - conditions (amount and currency band, budget status, criticality, emergency flag, department, vessel status)
  - route (steps; sequential or parallel; required role, designation or competence per step)
  - SLA and escalation, expiry
  - external acknowledgements required
  - reapproval triggers (fields whose change voids an approval)
- **Instance:**
  - payload snapshot, version and hash
  - maker, steps with actor, decision, time and delegation used
  - outcome
- **Rules:**
  - no self-approval; maker-checker
  - delegation is time-bounded and scope-subset only
  - changing a reapproval-trigger field voids the approval
  - external steps record acknowledgement evidence; the engine never "approves" for Class, Flag or the bank
- **Domain realism:** the same engine is used across domains, but each transaction type declares its legal authority source.
  - Permits follow SMS roles (Master/C/E/Officer; shore only where the SMS requires).
  - Deferrals of class items need X.
  - Bank-master changes need dual approval plus out-of-band verification.
  - DPA is configured as a notification, escalation or verification step only where the SMS assigns it, never as a default approver.
- **Master override:** a dedicated "overriding authority" event. It executes immediately, records the reason and notifies per policy. Review comes after; it is never a pre-condition.

---

## I. Security, privacy and ISPS (controls, not compliance claims)
- **Identity:**
  - invited accounts with user-created credentials
  - MFA mandatory for shore staff; passkeys preferred
  - onboard: device-bound login plus PIN or biometric, given poor connectivity
  - no camera surveillance
- **Least privilege at every layer:** RLS on DB tables; storage path policies keyed by tenant and vessel; search indexes filtered at query time; exports rechecked server-side and logged; AI retrieval filtered *before* retrieval; offline cache contains only the user's scope.
- **Isolated compartments**, each with its own access list, separate storage, excluded from general AI and search, and break-glass only:
  - confidential grievance
  - medical
  - bank and vendor master
  - SSP/ISPS restricted content
  - SSAS details
- **Devices:** registration, attestation where available, remote revoke, encrypted local store.
- **Keys:** managed by the platform KMS for the server. Device keys are per device. Signing keys for policy snapshots and releases are separate.
- **Releases:** signed builds, a dependency inventory (SBOM), staged rollout, rollback.
- **Backup and restore:** point-in-time recovery for the server, with periodic restore tests recorded. The ship node provides a local recovery copy.
- **Security event log** (separate from the operational audit): logins, MFA failures, permission denials, exports, break-glass, AI refusals on restricted content.
- **Support impersonation:** none by default. Read-only access is time-boxed, customer-approved and logged.
- **Break-glass:** named roles only; reason required; automatic notification to the tenant security owner; reviewed afterwards.
- **Dependencies:** a penetration test and data-protection review are hard gates before payroll, bank, medical or grievance data enter production.
- **Current project:** many existing tables are protected by an admin check only. The production model needs a tenant/vessel membership function used by every policy.

---

## J. Domain coverage check
**Covered in architecture:**
- PMS, defects, inspections, certificates, Class/Flag/PSC, permits, risk assessment, drills, incident/near miss
- MoC, crew/MLC, payroll ledger, travel, training/competence, purchasing/stores, bunker/lubes
- port call/MSW, agency, e-record books, emissions, ISPS, grievance, DPA/emergency
- supplier governance, finance subledger, document control, regulatory change, IT/OT, cyber, BCP, management review, owner reporting

**Covered but thin (to detail later):** medical/medicine chest, victualling/water, drydock, insurance/claims.

**Still missing, to add:**
- **Master-data stewardship:** ownership and change control of the equipment, part, vendor and crew masters.
- **Sampled assurance programme**, internal audit scheduling and ISM audit trail.
- **Vetting** (SIRE 2.0/CDI/RightShip) as a purpose on the shared Observation object.
- **Hours of rest and fatigue:** a rest-hours feature exists in the crew app, so integrate it and enforce scheduling.
- **Chartering/commercial interface:** voyage orders, laytime and claims. Out of scope unless managing commercially.
- **Ballast water / garbage / ODS records** within e-record books.
- **Navigation:** passage plans and chart/publication corrections, read-only integration.
- **Retention schedule** per record class.
- **Crew welfare data boundary:** Sealed Envelope is preserved, and the public crew wellness data never enters Fleet.

---

## K. AI governance
- **Two libraries:**
  - *Approved* (versioned, cited, approved by a named role).
  - *Unapproved extracted* (manuals parsed by AI, labelled "unverified").

  AI answers technical limits or procedures only from Approved. It may show Unapproved content with a warning and a "request approval" action.
- **No invented values:** responses carrying numeric limits must quote a source ID. Otherwise they return "no approved value" and open a library-gap item.
- **Confidence is metadata only.** It never changes safety status.
- **Failure-safe:** every workflow has a non-AI path. AI timeouts degrade to manual entry.
- **Retrieval filter:** a permission check runs before vector or keyword search. Compartments are excluded entirely.
- **Logging:** prompt and output metadata, model, sources used and user are logged. Confidential payloads are redacted or stored only in their compartment.
- **Proportionate confirmation:**
  - AI drafts of routine records: one-tap confirm.
  - Consequential records: explicit review of the changed fields.
- **Green automation:** only via deterministic rules. AI suggests, rules accept.
- **High-risk** (return to service, deferral, permit, pay, bank): human or external only.

---

## L. Autonomy maturity model
| Level | Description | Prove before advancing |
|---|---|---|
| 0 | Digital records, manual entry | Adoption >80% of jobs recorded digitally |
| 1 | Enter-once reuse (RH inheritance, evidence reuse, auto reports) | Duplicate-entry count near 0; report time reduced, measured |
| 2 | Exception routing (R/A/G), sampled assurance | Missed-critical rate 0 over N months; false-satisfactory rate measured below target |
| 3 | Policy auto-accept of eligible green work | Auto-accepted sample audit error below threshold; no critical misses |
| 4 | Assisted planning (work packages, requisitions, payroll prep drafted) | Draft acceptance rate high, override reasons analysed |
| 5 | Data-driven semi-autonomous management (sensor-fed states, predictive) | Validated sensor data quality; Class/Flag acceptance where relevant |

No percentage-automation claim is made unless it is backed by these KPIs.

---

## M. KPIs
- **Touches:** onboard touches per routine job (target ≤2); median time per routine PMS record.
- **Duplicate entry:** fields entered once and reused / total fields consumed.
- **Shore load:** review items per 100 jobs.
- **Assurance:** false satisfactory rate (sampled audits); missed critical exception rate (target 0).
- **Evidence:** evidence retake rate.
- **Sync:** success rate, median latency after link restored, conflict count and time to resolve.
- **Reporting:** report preparation time.
- **Procurement:** cycle time (requisition → PO → GRN), 3-way match first-pass rate.
- **Payroll:** exception rate, corrections after release.
- **Data:** completeness and provenance rate (% accepted values with full provenance).
- **Adoption:** active users per vessel, error and abandon rate, crew satisfaction (short in-app survey).
- **AI:** citation coverage, refusal correctness, draft acceptance rate.

---

## N. Freeze output

### N1. Principles to freeze
1. Enter once, reuse everywhere; no re-asking known data.
2. Normal work is minimal; abnormal work expands.
3. Authority class O/S/J/X on every record; discrepancy instead of edit.
4. Role, designation and competence are separate; effective-dated assignments; time-bounded delegation.
5. Events are immutable, state is projected; corrections supersede.
6. Provenance on every consequential value; policy-based source selection.
7. One policy engine; payload-bound approvals; no self-approval; external acknowledgements recorded, never simulated.
8. Master overriding authority never waits on software or shore.
9. Offline-safe operation; no last-write-wins for consequential records.
10. AI is advisory, cited and permission-filtered, never decisive for consequential matters.
11. Permissions are enforced on the server and in every cache, search, export and AI path.
12. Exceptions plus sampled assurance, never exceptions alone.
13. Public recruitment SeaMinds and Fleet remain separate products sharing identity only.

### N2. Capability map
- **P0 (pilot):** identity and memberships; policy engine (minimal); event/provenance store; offline sync (single vessel); asset register and onboarding; job library; Today list; RH reuse; findings/defects; exception engine plus sampling; Master/C/E/Supt screens; audit and security log.
- **P1:**
  - stores and requisitions, procurement, crew assignment and travel, payroll ledger (behind a security gate)
  - permits and emergency, grievance, ISPS compartment, certificates, e-record books
  - port call/MSW, emissions, MoC, regulatory change, supplier governance, ship edge node
- **P2:** agency/husbandry, owner portal, medical, victualling, bunker lifecycle, drydock, insurance, OT integration M4–M6, predictive maintenance.

### N3. Existing project: retire / retain / refactor / isolate
- **Retire:**
  - FleetLogin self-signup role request
  - hardcoded USD limits and boolean "can approve" switches (StaffApprovals)
  - "Marine Superintendent / DPA" combined role
  - synthetic-email staff accounts as the production identity model
- **Retain:**
  - takeover inspection data and the 282-item template, as the first Observation source
  - fleet_vessels, fleet_cells, management_periods concepts
  - the sonner, navy/gold design system
  - the public recruitment app untouched
- **Refactor:**
  - fleet_staff_members becomes person + membership + assignment
  - `/management/fleet` gets its own Fleet entry, separate from the Manager Portal
  - the IndexedDB draft outbox becomes the basis for the event queue
- **Isolate:** Fleet data from the public crew app (Sealed Envelope); the admin-only `is_admin` gate stays only for platform admin, not tenant permissions.

### N4. Dependency graph (no build)
```text
Identity/Membership ─┬─> Permission layer (RLS/storage/search/AI/cache)
                     │        │
Policy engine <──────┘        v
     │               Event + provenance store ──> Offline sync
     v                        │                        │
Exception engine <── Asset register/onboarding ──> Job library ──> Today list/RH reuse
     │                        │
     v                        v
Role screens (Rating/Officer/C/E/Master/Supt)   Findings/defects ──> Stores ──> Procurement
                                                Crew assignment ──> Travel ──> Payroll (security gate)
```

### N5. Recommended pilot vertical (one vessel, one tenant)
- **Scope:** about 30 critical assets on one engine-room system (e.g. diesel generators plus auxiliaries); imported register with confidence flags.
- **Library and readings:** cited job library for those assets; daily running hours once per meter.
- **Crew flow:** Today list with Done / Problem / Couldn't; QR entry; voice note with original kept.
- **Supervision:** findings and defects; C/E decisions box; Master authority items limited to acting appointment and join activation; superintendent RED/AMBER plus 5% sample.
- **Engine and sync:** policy engine used only for deferral routing; offline on two Android devices with conflict tests.
- **Excluded:** money, crew pay, procurement and ISPS.
- **Success** = measured KPIs over 60 days at sea.

### N6. Acceptance gates before any build instruction
1. You sign off the frozen principles (N1) and capability map (N2).
2. Data model review: entities, authority classes, event vs state list agreed.
3. Permission matrix agreed for pilot roles, including the offline cache scope.
4. Offline decision: PWA-only pilot accepted, or edge node required.
5. Pilot vessel, company and C/E champion identified; source manuals available.
6. Policy examples written for the pilot (deferral route, auto-accept eligibility, sampling rate).
7. KPI baseline captured on the pilot vessel (current touches and time).
8. Security review plan agreed (MFA approach, device registration).
9. Explicit written instruction from you: "Build pilot slice X."

### N7. Questions that block freeze
1. Is SeaMinds the DOC-holding manager, or software sold to managers? This changes tenant, legal and RPS boundaries.
2. Pilot vessel and company: who supplies manuals, the current PMS export and a C/E champion?
3. Pilot offline scope: is single-device offline acceptable, or is an onboard edge node required from day one?
4. Will the first customers require Flag acceptance of e-record books in phase 1? This is a yes/no scoping question.
5. Accounting stance confirmed: operational subledger feeding an external ERP, not a full general ledger?

---

## O. Build Budget & Review Protocol

Binding on every future Build-mode turn. It controls *how* work is executed; it never expands the frozen scope in N1–N6.

1. **Small reviewable slices.** Every build implements one coherent vertical capability only, sized to land in roughly a 3-credit turn where practical. Multiple major domains are never combined in one build.
2. **No credit guarantee.** "~3 credits" is a design target, not a promise — actual use varies with complexity. Each slice is deliberately kept small so it is *likely* to stay near that budget, and the build stops rather than expanding scope.
3. **Stop after each slice.** No automatic continuation to the next slice. Each build ends with a report: what changed; files, tables, functions and migrations touched; tests run and their result; known limitations; and exactly what the user should check by hand in Preview.
4. **Wait for instruction.** The next build happens only on the user's explicit instruction. No chained, background or "while I'm here" continuation.
5. **Too big → split first.** If a requested slice looks too large for one small turn, break it into sub-slices and ask the user to choose or start the first one. Do not silently attempt the whole thing.
6. **Acceptance criteria before editing.** Each slice states its pass/fail acceptance criteria up front; the build is judged against those, not against ambition.
7. **No Max mode** unless the user explicitly asks for it.
8. **Scope restated before every build.** In and out of scope are written down at the start of the turn so work cannot silently grow. Anything discovered outside scope is logged for a later slice, not built now.
9. **Frozen architecture preserved.** Every slice upholds the N1 principles: authority classes O/S/J/X; office-versus-ship data ownership and discrepancy-not-edit; immutable events with provenance and supersession; one policy engine with no self-approval and no simulated external sign-off; offline safety with no last-write-wins for consequential records; the AI source hierarchy (Approved versus Unapproved, cited values only); tenant and vessel isolation in DB, cache, search, export and AI paths; and no hard-coded maritime authority assumptions (pay triggers, preferred sensor sources, complaint channels, DPA-as-default-approver, fixed currency limits).
10. **Gated domains stay shut.** Payroll, bank and vendor master, medical, confidential grievance, ISPS/SSP and statutory e-recordbooks are not implemented until their stated security, legal, Flag and Class gates are satisfied (N6, and the compartment and penetration-test requirements in I).

**Slice report template (end of every build turn):**
```text
Scope done / Out of scope held
Files · tables · functions · migrations affected
Tests run + result
Known limitations
Check in Preview: (specific clicks, expected result)
Next candidate slice (not started)
```
