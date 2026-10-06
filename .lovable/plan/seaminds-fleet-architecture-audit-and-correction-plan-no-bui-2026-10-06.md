# SeaMinds Fleet — Architecture Audit and Correction Plan (no build)

## A. Status
Plan mode only. Nothing was edited, built, installed or migrated, and no database or screen was changed. I only read files and searched the code. The one file written is this plan.

## B. Current-project conflict audit

### Verified this turn (from the code)
| # | Finding | Evidence | Severity |
|---|---|---|---|
| 1 | Public self-service Fleet role request still exists | FleetLogin.tsx: `signUp` with `fleet_role` metadata, role dropdown, inserts a `pending` `requested_role` row | P0: remove before production |
| 2 | Generic role + USD limits used as the final model | StaffApprovals.tsx: hardcoded defaults Master 2500, C/E 1000, Supt 5000, TM 25000, plus a single `approval_limit_usd` | P0: replace with a policy engine |
| 3 | DPA is merged into a role label | StaffApprovals.tsx: "Marine Superintendent / DPA" | P1: make DPA a designation, not an approver role |
| 4 | Permissions are boolean module flags plus one role | M1 `modules` array and special approval switches | P0: replace with org/vessel memberships plus effective dates |
| 5 | Fleet tables are admin-only through RLS (`is_admin`) | Fleet migration: policies on fleet_cells, fleet_vessels and management_periods | Safe for now, but provisioned staff cannot see anything scoped to them yet |
| 6 | Staff accounts use a synthetic email and an admin-set password | admin-create-staff function | P1: switch to invite plus user-created credentials, with MFA/passkeys |
| 7 | Fleet sits inside the Manager/recruitment URL space (`/management/fleet`) and the homepage sign-in sheet | FleetHome.tsx, SignInSheet.tsx | P1: separate the Fleet front door |

### Checked, not present in code
- No camera selfie or live camera code. It was proposed in chat only; withdraw that proposal.
- No "log every click immutable" ledger code. Withdraw that wording from the roadmap.
- No Portage formula, enclosed-space limits, AI Morning Order or AI technical-limit code yet. These existed only in roadmap text; correct them before building.

### Not verified this turn (must check before sensitive modules)
- Storage bucket scoping, search/export paths, AI function scoping and offline-cache scoping per vessel.
- The 15 remaining security advisories, re-checked against Fleet.

### Earlier chat roadmap items that need correcting
- "AI Superintendent tells ship what must be done today" becomes an "AI-prepared daily brief". It is advisory only and has no command authority.
- Permit approval "by shore team/DPA" becomes per-permit-type policy that preserves Master authority.
- Fixed DoA dollar figures become versioned policy.
- The 10-step PMS roadmap is kept in substance but resequenced after the foundation gates (section J).

## C. Target architecture, in my own words
Fleet is a separately authorized, multi-company, multi-vessel operational system. People get access only through dated memberships that the company provisions. Every fact has an authority class: Office (O), Ship (S), Joint (J) or External (X). Ships record facts locally and keep running with no cloud, AI or internet. The office owns policy and master data. Disagreements become discrepancy or correction workflows, never silent edits. One approval engine governs consequential actions, using versioned policies and payload hashes. Data flows through these stages:

```text
RAW -> NORMALIZED -> VALIDATED -> DERIVED -> ACCEPTED STATE -> reports / PMS / analytics / AI
```

Provenance is kept at every stage. AI prepares, extracts and translates. Accountable humans or external bodies decide. Recruitment SeaMinds stays public and separate.

## D. Gaps by priority

**P0, foundation (before any sensitive module):**
- F1 identity and memberships
- F2 policy and approval engine
- F3 consequential audit (versioning and supersession, tamper-evident hashing)
- F4 offline event store and sync
- F5 data provenance model
- F6 permission enforcement across DB, storage, search, export, AI and cache
- F7 cyber device and key management, signed releases
- F8 business continuity and manual fallback

**P0, domains, from your list:**
1. Recruitment (RPS) boundary
2. Confidential grievance
3. ISPS
4. Emergency/DPA offline
5. Electronic record books
6. Port call / FAL / Maritime Single Window (MSW)
7. Agency and disbursements
8. Management of Change (MoC)
9. Regulatory change
10. Supplier governance and bank master data
11. IT/OT inventory
12. Business continuity

