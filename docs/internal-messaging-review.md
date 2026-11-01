# Internal messaging phase

## Baseline and audit

Development fetched on 2026-10-21 at d5c3e6d. Community commit 5c18bd1
was merged into the retired integration-fix branch, not development; reconciliation
PR #21 preserves that independently reviewed prerequisite. No automatic merge.
The owner subsequently merged #21. Development was fetched again at 6ca69f9,
and this feature branch fast-forwarded to that baseline before its own commit.

Existing conversation/message models persist two-person conversations, timestamps,
unread state and participant-only history. These are implemented but messaging has
no dedicated comprehensive test suite. History is limited to an inaccessible first
page in the UI. Conversation listing is unbounded and does per-row queries. Polling
runs every ten seconds. Start permission checks exist, but ordinary sends do not
recheck the connecting relationship. Community consent is already transactional.
Blocking, general preferences, typing, live updates, search and scoped complaint
evidence review are missing. Reports currently accept arbitrary message IDs.

## Acceptance criteria and design

- Preserve existing conversations and the community claim/consent restrictions.
- Every start, send and typing action rechecks active accounts, current eligibility,
  both parties' blocks and receiving preferences. Withdrawals serialize with sends.
- Messages and conversation timestamps commit atomically. Enforce database-backed
  send and new-conversation quotas; reject invalid IDs, content and pagination.
- Bounded conversation search, older-message pagination, read receipts and unread
  counts work in the UI. Ignore stale requests after switching conversations.
- Authenticated server-sent refresh signals provide live updates without putting
  message content or tokens in URLs/events. Reconnect and periodic refresh recover
  missed signals. Typing is ephemeral, participant-only and rate bounded.
- Blocking prevents future contact in both directions while retaining participants'
  own history. Preferences and blocked identities are owner-only.
- Only a participant can report another participant's message. Admin evidence
  access requires an open complaint, a reason, and an atomic audit record; expose
  only the exact reported message, never neighboring conversation history.
- In-app unread notices respect preferences. Centralized/email notifications are
  reserved for the separately approved notification phase.

## API/database compatibility

Retain existing message routes and response arrays; add pagination metadata and
optional query fields. Add owner settings, block/unblock, event-stream and typing
routes, and a narrowly scoped admin report-evidence endpoint. Add an owner-unique
messaging-settings collection, complaint-access audit collection and message
pagination/rate indexes. Defaults preserve existing permitted relationships.
No account fabrication, destructive backfill, production migration or schema
removal. Transaction-capable MongoDB remains required.

## Validation and deployment

Do not merge this phase automatically or start the next phase.

### Routes

All messaging routes require the current full bearer session and return no-store.

| Route under `/api/messages` | Behavior |
| --- | --- |
| `GET /conversations?q=&page=` | Literal name/organization search; 20 rows/page, total/pages metadata, allowlisted peer summary, latest preview/unread count |
| `POST /conversations` | Reuse or atomically create a currently permitted pair |
| `GET /conversations/:id/messages?before=` | Latest 40 messages or older cursor; chronological response, hasMore/nextBefore; legacy page query retained |
| `POST /conversations/:id/messages` | Trimmed 1–2000 character text, transactional message/timestamp and current permissions |
| `PATCH /conversations/:id/read` | Optional throughId limits the read receipt to displayed history |
| `POST /conversations/:id/typing` | Participant-only, current contact permissions; four-second ephemeral hint |
| `GET /settings`, `PUT /settings` | Owner-only receiving/unread-notice preferences; explicit booleans |
| `PUT /blocks/:id`, `DELETE /blocks/:id` | Idempotent owner block/unblock; maximum 200 blocks |
| `GET /summary` | Aggregate own unread total and notice preference |
| `GET /events` | Authenticated fetch/SSE; own refresh/typing hints only; arbitrary query room/user IDs ignored |

