# Phase 5: resource allocation and physical returns

Branch: `feature/resource-management-v2`. Base: approved development
`8226da9571751c1a71dd9ece727e3a6c2b9a8d7b`, after scholarship PR #28 merged.
This phase extends the existing Resource/ResourceRequest models and atomic
reservation service. It does not replace the marketplace or change frontend files.

## Audit and acceptance criteria

| Area | Existing behavior | Required and implemented behavior |
| --- | --- | --- |
| Reservations | Transactional one-unit decrement and same-student category lock; tested | Preserve both protections, serialize returns and inventory edits with the same records |
| Submission | Uncoordinated active-category lookup; limited validation | Transactional student/owner checks, category duplicate protection, dates, deadlines, validated fields |
| Ownership | All completions leave stock consumed | Preserve transfers; add explicit return handling only for returnable property |
| Dates | Free-text terms only | Requested dates, immutable allocation dates, bounded loan/rental deadlines, derived overdue flag |
| Waitlist | Display-time capacity flag | Persistent waitlisted membership, ranked queue, explicit human advance and reasoned overrides |
| Priority | Fixed rule-based score, relative timing, string IDs in benefit aggregation | Reuse default weights, fixed-window snapshots for new requests, actual ObjectIds and stable ties |
| History | Current status only | Append-only transactional resource domain events and private request history |
| Disputes | Missing | Scoped complaint records, open-dispute guard, resolution/withdrawal history |
| Listing updates | Absolute stock set and delete could race with allocations | Revision guard with active allocations, audited free-stock adjustments, pause semantics and retention |
| Moderation | Hard deletion orphaned active requests | Withdraw and retain applied listings; allow legitimate returns without reopening public access |

Acceptance requires real-Mongo tests for simultaneous approvals, cross-listing
category requests, duplicate return confirmations, stock-edit/return races,
ownership changes, audit rollback, private data restrictions and legacy clients.
The previous reservation tests remain in place; no assertions are relaxed.

## Ownership and allocation lifecycle

One request reserves exactly **one** unit at owner approval, including a future
reservation. It does not reserve on submission, and it never promises that the
same physical unit is available to multiple overlapping date bookings.

- `pending -> accepted | rejected | waitlisted`
- `waitlisted -> accepted | rejected`
- `accepted -> completed` through the status endpoint only for ownership transfers
- Applicant cancellation: `pending | waitlisted -> cancelled`
- Physical returns: accepted allocation -> borrower return request -> owner
  confirmation -> completed. A return request alone never restores stock.

Borrow, share and rent arrangements require return. Donation, installment,
interest-free and default sponsorship arrangements transfer ownership and do
not restore inventory at completion. A sponsorship may explicitly use
`returnPolicy: returnable` with `returnDurationDays: 1..3650` at listing creation.
Other types cannot contradict their ownership arrangement through returnPolicy.
This is inventory accounting, not proof of legal title, payment processing,
repayment tracking, refund handling or disbursement.

Approval stores an allocation snapshot with access type, return requirement,
reservation proof and dates. Return confirmation uses that snapshot and checks
current source ownership/category/access type. A changed/missing source requires
record review; no replacement stock or ownership is invented.

The original active-benefit rule remains one accepted allocation per student and
category, enforced by the original student write lock. Pending/waitlisted/new
submissions also allow only one active request in a category. The service lock
protects new concurrent submissions across listings without introducing a unique
index that would reject existing historical duplicates. Completing a transfer
frees the active-category restriction; this is not a lifetime donation limit.

## Borrowing dates and overdue status

Optional requestedStartAt/requestedReturnAt are validated UTC ISO timestamps.
Approval accepts explicit owner startAt/dueAt or uses current time and the listing
duration. A still-future requested start is preserved; stale proposed return
dates require the owner to set a valid deadline. Starts allow five minutes of
clock skew and at most one year ahead. Loan durations cannot exceed the listed
duration or ten years; rentals use a documented thirty-day month for minimum
periods and cannot be shorter than the listed minimum. A different calendar or
payment schedule is outside this phase. Legacy missing loan terms use thirty
days; invalid existing durations block allocation for record repair.

`isOverdue` is derived from accepted status and the persisted return deadline.
Reading it never changes inventory, charges a fee or marks a physical item as
returned. A return request remains overdue until actual owner confirmation.
Historical accepted records without dates cannot honestly be labeled overdue;
their deadline is unknown. No background reminder delivery is added (Phase 6).

## Physical returns and legacy records

The borrower provides a reason and current request revision to request a return.
The listing owner confirms the actual receipt with another reason and revision.
Exactly one unit is restored in the same transaction as completion and its audit
event. Duplicate/stale confirmations conflict. Open disputes block return changes.
The original borrower need not remain active for the owner to confirm an already
requested return; suspended owners cannot mutate allocations through this API.

Existing unsnapshotted accepted loans require explicit owner
`confirmLegacyReservation: true` when confirming receipt, plus the normal reason.
This attests that the legacy unit had genuinely been reserved. No old records are
automatically backfilled, restored or relabeled. Historical completed records
cannot be reopened to create inventory. Old direct completion of returnable
property is intentionally blocked: the separate UI must call the explicit return
endpoints. Existing donation status-only journeys remain compatible.

