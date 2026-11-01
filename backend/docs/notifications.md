# Phase 6: centralized in-app notifications

Branch: `feature/notification-system`. Base: approved development
`fdb911decf0fcbf23c3e271eeaf483d0e76f5ba2` after PRs #24, #29 and #23 merged.
Backend-only phase; the existing frontend design and normal app data are preserved.

Phase 7 now extends this foundation with actual mentorship lifecycle events and
appointment reminders. See [the mentorship module](mentorship.md) for its current
permissions, source revalidation and the worker rollback boundary. Statements below
about mentorship being deferred describe the scope of the original Phase 6 change.

Phase 9 adds campus event lifecycle updates, organizer decisions and bounded event
reminders. See [campus events](campus-events.md) for authorization and rollout rules.
The shared OpenAPI contract includes the eighth `event` category and
`event`/`event_organizer` sources (and the saved-opportunity source from Phase 8).
Preference reads include event=true by default. Updates still accept the original
seven required category booleans; event is optional for older clients, and omission
preserves an existing event opt-out. The worker now maintains five rotating producer
cursors. Pause workers before rollback to code without these source checks.

## Audit and acceptance criteria

| Area | Existing implementation | Phase 6 acceptance |
| --- | --- | --- |
| Campaign events | Transactional NotificationOutbox, pending only | Reuse it; retain legacy queue compatibility and deduplicate delivery |
| Inbox | Missing | Own notifications, bounded pagination/filtering and stable history |
| State | Missing | Own unread count and idempotent read/unread updates |
| Preferences | Messaging-only notification switch | Central in-app/category consent, optimistic revisions, respect existing messaging settings |
| Domain hooks | Campaign only | Transactional application, scholarship/appeal, resource/return/dispute, verification/community and message notices |
| Reminders | Missing | Bounded fair scans for upcoming scholarship deadlines and resource due/overdue reminders |
| Delivery | Missing | Database leases, atomic in-app delivery, bounded retries, dead letters and safe recovery after crashes |
| Confidentiality | Existing campaign bodies generic | Static safe templates; no message previews, evidence, justifications, appeal/dispute statements or reasons |
| Email | Local development adapter, production disabled | In-app scope only; do not offer a nonfunctional email toggle or claim production delivery |
| Mentorship | Module planned for Phase 7 | Category/template/internal enqueue supported; actual mentorship hooks follow the real module |

Tests must exercise actual Express routes and isolated MongoDB: ownership/IDOR,
restricted provider sessions, preferences and concurrent revisions, real domain
events, concurrent workers, retry/backoff/lease recovery, dedupe, audit rollback,
generic content, reminder scans and original campaign compatibility. Full CI,
types, builds and existing browser journeys must pass before the requested merge.

## Delivery and data boundaries

Domain services enqueue notices in their existing MongoDB transactions. The
outbox remains NotificationOutbox; old pending campaign records can be delivered
without a destructive migration or a second campaign-notification system. New
ordinary application submissions now commit their source and notice together,
rechecking the student and listing under transaction locks. Existing 201/200
envelopes remain. Concurrent duplicate submissions return 409; infrastructure
failures return sanitized 503 rather than being mislabeled as validation errors.

Notification is the durable private inbox, keyed uniquely by owner/dedupeKey.
NotificationPreferences stores central inApp/category consent with revision;
NotificationProducer stores reminder scan cursors. No API exposes raw outbox,
lease tokens, retries, dedupe keys or another user's inbox. Administrators have
no general private-inbox override and cannot create notices through a public API.

Kinds: campaign, message, application, scholarship, resource, verification,
mentorship and event. All rendered titles/bodies come from static templates. Legacy outbox
text is not blindly copied. No message content, application justification, score,
award amount, evidence filename/bytes, decision reason, appeal/dispute statement
or external link is placed in a notification. Links use a fixed internal allowlist
and the current recipient role. Optional source IDs identify the authorized
workspace record; opening that workspace still requires its own authorization.

occurredAt is the queued event time. An inbox entry means materialized in-app
delivery, not proof the person read it. Outbox deliveredAt is set only after that
materialization commits. processedAt also records suppression without falsely
claiming delivery. readAt changes only through the recipient's read-state API.

## Domain producers

