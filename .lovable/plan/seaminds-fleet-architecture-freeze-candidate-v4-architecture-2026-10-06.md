# SeaMinds Fleet — Architecture Freeze Candidate v4 (architecture rules)

**Status:** strict plan mode. No code, database, screen, package or configuration change has been made. **Approving this does not authorize any build.**

This document replaces v1–v3 as the reference that Build mode must follow. Module catalogues, scenario answers and the KPI list from earlier versions remain as background only. Where they conflict, this document wins.

---

## A. Final invariants to freeze
1. **Authority comes first.** Every consequential action type declares its `authority_source`: SMS, company procedure, SEA/CBA, contract, Class, Flag, law or external body. Software only implements a workflow that source permits. Software never creates authority.
2. **Enter once, reuse with provenance.** No re-asking for accepted facts, and no reuse beyond the scope the fact was accepted for.
3. **Normal work is minimal; abnormal work expands.** Routine work needs the fewest steps. Exceptions open the detail they require.
4. **Every record type has an authority class.** The classes are Office (O), Ship (S), Joint (J) and External (X). The wrong party raises a discrepancy and never edits.
5. **Events are logically immutable; current state is a projection.** Corrections supersede earlier events. Immutability does not mean indefinite retention.
6. **External authority is only ever recorded, never simulated.** Test or simulated acknowledgements are marked non-production and are never operational truth.
7. **Safety and emergency capture is never blocked by software state.** This covers credentials, connectivity, AI or sync.
8. **No last-write-wins for consequential records.**
9. **Permissions are enforced on the server and in every derived channel.** That includes the database, storage, search, export, AI retrieval and offline cache.
10. **AI is advisory.** It is source-tiered and filtered by tenant and permission before retrieval. It is never decisive for consequential matters.
11. **Tenant isolation is absolute for customer-private data,** including AI context.
12. **Exceptions plus sampled assurance, never exceptions alone.**
13. **Legal and privacy roles are configured per deployment, never hard-coded.** This covers controller, processor, retention and lawful basis.
14. **Vessel and asset identity persist across management changes.** Access, custody and attribution are period-scoped.
15. **Public recruitment SeaMinds and Fleet are separate products.** They share identity only. Crew wellness data stays compartmentalized by default.

---

## B. Core entity model

```text
REFERENCE (platform-shared, licence-permitting)
  VesselIdentity (IMO, stable platform ID, static particulars)
  MakerModelCatalog (optional, licence-controlled)
  RegulatoryReference (citations only, no customer interpretation)

PARTIES
  LegalParty (company/person entity; may perform many functions)
  CustomerOrganization (contracting customer of the platform; deployment config incl. privacy-role register)
  ResponsibilityRelationship (Vessel <-> LegalParty, function, effective from/to)
     functions: registered_owner, beneficial_owner, doc_company, technical_manager,
                crew_manager, commercial_manager, charterer(type), agent, flag, class
  ServiceContract (CustomerOrganization <-> Vessel, scope of functions, effective dates)
     -> creates a ManagementPeriod (data custody + access scope)

PEOPLE & ACCESS
  Person (identity; passkey/MFA; no biometrics stored)
  Membership (Person <-> CustomerOrganization, dates)
  Assignment (position + scope: vessel/cell/org-unit/portfolio, dates, source)
  RoleGrant (permission bundle)          Designation (SMS/statutory appointment)
  CompetenceRecord (qualification + expiry + verifier)
  Delegation (assignment subset -> person, dates, reason)
  Device (registered, revocable, key-bound)

VESSEL TECHNICAL (customer-private within ManagementPeriod unless transferred)
  Position/Function (stable per vessel)    Asset/Component (stable platform asset ID)
  Installation (asset in position, from/to)   Meter (+ resets/offsets)
  JobDefinition (versioned, cited, authority_source)  Plan/Schedule (projection)
  Observation/Evidence (multi-purpose)   Finding -> CorrectiveAction
  VerificationObjective (inspection/readiness/statutory) + VerificationStatus (projection)

GOVERNANCE
  ActionType (authority_source, authority class, gate list, offline tier, evidence class, emergency_allowed)
  Policy (versioned, scoped, implements route for ActionType)
  ApprovalInstance (payload hash/version, steps, outcome)
  ExternalAcknowledgement (real evidence only; production flag)
  RecordClass (retention, legal basis ref, minimization, hold rules)
  HandoverPackage (transfer authority, items, provenance)
```

