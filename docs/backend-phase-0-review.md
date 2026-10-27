# Backend master plan: Phase 0 messaging review

Review date: 2026-10-27. This report implements only Phase 0 of the newly supplied
backend master prompt. No later phase was started and no frontend file was edited
during this review. Existing frontend work in PR #22 is retained.

## 1. Repository and phase information

| Item | Verified state |
| --- | --- |
| Current remote development | `eb6648635aca346209a55d261009146d4abf480a` |
| Current remote main | `a64642882610059519e45a1eb11931fb0f56ddc1` |
| Existing feature branch | `feature/internal-messaging` |
| Reviewed implementation commit | `09a9bdb9d16c6ef8a3e7ea6efc2d1b8234733e7e` |
| Original feature baseline | `6ca69f9` (same source tree as current development) |
| Existing PR | [#22](https://github.com/HajithMohamed/Tech_Bridge/pull/22), base `development` |
| PR state at review | Open, non-draft, unmerged, GitHub reports mergeable |
| Review changes | Backend API documentation and this report only |
| Approval | Pending; no merge performed |

Fetched all remotes before review. Main/development have 4/25 unique history
commits respectively; this is not a reason to force-pull or integrate into main.
Open PR #15 proposes development into main and is outside this workflow.
The local development branch is older; it must be fast-forwarded after an approved
merge before any new phase branch is created. This phase reuses the existing PR.

The original `fix/workspace-usability` working tree contains unrelated uncommitted
work. It was not discarded, reset, stashed, switched or overwritten. Review/tests
run in a clean worktree on the existing messaging branch. Installed dependencies
and the MongoDB binary cache are reused; test database names/connections remain
owned, disposable and independent of the normal application configuration.

## 2. Updated development checklist

These are scoped assessments from current code/routes/tests and PR status, not
claims that an entire product phase works merely because files exist.

| Master phase | Current verified baseline / next step |
| --- | --- |
| 0: Messaging review | Earliest unfinished approval/integration step. PR #22 has the enhanced implementation and passing historical CI; review it here, then stop for approval. |
| 1: Dependency/security hardening | Outstanding. Fresh backend audit has critical/high/moderate findings. Create only after #22 approval/merge, from updated development. No dependency changes in Phase 0. |
| 2: Creator profiles | Legacy opt-in profiles/discovery are in development. Draft #25 adds API validation/privacy/filtering but is unmerged; reuse/inspect that work when this phase is reached. Its remaining UI dependencies do not authorize frontend edits in this workflow. |
| 3: Collaborations | Legacy promotion requests are in development. Draft #26 adds partial transactional workflow and pending notices, not the complete planned lifecycle. Unmerged; reuse after the creator phase is approved/merged. |
| 4: Scholarship priority | Atomic award-capacity protection is merged through #13. Priority weights remain fixed 40/30/20/10 and waitlisting is computed; configurable policy, persisted waitlists, confidential evidence, appeals and decision history remain. |
| 5: Resource lifecycle | Atomic reservation protection is merged through #12. Existing requests/decisions are reusable; return policy/inventory restoration, deadlines/overdue/disputes, persisted waitlists and audit lifecycle remain to be completed. |
| 6: Notifications | Messaging unread totals and verification history notices are scoped features. No centralized notification model/API/worker is merged. The pending campaign outbox exists only in draft #26. |
| 7: Mentorship | Verified faculty/alumni identity/consent and mentorship opportunity types exist. Availability, request/booking model, conflict-safe scheduling, rescheduling/cancellation/history are not a completed backend system. |
| 8: Opportunities | Listing/application APIs, duplicate constraints and rule-based matching exist. Saved opportunities, full status history, eligibility/deadline/expiry policy and notification events need the planned extension. |
| 9: Events | No event/registration/capacity backend model or routes in the inspected baseline. Future phase. |
| 10: Analytics | Counts/aggregations use database records. The aggregate dashboard route is authenticated but not yet a complete role-scoped/date-filtered analytics system. Extend existing queries rather than introduce fake statistics. |
| 11: Release readiness | Future integrated regression, contracts/OpenAPI, security, indexes/load/operations, deployment, backup and rollback review. No deployment or main merge authorized. |

Already merged/reusable foundations include repository hygiene/testing CI (#4/#6),
admin management (#14), provider verification (#16), community identity claims
(#19/#21), Docker/admin local setup (#17/#18/#20), resource atomicity (#12) and
scholarship atomicity (#13). Their presence does not make later roadmap phases
complete or remove their regression requirements.

Other open work is preserved: #23 is a UI/usability PR outside backend-only scope;
#24 is an unmerged auth-recovery draft with registration-contract regression
failures; #25/#26 are unmerged creator/campaign drafts with incomplete requirements.
No new branches for future phases were created by this review.

## 3. Code review and reused behavior

The implementation already in #22 is reused. No messaging module was recreated.

| Concern | Code inspected and observed behavior | Relevant automated evidence |
| --- | --- | --- |
| Creation and persistence | `messaging.ts` locks both users in stable order, rechecks permission, reuses the unique pair, and writes each message/conversation timestamp atomically. | Competing starts, allowed relationship types, unavailable recipients, transaction rollback, minute/hour/new-conversation quotas. |
| Participant privacy | `messageController.ts` filters list/history/read/send by actual participants; administrator role does not grant a transcript bypass. Responses project limited peer fields. | Outsider/admin history/read/send/typing rejection, owned-only search and metadata, foreign cursor rejection. |
| Current consent and blocking | `messagingPolicy.ts`, `communityMessaging.ts`, settings routes and shared account locks enforce both parties' blocks, receiving opt-out and current faculty/alumni identity/visibility/student-initiation rules. | Both-direction blocks, opt-out/block races, idempotent unblock, block cap, community withdrawal/identity/verification regression cases. |
| Validation and pagination | Canonical IDs, bounded trimmed text/control-character rules, literal search, bounded numeric pages, 40-message older cursors and deterministic timestamp/ID ordering. | Input boundary tables, pagination with equal timestamps, no duplicate/foreign history, literal search and bounded list pages. |
| Reads and unread notices | Read receipt uses the displayed throughId boundary; unread totals join only owned conversations. Receiving and notice preferences remain separate. | Receipt boundaries, persisted readAt and unread count, notification opt-out. |
| Live authorization | `messageEvents.ts` authenticates streams through normal protect, revalidates current JWT/version/account/provider status for hints/heartbeat, checks typing participants/blocks/community consent and never transports message bodies. | Invalid/restricted/revoked/suspended sessions, owner-only hints, arbitrary query room ignored, blocked typing, stream limits, shared-worker delivery. |
| Live update ordering | A refresh arriving during asynchronous typing authorization is retained as a trailing refresh. Durable API state recovers missed signals. | Dedicated overlapping typing/refresh regression and existing independent-session Chromium flow. |
| Message reports | Only incoming messages in the reporter's own conversation can be reported; duplicates and daily quotas are enforced. | Self/foreign reports, duplicate/index behavior, daily cap and invalid legacy complaints. |
| Narrow administrative review | `messageReports.ts` requires an open valid complaint, independent current admin, access reason and committed access/audit records before returning exactly the reported message. No neighboring content/contact data. | Exact evidence allowlist, unauthorized/self-review denial, audit-failure rollback, prior-access requirement and closed-report access refusal. |

Read middleware, route mounts, controllers/services, all six relevant messaging/
report models, policy tests and actual MongoDB integration tests. Existing frontend
client/stream behavior is represented by its already committed tests and CI; no
frontend source, routing, layout or styling was changed in this review.

## 4. API and database documentation

Added [`backend/docs/messaging.openapi.json`](../backend/docs/messaging.openapi.json),
OpenAPI 3.0.3, documenting 11 path items and their operations: authentication,
authorized roles/participants, request body/query/path rules, success/error shapes,
models, quotas, privacy and transaction behavior. JSON and all local schema
references were checked. Existing endpoint behavior is unchanged.

The contract covers conversation start/search/history/send/read/typing, owner
settings/blocking/unread summary, authenticated SSE and the message-specific
report/evidence/resolution workflow. It distinguishes legacy report POST's generic
500 from messaging service 503 responses, and does not falsely claim explicit
no-store headers for legacy report creation/resolution. The existing directory
alias remains governed by the community-verification contract.

The original PR adds MessagingSettings (owner unique), MessageReviewAccess
(report/time index), and MessagingSignal (expiry TTL), message chronological/rate/
unread indexes, conversation participant-order/initiator indexes, and the optional
internal User.lastTypingAt field. The unique conversation pair remains intact.
No additional model/index/migration is introduced by this review. Full field/index
and rollback details are in [the implementation report](internal-messaging-review.md).

Deployment requires a coordinated API/client release, transaction/change-stream
capable MongoDB, reviewed index application and an authenticated unbuffered SSE
proxy. TTL deletion is asynchronous; expired hints are ignored before cleanup.
No production migration, index deletion, backfill, credential/role change or data
deletion was performed during Phase 0. Preserve block/consent authorization on
rollback; disable message writes if reverting to an older unsafe backend.

## 5. Verification and limitations

Executed source/test typecheck and backend build. MongoDB Memory Server owns replica sets with
random `techbridge_test_...` names; it refuses production or normal development
URIs. Existing tests are retained and no timeouts/assertions were weakened.

Fresh local execution on the reviewed implementation:

| Check | Passed | Failed | Skipped / reason |
| --- | ---: | ---: | --- |
| Backend unit | 281 | 0 | 0 |
| Backend integration | 189 | 0 | 0 |
| Repository policy | 9 | 0 | 0 |
| Source and test TypeScript | Pass | 0 | None |
| Backend production build | Pass | 0 | None |
| API JSON/local-reference validation | Pass | 0 | None |
| Backend lint | Not run | - | No backend lint script exists |
| Local frontend / Chromium | Not rerun | - | No frontend changes; existing full compatibility suite runs again in review-head CI |

Integration completed all ten files without a timeout or failure. Test failures
from unrelated auth-recovery draft #24 are not imported into or hidden by this
branch. Current review-head CI results, its exact head SHA and required checks are
reported in PR #22 after the documentation commit is pushed.

Historical implementation CI for 09a9bdb passed all 545 cases: backend unit 281,
backend integration 189, frontend unit 10, frontend integration 46, Chromium 10,
repository policy 9. Sources: [Application checks](https://github.com/HajithMohamed/Tech_Bridge/actions/runs/40352245482)
and [Repository security](https://github.com/HajithMohamed/Tech_Bridge/actions/runs/40352245499).
Current review-head CI is a separate verification recorded in the PR.

No additional messaging defect requiring an implementation change was found in
the reviewed permission/privacy/transaction paths and covered scenarios. This is
not a claim that all security, scale, recovery and production risks are eliminated.

Current backend runtime dependency audit on 2026-10-27 exits nonzero: **4 affected
packages: 2 critical, 1 high, 1 moderate**. Express inherits the affected dependency
paths; the packages are proxy-addr, body-parser, qs and Express. The new body-parser
finding postdates the older implementation report's scan. Current npm reports a
compatible fix available for proxy-addr; the advisory names 2.0.8. body-parser's
advisory names 2.4.0/1.20.9 fixes, even though npm does not report an automatic fix
for this lockfile path. Do not infer "no fix exists" from that flag.

Primary advisories: [proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h),
[body-parser](https://github.com/advisories/GHSA-27r3-jxmh-p828),
[qs parsing](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx) and
[qs object handling](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g).
The body-parser advisory describes an unauthenticated process-crash path through
compressed request parsing. This is a production release blocker for Phase 1;
no payload was sent to the normal app or production. The baseline does not enable
trust proxy and messaging quotas use database account IDs, but that does not waive
dependency remediation. No package/lockfile changes were made in Phase 0.

Other limits already documented: unbuffered proxy configuration, per-worker stream
caps, database-backed counters but no general HTTP throttling, monitoring and load
testing, retry/refresh rather than durable event replay, 200 blocked IDs, and no
centralized/email notification system. New future backend phases must request
separate authorization if a required frontend dependency cannot be avoided.

## 6. Approval and next action

Review documentation is pushed on the existing messaging branch and PR #22 remains
targeted at development. No phase is marked merged until GitHub confirms a merge.
Do not merge with failing checks. After explicit approval and passing checks,
merge #22 through GitHub, fetch/verify development and fast-forward the local
development baseline. Only then begin Phase 1 on `chore/dependency-hardening` from
the newly approved origin/development. Do not activate or recreate future draft
branches now. No automatic main merge or deployment.
