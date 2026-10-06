# SeaMinds Fleet — Architecture Freeze Candidate v3 (review only)

**Status:** strict plan mode. No code, database, screen, package or configuration change has been made. This is a review document. **Approving it does not authorize a build.** It supersedes v2 only where stated; every v2 section not corrected below carries forward as is.

---

## 1. Organization and responsibility model

Parties are modelled separately, never merged into a single "tenant = DOC holder":

```text
Platform Operator (SaaS provider, e.g. SeaMinds Technologies)
 └─ Customer Organization (contracting party; billing; data controller for its data)
     └─ Legal Parties (registry, reusable across customers)
          - Ship manager(s), DOC holder(s), Registered owner, Beneficial owner,
            Technical / Crew / Commercial manager, Charterer, Agent
Vessel (stable ID, IMO)
 └─ Responsibility Periods (effective-dated, per function):
      ISM/DOC company | technical mgmt | crew mgmt | commercial mgmt |
      registered owner | charterer (type) | flag | class
Data Partition = (Customer Organization, Vessel, Responsibility Period)
```

- Access is granted per **Data Partition**, never per legal party alone. One vessel can have one DOC holder and a different crew manager, each a separate customer with different partitions and functions.
- **SeaMinds-as-manager:** SeaMinds's own legal entity is a customer organization and the DOC holder. This is the same model, so nothing is re-architected.
- **SeaMinds-as-software:** customers are third-party managers. The platform operator has no data access by default; support access is break-glass only.
- **Management change:** the old period closes and a new one opens. Historic records stay owned by the old period. Handover export or transfer happens under an explicit data-sharing agreement.
- The platform operator holds no operational authority over any vessel.

---

## 2. Five distinct authority concepts

| Concept | Meaning | Example | Who grants |
|---|---|---|---|
| Permission | Can the user technically see or do X in this partition | view PMS, create requisition | customer admin via role bundle |
| Operational assignment | What position the person holds where and when | 2/E on MV X, 1 May–30 Nov | crewing / office, confirmed by factual join |
| Appointment / designation | Accountable statutory or SMS function | DPA, CSO, SSO, Safety Officer, Medical Officer | company per SMS, effective-dated |
| Competence / qualification | Professional fitness for a task | CoC, endorsement, enclosed-space training, maker course | evidence + expiry; verified by crewing |
| Approval authority | Right to approve a transaction type within policy | approve deferral class-B, approve PO band | policy engine (section 8) |

**Evaluation rule:** permission is always required. Assignment is required for vessel-local actions. Designation, competence and approval authority are checked **only when the action type declares that it needs them**. For example:
- Recording a routine job needs permission plus assignment only.
- Signing an enclosed-space permit needs permission, assignment, the designation the SMS names and valid competence.

Each action type has a declared gate list, versioned in policy.

---

## 3. Vessel Operational Administrator (VOA)

- **Default holder:** the Master. Delegable to the C/O or another person the SMS names.
- **Can:**
  - confirm factual join and sign-off of office-provisioned persons
  - appoint onboard acting assignments from eligible persons onboard
  - set vessel-local operational designations the SMS allows the Master to make
  - exercise overriding authority
  - acknowledge office instructions
- **Cannot and need not:** identity proofing, password resets, MFA enrolment, creating roles or permissions, editing company policy, vendor or job masters, device management, IT settings.
- **IT and identity** (device enrolment, recovery, account lifecycle) belong to the customer IT/admin function. A designated onboard *device custodian* (e.g. ETO or C/O) may assist with physical device steps only.

---

## 4. Offline authorization: risk-tiered leases

There is no single offline validity period. Each action class carries a policy-defined **offline lease**:

| Class | Examples | Offline behaviour |
|---|---|---|
| S0 Safety / emergency | emergency log, Master override, alarms, emergency checklists, permit suspension | **Never blocked** by credential expiry. Attributed by the best available identity (device + person + VOA witness). Flagged for review. |
| S1 Operational record | PMS completion, readings, defects, observations | Long lease (policy). After expiry, still captured as "pending re-authentication". |
| S2 Authority action | permit issue, acting appointment, deferral request, critical sign-off | Lease tied to a valid assignment and designation snapshot; expiry requires VOA co-sign or queues as provisional. |
| S3 Commercial / financial | requisition submit, cash entry, payroll variables | Shorter lease; provisional until online validation. |
| S4 Privileged / security | ISPS restricted content, grievance case access, bank/vendor, exports | Online only, or a very short lease; no offline cache of restricted content unless policy explicitly allows. |

