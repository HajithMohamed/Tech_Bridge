# Phase 10 — Platform analytics backend

Baseline: fetched development `c332f7a`, after merged Phase 9 PR #34. The merge
tree matches tested event head `30ace24`. Implementation is isolated on
`feature/platform-analytics-v2`; the original workspace contains unrelated work.

| Existing implementation | Audit finding | Acceptance criteria |
| --- | --- | --- |
| GET /api/dashboard/stats | Real counts, but all roles receive global private application distributions; no date filters or analytics tests | Preserve response keys while enforcing role scope; current public discovery counts only for students |
| GET /api/provider/dashboard | Own data, but loads all opportunities and distinct student IDs; ignores current resource intake rules and creator campaigns | Database aggregates, bounded safe recent DTOs, consistent source ownership and effective statuses; retain legacy keys |
| Student analytics | No dedicated scholarship/resource/mentorship summary | Own records only, bounded distributions, explainable recorded versus legacy outcomes |
| Admin analytics | No dedicated multi-module aggregate endpoint | Platform account, verification, award, resource, pending-request and moderation counts, without private document/message contents |
| Filtering/consistency | No analytics window contract | Strict UTC cohort filtering, exclusive end, snapshot reads, empty datasets produce zeros |

This phase adds backend analytics and keeps the existing frontend design. No
production migration, demo seeding, destructive index synchronization or normal app
database writes are performed. Phase 11 is outside this branch.

## Endpoints and access

| GET path | Scope |
| --- | --- |
| `/api/dashboard/analytics` | Derive the caller's student/provider/admin scope from the current database account |
| `/api/dashboard/analytics/student` | Student only: own applications, scholarships, resource requests, mentorship, visible creator invitations and public discovery counts |
| `/api/dashboard/analytics/provider` | Verified provider only: owned listings, received applications/requests, mentorship and creator campaigns |
| `/api/dashboard/analytics/admin` | Administrator only: platform counts, account/verification/pending queues and moderation summaries |
| `/api/dashboard/stats` | Existing impact response keys retained; private counts/distributions now follow the caller's scope |
| `/api/provider/dashboard` | Existing stats/recentOpportunities/recentActivity keys retained; bounded source-owned activity and additive confirmed-outcome/creator counts |

Normal JWT sessions, current token version, account status, required email
verification and current provider verification are checked. Verification-only
sessions cannot access analytics. Each snapshot rechecks the caller's account;
role-specific endpoints additionally reject other roles. No caller-supplied role,
owner ID, institution, arbitrary group field or MongoDB operator is accepted.
Responses are private and `Cache-Control: no-store`. No shared result cache is added.

Only aggregates reach the new summary endpoints: no names, emails, contact details,
message previews, financial evidence, justification, need/priority scores, claim or
appeal/dispute statements, admin reasons, session tokens, raw student IDs or private
campaign/mentorship descriptions. Administrators receive aggregate counts rather
than automatic access to private messages or source documents. Provider recent
activity is the existing narrow DTO: owned listing titles, source IDs, dates and
statuses, capped at four recent opportunities and six combined activity entries.
Application/resource source ownership is checked against both the record's stored
provider ID and the actual referenced listing before provider aggregation/activity.

## Window and snapshot semantics

Query parameters are either absent (all time) or both `from` and `to`, using UTC
timestamps such as `2026-10-01T00:00:00.000Z`. The interval includes `from`, excludes
`to`, must increase and cannot exceed 366 days. Future windows are permitted and
produce zeros unless matching records actually exist. Unknown/repeated/nested fields,
ambiguous calendar strings, arrays and invalid dates are rejected with 400.

This is a **creation cohort summarized by current recorded status**, not a historical
state reconstruction or a flow of decisions made during the period. Applications
use immutable appliedAt; other entities use createdAt. For example, a January
application accepted in March remains in the January cohort as currently accepted.
Changing updatedAt does not move a record between cohorts. A date-bounded user count
means accounts created in the interval, not people online during that interval.
Missing creation dates cannot be invented into a bounded cohort.

One read-only MongoDB snapshot transaction covers the account and all module reads,
including legacy provider recent activity. Operations on a session are sequential.
generatedAt is the request's server timestamp, not a historical database timestamp.
Replica-set transaction support is required, as in the approved allocation modules.
A test commits a request between module reads and verifies it appears only in the
next response. Analytics does not mutate counts, statuses, actor versions, audit or
outbox records. Derived opportunity expiry/withdrawal never saves back to a listing.

## Metric definitions

