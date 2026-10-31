# Phase 7 — Mentorship backend

## Repository audit and acceptance criteria

Baseline: `origin/development` at `d22803f`, fetched before branching. PR #30
(notifications) is merged. No existing mentorship feature branch or open PR was
found. The original workspace contains unrelated changes and remains untouched;
implementation uses the isolated `feature/mentorship-system` worktree.

| Existing capability | Evidence and classification | Phase 7 change |
| --- | --- | --- |
| Verified faculty/alumni | CommunityClaim, communityApproved/communityVisible, private evidence review and revocation; implemented and regression tested in previous phases | Reuse current identity and directory visibility; no seeded identity becomes a mentor |
| Community contact preferences | MessagingSettings, block lists, community consent; implemented | Honor blocks and contact preferences when creating or scheduling sessions |
| Mentorship opportunity listings | Opportunity model metadata and generic applications; partial mentorship support | Preserve listings and applications unchanged; add an independent session workflow |
| Appointment availability and booking | No session/calendar model or routes found; missing | Opt-in mentor profile, UTC windows, requests, approval, mutual scheduling and rescheduling, cancellation/completion and private history |
| Industry mentor authorization | Provider verification exists; person-specific mentor approval missing | Admin approval for verified individual providers, bound to current evidence, with audit history |
| Notifications | Durable outbox, inbox, preferences and worker exist | Transactional mentorship events and deduplicated appointment reminders |

Acceptance: only currently verified, explicitly opted-in mentors are discoverable;
new requests honor visibility and blocking; only the two participants can access
private sessions/history; approval belongs to the mentor; booking and rescheduling
require the other participant's confirmation; concurrent appointments cannot
overlap for either participant; cancellation releases capacity; completed history
is retained; database failure rolls back both changes and notifications. Tests
must execute against the existing disposable replica set and cover permissions,
dates, transitions, concurrency, rollback and reminder staleness.

No existing API is replaced. No frontend source is changed. No production data
backfill or migration will run. The new workflow requires a separately implemented
frontend; existing mentorship listings continue to use the existing application API.

## API and permissions

See `mentorship.openapi.json` for the request/response contract. Every endpoint
requires a normal JWT, current account/token version, provider verification for
providers, and verified email for accounts enrolled in the email-verification gate.
Verification-only tokens are rejected. Responses, including failures, are private
and use `Cache-Control: no-store`.

All paths below begin with `/api/mentorship`:

| Method and path | Authorization and behavior |
| --- | --- |
| GET/PUT `/profile` | Provider owns the profile; full replacement uses expected revision; no request may set owner/approval/identity binding |
| GET `/mentors` | Students discover currently opted-in faculty, alumni or individual mentors; literal `q`, `expertise`, exact `department`, `page`, `limit` |
| GET `/mentors/:id/availability` | Students receive free intervals without other students' booking identities or private topics |
| POST `/sessions` | Student supplies mentorId, topic and private explanation; pending request |
| GET `/sessions` | Participant history only, optional status, page and limit |
| GET `/sessions/:id` | Exactly one participant-owned record; cross-user access returns 404 |
| GET `/sessions/:id/history` | Participant-only append-only action, reason, original appointment and proposal history |
| POST `/sessions/:id/approve` | Owning mentor approves a pending request |
| POST `/sessions/:id/reject` | Owning mentor rejects pending request with a reason |
| POST `/sessions/:id/schedule` | Either participant proposes a time after approval, or proposes a replacement for a future/ongoing appointment |
| POST `/sessions/:id/schedule/accept` | The other participant confirms the proposed time |
| POST `/sessions/:id/schedule/decline` | The other participant declines with a reason; current appointment remains |
| POST `/sessions/:id/cancel` | Either participant closes pending/approved/scheduled requests with a reason; releases reserved capacity |
| POST `/sessions/:id/complete` | Owning mentor completes a scheduled appointment after its end |
| GET `/admin/mentors` | Admin-only paginated list of individual provider candidates, verification reference, mentor draft and current approval |
| PUT `/admin/mentors/:id/approval` | Independent administrator approves/revokes an individual provider using expected revision and current documentId |
| GET `/admin/mentors/:id/history` | Admin-only approval audit history; never private mentoring sessions |

Only the two participants can read private session topics, requests and history.
Administrators are deliberately excluded from these APIs; industry approval gives
no access to appointments. General directory discovery remains unchanged. Existing
scoped messaging complaints remain in the messaging module, with no new global
administrator access to private conversation contents.

## Identity, consent and privacy

Faculty/alumni must have a current `communityVisible` identity: approved claim,
matching current verification evidence and account type, valid directory contact,
verified provider status and a members-visible community profile. They must also
opt in through their mentor profile. Discovery and new mentoring activity honor
community student-contact consent, both global contact settings and both users'
block lists. Self-entered faculty names never replace the verified directory name.
No publicly listed directory contact or demo account is automatically enrolled.