**Revocation reconciliation:**
- Events from a revoked person after the revocation effective time are **quarantined, never deleted**.
- Reviewers can accept them (attributed with a note), reassign attribution or reject them with a reason.
- Evidence stays preserved in every case.
- Revocation events carry server time. Device-time disagreements go to review and are never auto-resolved.

---

## 5. Biometrics

SeaMinds stores no biometric data. Device unlock, Face ID and fingerprint are used only through OS passkeys or WebAuthn. SeaMinds receives a cryptographic assertion. No camera surveillance or selfie capture is part of authentication.

---

## 6. Exception UX: accessible and policy-driven

- Every status shows a colour, a **text label** (Critical / Action / Routine), an **icon shape** and a **priority number**. It does not rely on colour alone and meets WCAG contrast. It works with a screen reader, large text and gloved touch (minimum touch targets), and in a low-light night mode.
- Queue sizes, due-soon windows, sampling rates and auto-accept eligibility are **policy parameters** set from risk, crew capacity and the pilot baseline. Any numbers in earlier versions were illustrations only.
- Classification rules are versioned. Every item shows *why* it is RED or AMBER (the rule ID and plain-language reason).

---

## 7. Evidence classes, reuse and retention

### Evidence classes
| Class | Example | Original media | Confirmed text | Default retention basis |
|---|---|---|---|---|
| E0 Dictation aid | voice note turned into a routine job remark | discard after confirmation if policy allows | keep (original language + translation) | record class of parent |
| E1 Routine evidence | photo of a cleaned filter | compressed copy kept | keep | PMS record class |
| E2 Critical evidence | critical job before/after, test result, failed test | original preserved, hash recorded | keep | longer; per SMS/Class |
| E3 Regulatory / legal | record-book entry, incident, PSC, claims | original + chain of custody | keep | regulatory period; legal hold capable |
| E4 Confidential | grievance, medical | compartment storage | compartment | compartment policy |

- **Translation:** the confirmed original-language text is preserved whenever it forms part of a formal record. The translation is stored as a derived item, never as a replacement.
- **Cost controls:** compression profiles per class; media held in a separate storage tier; per-vessel storage reporting.

### Evidence reuse rule
Evidence may satisfy another objective only if **all** of these match the target objective's requirements: equipment identity (the specific serial in that position), scope, test or inspection method, freshness window, operating condition, witness or signature requirement, and authority class. Matching is proposed by rules or AI and accepted by the objective owner.

### Invalidation
A new defect, repair, overhaul, equipment swap or condition change **invalidates only the current verification status** of the affected objectives. History is never altered. The affected objectives show "re-verification required".

---

## 8. Approval and policy engine (unchanged from v2, plus clarifications)

- Report sign-off is per **report-type definition**: generator, reviewers, signatories, submitter and external verifier are declared per company procedure and regulation. Nothing is hard-coded to C/E or Master.
- Each transaction type declares its legal authority source and gate list (section 2).
- The DPA appears only where the SMS assigns a step.
- Master override is an immediate S0 event.

---

## 9. Data fabric with retention

- **Logical immutability:** event history is append-only. Corrections are superseding events. Projections are rebuildable.
- **Retention:** retention is defined per record class, and is not indefinite.
  - Each class declares a retention period, legal basis, minimization rules and an expiry action (delete, anonymize or archive).
  - Raw sensitive data (audio, video, IDs, medical) follows the shortest period that policy and law allow.
- **Legal hold:** a hold on a case, vessel or period suspends expiry actions. Holds are themselves audited.
- **Defensible deletion:**
  - At expiry, content is deleted and a **tombstone event** remains: what class, when, under which rule, and its hash.
  - Event chains stay verifiable without the content.
  - Deletion propagates to replicas, caches, search indexes, AI indexes and device stores at the next sync.
  - Backups age out within a documented window; restore procedures re-apply tombstones.
- **Minimization:** collect only the fields a declared purpose needs. Personal data in operational records is limited to identity and role.

---

## 10. Client platform: decided by test, not assumed

The pilot includes a **capability test protocol** on real ship devices (customer-issued Android/iOS tablets and phones, desktops):
- outages of 7–30 days (example durations, set per pilot)
- forced app restarts and OS storage-eviction pressure
- a large media queue
- clock drift and timezone changes at sea
- two-device conflicting edits
- update during an outage
- device loss

