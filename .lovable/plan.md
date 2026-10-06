# SeaMinds Fleet — Architecture Freeze (v5, decisions locked)

Status: strict plan mode. Nothing was built, and no database, UI, package or config change was made. This card records the answers you selected and what they lock in. Approving it does not start a build — the first build needs a separate written instruction.

## A. Your eight decisions

| Question | Your answer | What it locks in |
|---|---|---|
| Business model | Both, manager first | SeaMinds holds the DOC and operates its own ship as the proving ground, then sells the same system to other managers. |
| Offline setup | Phone/tablet only, no extra kit | No onboard box in phase one. Devices hold work and upload when linked. |
| Record books | Flag acceptance required | Electronic record books are a phase-one deliverable that a Flag administration must accept, not a convenience tool. |
| Accounts depth | Operational ledger only | We capture every cost event accurately and pass them to the company's accounting package. No general ledger, no year-end close in-app. |
| First vessel | A ship we manage ourselves | Tenant one is SeaMinds. We control ship, crew and paperwork, so policy and speed are ours. |
| Starting scope | Generators and auxiliaries | Roughly 30 critical assets on one system, with daily running hours from one meter reading. |
| Rules owner | DPA / safety owner | The safety owner signs the version of policy that says what the system may accept automatically, plus the targets we measure. |
| Crew devices | Ship tablets or laptops | Shared ship devices, not personal handsets. |

## B. What follows automatically from those answers

1. **Single tenant in practice, multi-tenant in structure.** Because the software business comes second, the tables still carry tenant and vessel keys from the first migration. Retrofitting separation later is the expensive mistake.
2. **Shared devices change the identity rules.** A tablet passed between ratings means: sign in per person per use, short idle lock-out, the offline store partitioned per person so one person's queue can never be sent under another's name, and the Master able to end a session on the spot. Personal phone numbers, documents and anything from the crew wellness side never appear on a fleet device.
3. **Flag acceptance raises the bar on record books.** Sequential entries with no gaps or deletions, corrections as a new entry that supersedes the original, signature or attestation evidence on each entry, time source recorded, and an export format the Flag will accept. The format and the acceptance route must be agreed with the Flag administration before that module is built, not after.
4. **Accounts stays a subledger.** Every cost event carries a posting status and an export handle. No trial balance, no tax postings, no locked periods in-app.
5. **The DPA is an author and approver of policy, not a default approver of work.** Auto-accept is only ever possible for job types named in a policy version the safety owner has signed. Nothing is automatic until that signature exists.
6. **The pilot is narrow on purpose.** One system, about 30 assets, one ship, one crew rotation. Breadth comes only after the measured numbers are good.

## C. Frozen from the earlier review, unchanged

- Authority classes O / S / J / X on every record type; the wrong party raises a discrepancy instead of editing.
- Role, designation and competence stay three separate things; assignments are effective-dated; delegation is time-bounded and scope-subset only.
- Events are immutable, current state is a projection, corrections supersede and never overwrite.
- Provenance on every consequential value; source selection by versioned policy, never hard-coded preference.
- One policy engine; payload-bound approvals; no self-approval; external acknowledgements recorded, never simulated.
- Offline-safe: no last-write-wins for consequential records; concurrent events both stored and flagged.
- AI is advisory, cited from the approved library only, permission-filtered before retrieval, and never decisive for safety or money.
- Tenant and vessel isolation enforced in the database, every cache, search, export and AI path.
- No hard-coded maritime authority: no fixed pay trigger, no assumed preferred sensor, no assumed complaint channel, no fixed currency approval limits.

## D. Pilot definition, now concrete

```text
Ship:      a vessel SeaMinds manages (DOC held by us)
Scope:     generators + auxiliaries, ~30 critical assets
Crew:      ship tablets / laptops, shared, sign-in per person
Offline:   device-only, no onboard box
Policy:    auto-accept + sampling rates signed by the DPA before use
Money:     excluded from the pilot
ISPS:      excluded from the pilot
Measure:   60 days at sea, KPIs compared to a baseline captured first
```

Pass conditions: routine work recorded digitally by more than 80% of jobs; onboard touches per routine job two or fewer; duplicate entry near zero; no critical exception missed; false-satisfactory rate measured by sampled audit; sync losses and conflicts counted, not guessed.

## E. Still open before the first build

1. Which ship: name and IMO number, and the chief engineer who will champion it.
2. Which devices exactly: make, operating system and browser of the tablets or laptops, since offline storage behaviour differs by platform and this decides whether a browser app is enough.
3. Flag administration: written confirmation of the accepted electronic record-book format and the acceptance route, before that module is designed.
4. DPA-signed policy version one: which job types may be auto-accepted, the sampling percentage, and the KPI targets.
5. Baseline captured on the ship: how many touches and how much time a routine job takes today.
6. Your written instruction naming the first slice.

## F. First slice candidates, one at a time, roughly a 3-credit turn each

```text
S1  Identity, membership, assignment  + shared-device session and per-person offline partition
S2  Policy engine, minimal            + action registry with authority source on every type
S3  Event and provenance store        + device queue, idempotent upload
S4  Asset register onboarding         + import with confidence flags, generators and auxiliaries
S5  Job library and due logic         + running-hour inheritance from one daily reading
S6  Crew Today list                   + Done / Problem / Couldn't, one photo, voice note
S7  C/E decisions box and exceptions  + RED / AMBER / GREEN with sampled assurance
S8  Superintendent cockpit            + own vessel only
S9  Record books, first book          + Flag format, sequential entries, supersession
```

Each slice states its pass/fail check before any file is touched, and I stop after it with a report. Nothing here is started.

## G. Still prohibited

No self-service fleet sign-up. No synthetic staff email as the production identity. No fixed approval amounts in code. No simulated Class, Flag or bank acknowledgement. No cross-tenant AI learning or memory. No wellness data in Fleet. No claim of legal immutability from hashing alone. No build without your written instruction.

## H. Note for the build turns

The standing roadmap file at the project root will be updated to this slice list at the start of the first build turn; it was not touched now because this turn is plan-only.