Existing `/api/reports` validates a message target against incoming participant
history and refuses duplicates. Admin `POST /api/admin/reports/:id/message-evidence`
requires a 10–500 character access reason and an open, independently reviewed
complaint. Access and audit commit before returning the exact message. Resolution
requires a 10–500 character note; reviewed outcomes require prior access by the
acting administrator. Closed complaints cannot be reopened for evidence access.
Private message deletion and transcript browsing are deliberately unavailable.
Malformed legacy complaints do not grant evidence access. No admin history bypass.

### Concurrency, privacy and limits

Start/send/typing lock both active accounts in stable ID order. Settings and blocks
lock their owner; community visibility/identity changes already share that account
lock. MongoDB retries write conflicts. Current provider verification, student-first
community consent and permitted application/resource/collaboration relationships
are rechecked. Read-only participant history survives a block/opt-out. Preferences
control incoming contact; opting out does not prevent sending to a willing peer.
Rejected relationships no longer permit ordinary sends. Admins can initiate their
own support conversations, but cannot read conversations they did not participate in.

Quotas shared across API workers: 20 messages/minute, 100/hour, 10 newly initiated
conversations/hour and 10 incoming-message complaints/day. Typing is limited to one
update per account every two seconds. Counts/timestamp checks serialize through the
account transaction lock; no process-local send quota. Existing-conversation reuse
does not consume the new-conversation allowance. 429 includes Retry-After: 60;
hour/day limits can require longer. There are no automated content judgements.
The 200-block bound is a product limit that may need a future abuse/support workflow.

The browser ignores stale history responses after changing conversations, deduplicates
live updates, retains loaded older history and preserves unsent text on failure.
Refresh hints arriving during an in-flight history, conversation-list or unread-summary
request queue one follow-up refresh. The server likewise retains a refresh arriving
during another hint's permission checks. This prevents overlapping typing/message/read
signals from leaving receipts or unread counts stale until the periodic refresh.
Read receipts are sent only while the document is visible and through the latest
fetched message. Unsaved preferences survive background refreshes. Report controls
are keyboard/touch accessible and explain the narrow evidence disclosure.

### Live transport and operations

SSE is one-way server push; existing authenticated REST requests carry sends/typing.
Fetch keeps bearer tokens in Authorization headers, never URLs. One stream per
signed-in browser app reconnects after five seconds. The backend sends a refresh
every 15 seconds and closes streams after five minutes; the browser also refreshes
every 30 seconds. Durable Mongo history recovers missed signals without requiring
delivery or replay of private message bodies in the event channel.

`MessagingSignal` contains only owner ID, worker ID, event type, optional conversation
ID and expiry. TTL expiry removes temporary hints; expired hints are ignored even
before Mongo's asynchronous TTL cleanup. A shared Mongo change stream fans hints
to other API workers; local delivery is immediate. The watcher exists only while
this worker has listeners and retries failures after five seconds. Failure to save
a hint must not turn an already committed message into a failed send. Periodic
refresh remains available if the shared channel is temporarily unavailable.
Streams revalidate JWT expiry, token version, account status and provider verification
before every hint/heartbeat. Typing delivery also rechecks participants, blocks and
community visibility/consent. Content is fetched through the participant-only API.
Three concurrent streams per account per worker and 1000 total per worker bound
local resource use. Slow clients are disconnected on backpressure.

Deployment needs coordinated frontend/backend, transaction/change-stream capable
MongoDB, TLS, database read/write/watch privileges, correctly applied indexes and
a proxy that passes Authorization, disables SSE buffering and permits long-lived
responses. Proxy connection limits, aggregate throughput/load tests, authentication
storage hardening, generic HTTP throttling and observability remain production-phase
work. Mongo change-stream failures currently recover through retries/refresh; a
production monitoring policy must alert on prolonged degraded delivery. No new npm
dependencies or environment secrets were introduced.