### Data scoping
| Category | Scope |
|---|---|
| Platform reference | Vessel identity, licensed maker catalog, regulatory citations |
| Customer-private | Job library, procedures, defect history, readings, evidence, vendor prices, wage scales, crew data, policies, AI context |
| Shared by agreement | Transferred vessel history, via HandoverPackage only |

---

## C. Authority and permission model

**Five concepts are kept distinct:**
- permission
- operational assignment
- designation/appointment
- competence
- approval authority

**Action evaluation:**
- Permission is always required.
- Assignment is required for vessel-local actions.
- Designation, competence and approval authority are checked only when the ActionType's gate list declares them.
- The specific rank or designation is set by the authority source and policy, never by the platform.

**Access** comes from ServiceContract plus Membership plus Assignment. It never comes from a ResponsibilityRelationship label alone.

**Vessel Operational Administrator** (Master by default, delegable per SMS):
- **Does:** confirms factual join and sign-off; makes onboard acting assignments from eligible people; makes vessel-local designations the SMS allows; acknowledges instructions.
- **Does not:** IT, identity, passwords, roles, policy or master data.

**Emergency/Overriding Authority Event:**
- Available only on ActionTypes with `emergency_allowed = true`, as derived from their authority source (safety, pollution prevention, or other authority the SMS or law grants).
- It executes immediately and records the reason. Review and notification follow afterwards.
- It cannot apply to procurement, payroll, bank/vendor master, commercial or unrelated financial actions. Their authority sources do not allow it.

**Policy engine:**
- Implements routes for an ActionType within its authority source.
- Supports maker-checker, no self-approval, sequential or parallel steps, delegation, SLA/escalation, payload hash/version binding, reapproval triggers and external acknowledgement steps.

---

## D. Event, state and provenance model

| Layer | Content |
|---|---|
| RAW | Captured payloads and media. Retention follows the RecordClass. |
| NORMALIZED | Parsed value, unit and mapped asset or data point. |
| VALIDATED | Rule results and quality flags (rule version recorded). |
| DERIVED | Recomputable values (algorithm version recorded). |
| ACCEPTED | Selection or confirmation event under the source-selection policy. This is the formal fact. |
| PROJECTION | Current state, rebuildable from events. |
| REPORTED | Frozen snapshot referencing accepted facts and the report-type definition (its signatories come from procedure, not hard-coding). |

**Provenance on consequential values:**
- source and data point
- raw value, normalized value and unit
- event time, device time, ship receipt time, server receipt time
- person, device and assignment
- quality and confidence
- validator version
- override reason
- accepted-by and policy version
- supersedes / superseded-by
- management period
- transfer origin, if any

**Retention:**
- RecordClass defines the period, legal basis reference, minimization rules and expiry action.
- Legal holds suspend expiry.
- Deletion leaves a tombstone event (class, rule, time, hash) and propagates to replicas, indexes, AI indexes and devices.
- Backups age out within a documented window, and restores re-apply tombstones.

**Evidence classes E0–E4 (from v3) govern media retention.** The confirmed original-language text is kept whenever it is part of a formal record. A translation is stored as derived data.

---

## E. Offline model
- **Device:** local store with an append-only event queue and client UUIDs. Signed policy and master-data snapshots carry a version and validity window.
- **Risk-tiered offline leases** by ActionType tier. All durations are policy.

