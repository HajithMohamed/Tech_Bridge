# Phase 8 — Opportunity management backend

Baseline: latest fetched development `45c2b1e` after PRs #31 and #32. No existing
opportunity-management feature/PR was present. This branch preserves all original
dirty workspace files and the separately maintained frontend.

| Module | Audited state | Required change |
| --- | --- | --- |
| Publish/edit and provider services | Implemented; scholarship edits have transaction/capacity safeguards | Recheck provider and capabilities inside writes, validate bounded input, preserve award guard |
| Public search | Partial type/skill/work-mode filters; unbounded reads and write-on-read expiration | Literal advanced filters, stable pagination, current provider visibility, effective expiration |
| Matching | Existing tested 60/25/15 rule engine; substring false positives, duplicate/blank skill bias, unbounded results | Preserve weights and add explicit aliases, explanations and bounded ranked result retention |
| Saved opportunities | Missing | Private idempotent saving, bounded lists and unavailable placeholders |
| Applications | Duplicate constraint, transactional submission/status notices; ordinary history missing | Record real status history, preserve scholarship audit, enforce transitions and optional stale-write checks |
| Eligibility | Scholarship policy exists; ordinary explicit rules/explanations missing | Optional structured ordinary requirements; reuse scholarship policy; explain advisory match separately |
| Deadlines | Public reads mutate status; expired records cannot be closed cleanly | Logical deadline enforcement, safe closing/reopening, saved-list deadline reminders and stale-source checks |
| Deletion/history | Ordinary deletion can orphan applications | Retain closed source records after applications, respect admin withdrawal |

Acceptance: preserve existing response arrays/provider privacy and scholarship
capacity/fairness policies; prevent applying to unavailable sources and duplicate
submissions; enforce current provider authorization under concurrent changes;
maintain private real history without inventing legacy events; return transparent
eligibility/matching explanations; save/unsave only the current student's records;
bound search/history work and preserve global match ordering; produce safe durable
notification events. All implementation and test evidence belongs to this branch.

## API and compatibility

The contract is in `opportunity-management.openapi.json`. Existing `data.opportunities`
and `data.application` fields, populated public provider fields and matching score
fields are preserved. List endpoints add total/page/limit/pages metadata. Existing
frontend files are unchanged; new saved, eligibility and history controls require
the separately maintained frontend workflow.

| Method/path below `/api` | Behavior |
| --- | --- |
| GET `/opportunities` | Public current verified-provider listings, literal q/skill/location, type, workMode, providerId, deadlineFrom/deadlineTo, isPaid/isFree, page/limit, newest/deadline ordering |
| GET `/opportunities/scholarships` | Same public filters restricted to scholarships; default earliest-deadline order |
| GET `/opportunities/mine` | Verified provider's own drafts/open/closed/expired sources; type/q/status, page/limit and batched application counts |
| GET `/opportunities/matched` | Student-only global rule-score ranking; same content filters, page/limit, stable ties, original skill/resource fields and method/version metadata |
| GET `/opportunities/:id` | Public currently open detail and existing targeted view-count increment |
| POST `/opportunities` | Verified provider publishes a supported current service; server owns providerId and initial revision |
| PUT `/opportunities/:id` | Current owning verified provider edits; optional expected revision; scholarship award guard retained |
| DELETE `/opportunities/:id` | Owner removes an empty source, or closes an ordinary source with applications while retaining its history; response adds retained boolean |
| GET `/opportunities/saved` | Current student's saved entries, including unavailable placeholders; page/limit |
| PUT `/opportunities/:id/saved` | Idempotent save of a currently public source; body empty, no arbitrary owner ID |
| DELETE `/opportunities/:id/saved` | Idempotent owner-only unsave even after the source disappears; body empty |
| GET `/opportunities/:id/eligibility` | Current student receives formal checks, current duplicate-application state and advisory matching explanation for a visible source |
| POST `/applications` | Existing student submission; ordinary sources now enforce explicit eligibility and append real initial history in the same transaction |
| PATCH `/applications/:id/status` | Existing owning-provider decision; ordinary transition rules, optional expected revision and atomic history/notice |
| GET `/applications/:id/history` | Applicant or actual source owner only; paginated private status history; administrators and unrelated accounts have no automatic access |

Public search defaults to 20 results, maximum 100; matched defaults to 20, maximum
50 and at most 100 pages (5,000 retained ranked candidates). Saved lists use maximum
100 and status history maximum 50. Other lists allow at most 10,000 pages. Saved
state is limited to 500 entries per student. Search terms are bounded to 80 characters
and escaped as literal, case-insensitive text. Arrays/operator-shaped queries,
unknown filters, malformed IDs, invalid booleans and excessive bounds return 400.
Lists sort by a deterministic unique ID tie-breaker for unchanged data; pages are
not a cross-request snapshot of a changing catalogue.