Industry mentors use existing **individual** provider accounts. A verified company
or NGO is not a verified person. The approving admin must review the individual's
current document through the existing private verification API, then independently
confirm identity and mentoring expertise. The approval is bound to that document;
its actor, reason, revision and document reference are stored in the admin audit
log. `identityConfirmed` and `expertiseConfirmed` are required true on approval.
Those attestations are human review, not automated credential checks.

Publication is additionally bound to the evidence/account type/directory identity
or industry approval revision present when the mentor explicitly saved their
profile. Identity evidence changes require renewed mentor opt-in even if a new
claim is later approved and visible. Industry revocation explicitly disables the
profile and increments its revision; reapproval never republishes it automatically.
The internal binding is excluded from every profile response.

Profile `enabled: false` stops discovery and new requests/scheduling; existing
private records remain accessible to participants. Cancellation does not require
the other party to remain opted in or active, so a student can close a session
after a mentor withdraws or is suspended. A suspended actor cannot use the API.
Provider actors whose provider verification is revoked must regain a full session
before accessing protected provider APIs; their student participant can still
cancel. No appointment is silently erased by a consent change.

Public mentor DTOs contain only account ID, canonical/consented display name,
category, optional canonical department, expertise, bio, display time zone and
profile revision. Email, phone, evidence bytes/references, claim justifications,
student details, block settings and appointment subjects are excluded. Availability
discloses only free time intervals and is an advisory read, not a reservation.

## Availability and agreement lifecycle

Profiles accept 1–12 expertise topics, a 20–1,000 character biography, supported
IANA time zone and at most 40 concrete UTC windows. Requests use canonical UTC ISO
timestamps including milliseconds, e.g. `2030-01-02T10:00:00.000Z`; local/ambiguous
timestamps and invalid dates are rejected. The time zone is display metadata;
there is no recurring local-time interpretation or implicit daylight-saving shift.

Availability windows are 15–480 minutes, on quarter-hour boundaries, nonoverlapping,
ending in the future and no later than 90 days away. Ongoing windows can remain in
a profile edit. An appointment lasts 15–120 minutes, starts strictly in the future,
fits inside one availability window, and ends within the same 90-day horizon.
Adjacent appointments are permitted; intervals use `[startAt, endAt)` semantics.
Free windows are clipped to future quarter hours, subtract confirmed bookings and
omit fragments shorter than 15 minutes. Expired windows are omitted from discovery
availability rather than resurrected or renewed automatically.

`pending → approved → scheduled → completed` is the normal lifecycle. The mentor
may reject a pending request; either participant may cancel a pending, approved or
scheduled session. Completion is an explicit mentor action after the end, not
automatic attendance tracking. Terminal requests retain their history and permit
a new request for the same pair.

After approval either participant proposes a time and the other accepts or declines.
A proposal itself does not reserve capacity. A proposal can be replaced, but every
change increments revision; clients must reload stale proposals before confirming.
Acceptance rechecks dates, consent and both calendars. An unaccepted reschedule
retains the old confirmed appointment. A failed acceptance preserves the old time
and proposal; clients can propose another time, decline or cancel. Ended appointments
cannot be rescheduled. Pending approvals/proposals have no automatic expiry job;
expired proposals are rejected at acceptance and participants can decline/cancel.

All session mutations require expected `revision`. A repeated stale write returns
409 rather than repeating audit events or silently accepting a lost update.
Reasons are required for rejection, cancellation and declining a proposal and are
visible only in authorized private history. Request text is plain bounded text;
notification messages never copy it.

## Concurrency, quotas and transaction boundaries

MongoDB must support transactions (replica set or sharded cluster, as already
required by resource and scholarship allocation). Every booking-affecting mutation
locks both participant User records in sorted ID order with the existing `__v`
coordination write. Within a snapshot/majority transaction it rechecks:

- The actor and the current expected session revision.
- Active student/mentor identities and mentor opt-in binding.
- Community visibility/contact consent and global block/contact settings.
- The current mentor availability and confirmed appointments on **both** calendars.

Normal suspension, provider identity, community preference, mentor profile and
messaging/block writers take the same User lock, so conflicting changes cause a
transaction retry and fresh validation. Confirmed bookings are queried by mentor
and by student using indexed overlap predicates; the locks serialize concurrent
inserts without a separate slot inventory. Concurrent conflicting confirmations
have one successful reservation; a loser receives 409. This guarantee assumes all
appointment writers use this service; unsupported direct database writes bypass it.