**P1:** medical and medicine chest, victualling and water, bunker/lube lifecycle, DCS/CII/SEEMP/ETS/FuelEU, support and release operations. **Later:** drydock and insurance/claims.

## E. Role experience (minimum interaction)
- **Crew:** TODAY / ASK / SCAN / DO / REPORT. QR/NFC on assets. Normal / Problem Found / Could Not Complete. Voice in their own language, with the original kept beside the English draft.
- **Master:** a vessel-admin cockpit to confirm joins and sign-offs, review exceptions, sign record books, handle cash events and permits with offline authority, and see the crew list. Master cannot edit office master data.
- **C/E:** a decisions box covering deferral drafts, critical sign-offs, low critical spares and running-hour anomalies. Routine green items are auto-accepted where policy allows.
- **Superintendent:** RED/AMBER across assigned vessels only, visit scope, port package, and approvals within policy.
- **Crewing:** the assignment state machine, compliance checks, travel, and RPS-bounded selection.
- **Procurement:** requisition inbox, RFQ, bid comparison (AI extract), and PO issue under policy.
- **Accounts:** subledger, 3-way match exceptions, Master Cash reconciliation, payroll ledger, and exception-based close.
- **Owner:** material risk, cost versus budget, downtime and forecast only.

## F. Approval and authority model
A policy object includes:
- company, owner and vessel
- transaction type
- amount and currency bands
- budget status
- criticality and emergency flag
- department
- steps (sequential or parallel)
- delegation and expiry/escalation
- effective dates and version

Every approval binds to a payload version and hash. Any consequential change creates a new version and needs reapproval. The engine enforces no self-approval and maker-checker. Reject and rework keep the history. Temporary delegations are dated and audited. External steps (Class, Flag, bank) are recorded as acknowledgements; SeaMinds never approves them itself. Master overriding authority is an explicit emergency path that never waits on the engine.

## G. Data, offline and integration model
- Integration levels M0 to M6, as in your brief.
- Each value records: source and device, raw value, normalized value and unit, device/ship/cloud times, quality, validator, override reason and confirmer.
- The device keeps an append-only local event log with client UUIDs. Sync is idempotent, prioritized and resumable. Conflicts are kept as parallel records and resolved by a rule or a person, never last-write-wins.
- Office-locked data reaches the ship as signed read-only snapshots.
- Connections to OT/navigation are read-only by default.
- Reports are snapshots of accepted state. Exports: PDF, XLSX, CSV, JSON, XML, API and webhook.
- Current gap: the existing IndexedDB outbox is only a draft-recovery buffer. It is not this event store.

## H. AI safety model
- AI reads only what the user's membership allows, with vessel and ISPS scope enforced on the server.
- AI cites an approved source for every technical value or procedure. If there is no source, it says "no approved value found" and opens a request.
- AI never approves, commits funds, extends a deferral, returns equipment to service or decides statutory applicability.
- AI output is labelled as a draft. The original language and the raw data are never overwritten.
- The ship works fully with AI switched off.

