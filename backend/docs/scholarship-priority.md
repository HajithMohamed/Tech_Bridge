# Phase 4: scholarship priority and human allocation

Branch: `feature/scholarship-priority-v2`, based on approved development
`111f0d27197595477e71cf38a92716954e48f15b` after PR #26 merged. Existing award
transactions, capacity checks, opportunity serialization and student benefit locks
are extended rather than replaced. Normal Docker accounts/data and the original
uncommitted workspace are untouched. No frontend files or production records are
edited and no deployment or destructive migration is performed.

## Audit and acceptance criteria

| Area | Previous implementation | Phase 4 behavior |
| --- | --- | --- |
| Weights/eligibility | Fixed 40/30/20/10 weights, rule-based fit | Provider-configured bounded weights and education/skill rules, frozen after first application |
| Priority | Live relative application timing; benefit aggregation used string IDs | Persisted explainable snapshots, shared cohort timing window, ObjectId aggregation fix, stable ties |
| Decisions | Human status update; legacy callers supplied no reason | Configured programmes require reasons and controlled transitions; legacy compatibility explicitly labeled |
| Capacity/duplicates | Existing student/opportunity transaction locks | Preserved locks/capacity fallback; configurable restrictions honor existing stricter commitments |
| Waitlist | Computed capacity display flag | Persistent waitlisted status/date, ranked queue, explicit human advance and recorded overrides |
| Evidence | No scholarship-specific evidence lifecycle | Three unique private attachments, restricted formats/size, scoped metadata and audited provider downloads |
| Appeals | Missing | Revision-bound appeals, uphold/reopen decisions, transaction history and limits |
| History/deletion | Decisions overwritten; deleting a listing could orphan records | Append-only domain events; provider deletion guard; moderated withdrawal preserves source records |

## Provider-controlled activation and backward compatibility

A provider should create a scholarship as draft, configure policy, then open it.
`PUT /api/scholarships/{id}/policy` requires the expected revision (initially 0)
and a reason. Explicit configuration increments policy revision and activates
strict decision rules for programme applications. Applicants cannot enable,
disable or spoof programme settings through request metadata. Policy settings
become immutable after the first application, including legacy applications.
Changing the rules then requires a new scholarship listing.

Unconfigured programmes retain the published legacy decision contract, including
existing status requests without a reason and existing status reversals. Their
audit entry says **no reason was supplied by the older client**, rather than
inventing a reviewer explanation. Default policy/score/timing snapshots are still
stored for new submissions; the implicit policy has revision 0. Existing browser
forms and the original scholarship decision journey remain supported.

Applications in configured programmes get server-owned `scholarshipVersion: 1`.
Changed decisions require a plain-text reason of 10-1000 characters. A supplied
expected revision must match. Exact repeat decisions remain idempotent: they do
not allocate again or rewrite the first reason. New fields are read-only to
applicants. Configured records without a marker are also checked against their
saved policy revision when reviewed; request omissions cannot downgrade them.

Strict transitions: applied -> reviewed/waitlisted/accepted/rejected;
reviewed -> waitlisted/accepted/rejected; waitlisted -> reviewed/accepted/rejected;
rejected -> reviewed; accepted -> reviewed/rejected. Moving back to reviewed or
rejected revokes the current allocation and frees capacity, with history retained.
It does not describe returned/disbursed money: these records track approvals,
not payments. A rejected application cannot jump straight to accepted.

Strict programme terms affecting scoring/eligibility/offer content are frozen
after versioned applications. Capacity retains the existing rule: it may not be
reduced below accepted allocations. Deadlines may be extended, not shortened,
for versioned applications; extensions do not rescale the original timing window.
Legacy listing-edit compatibility remains for programmes with only old records.

## Explainable scoring and fairness limits

Defaults remain need 40%, rule-based profile fit 30%, previous accepted benefits
20%, timing 10%. Providers can select whole percentages from 0 to 100 totaling
100; timing or any other component may be disabled. Supported exact eligibility
rules are degree programmes, institution labels, required skills and study-year
bounds, plus whether evidence is required before award. Free-text listing
eligibility criteria remain human review instructions, not automatically parsed.

Scores are integer 0-100 and include components, weights, reasons, policy revision
and calculation time. Need is self-declared, not verified income. Fit reuses the
existing skills/career/location matcher. Previous-benefit points decline by 40
per counted accepted scholarship, floored at zero. Timing is clamped to the common
creation-to-original-deadline window; invalid windows use neutral timing.
Applicants tie by earliest immutable application time, then ID. A reasoned
provider recalculation preserves the original policy/window and logs the result.

Snapshots prevent later submissions from silently rescaling earlier scores.
Eligibility and required evidence are checked again before award against current
student records. Score snapshots may become stale as profiles/benefits change;
reviewers can request a logged recalculation. Reads, scores, waitlists and appeals
never grant an award automatically.

These weights are not a universal fairness guarantee. Self-reporting, unequal
profile completeness, institution filters, location fit, prior-benefit penalties
and connectivity-related timing can disadvantage legitimate applicants. Tests
show that disabling timing removes the timing penalty for otherwise equal
profiles. Human review and recorded priority overrides remain necessary; no
demographic fairness certification, financial-need verification or AI is claimed.

Duplicate policies: `application_year` retains the legacy server-local January
calendar boundary based on **application date**, not award date or an institutional
academic year. `lifetime` considers all currently accepted scholarship records;
`allow_multiple` permits multiple commitments only when existing awards also allow
them. A new relaxed policy cannot void a prior accepted allocation's stricter
snapshot. Historical legacy awards default to the old application-year rule.
Revoked decisions no longer occupy capacity or count as currently held benefits.
Missing/unclassified accepted source records block an award for record review;
they are not silently assumed irrelevant. No historical data is auto-repaired.

