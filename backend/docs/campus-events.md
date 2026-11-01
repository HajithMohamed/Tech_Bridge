# Phase 9 — Campus events backend

Baseline: latest fetched development `934a229` after PR #33 merged. Its tree was
verified identical to tested Phase 8 head `40d52b3`. No existing campus-event model,
registration/attendance API, tests or open feature PR were found. Existing mentorship
availability and opportunity workshop listings are distinct workflows and remain.

| Capability | Audit classification | Phase 9 acceptance |
| --- | --- | --- |
| Event ownership and organizer approval | Missing | Explicit, auditable admin approval; bind grants to current identity/affiliation; verified provider or independently reviewed student |
| Event model, publication and discovery | Missing | Draft/publish/edit/cancel/complete lifecycle; bounded search; private joining instructions |
| Registration and capacity | Missing | One record per event/student; transactionally enforce capacity, deadlines and source permissions, cancellation/re-registration |
| Attendance and history | Missing | Actual organizer-recorded attendance, bounded correction window and private audit trail; no inferred attendance |
| Reminders/events | Notification infrastructure exists; campus hooks missing | Transactional notices, bounded update fanout and reminders, stale-source checks and compatible preference extension |

Acceptance: only approved current organizers may publish; no demo or directory
identity automatically gains authority; participants cannot access peer tickets;
private joining data never appears in public APIs; concurrent last-seat requests
have one winner; cancellation safely releases capacity; capacity reduction cannot
invalidate existing registrations; attendance is recorded only by the actual
organizer in the permitted time window; revocation blocks new activity and stale
reminders; database failure cannot leave partial registrations/audit/notices.

This phase is backend-only. No frontend source, normal app records, migrations or
future Phase 10 analytics implementation are authorized by this branch.

## API and permissions

All paths below are relative to `/api/events`. Use full JWT sessions; enrolled
email verification and account suspension are checked. A verification-only session
cannot enter this module. Public discovery needs no session. IDs are 24 hex
characters, timestamps are canonical UTC with milliseconds, and write bodies reject
unknown fields. Lists default to 20 and cap at 100 records; page caps at 10,000.
The machine-readable contract is [campus-events.openapi.json](campus-events.openapi.json).

| Method/path | Permission and behavior |
| --- | --- |
| GET `/` | Public published events under current approval; q (literal title/description), category, institution, mode, phase=upcoming/ongoing/past, page, limit |
| GET `/:id` | Public published/completed event under current approval; never drafts/cancellations or private joining details |
| GET `/organizer` | Student/provider's own sanitized approval status and current eligibility |
| GET `/admin/organizers` | Admin paginated approved/revoked organizer grants and private review reference |
| PUT `/admin/organizers/:id` | Admin independent approve/revoke decision for a student/provider; expected revision and reason |
| GET `/admin/organizers/:id/history` | Admin paginated approval history; ID is the account ID |
| GET `/admin` | Admin paginated event metadata, optional lifecycle status; no joining instructions or roster |
| POST `/admin/:id/cancel` | Admin cancellation with expected revision and reason; audited as that admin |
| POST `/` | Current approved organizer creates a private draft |
| GET `/mine`, `/mine/:id`, `/mine/:id/history` | Actual owner's paginated events, own draft/private metadata and event history; optional status for list |
| PATCH `/:id` | Actual current approved owner edits future draft/published details; revision, partial metadata, reason for published edits |
| POST `/:id/publish`, `/:id/cancel`, `/:id/complete` | Owner lifecycle actions, expected revision; cancellation and renewed publication require reason |
| POST `/:id/registrations` | Student explicitly registers with an empty body; organizer cannot register for their own event |
| GET `/:id/registrations` | Actual current approved owner only; paginated roster, status=registered/cancelled and attendance=unmarked/attended/absent |
| GET `/registrations/mine` | Student's own paginated tickets; optional registered/cancelled status |
| GET `/registrations/:id`, `/registrations/:id/history` | Ticket owner or actual currently approved event owner only; no automatic admin access |
| POST `/registrations/:id/cancel` | Ticket's student owner, expected revision and optional reason |
| PATCH `/registrations/:id/attendance` | Actual currently approved event owner, expected revision, attended/absent and required reason |

Responses use `{success:true,data:{...}}`; failures use `{success:false,message}`.
Validation is 400 (capacity policy conflicts 409), missing/invisible sources 404,
insufficient permission 403, stale revision/state/capacity/deadline conflicts 409,
quota exceeded 429 and unavailable infrastructure 503 with sanitized text. POST
creation/registration return 201. No source is considered successful merely because
its route/model exists; executed verification evidence belongs in the PR report.

## Organizer approval and privacy

Organizer permission is a separate CampusOrganizer grant, not a new User role or
an automatic privilege for all verified providers. Admin approval requires both
identityConfirmed and affiliationConfirmed to be true, a 20–1,000 character private
affiliationReference and a 10–1,000 character reason. Students' current institution
must match the independently reviewed campus. Providers need current verified
document evidence that the deciding admin has actually opened using the existing
private provider-document API. Student institutional evidence is externally reviewed
and referenced by the admin; this phase does not introduce a new identity upload
store. A boolean attestation alone is not independent proof of identity.