## I. Scenario answers
1. **C/O joining while the ship is offline:** Locally, Master records Actual Join with time, place and witness. This creates an Assignment event, sets Onboard locally and updates the crew list. The approved wage, contract and compliance stay office-locked. The event syncs idempotently later, and the office reconciles it against the Planned Join. Pay entitlement starts from the accepted Actual Join (or the SEA/CBA rule, e.g. the travel-day clause), never from the travel state.
2. **Wrong office-approved wage:** Master raises a Discrepancy on the wage record, with evidence and an optional proposed value. This is a Joint workflow, and the office corrects and re-versions the record. Master may not edit the rate, the components or the rule.
3. **Critical-spare requisition:** The ship raises the need. Shore procurement selects vendors and runs the RFQ. Only authorized procurement and approvers see competing quotes; vendors never do. The PO is issued by procurement after policy approval. The ship confirms the GRN for quantity and condition.
4. **Quote changes after approval:** The old approval is void for the new payload because the hash no longer matches. A new version goes through reapproval. Policy may allow tolerance bands for minor changes, set explicitly by the office.
5. **No approved DG2 exhaust-temperature limit:** AI says that no approved limit is in the vessel library. It shows the maker manual reference if one is held, labelled unapproved. It does not invent a value. It flags a library gap to the superintendent and suggests consulting the C/E and the maker.
6. **Internet down during a critical repair or permit:** Master and C/E proceed under the onboard authority defined in the SMS. The permit is issued locally with gas readings, signatures and time limits. Shore notifications and countersignatures queue for sync. Safety work never waits for software or shore when onboard authority is sufficient. Shore-required items per policy are flagged as pending.
7. **Two offline devices submit conflicting running hours:** Both readings are stored with device, time and user. Validation checks monotonic order and the plausible rate. The conflict goes to the C/E to pick or correct, with a reason. Derived intervals use only the accepted value.
8. **Vendor puts new bank details in a quote:** The quote is ignored as a bank source. A bank-change case opens in supplier governance with out-of-band verification and dual approval. Payments hold until it is verified. The event is security-flagged.
9. **GNSS noon position conflicts with manual position:** Both are stored with source and quality. A deviation check flags the conflict. The formal value is the one the officer confirms; GNSS is the default where valid. The override reason is recorded.
10. **Class-controlled deferral:** Neither SeaMinds nor the office can approve it alone. The internal Joint workflow prepares it, then an External Class acknowledgement is required before it is accepted.
11. **Complaint about the supervisor or Master:** The crew member can route to the DPA, a designated shore contact or an external body (Flag, ISWAN, union) without the Master's visibility. Access is restricted. Anti-victimization markers are applied. Offline, the complaint is stored encrypted until it syncs.
12. **MSW rejects a declaration:** The status shows "Rejected by authority" with the reason. The submission record is kept unchanged. A corrected version is linked as a resubmission.
13. **Major emergency with no internet:** Emergency response works fully on the ship: local checklists, the contact list cached in the app, an event log and the Master's decisions. The DPA is notified by any available channel. Records sync later.
14. **Correcting a signed record-book entry:** The original stays visible and signed. A correction entry references it, with reason, signer and time, following Flag rules.
15. **AI asked for restricted SSP content without authorization:** AI refuses, says ISPS authorization is required, logs the attempt to the security audit, and gives no partial content.

## J. Build strategy (plan only)
Each slice is about 3 credits and has an acceptance gate:
1. **G0 Correct:** retire Fleet self-signup and remove the hardcoded limits from the UI. *Gate:* no public role request path.
2. **F1 Memberships:** org/vessel memberships with dates, invite flow and vessel-scoped RLS. *Gate:* staff see only their vessels; cross-vessel tests pass.
3. **F2 Policy engine:** policies, approvals, versioning and hashes, no self-approval. *Gate:* scenario 4 passes.
4. **F3/F5 Audit and provenance:** a consequential audit table with hash chain and a value-provenance schema. *Gate:* scenarios 7 and 9 pass in a data test.
5. **F4 Offline event store:** prototype on one domain (running hours). *Gate:* conflict and idempotent sync tests pass.
6. **First vertical, PMS core:** asset tree, versioned jobs with source citation, running-hour reuse, TODAY. *Gate:* scenario 5 passes and the ship works offline.
7. Then: defects and deferrals (scenario 10), takeover-to-PMS, procurement and suppliers (scenarios 3 and 8), crew assignment and travel (scenario 1), payroll ledger (scenario 2; security gate first), permits and emergency (scenarios 6 and 13), grievance (scenario 11), ISPS (scenario 15), record books (scenario 14), port call / MSW (scenario 12), owner portal.

The security review is a hard gate before payroll, bank, medical or vendor-bank data.

## K. Open questions and unsafe assumptions
- Is SeaMinds itself the ship manager, or software sold to managers? This decides the DOC/SMS and RPS boundary.
- Which Flag(s) are targeted first for electronic record books?
- Is this an operational subledger only, or a full ERP? (Assumed: subledger.)
- Which first pilot vessel type and company will provide approved PMS jobs and manual sources?
- Is an MFA/passkey provider acceptable?
- The marketplace RPS licensing jurisdiction needs a legal review.
- Lovable Cloud limits: OT gateways (M4/M5) need separate onboard hardware outside this app.

## L. Verdict
**Needs correction before freezing the architecture.** It is safe to build only G0 and F1 as the first vertical, after your explicit approval. No Class or Flag acceptance is implied.