A partial unique index additionally prevents multiple active requests per pair.
Student creation is capped at ten requests per rolling 24 hours, and each actor is
capped at twenty scheduling proposals per rolling 24 hours. Quotas use real stored
records/events inside the same lock; cancelling requests does not reset creation
quotas. Reads are paginated: default 20, mentor discovery max 20, histories/lists max
50, page max 10,000. Public identity/contact filtering occurs before pagination.

The domain write, revision/event append and opposite-party notification outbox
enqueue commit together. Failure to persist the notice rolls everything back;
503 responses contain no database-driver details. No external service is called
inside those transactions.

## Notifications and reminder worker

Mentorship lifecycle events and industry approval decisions reuse the existing
outbox/inbox worker. Session events notify the opposite participant, never an
unrelated administrator. Messages use existing canonical generic templates and
the allowlisted `/impact` destination; they contain no topic, student background,
appointment reason, evidence or verification decision explanation. Notification
preferences, suspended-recipient handling, retries, leases and dedupe remain the
Phase 6 implementation.

The existing reminder scan adds a `mentorship-reminders` cursor. Each tick scans at
most the configured limit of scheduled sessions (maximum 100), advancing through
nondue records and wrapping, independently of scholarship/resource cursors. For
appointments starting within the next 24 hours it enqueues a reminder for each
participant, once per session/exact scheduled start. Rescheduling produces a new
dedupe key. Delivery rechecks the current scheduled start, recipient participation,
both accounts, mentor identity/consent/binding and contact restrictions. Cancelled,
rescheduled, begun, blocked or withdrawn connections cannot materialize stale
reminders. Central notification opt-outs are also honored. Disabling mentor intake
suppresses not-yet-delivered reminders; it does not cancel confirmed history.

The worker can run in-process or via the existing `notifications:worker` script;
use only one operational deployment strategy as described in `notifications.md`.
Multiple workers are safe under the existing transaction/lease protocol. Worker
lag and scan rotation mean notification enqueue is eventually processed; there is
no promise of an exact delivery instant. No email, external calendar integration,
payment, meeting provider or synthetic attendance result is introduced.

## Database rollout, compatibility and rollback

Additive collections: MentorProfile, MentorApproval, Mentorship and MentorshipEvent.
There are 12 new indexes: two profile indexes (including owner uniqueness), one
approval owner index, six session indexes (pair partial uniqueness, two calendars,
two participant histories and the reminder cursor), and three event indexes
(session/revision uniqueness, history and proposal quota). AuditLog gains optional
mentorshipApproval documentId/revision metadata. NotificationProducer accepts a
third cursor key. Existing documents and APIs require no backfill or reinterpretation.

Before deploying, verify replica-set transactions, backups and index creation
permissions. On a populated environment, review the index plan and expected build
load; create indexes through the established controlled deployment process. There
is no `syncIndexes`, production migration, destructive cleanup or account seed in
this phase. Old outbox records and existing preference documents remain compatible;
mentorship was already a supported notification category.

Rollback: stop or disable the notification worker before rolling back application
code, then restore the prior server revision. Preserve the new collections/audit
metadata and queued notices for forward recovery. Older Phase 6 workers do not
revalidate mentorship reminder sources; they must remain disabled while reverting
across this boundary, or could deliver stale generic reminders. Restore the Phase 7
worker before resuming pending mentorship delivery. Do not delete indexes, change
production records, restore a backup or purge notices without a separate approved
operational plan. No rollback was executed against normal app data.

## Test evidence and remaining dependencies

Unit tests cover UTC date/calendar validation, boundaries and durations, overlap
semantics, available interval subtraction, profile opt-in, revision/ID/page bounds,
state transitions and current identity requirements. API integration tests run the
real Express app against the existing isolated loopback TestDatabase replica set;
they cover complete mutual scheduling/rescheduling, private history, admin approval
review/audit, identity binding, stale writes, abuse bounds, concurrent pair creation,
both calendars, cancellation/reuse, transactional rollback and stale reminders.

Actual executed counts and CI links are recorded in the phase pull request. Initial
sandbox execution could not start MongoDB, and the unit API import timed out in that
environment; the unchanged assertions are rerun outside the sandbox. Do not count
those blocked/failed attempts as passed tests. The final published evidence must
identify any remaining failed/skipped cases.

Backend-only limitations: no mentor directory/scheduling screen, no external email
or calendar provider, no video meeting links, no group sessions, no recurrence and
no automatic attendance inference. Availability is explicit and bounded to 90 days.
Optional feedback is deferred until a separately approved product/API decision; it
is not required by the Phase 7 backend master prompt. New frontend integration must
provide UTC conversion, revision conflict handling, confirmation/decline controls
and participant-private history without changing existing mentorship listings.
Phase 8 opportunity management remains outside this branch.