Approval snapshots the reviewed account role, name, email, campus or provider
organization/type/document. Changes to those identity fields, suspension, required
email verification, provider withdrawal, or revoked grants invalidate authority.
Public aggregation filters current authority before counting/pagination. Each event
binds its grant revision and institution. Reapproval does not automatically restore
old publications: the actual organizer must explicitly republish with a reason.
Private audit references and identity snapshots do not appear in public/own grant
DTOs. Demo or directory contacts never acquire organizer permission automatically.

Joining instructions are a separate private field (up to 1,500 characters) excluded
from default model reads and all public/admin event DTOs. Use a nonsecret public
venue label; never put a meeting password in the public venue/description. Only the
actual owner and registered ticket holder under current published authority receive
joining instructions. Withdrawn/cancelled/unavailable activity withholds them.
Roster access requires actual ownership plus current approval for that campus;
roster identity contains student name/institution, not email or private profiles.
Admins may cancel events but have no automatic attendee-ticket/roster privilege.
Historical organizer attendance access requires current campus approval, while
republication is separately required to restore public visibility and intake.

## Lifecycle, capacity and attendance rules

Creation always makes a draft, with a future start within 365 days, duration greater
than zero and at most 14 days, and a future registration deadline no later than
start. Categories include university events, workshops, hackathons, seminars,
career fairs, networking and other. Campus, online and hybrid modes are supported.
Capacity is an integer 1–10,000. Ownership, institution and grant version are set by
the server; clients cannot supply counts, status or identity.

Drafts can be edited/published/cancelled. Published events can be edited before start,
cancelled, or completed after end. Published edits need a reason, advance the event
revision and notify current registrants asynchronously; registration can be closed
by moving its deadline to now or earlier. Capacity may never fall below committed
registrations. Completed/cancelled events cannot reopen. Repeated cancellation is
idempotent and does not invent history. A revoked organizer can still withdraw their
own event; if suspension or provider verification blocks the full session, an admin
can cancel it with an independent reason. Revocation itself withdraws public access
and registration without bulk rewriting existing events or tickets.

Tickets have one unique event/student record. Registration and re-registration
check current student and organizer authority, publication, start/deadline and
capacity. Re-registration reuses a cancelled record and advances its revision.
Cancelling releases exactly one seat before start; a cancelled event also permits
release after start while attendance remains unmarked. Peer cancellation is denied.
Event cancellation preserves ticket records/counts for audit, reports an effective
event_cancelled state and hides joining data; it does not silently delete tickets,
reset inventory or turn unmarked attendees into absences.

Attendance starts unmarked. The actual currently approved organizer explicitly
records attended/absent with a reason from event start through seven days after end.
Corrections require the latest ticket revision and preserve the previous state and
actual actor. Completing an event never infers attendance. Attendance-marked tickets
cannot be cancelled. There is no automatic check-in, bulk inference or attendance
score. Limits per rolling day: 10 draft creations and 50 changed lifecycle/metadata
actions per organizer, 20 registrations per student. Idempotent retries do not create
new audit actions. Existing authentication, CORS and JSON size controls still apply.

## Persistence, notifications and rollout

Four additive collections, 11 indexes: CampusOrganizer (2), CampusEvent (2),
EventRegistration (4), CampusEventAudit (3). Source mutations use replica-set
transactions with snapshot reads and majority commits. User coordination writes,
event serialization, unique ticket/audit indexes and expected business revisions
protect against duplicate/final-seat races and concurrent capacity edits. Source
state, inventory, audit and notification enqueue commit together. Enqueue failure
rolls back business writes; there is no promise that enqueued means delivered.
Direct unsupported database writers bypass these guarantees.

The eighth notification category is event, with event/event_organizer source types.
Existing seven-category preference payloads remain valid. Older updates merge into
current preferences and preserve an existing event opt-out; old stored preferences
default the added category to true without a backfill. Templates contain only generic
campus activity text, never event private details, attendance, reasons or identity
evidence. The temporary href is the existing `/impact` route; new frontend event
screens and email are outside this backend phase.

The worker adds a fifth rotating producer cursor over registered tickets. Each
scan considers at most 100 rows, advances over nondue records and wraps. Changed
event notice revisions or organizer grant revisions enqueue one generic update per
ticket/version tuple. Delivery-progress updates do not change business revisions or
create fake user history. Reminders are deduplicated per ticket/exact start/approval
version for starts within the next 24 hours. Delivery rechecks registration owner,
active student, exact future start, current published source and organizer approval
version. Cancellation, rescheduling, registration cancellation, renewed authority,
identity changes and deleted sources suppress stale pending reminders. Infrastructure
failures use existing durable retries; preferences suppress unwanted delivery.
Delivery is asynchronous and bounded-scan dependent; monitor backlog/lag rather than
promising an exact reminder instant. Generic cancellation updates remain readable by
the ticket holder after withdrawal without disclosing private joining details.

Before rollout: verify backup/restore readiness, replica-set transactions, index
creation permissions/load and the organizer review process. No production migration,
syncIndexes, destructive backfill, normal app DB writes or demo account creation is
performed by this branch. Existing eventless clients continue to work.

Rollback: pause workers before reverting to code that lacks the event enums/source
checks. Preserve the four collections, additive fields/indexes, preferences, cursor
and queued notices for forward recovery; old workers must not process event notices.
Restore a compatible worker before resuming or seek separate operational approval
for queue handling. Never purge records or restore production backups automatically.

Backend dependency audit and full regression results are reported after execution.
Earlier frontend dependency advisories remain separate; this backend phase does not
claim overall production readiness. Phase 10 analytics is intentionally unstarted.