| Group | Meaning |
| --- | --- |
| applications | Current status counts for cohort application records; scholarships are a subset, not an additional application count |
| scholarships.confirmedAwards | Current accepted scholarship with a valid source owner/type, a recorded awardedAt no later than request time, and the corresponding accepted ScholarshipEvent at the current decision revision, authored by the owning provider |
| scholarships.acceptedWithoutAwardRecord | Accepted scholarship rows lacking that proof; not silently presented as confirmed awards |
| resourceRequests.confirmedAllocations | Accepted/completed request with a source owned by its stored provider, a matching reserved allocation snapshot and an accepted ResourceEvent or explicitly confirmed legacy return event from that provider |
| resourceRequests.currentAllocations | Confirmed accepted allocations whose inventory has not been restored |
| resourceRequests.returnsConfirmed | Confirmed completed allocations with returnedAt and inventoryRestoredAt |
| resourceRequests.overdue | Confirmed accepted returnable allocations with an un-restored, past dueAt; not inferred from every accepted request |
| resourceRequests.acceptedWithoutAllocationRecord | Accepted/completed rows without confirmation, reported separately from actual inventory allocations |
| resources.availableListings / availableUnits | Accepting, unpaused/unwithdrawn listings versus the sum of their remaining stock; zero stock and past donation/sponsorship deadlines are excluded; current owner verification is required |
| opportunities.byStatus | Effective current draft/open/closed/expired; admin withdrawal yields closed, and an elapsed open deadline yields expired without a database write |
| opportunities.discoverableOpen | Open before the deadline, unwithdrawn, under a currently verified/active provider; distinct from an open status on an inaccessible source |
| opportunities.expiringSoon | Unwithdrawn open records closing in the next seven days; a provider's owned subset or admin operational status count |
| mentorship | Participant/owner current-status counts and recorded scheduled future starts; not a guarantee that a withdrawn mentor remains bookable |
| campaigns | Actual stage, with the existing legacy delivery-status mapping; students never count provider drafts addressed to them |
| accounts.activeAccounts | Non-suspended database accounts, not live/online users |
| accounts.verifiedProviders | Current provider role, verified flag plus VERIFIED status, active account and any required verified email; not proof that a seeded directory identity is a real independently verified person |
| pendingRequests / pendingReviews | Current pending cohort application/resource/mentor/invitation/account/claim/appeal/dispute rows; not historical arrival counts or a claim that all rows are immediately actionable |
| moderation | Current report status/target distributions and count of recorded administrative audit actions; no complaint/evidence content |

Every fixed distribution includes zero-valued states and an unknown bucket for
malformed/unrecognized legacy statuses. Arbitrary stored status strings never become
response keys. Missing/mismatched sources remain unavailableSources in student/admin
application/request history and cannot become confirmed benefits. Providers never
receive those mismatched rows. Counts use safe integers and fail closed on invalid
or overflowing numeric results. No percentages, currency conversion, payout totals,
payment processing or inferred financial outcomes are introduced.

Legacy compatibility has explicit scope changes. Impact totalApplications and
applicationsByStatus are own/owned/platform for student/provider/admin, respectively.
Student totalStudents is the actual caller account (or zero outside its creation
cohort), provider totalStudents is unique accepted students on owned valid sources,
and admin totalStudents is the platform student count. Student listing counts cover
only currently public discovery; provider/admin resource totals cover their listing
scope. Empty legacy distributions remain `{}`. New summaries retain stable zero
buckets. Existing frontend labels do not yet consume scope/filter metadata; a
separately approved UI update can use the dedicated role summaries and correct labels.

Provider legacy paidProjects remains the job/freelance/promotion listing count, not
confirmed payments. Existing accepted request/student counts retain recorded-status
semantics; additive confirmedResourceAllocations and confirmedScholarshipAwards
expose stronger outcome evidence. No legacy records are backfilled into fake proof.
History may be incomplete: absence of confirmation means unconfirmed, not necessarily
that no real-world support occurred. Cancellation/reopening can remove current
confirmed-award eligibility; these counts are not an immutable lifetime award ledger.

## Query efficiency and database compatibility

Counts/distributions/distinct-student cardinality are calculated in MongoDB. The
server does not materialize full opportunity lists or student ID sets. Lookup source
projections are minimal; summary arrays are bounded by fixed enum distributions.
Each aggregate has maxTimeMS=5000 with disk spilling disabled; a failed query produces
a sanitized 503 and no partial dashboard. These limits are operational protections,
not response-time guarantees or evidence of production-scale performance.

Fifteen additive nonunique indexes support owner/date or cohort/pending ranges:

| Collection/model | Added index patterns |
| --- | --- |
| Application | studentId/appliedAt; providerId/appliedAt |
| ResourceRequest | studentId/createdAt; providerId/createdAt; createdAt |
| Resource | listedBy/createdAt; createdAt |
| Opportunity, Mentorship, PromotionRequest, User, Report, AuditLog | createdAt (one on each) |
| ScholarshipAppeal, ResourceDispute | status/createdAt (one on each) |

Existing source-ID, event/history and owner/date indexes are reused for joins and
recent queries. A real explain test verifies an indexed selective owner/date plan
examines at most two documents among 101 application rows. It does not guarantee
every future production planner choice. All-time platform aggregates still scale
with record volume; monitor latency and consider reviewed rollups only when measured
production volume justifies them. No new collections or persistent metric fields
are introduced. Direct unsupported database writers can bypass source integrity.

## Rollout, rollback and verification

Before rollout, review backups, replica-set support, index build permissions/load
and the privacy-related change from global to role-scoped impact distributions.
Create additive indexes in a reviewed deployment window; no production index build,
syncIndexes, migration or destructive history rewrite was performed here. Existing
source/index data remains compatible with the previous release.

Rollback requires preserving the privacy fix: the old impact handler exposes global
private distributions to ordinary accounts. Prefer forward repair or temporarily
disable the analytics routes while reviewing a rollback rather than silently
restoring that behavior. Keep additive indexes and all source/audit data for recovery;
do not delete production data/indexes or restore a backup automatically. Existing
notification workers/enums are unchanged by this phase.

The OpenAPI contract is [platform-analytics.openapi.json](platform-analytics.openapi.json).
Unit tests cover cohort boundaries, safe metric calculations and account rules.
Real API tests cover scope/ownership, empty datasets, source proof, actual award and
allocation workflows, legacy campaign mapping, pending queues, snapshot isolation,
indexed queries, source immutability, bounded legacy DTOs and sanitized failures.
Actual executed totals, regression/browser/type/build/lint/security results are
recorded in the PR after execution. Existing frontend dependency advisories remain a
separate readiness issue. No overall production-readiness claim or Phase 11 work is
included in this branch.