**Decision matrix after testing:**
- **PWA:** acceptable only if all tests pass on the target devices.
- **Native wrapper:** if eviction, background sync, NFC or secure key storage fail.
- **Shipboard edge service:** if multi-device long-offline use creates divergent local truth (each device seeing different current state), or a ship-local recovery copy or OT ingestion is required.

The edge service would be the ship's local authority for sequencing and projections, syncing with shore. It is outside the Lovable web stack and would be a separate component.

---

## 11. Domain coverage additions

### Cargo / deck operations (boundary)
- **SeaMinds manages:** cargo information records; IMSBC/IMDG applicability *flags confirmed by a human*; loading and discharge plan **documents and workflow**; ballast operation records; hold, hatch cover and bilge condition inspections; cargo damage, claims evidence and statements of fact; mooring and anchoring equipment inspections, MEG-style records where adopted; reuse of evidence for owner, charterer and claims reports.
- **SeaMinds does not:** perform stability, strength or draft calculations, or replace the approved loading instrument. It may ingest and display **accepted outputs** (imported file or report) labelled with their source and version.

### Other gaps, now explicit
| Domain | Coverage level |
|---|---|
| Fuel/bunker ROB, BDN, samples, reconciliation | P1 |
| Lube oil condition and consumption, lab results trends | P1 (with PMS) |
| Ballast-water management records | P1 within e-record books |
| Garbage / ODS / oil record (bilge, sludge) workflows | P1 within e-record books |
| Mooring equipment management (lines, winches, MEG where applicable) | P1 |
| Navigation publication / chart correction status (no ECDIS replacement) | P2, status only |
| Warranty / guarantee claims after repair or newbuild | P2 |
| Technical circulars / fleet instructions with controlled acknowledgement | P1 |
| Survey planning, class recommendations, conditions of class | P1 (with certificates) |
| Owner/charterer instructions and contract-relevant evidence | P1 |