Protocol references: [MDN SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events),
[Node HTTP](https://nodejs.org/download/release/latest-v24.x/docs/api/http.html).

### Database rollout and rollback

Add owner-unique MessagingSettings, append-only-by-API MessageReviewAccess, and
TTL MessagingSignal collections. Message gains (conversation, createdAt, _id),
(sender, createdAt) and (conversation, sender, readAt) indexes; Conversation gains
participant ordering and initiator/time indexes. User.lastTypingAt is optional,
internal and excluded from ordinary selections. Missing settings default to permitted
incoming contact and notices. Older conversations/messages remain readable; no
destructive migration or identity/account creation was run.

Apply indexes through the controlled deployment's normal index-management procedure;
do not run syncIndexes against production without reviewing removals. Back up the
database and test with synthetic records before rollout. Validate two independent
sessions, shared-worker hints, opt-out and narrow complaint access behind the real
proxy. No production migration or remote account changes were performed here.

Rollback can use the previous frontend while retaining these stricter backend routes.
Retain the new collections/history. Rolling back backend authorization would reopen
blocked contact and arbitrary message reports; if a backend rollback is essential,
disable message writes/typing/report evidence routes until protections are restored.

### Security scan findings

Repository policy tests and forbidden-file checks pass. Runtime npm audits were
executed on 2026-10-21 and **are not clean**: backend reports two critical and two
moderate affected packages (proxy-addr/Express and qs/body-parser); frontend reports
two high affected packages (Axios/follow-redirects). These dependencies/lockfiles
are unchanged in this phase. npm reports no fix for proxy-addr, Axios or
follow-redirects and offers a qs patch through audit fix. Do not run a blanket
dependency upgrade in this feature branch.

Relevant primary advisories:
[proxy-addr trust-subnet spoofing](https://github.com/advisories/GHSA-jqcg-44mw-7w3h),
[qs parsing](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx),
[Axios fetch prototype gadget](https://github.com/advisories/GHSA-vh66-26gq-q6x8),
[follow-redirects credential stripping](https://github.com/advisories/GHSA-q3jh-wrc6-jgq8).
The app does not enable trust proxy and the new quotas use database account IDs,
not client IP. Browser Axios uses its existing adapter; Node adapter findings are
not proof of browser exploitability. These observations do not waive the advisories:
track dependency remediation/verification separately before production approval.

### Executed checks (local, continued 2026-10-26)

- Backend unit: **281 passed**. Source/test TypeScript and production build passed.
- Frontend unit: **10 passed**; integration: **46 passed**, including thirteen new
  messaging/complaint/notice cases. Lint, source/test types and build passed.
- Latest messaging API run: **33 passed**, including shared-worker signal delivery,
  stream limits, session revocation, read-receipt cursors and overlapping typing/refresh
  delivery. Three additional frontend regressions cover refreshes arriving while
  history, conversation-list and unread-summary requests are still pending.
- Earlier targeted API run: **57 passed** (28 new messaging plus 29 existing
  community cases). The earlier broad API run returned **184 passed / 3 failed
  out of 187**. All three failures were existing admin-bootstrap child-process
  cases exceeding their unchanged 15-second deadline. No test limits were relaxed.
  Those three subsequently passed on direct rerun in 0.75–1.18 seconds each. The
  broad API suite was not repeated during this continuation.
- Chromium: **10 passed** in the full browser suite. The messaging scenario verifies
  two independent participants, typing, live delivery, read receipts, exact-message
  complaint access/resolution, blocking, opt-out and mobile/desktop captures.
  Corrected the test's case-sensitive Reports locator and evidence assertion to
  account for the timestamp within the evidence blockquote. Sandbox runs completed
  browser assertions but could not finish teardown because Windows denied
  Playwright's taskkill operation. The final run passed outside that sandbox;
  no browser assertions or timeouts were weakened.
- Repository policy tests: **9 passed**. Forbidden tracked environments/dependencies/
  compiled output: zero. Whitespace checks passed. No production data, identities,
  accounts or migrations were used.
- Frontend production bundle: **647.12 kB** (169.39 kB gzip), retaining Vite's
  existing >500 kB warning. No backend lint script exists.

The browser captures are in ignored `output/playwright/internal-messaging-mobile.png`
and `output/playwright/internal-messaging-desktop.png`. CI results are not included
in this local execution record.