The following existing HTTP contracts keep their request bodies/authorization and
gain transactional outbox side effects. Their detailed contracts remain in the
existing messaging, campaign, scholarship and resource API specifications.

| Trigger / method and route | Recipient and notification |
| --- | --- |
| POST /api/promotion-requests and existing campaign lifecycle actions | Existing opposite-party campaign recipient; drafts remain private and silent |
| POST /api/messages/conversations/{id}/messages | Other participant; no preview or sender self-notice |
| POST /api/applications | Owning provider on ordinary/scholarship submission |
| PATCH /api/applications/{id}/status | Applicant on real changed decisions; exact repeat decisions stay silent |
| POST /api/applications/{id}/scholarship/appeals | Owning reviewer; no appeal statement |
| POST /api/applications/{id}/scholarship/appeals/{appealId}/review | Applicant; no review reason |
| POST /api/resource-requests | Current listing owner |
| PATCH /api/resource-requests/{id}/status | Opposite participant on decision/completion |
| POST /api/resource-requests/{id}/cancel, /return, /return/confirm | Opposite participant; no automatic inventory effect from a notice |
| POST /api/resource-requests/{id}/disputes and /disputes/{disputeId}/resolve | Opposite participant; statement stays in the dispute workspace |
| PATCH /api/admin/providers/{id}/verify, /reject, /request-info | Affected provider, generic verification update |
| Existing community-claim approve/reject/request-info/revoke actions | Claim owner, community workspace link |

Provider verification and community decisions remain separate from email
verification. The notification category does not confer provider/admin authority.
Mentorship templates/preferences/internal enqueue are ready for the real Phase 7
module; no synthetic mentorship workflow or production event is invented here.

## Permission and consent behavior

All notification routes require an active, non-revoked session and are no-store.
Email-gated users must verify email first. Full sessions can access their own
inbox. A provider-verification-scoped session may access only its owner's
verification notices/preferences; it still cannot access normal platform APIs.
That scope remains restricted even after provider approval. Reading preferences
is allowed, but changing global notification consent requires a full session.
Pending/rejected/unverified providers are limited to verification notices even
with a full token. A changed non-provider role cannot reuse a provider-scoped
token. This exception is local to notification authentication and does not widen
existing application/message/document access.

Central preferences default to all in-app categories enabled, email unsupported.
GET preferences does not create a database record. Updates require every known
category boolean and the current revision; unknown fields, including owner/email
authority, are rejected. Concurrent edits at the same revision have one winner.
An opt-out suppresses pending/future notices when processed; it does not delete
history, mark old notices read or replay suppressed events after a later opt-in.

Message notices also honor the existing MessagingSettings.notifications and
acceptsMessages switches, both participants' blocking, current account/verification
state, community messaging consent, conversation membership and whether the
message was already read. Central enablement never overrides an older messaging
opt-out. Recipient and sender coordination writes serialize delivery with normal
preference, blocking and community-revocation writers. No incoming notification
opens a new conversation or bypasses its authorization rules.

## Retry, concurrency and reminders

The worker atomically claims one eligible job at a time with a random lease token
and sixty-second expiry. In-app upsert and outbox acknowledgment commit in one
transaction; acknowledgment failure rolls back the inbox and recipient lock.
Duplicate enqueue/worker attempts cannot create a second inbox entry for the same
owner/dedupeKey. A replaced lease cannot acknowledge/deliver after another worker
has taken ownership. Crashed leases can be reclaimed. After five failed attempts
or exhausted crashed leases, jobs remain failed for operator review.

Transient failures retry after 5, 10, 20 and 40 seconds; the general helper caps
backoff at one hour. Invalid persisted notices fail permanently. Stored outcomes
are fixed codes, never raw exceptions, addresses or tokens. Worker logs are generic.
Suppression distinguishes consent, unavailable recipients/messages and stale
reminders. A database failure recording the retry leaves the lease to expire
and be recovered; it never claims successful delivery.

Two bounded rotating scans examine at most 100 active applications and 100
accepted resource requests per tick. Cursors advance over non-due rows too;
end-of-scan wraps within the same call, preventing early non-due rows from
starving later records. Scans run independently of inbox history pagination.

Scholarship reminders cover applicants with active applied/reviewed/waitlisted
records and an open, unwithdrawn scholarship deadline in the next 24 hours. They
deduplicate per application and exact deadline. Delivery rechecks current status,
source/deadline and window; changed deadlines or decided applications suppress
stale reminders. They do not automatically apply or award a scholarship.