### Hours of rest
SeaMinds calculates rest hours, warns, forecasts likely violations from the planned work and port schedule, and records accountable resolution (e.g. the Master's documented exception under the applicable rules). It does not decide manning or block operations.

### Crew wellness / Sealed Envelope
Private wellness and confidential crew data is isolated by default in its own compartment. It is disclosed only under explicit policy, informed consent, or a defined legal or safety basis, and every disclosure is logged. General Fleet users never see it. Aggregated, anonymized indicators may be shared only where consent and policy permit.

---

## 12. AI source hierarchy

| Tier | What it is | AI may |
|---|---|---|
| T1 Approved technical library | company-approved, versioned, cited | state limits and procedures with a citation |
| T2 Authoritative external source | regulations, class rules, maker bulletins held in library | quote with citation; **applicability is interpreted by a human or external body** |
| T3 Unapproved extracted document | parsed manuals and scans not yet approved | show with the original citation and an "UNAPPROVED — not an operating limit" warning; offer "request approval" |
| T4 AI inference | suggestion, summary, translation | label as a suggestion; never presented as a limit or procedure |

Numeric limits and procedures in operational guidance come only from T1, or from T2 where applicability has already been confirmed.

---

## 13. Maturity model and KPIs (method frozen, targets open)

- The Level 0–5 model is kept from v2. All numeric thresholds are **removed**. Each level's advancement criterion is "the target set from the pilot baseline, approved by the customer and the safety owner, is met for a defined period with zero unresolved critical misses".
- **KPI method frozen:** definitions, data sources, sampling method and reporting cadence for:
  - touches per routine job
  - duplicate entry avoided
  - shore review items per 100 jobs
  - false satisfactory rate
  - missed critical exceptions
  - retake rate
  - sync success, conflict rate and resolution time
  - report preparation time
  - procurement cycle time
  - payroll exception rate
  - provenance completeness
  - adoption and error rate
- **Targets:** set after the baseline, scaled to risk.

---

## 14. Revised pilot: "One Engine-Room System, End-to-End"

**Recommended scope:** one vessel; the **main and auxiliary power system** (diesel generators, their fuel/lube/cooling sub-systems, the emergency generator, main switchboard). This is roughly 40–80 assets, set during onboarding.

**Why this scope:**
- running hours apply
- critical equipment includes the emergency generator
- periodic statutory tests exist (emergency generator load test)
- class-relevant deferrals are realistic
- old-ship records are typically messy here
- it touches C/E, 2/E, ETO, ratings, Master (critical tests) and the Superintendent

It is small enough to execute and broad enough for every primitive.

### Primitives proven
| Primitive | Pilot proof |
|---|---|
| Real identities, vessel-scoped permissions | invited users, MFA/passkey, a cross-vessel denial test |
| Role / designation / competence separation | ETO competence gate on electrical critical job; Master designation for emergency generator test sign-off |
| Offline on 2+ devices | engine-room tablet + C/E device; conflict tests |
| Provenance | every reading and completion carries a full provenance record |
| Old-ship onboarding, unknown history | import of Excel/paper register; unknown-history baseline jobs |
| Running-hour reuse | daily DG meter readings drive child intervals |
| Routine green completion | non-critical jobs auto-accepted per policy, sampled |
| Problem Found → Finding → corrective action | full lifecycle with verification step |
| Critical evidence and sign-off | emergency generator load test with E2 evidence |
| Controlled deferral | one deferral through policy routing, including an external acknowledgement placeholder |
| Evidence reuse | emergency generator test satisfies a readiness/inspection objective under the reuse rule |
| Exception dashboards | C/E decisions and Superintendent RED/AMBER |
| Report snapshot | monthly technical snapshot from accepted state, with sign-off per report definition |
| Client capability test | protocol in section 10 |

**Excluded from the pilot:** money, payroll, procurement, ISPS, grievance, cargo, record books.

---

## 15. Final freeze decision

### A. Safe to freeze now
1. Separation of platform operator, customer organization, legal parties and vessel responsibility periods; data partition model.
2. The five authority concepts, with conditional gates declared per action type.
3. Vessel Operational Administrator scope (no IT duties).
4. Authority classes O/S/J/X; discrepancy instead of edit.
5. Append-only events plus rebuildable projections; supersession for corrections; logical immutability distinct from retention.
6. Provenance fields on consequential values; policy-based source selection.
7. One policy engine; payload-bound approvals; no self-approval; external acknowledgements recorded, never simulated; Master override as an S0 event.
8. Risk-tiered offline leases; S0 never blocked; quarantine instead of deletion.
9. No biometric storage; no camera surveillance.
10. Accessible, multi-signal exception UX; thresholds as policy.
11. Evidence classes, the reuse rule and scoped invalidation.
12. AI source tiers T1–T4; AI advisory only; permission filtering before retrieval.
13. Cargo/loading-instrument boundary; hours-of-rest advisory boundary; wellness compartment boundary.
14. KPI measurement method; targets from baseline.
15. Public recruitment SeaMinds stays separate from Fleet.

### B. Needs customer, legal, Flag, Class or company-policy confirmation
- SeaMinds-as-manager vs software (both supported; the choice changes contracts and RPS exposure).
- Retention periods per record class; legal hold owners.
- E-record book acceptance per Flag; electronic signature acceptance.
- Which designations the SMS lets the Master appoint onboard.
- Deferral authority matrix and class involvement.
- Offline lease durations per action class.
- Wellness disclosure legal bases per jurisdiction.
- Evidence class assignments for critical equipment.
- Accounting stance (subledger vs ERP).

### C. Open until pilot testing
- PWA vs native wrapper vs shipboard edge service.
- Local database technology, sync protocol details, media compression profiles.
- Queue sizes, sampling rates, auto-accept eligibility values.
- KPI targets.
- QR vs NFC tagging on the pilot vessel.
- Voice transcription and translation provider choice and accuracy thresholds.

### D. Must NOT be built yet
- Payroll, bank or vendor-master, and medical data handling (security gate first).
- Grievance and ISPS compartments (policy and legal confirmation first).
- Electronic record books (Flag acceptance first).
- Cargo, stability or loading computation of any kind (permanently out of scope).
- Owner portal, procurement, crew travel (after the pilot).
- Any AI feature that outputs technical limits without the T1 library in place.
- Any change to the current Fleet screens until the freeze is approved and you give an explicit build instruction.

### Questions that still block a full freeze
1. Which commercial model comes first (SeaMinds-as-manager or software), even though the architecture supports both?
2. Pilot vessel, customer and C/E champion; availability of the power-system manuals and current records.
3. Target devices onboard for the capability test.
4. Who acts as safety owner to approve auto-accept policy and KPI targets?