## Availability and inventory

quantityAvailable means **free units currently offered**, excluding reserved and
permanently transferred units. Creation allows 1..1000000; explicit inventory
adjustment allows 0..1000000. It does not represent original total physical stock.
Owners are responsible for asserting real additional free units rather than
counting already allocated property a second time.

Inventory revision changes on reservation, restoration, stock/status adjustment
and administrative withdrawal. Existing status/inventory clients remain valid
when no allocation is active. While allocations are active an absolute inventory
set requires current inventoryRevision and a reason; otherwise it cannot silently
overwrite a concurrent reservation/return. Any supplied revision is checked even
without active allocations. Transactions retry on write conflicts and recheck
guards. Returned stock increments the current count, rather than replacing it.

Owner `status: claimed` deliberately pauses a listing. Automatic depletion marks
it claimed without pausing it. A physical return can reopen an automatically
depleted listing; it never reopens an owner pause or administrative withdrawal.
Restocking a paused listing keeps it paused until an explicit valid reopening.

## Waitlists and scoring limitations

Applicants can explicitly join a depleted listing's waitlist using joinWaitlist.
Owners may also waitlist a pending request with a reason. Paused, withdrawn and
expired listings reject new requests and allocations. Queue reads are owner-only,
paginated (default 20, max 50), ordered by stored score descending, original
creation time ascending, then ID. No queue read or returned unit automatically
awards a place. Advance requires request ID, revision and human reason; selecting
outside the ranked queue requires a priorityOverrideReason. Direct owner approval
remains advisory rather than universally enforcing score order.

New requests freeze score, components, explanations and calculation time. Weights
reuse need 40%, profile fit 30%, active category benefits 20%, timing 10%. Timing
uses listing creation to the sponsorship/donation deadline, or one year for
undated listings; it is clamped and later submissions do not rescale old scores.
Existing records retain the prior live scoring fallback in owner feeds, with the
benefit ObjectId bug fixed. A legacy queue record without a snapshot is unscored;
it must not be represented as an independently verified assessment.

Need is self-reported. Profile completeness, category limits, application timing
and the simple fit rule can disadvantage legitimate applicants. These rules are
not universally fair or AI. Human review remains necessary, especially where
historical records lack snapshots. This phase does not implement configurable
resource weights, automated eligibility parsing or financial-need verification.

## Confidential disputes and history

Only the applicant and current listing owner can access a request, its history or
disputes; old recorded owner ID alone is insufficient. Administrators have no
automatic private-case read override. Public listings do not expose applicant
justifications, dispute statements or request events. Protected routes are
no-store. Owner feeds now require both recorded and current listing ownership and
tolerate missing student references instead of failing the entire queue.

Participants can open a dispute on accepted/completed allocations, with a 30..2000
character statement, at most three per request and one open dispute at a time.
Opening/reviewing changes request revision. Only its creator may withdraw it;
only the listing owner may record resolution. This is a recorded participant
workflow, not independent arbitration or a finding against either party. A
resolution never changes stock, ownership or a return obligation. Statements stay
in scoped records; events link the exact dispute without copying its statement.

Request status, allocation, return and stock events commit transactionally.
Failures in domain-event persistence roll back the mutation. Admin resource
withdrawal also commits its global AuditLog entry in the same transaction.
The existing report-resolution envelope remains; non-message report resolution
itself is still the existing separate operation from target moderation.

## Schema, API and deployment

See [resource-management.openapi.json](resource-management.openapi.json) for
roles, bodies, responses, validators, models and related business rules.
New routes cover request detail/history, cancellation, returns, disputes, owner
listing inventory history and waitlist advancement. Existing submit/list/status,
listing creation/status/inventory/delete and moderation routes are extended.

Resource gains returnPolicy/returnDurationDays, inventoryRevision, availabilityPaused
and withdrawnByAdmin. ResourceRequest gains optional lifecycleVersion/revision,
proposed dates, allocation/priority snapshots, waitlist and return timestamps.
Two new collections: ResourceEvent (request/resource chronological indexes) and
ResourceDispute (unique open dispute per request and chronological index).
New request indexes cover resource/status/order and accepted due dates.

Providers/students cannot delete a listing with any request history; pause it.
Administrative removal instead retains and withdraws it when requests exist.
Direct public lookup hides withdrawn listings. Private history and legitimate
physical returns remain available; owner actions cannot reopen/restock it.
Unapplied listings can still be deleted through the existing contract.

No production records, migrations, index builds, accounts or running app servers
were changed. Review indexes/limits and legacy inconsistencies on a backup before
approved rollout. A MongoDB replica set is required; standalone deployments fail
closed. Deploy compatible writers together: old services do not enforce new loan
completion, return, dispute or pause rules. Before rollback, disable resource
mutations and use a compatible handler/forward fix; preserve records and history.
Do not restore an old database merely to undo code deployment.

New date/return/dispute/waitlist UI controls belong to the separate frontend
workflow. Notifications, independent mediation, financial repayments, recurring
reservations, serialized per-device tracking and configurable scoring remain
separate work. The existing frontend dependency advisories are unchanged.
Executed test counts and exact GitHub Actions evidence are recorded in the PR.