Resource reminders cover accepted returnable snapshots due within 24 hours or
already overdue, once per request/deadline/UTC day. Delivery rechecks outstanding
status, original source ownership/category/access and exact deadline, and derives
due/overdue at delivery time. Completed returns suppress queued reminders. Legacy
allocations without an actual deadline and permanent transfers get no fabricated
reminder. Notices never change stock, deadlines, decisions or impose a penalty.
Large datasets may require tuning cadence/batch size or partitioning scans before
deployment; this phase does not claim a universal reminder latency SLA.

## APIs and schema changes

See [notifications.openapi.json](notifications.openapi.json) for the five new
operations, auth/roles, request bodies, validation, response models and errors.

- GET /api/notifications: own stable occurredAt/ID descending history; page
  1..10000, limit 1..100 (default 20), kind and boolean unread filters. Unknown
  filters reject with 400. Response includes filtered total and global own unread.
- GET /api/notifications/unread-count: own visible unread count.
- PATCH /api/notifications/{id}/read: exactly one boolean read field; true is
  idempotent without resetting the original read timestamp, false restores unread.
- GET /api/notifications/preferences: own defaults/stored settings and in_app
  supported channel. No email setting is falsely offered.
- PUT /api/notifications/preferences: full validated booleans and expected revision.

New collections: Notification (unique owner/dedupe, owner/time and owner/read/kind
indexes), NotificationPreferences (unique owner), NotificationProducer (unique
scan key). Outbox adds optional action/source/scheduled time, attempts, retry,
lease, processing/delivery times and outcomes; existing owner/dedupe uniqueness
is retained and processing indexes added. Application gains optional internal
notificationRevision for ordinary status events; applications/resources gain
status/ID scan indexes. None of these server fields are client-writable.

No production migration, historical message replay, identity backfill, credential
change or destructive index synchronization ran. Existing pending campaign
notices are intentionally eligible; existing suppressed/delivered notices are
not automatically replayed. All new queue/domain writes remain transactional.

## Running, rollout and rollback

The regular API server starts a nonoverlapping background worker after MongoDB
connects. It stops/awaits its current tick on shutdown. createApp alone does not
start timers, so API tests/serverless adapters need an explicit worker owner.

Environment settings (validated by API-server/worker startup):

- NOTIFICATION_WORKER_ENABLED=true by default; set false on API replicas when a
  dedicated worker is preferred. Multiple enabled workers are safe through leases.
- NOTIFICATION_POLL_MS=5000, allowed 1000..60000.
- NOTIFICATION_BATCH_SIZE=20, allowed 1..100. Each job is claimed only when processed.

`npm run notifications:worker` runs the dedicated process against its deliberately
configured database. `npm run notifications:once` explicitly processes one tick
(including reminder production); **it is not a dry run**, even when the normal
background worker is disabled. Neither command was run against normal/production
data for this implementation. Tests invoke workers only on owned disposable DBs.

Deploy reviewed indexes on a backup/staging copy before an approved production
rollout. A MongoDB replica set is required; unsupported transactions fail closed.
Monitor pending/failed counts, oldest pending age and source-scan cursor progress
with privileged operational tooling. Failed jobs are retained. After correcting
the cause and recording operator approval in the operations audit, an operator
may deliberately reset a specific failed job to pending/attempts zero with an
immediate nextAttemptAt and cleared lease; retain its original dedupe key. There
is no public retry/create/admin-inbox endpoint. Do not broadly delete queues to
make failures disappear.

Before rollback, stop workers and preserve all queue/inbox/preference/cursor data.
Older writers can still append legacy campaign notices, but cannot emit the new
cross-module events. Mixed writers create coverage gaps. Use coordinated writers
or a forward fix; do not restore an old database merely to undo code deployment.
No external email, push or third-party delivery is implemented or sent.

Notification UI controls belong to the separate frontend workflow. Real mentorship
events and appointment reminders follow the Phase 7 module; optional production
email requires a separately approved adapter/consent design. The merged auth/UI
limitations and existing frontend dependency advisories remain separate work.
Exact executed totals, CI URLs, base/head and the requested merge are recorded in
the phase pull request.