| Tier | Covers | Offline behaviour |
|---|---|---|
| S0 | Safety/emergency | Never blocked; best-available attribution; flagged for review |
| S1 | Operational records | Long lease, then captured as pending re-auth |
| S2 | Authority actions | Need a valid assignment/designation snapshot; otherwise provisional or co-signed |
| S3 | Commercial | Short lease; provisional until online |
| S4 | Privileged/security | Online only, or minimal lease; no restricted cache unless policy allows |

- **Sync order:** safety, then authority, then structured records, then thumbnails, then media. Uploads are resumable and idempotent.
- **Conflicts:** both records are kept and resolved by a rule or a named human.
- **Revocation:** events after the effective revocation time are quarantined. A reviewer accepts, reattributes or rejects them, and the evidence is always preserved.
- **Client form factor** (PWA, native wrapper or shipboard edge service) is decided by the pilot capability tests in section I, never assumed.

---

## F. Exception and automation model
- **Status display:** RED, AMBER and GREEN each show a text label, icon, priority and reason (rule ID). The display is accessible and never colour-only.
- **Policy-set values:** classification rules, windows, queue sizes, sampling and auto-accept eligibility are all versioned policy derived from risk and baseline.
- **Auto-accept:** only for ActionTypes flagged eligible, through deterministic rules. AI may suggest, but never accepts.
- **Each automation is labelled** as a deterministic rule, AI assist, human decision or external authority.
- **Evidence reuse:** allowed only when identity (asset in position), scope, method, freshness, operating condition, witness/signature requirement and authority class all match. A new defect, repair, overhaul, swap or condition change invalidates only the affected current VerificationStatus, never history.
- **Work completed is not the same as equipment healthy or test passed.** A failed critical test stays failed until a new passing event.

---

## G. Security, privacy and AI boundaries
- **Identity:** invited accounts, user-created credentials, MFA and passkeys. Device biometrics are OS-local, and SeaMinds receives assertions only. No camera monitoring.
- **Least privilege across every channel:** RLS, storage paths, search, export, AI and offline cache, all keyed by customer, management period and vessel.
- **Compartments:** grievance, medical, bank/vendor master, ISPS-restricted and SSAS. Each has its own access list, is excluded from general search and AI, and is reachable only through logged break-glass.
- **Privacy roles** (controller, joint controller, processor) are recorded per deployment and processing purpose in the customer's deployment configuration.
- **Platform operator:** no default data access. Support access is time-boxed, customer-approved and logged.
- **Device and release controls:** device registration and revocation; separate key domains; signed releases; SBOM; backup with tested restore; security event log separate from the operational audit.
- **AI source tiers:**
  - T1: approved library (limits and procedures, with citation)
  - T2: authoritative external source (quote only; applicability needs a human or external body)
  - T3: unapproved extracted document (shown with citation and an UNAPPROVED warning)
  - T4: inference (labelled as a suggestion)
- **AI tenancy:** retrieval context is limited to the requesting customer's permitted partition. No cross-customer retrieval, memory or example use. Any aggregate model improvement is a separate contract and privacy decision and is never operational memory.
- **AI logging** records metadata and sources, with confidential payloads redacted or held in their compartment. AI failure always degrades to a manual path.

---

## H. Management-change and handover model
- **Identity:** VesselIdentity and asset/component IDs are stable platform identifiers across management periods.
- **Period close:**
  - The outgoing ManagementPeriod closes.
  - Its records keep their attribution to the outgoing organization and period.
  - Custody and access stay with that period's contractual parties.
- **Handover:**
  - A HandoverPackage is created under a recorded transfer authority (contract, owner instruction or agreement).
  - It lists selected items: asset register, maintenance history, open defects, certificates, readings and evidence.
- **Import:**
  - The incoming period imports items as *transferred* with provenance: origin period, transfer authority and original verifiers.
  - Items are not auto-accepted. The incoming manager reviews and accepts, or marks "transferred, unverified".
  - Unshared or unknown history stays UNKNOWN and drives baseline jobs.