Compatibility changes are intentional: feeds are now paginated rather than
unbounded, invalid filters return 400 rather than being silently ignored, and new
ordinary application input rejects unsupported fields. Older clients may omit
revision for ordinary decisions and listing edits; writes remain serialized, but
clients should send revision to detect stale forms. New frontend pagination and
conflict/reopening controls are integration dependencies, not implemented screens.

## Publication, identity and expiration

Writes preserve the provider service matrix, but verify the current account,
verification and selected offerings inside the transaction as well as middleware.
The creator cannot supply another provider ID. Public feeds, matching and saved
detail require an active provider role, verified flag and VERIFIED status, plus any
enrolled email gate. Provider credibility means that provider verification is
current; it does not certify an opportunity's claims or independently verify a
faculty identity. Public provider DTOs retain the existing explicit allowlist and
never expose account email, contacts, evidence, decisions or future private fields.

Application deadlines accept a real `YYYY-MM-DD` (UTC midnight) or an explicit UTC
timestamp with seconds and optional milliseconds. Invalid rollover dates, local
timestamps and offset timestamps are rejected; clients must convert local times
to UTC before sending. Open/draft publication needs a strictly future deadline;
expired is server-derived. At equality, a source no longer accepts applications.
Closed/expired records can be closed or extended/reopened explicitly without a
future-date requirement blocking closure. Extending an expired stored record does
not itself republish it; set status open explicitly.

Expiration is now logical: every relevant discovery query checks deadline > now,
and owner lists/dashboard derive expired status from the deadline. Public reads
and the provider dashboard no longer run global updateMany expiration writes.
Stored status may remain open after its deadline; query by status **and** deadline
when integrating other modules. Existing targeted public view-count increments
remain. No global expiry migration or production rewrite was run.

Ordinary sources with applications are retained on provider deletion as closed
records. Admin removal also sets a withdrawal flag; the owner cannot republish
that moderated record or accept more applicants from it. New applications still
require an open, unwithdrawn, current verified-provider source. Existing applicants
can receive human decisions after a normal deadline/closure; expiration does not
erase applications or automatically reject them. Scholarship deletion/award
retention and capacity protections remain the existing policy.

## Explicit eligibility and advisory matching

Ordinary opportunities may publish `eligibility` with degrees (ict/et/bst/other),
institutions, mandatory requiredSkills and integer minStudyYear/maxStudyYear.
Bounds are 1–6 study years, at most four degrees, 20 institutions and 20 mandatory
skills, checked at both the API and model validation boundaries. Missing rules default to unrestricted degree/institution/skills and normal
student study years. Requirements are checked against the current active student
profile during both submission and acceptance. Failure returns explanation text;
it never inserts a rejected application on the student's behalf.

Top-level requiredSkills remain **preferred matching inputs**. A student can apply
with missing preferred skills unless they are explicitly mandatory under eligibility.
GET eligibility reports each formal check separately from advisory matching and
alreadyApplied/canApply. Unavailable/draft sources return 404 without leaking their
private terms. Scholarship eligibility comes from the existing ScholarshipPolicy
service; generic eligibility cannot be substituted for it, and evidence/award
requirements and human review remain separate. No automatic award is introduced.

Opportunity type and mandatory eligibility are frozen once applications exist.
Changing those terms requires a new listing, preventing an existing applicant's
requirements and history semantics from being silently rewritten. The existing
stronger scholarship term/deadline/award-capacity guard also remains active.

Matching retains its 60% skills, 25% career relevance and 15% location weights and
the original career/location logic. Version 2 changes skill identity deliberately:
known aliases such as React/React.js/React JS, Node.js/nodejs, JS/JavaScript and
TS/TypeScript compare consistently; Java/JavaScript, C/C++/C# and SQL/NoSQL remain
distinct. Blank legacy requirements and duplicate aliases do not inflate the score.
Blank locations remain neutral. Curated learning hints use the same exact alias
identity; unknown labels use an encoded search fallback. No social scraping, AI
claim, LLM call or predictive decision is introduced.

To preserve a true global ranking without loading the whole catalogue into memory,
the matching API streams filtered, visible candidates in database batches of 100
and retains only the best page*limit rows, at most 5,000. Score ties use createdAt
then unique ID. It never ranks only a recent sample and presents it as complete.
This still scans/scores all matching candidates, with O(catalogue) CPU and bounded
retained result memory; it is not a production search index or large-scale matching
cache. Search aggregates have a 10-second database execution limit and fail with a
sanitized 503 on infrastructure failure. Production scale/latency needs measurement
and potentially a separately reviewed indexed search/matching strategy.