## Persistent waitlists and human selection

`status: waitlisted` and `waitlistedAt` are persisted. The old computed
`isWaitlisted` flag can still appear on old live priority results; it does not
create queue membership. New snapshots report actual persisted membership.
The owner-only queue sorts score descending, application date ascending, ID
ascending, with bounded pagination. A missing snapshot is labeled rather than
presented as verified scoring. Capacity/remaining counts are advisory reads;
transactions recheck the actual accepted count before allocation.

Advancing requires an explicit application ID, current decision revision and
human reason. The selected application must still be waitlisted. Selecting
outside the current ranked order through this endpoint requires a documented
`priorityOverrideReason`. Ordinary direct human decisions remain advisory with
mandatory reasons in strict programmes; they do not universally enforce rank order.
No override bypasses eligibility, evidence, capacity, ownership or benefit policy.
Freed places never automatically award or promote the next student.

## Confidential evidence and appeals

Applicants can attach up to three unique documents of at most 2 MiB each, using
the existing conservative PDF/PNG/JPEG validator and safe filename/base64 checks.
Duplicate fingerprints cannot consume another attachment slot. The validator is
not antivirus or full content/identity verification; restricted active/encrypted
PDF features are rejected. The API never fetches external evidence links.

Bytes and fingerprints are excluded by default from model queries and never
included in application lists, assessment JSON, history or public listings.
Owners can list metadata/download their own evidence. Only the current verified
provider owning both application and source listing may download as reviewer,
using POST access with an audit reason. The audit includes the exact document ID
and commits before bytes are sent. Administrators have no automatic private-file
override. Downloads are no-store attachments with nosniff and a generic filename.

At-rest encryption, database/backup access, malware scanning, retention schedules
and lawful operational deletion are deployment responsibilities; no encryption
or scanning service is falsely claimed. No unauthenticated/static file route,
email delivery or confidential notification payload is introduced.

Applicants may appeal rejected or waitlisted decisions, with a 30-2000 character
statement and current decision revision. One appeal per decision and at most
three per application are enforced transactionally. While an appeal is pending,
other changed status decisions are blocked. The owning verified provider records
an uphold/reopen reason. Uphold keeps the same decision; reopening moves it to
reviewed and requires a fresh human decision, never an automatic award. Repeated
reviews and stale appeals conflict. Statements remain in scoped appeal records;
audit events link appeal IDs without copying confidential statements elsewhere.

## APIs and database changes

See [scholarship-priority.openapi.json](scholarship-priority.openapi.json) for
methods, roles, bodies, success/error envelopes, models and business rules.
New APIs cover policy/history, private assessment/history, ranked waitlists and
explicit advancement, evidence metadata/upload/download/reviewer access, appeals
and logged recalculation. Existing application/opportunity/moderation APIs retain
their envelopes while enforcing the documented new guards.

Reuses Application, Opportunity, User and the existing award transaction service.
Adds ScholarshipPolicy, ScholarshipReview, ScholarshipEvidence, ScholarshipAppeal
and ScholarshipEvent collections. Application gains optional version/revision,
waitlist date and award date; Opportunity gains a server-owned moderation
withdrawal flag. Indexes cover policy/review uniqueness, evidence app/fingerprint
dedupe, appeal app/decision uniqueness, ranking and dated history. No destructive
migration, production index build, account reset or record backfill ran.

Provider applicant feeds now require both recorded application ownership and
current listing ownership; the previous string/ObjectId benefit aggregation bug
and inconsistent tie direction are corrected. Scholarship provider deletion is
blocked once applications exist. Administrator removal (direct or via report)
closes and flags the listing while retaining application/evidence/decision source
records. It cannot be republished by the provider and no new awards may be made
from it. Existing authorized participants retain their scoped history; no admin
private-review permission is added. Non-scholarship removal retains its existing
workflow.

## Rollout, rollback and verification

Use the existing replica-set transactions and Phase 1 production configuration.
Review new index build costs, uniqueness constraints and any preexisting orphan
records on a backup before an approved rollout. Do not run destructive syncIndexes
or fabricate missing applicant data. Domain writes, revisions and audit events
commit together; failures roll them back. Student locks still serialize awards
across providers, and opportunity locks serialize capacity edits/awards, policy
freeze, evidence, queue changes and appeals. Normal app data is never a test DB.

Coordinate backend writers and UI deployment for strict programmes. Older writers
do not enforce evidence/reasons/new statuses; mixed-version writes are unsafe.
Before rolling back to an older artifact, disable scholarship mutations and
deploy a compatible version-aware handler or forward fix. Preserve evidence,
consent, policy snapshots and allocation history; do not restore an old database
backup merely to undo application code. No automatic production deployment occurs.

Frontend controls for configuration, reasons, evidence, queue overrides and
appeals belong to the separate UI workflow. Legacy default client journeys are
tested. Notification delivery, disbursement/payment accounting, retention tooling,
independent identity verification and a configurable institutional academic-year
calendar are not introduced. Existing frontend advisories remain separate work.

Unit/integration tests cover configurable weights/rules, missing data, fairness
limitations, stable ties, legacy compatibility, mutual benefit restrictions,
confidential access, document limits, concurrent last-place decisions, policy
freeze races, waitlist processing, appeals, audit rollback and source retention.
Complete executed counts and GitHub Actions evidence are recorded in the PR.