- **Ongoing access:** access to prior-period records requires an explicit grant under agreement. There is no implicit inheritance.
- **Takeover inspection:** this feeds Observations into the new period with the normal provenance.

---

## I. Pilot acceptance tests

Scope: one vessel, the main and auxiliary power system. Each test passes only with recorded evidence.

1. Invited users authenticate with MFA or a passkey. A cross-vessel and cross-customer denial is proven on the database, storage, export and AI paths.
2. An ActionType gate requires a designated and/or competent signatory per its policy. Who signs is configured, not assumed by rank.
3. Two or more devices capture offline through a long outage, restart and storage pressure. Sync completes idempotently, and a conflict is resolved by a named reviewer.
4. Revoked-user offline events are quarantined and reconciled without evidence loss.
5. An old-ship register is imported with confidence flags. Unknown history produces baseline jobs, and no history is fabricated.
6. One daily meter reading propagates to child intervals. A meter reset with offset keeps history continuous.
7. A routine eligible job is auto-accepted by rule and appears in the sampled-assurance stream.
8. Problem Found leads to a Finding, then a CorrectiveAction, then verification before closure.
9. A critical job captures E2 evidence and its gated sign-off. A failed test stays failed.
10. One deferral is routed by policy. External acknowledgement comes either from a real Class case or from a test clearly flagged as non-production.
11. Evidence satisfies a readiness objective only when the reuse rule matches. A subsequent defect invalidates only that current status.
12. C/E and Superintendent exception views show labelled, reasoned items, with thresholds from policy.
13. A report snapshot is generated from accepted state, with sign-off per its report-type definition.
14. An AI query for a missing limit returns "no approved value". T3 content shows the UNAPPROVED warning, and no cross-customer context appears.
15. The client capability protocol (devices, outage length, eviction, media queue, clock drift, update during outage, device loss) produces the PWA / native / edge decision.
16. The KPI baseline is captured, and targets are set afterwards.

---

## J. Explicitly open decisions
- Commercial model first: SeaMinds-as-manager or software. Both are supported.
- Privacy role register per deployment; retention periods per RecordClass; legal hold owners.
- Flag acceptance of e-record books and electronic signatures.
- Designations the SMS lets the Master appoint onboard; signatory and witness rules per job.
- Deferral authority matrix and Class involvement.
- Offline lease durations per tier.
- Wellness disclosure bases per jurisdiction.
- Licensing for a shared maker/model catalog.
- Client form factor: PWA, native or edge (after pilot tests).
- Queue, sampling, auto-accept values and KPI targets (after baseline).
- Pilot vessel, customer, C/E champion, devices and safety owner.

---

## K. Prohibited architecture shortcuts
1. Hard-coding rank-based approvers, USD limits, sampling rates, queue sizes or KPI targets.
2. A generic "Master override" or any bypass that crosses into commercial, financial, payroll, bank or vendor controls.
3. Storing simulated or fake external acknowledgements as operational truth.
4. Granting access from a relationship label instead of a contract plus assignment.
5. Fragmenting vessel or asset identity per management period, or silently inheriting unverified prior-period data.
6. Cross-customer AI retrieval, memory or shared customer-private master data.
7. Treating hashing as legal immutability, or immutability as indefinite retention.
8. Last-write-wins on consequential records; deleting quarantined evidence.
9. UI-only permission checks; unscoped offline caches, search indexes or exports.
10. AI-generated technical limits or procedures without a T1 source; AI auto-acceptance.
11. Storing biometrics; camera surveillance; immutable "log every click" telemetry.
12. Computing stability, strength or loading (no uncertified loading computer); software deciding manning or rest-hour outcomes.
13. Self-service public sign-up granting Fleet roles.
14. Exposing wellness or confidential crew data to general Fleet users.
15. Assuming the PWA is sufficient without passing the capability tests.
16. Any build before the freeze is approved and an explicit build instruction is given.