Existing stored scholarship assessment snapshots are not recalculated or rewritten.
New assessments or explicit recalculations use the corrected match logic. The version
change may alter advisory fit for ambiguous/duplicate skills; it does not change
published policy weights or automatically change an allocation decision.

## Private saves and real application history

SavedOpportunity has a unique student/source constraint. Duplicate saves preserve
the initial timestamp; unsaving an absent record is successful. Save authorization,
source availability and the 500-entry quota are checked transactionally under the
student/provider coordination locks. Unsaving takes the student lock shared by
notification delivery. Other users' saved IDs, counts and choices are never queried
for a client. Missing, draft, expired, unverified or withdrawn sources become
`{ availability: unavailable, opportunity: null }` while retaining the owner's saved
ID/time and source ID, so the owner can remove them without exposing new terms.

New ordinary submissions set statusHistoryVersion 1 and notificationRevision 0 and
write a real submitted ApplicationEvent. Every changed human decision writes a
unique application/revision event with actor, from/to status, timestamp and reason.
Status-only legacy clients receive a truthful default reason identifying that no
reason was supplied; their actor is still recorded. Idempotent repeats add no extra
history or notices. A supplied stale revision fails even when the desired status
already matches. No synthetic legacy history or historical timestamp is invented.

| Current ordinary status | Allowed changed status |
| --- | --- |
| applied | reviewed, accepted, rejected |
| reviewed | accepted, rejected |
| accepted | reviewed (reason required), rejected |
| rejected | reviewed (reason required) |

Resetting to applied, directly accepting a rejected application, and ordinary
waitlisting are rejected. Reopening requires a plain-text reason of 10–1,000
characters. Scholarship transitions retain their separate reviewed policy.

GET application history only exposes the applicant's or owning provider's records,
with no administrator shortcut. For scholarships it adapts existing submitted,
decision and appeal-reopening events while excluding evidence references, priority
override details and policy snapshots. Legacy ordinary applications are marked
historyComplete false and have an explicit current-status snapshot notice; future
recorded events do not falsely make their earlier history complete.

## Transactions, reminders and operational boundaries

Ordinary submission/status changes use the existing replica-set transaction model.
They lock affected User records in sorted ID order, recheck current authorization,
then serialize on the source Opportunity. Provider verification/profile updates,
suspension and relevant application/listing writers share these coordination points.
Concurrent duplicate submissions have one database winner; concurrent decisions
with the same expected revision have one successful result. Status/source changes,
history and notification enqueue commit together; enqueue failure rolls them back.

Submission/status events reuse the durable application notification category.
The reminder worker adds a bounded, rotating saved-opportunity cursor. It scans at
most 100 saved entries per tick, advancing over nondue/missing records and wrapping.
For deadlines in the next 24 hours, it enqueues once per saved-entry/exact deadline.
Delivery rechecks the same saved entry, owner role and enrolled email gate, current
source deadline/status/withdrawal, provider verification and absence of a submitted
application. Unsave, closure, deadline extension, application submission or provider
withdrawal suppresses stale pending reminders. Saving anew creates a new owner
record and may produce a fresh reminder; it cannot resurrect the removed record.

The seven existing preference categories remain unchanged: saved deadline alerts
use the application category and sourceType opportunity. Canonical notices contain
no applicant justification, human decision reason, evidence or private source text;
the href is the existing `/opportunities` route. No email delivery or new frontend
notification controls are added. Queue delivery remains asynchronous and scan-lag
dependent; there is no guarantee of an exact reminder instant. Monitor worker lag
before enabling deadline promises on a large catalogue.

Database changes are additive: SavedOpportunity (three indexes), ApplicationEvent
(two indexes), two Opportunity list indexes, optional eligibility/revision/withdrawal
fields, and an optional Application history marker. Notification source enums accept
opportunity and producer keys accept a fourth cursor. There is no destructive
migration, syncIndexes, source backfill or modification to normal app records.
Before rollout, verify backups, replica-set transaction support, expected index
creation permissions/load and existing provider verification data compatibility.
Direct unsupported database writers bypass the service lock/validation guarantees.

Rollback: pause notification workers before reverting across this phase; an older
worker cannot validate saved-opportunity reminder sources. Retain added collections,
fields, indexes and pending notices for forward recovery. Restore this phase's worker
before resuming pending saved reminder delivery, or use a separately approved
operational queue plan. Do not purge records/indexes or restore production backups
without explicit approval. Earlier frontend dependency advisories remain a separate
workflow; this phase does not claim overall production readiness.

The existing unpaginated legacy application list/priority-review endpoints remain
compatible; their broader performance work and the Phase 10 analytics redesign are
outside this change. Phase 9 events are not implemented here. Actual unit/API,
compatibility/browser, build/type and security evidence is recorded in the PR after
execution; no test should be counted as passing merely because its file exists.
