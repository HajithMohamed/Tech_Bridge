# Community verification review

## Existing implementation and acceptance criteria

Implementation baseline: `f45a343730ba7e967d278a5116a0b7ced39f4bd9` on the
reviewed local-admin/provider stack. On 2026-10-21, development was refreshed to
`cb5e3fdbf760e714a7872d10b269d408eb51b741` (merged PR #16). PR #17 was merged
into the former provider feature branch after PR #16, leaving its Docker/admin
changes outside development. [Reconciliation PR #18](https://github.com/HajithMohamed/Tech_Bridge/pull/18)
contains only that previously reviewed fix; its head `27d2d30ef7f6cbd3bcb1d4f74e0e5f5ff78fe03d`
has exactly the same tree as the implementation baseline. The community PR targets
`fix/local-admin-integration` to keep its diff separate. Retarget it to development
after the owner-approved reconciliation merge. No automatic merge or production
migration is performed.

Before this phase, the directory contained public contact snapshots but no ownership claims. Its UI
matches accounts by full name, and `/messages/directory` exposes any faculty/alumni
provider with the legacy verified flag. Conversation creation trusts that flag;
existing conversations do not recheck community preferences when sending. There
are no community claim, affiliation-review, visibility or messaging-consent tests.
Classification: directory partially implemented; identity claims missing;
messaging eligibility requires improvement. Existing private-history participant
checks remain useful and must be retained.

Acceptance criteria:

1. A faculty/alumni provider may claim an explicit matching-category catalog ID
   using its current privately stored evidence. Names and legacy verified flags
   never establish account ownership automatically.
2. Admins must review the exact current document and independently confirm identity
   and institution/alumni affiliation, with a bounded reason and method/reference.
   Matching email domains or uploaded documents alone do not establish identity.
3. Reasoned approve/reject/request-information/revoke actions and claim revisions
   are auditable and transactional. Concurrent approvals cannot bind one directory
   identity to two accounts; stale evidence/revisions and self-approval are denied.
4. Claimants can see their decisions, resubmit corrections, manage expertise,
   availability and visibility, and opt into student messages. Profiles default to
   hidden with messaging disabled. Owner/admin fields have explicit allowlists.
5. Member discovery returns only active, currently verified, approved, opted-in
   accounts with current matching evidence, through a bounded public projection.
   Evidence, account email and private review notes remain owner/admin-only.
6. Community consent/verification is checked for new conversations and sends,
   including existing conversations. Authorized participants retain their history;
   administrators gain no private-history bypass. Unrelated provider messaging is
   preserved for the later messaging phase.
7. Public listed contacts remain clearly separate from verified platform members.
   Frontend and backend share one catalog; no demonstration people are seeded or
   retrospectively claimed. Test identities remain in isolated databases.

Additive collections: CommunityClaim and CommunityClaimEvent. Existing
User roles remain student/provider/admin, with faculty/alumni represented by their
existing provider subtype. Conversation gains an optional initiator for student
consent. Provider evidence storage, restricted short-lived verification sessions,
file validation and audited admin downloads are reused from PR #16. Existing
accounts require explicit claims; no provider is silently converted or verified.

API design: restricted owner claim/profile/history endpoints, admin paginated
claim review/history/decisions, and authenticated paginated member discovery.
Older `/messages/directory` receives the same stricter identity/privacy filtering.
The green UI and existing official directory links are preserved.

## Resulting behavior and security boundaries

The canonical catalog is `backend/src/data/communityDirectory.json`, imported by
both frontend and backend. Existing IDs, contact snapshots and source links are
preserved. Vite explicitly permits only this additional data file outside its
normal workspace; no backend configuration or private account data is bundled.
Claims bind directory IDs to authenticated account IDs, never names or email domains.

Claims transition through `PENDING` to `APPROVED`, `REJECTED` or `NEEDS_INFO`.
Only approved claims can be explicitly `REVOKED`. Owners may resubmit with the
current revision; renewal hides the profile and clears message consent. Each
submission/decision/privacy change has an append-only history record. Submissions
are limited to five per account per rolling 24 hours under the same user lock.

Approval requires the claimant's exact current document, a download by the acting
admin after the latest claim update, separate identity/affiliation confirmations,
a method, private independent-check reference, and a claimant-visible reason.
These are records of a human review, not automated proof of authenticity. A
reviewer cannot approve their own claim. Suspended users cannot be approved;
admins may still reject or revoke a suspended account without reinstating it.
Approval/revocation invalidates old sessions. All account, claim, history and
administrative audit writes commit or roll back together.

One account has at most one current claim. A partial unique index permits at most
one approved account per directory identity, including concurrent reviews by
different requests. Claim revision and current-evidence checks reject stale
decisions. Provider identity edits and generic verification withdrawals invalidate
pending/approved community claims in the same provider transaction, preventing a
later legacy provider flag from silently restoring a withdrawn identity claim.

Profiles default to hidden with messaging disabled. Discovery requires an active
provider, matching faculty/alumni category, approved claim, current provider
verification, matching evidence, and explicit member visibility. Its response
allowlist contains only the canonical name/ID, institution, department, expertise,
biography, availability and consent. It excludes account email, evidence IDs,
justifications and review notes. Independent-check references are admin-only even
in the claimant's history. All community responses use `Cache-Control: no-store`,
including the compatibility directory endpoint.

Students initiate community conversations. Faculty/alumni can reply once the
student initiates or has participated in a legacy conversation. Claim/visibility/
consent/account checks run again for each send under transactional locks shared
with preference and identity updates. Hiding a profile, opting out, revocation,
suspension or deletion blocks new sends, including old conversations. Existing
history remains participant-only and readable; there is no admin-history bypass.
Other existing provider/student relationship rules are retained. Generic public
provider listings and already-public institution contacts are separate from the
new community biography/preferences and are not removed by a community visibility
change; the owner UI states this boundary explicitly.

## API and UI contracts

All paths are under `/api`. Owner routes accept the existing 15-minute restricted
verification token or a current provider session and require faculty/alumni ownership.
The separate Axios client stores restricted tokens only in React memory and never
replaces an unrelated full-session token in localStorage.

| Method | Route | Contract |
| --- | --- | --- |
| GET | `/community/claim` | Current owned claim, effective approval, faculty/alumni kind |
| POST | `/community/claim` | `directoryId`, exact current `documentId`, institution, 20–1000-character justification, current `revision` (0 for first submission) |
| PUT | `/community/claim/profile` | Current revision and allowlisted visibility/consent/expertise/availability/biography |
| GET | `/community/claim/history?page=` | Owner's history, 20 per page, excluding private affiliation references |
| GET | `/community/people?category=&department=&q=&page=` | Authenticated member discovery, 20 per page, bounded search/filter validation |
| GET | `/messages/directory` | Compatibility people response with the same stricter identity/privacy checks and pagination metadata |
| GET | `/admin/community-claims?status=&q=&page=` | Admin queue, 20 per page; optional category/department filters |
| GET | `/admin/community-claims/:id/history?page=` | Admin history including the private review reference |
| PATCH | `/admin/community-claims/:id/{approve,reject,request-info,revoke}` | Current revision/document, bounded reason; approval additionally requires independent identity/affiliation attestations, method and reference |

Private evidence upload and audited download continue through the existing
provider-verification routes; there is no second file store or weaker download
path. `/community-verification` supplies owner sign-in, evidence submission,
claims, preferences and history. `/admin` adds the Community claims tab.
`/connections` separates listed contacts from verified opted-in members, with
department/expertise search and permitted message actions.

## Deployment, compatibility and rollback

Deploy backend/frontend together after the prerequisite PRs. MongoDB must support
transactions. Initialize and verify the new unique provider index, partial unique
approved-directory index, queue index, and provider/claim history indexes before
enabling claims in production. These collections start empty; no existing
faculty/alumni account is approved automatically. An older verified account with
only a filename must receive an administrator request for current stored evidence
before it can claim an identity. The owner UI explains that requirement.

Conversation's optional `initiatedBy` field is additive. Legacy participants keep
their messages. Existing community conversations need a valid new claim and
consent before future sends; student participation can establish their initiation
when the old record lacks this field. The normal User roles and provider schemas
are unchanged. No destructive migration, data backfill or remote database write
was executed. The catalog is currently the existing University of Ruhuna list;
adding other institutions/unlisted identities requires a reviewed catalog change.

Back up the new collections with User, existing evidence and conversations.
Preserve claim/event records on rollback. A frontend rollback can retain the
stricter backend. **Do not restore the old permissive community messaging backend
while claiming these privacy guarantees**: disable community messaging/discovery
during a coordinated rollback or deploy a compatible fix that retains the new
authorization checks. An indiscriminate code revert could re-enable legacy flags.

## Production limitations and directory provenance

Reviewers must actually establish ownership and current affiliation through an
independent institution/alumni contact or reliable current records. Attestation
checkboxes, file signatures, email domains and a download log are insufficient on
their own. No institution API, email OTP delivery or external verification service
is configured. No real faculty/alumni identities were created or approved locally.

Direct fetches of several existing university source URLs returned 404/timeouts
during the review. The indexed [official alumni page](https://www.tec.ruh.ac.lk/alumni/)
labels its committee as 2024–2025. Catalog contacts are therefore explicitly
presented as snapshots, not certified current appointments. Reviewers must use
independently obtained current contacts when a linked source is unavailable or
outdated. Existing source links are retained rather than substituting unverified
third-party data.

Production malware scanning, evidence retention/deletion, backup controls, shared
rate limiting, reviewer procedures and monitoring remain prerequisites from the
provider-verification review. This phase provides claim status/history; centralized
notifications, realtime delivery, blocking, anti-spam and the broader messaging
workflow remain separate phases. The production JS bundle still exceeds Vite's
warning threshold; bundle size is recorded with the validation evidence below.

## Validation evidence

The phase adds 74 automated cases: 37 backend unit, 29 backend integration,
seven frontend integration and one Chromium journey. The complete expected suite
contains 458 cases (244 backend unit, 156 backend integration, seven frontend unit,
33 frontend integration, nine Chromium and nine repository-policy checks).

Executed local evidence on 2026-10-20/21:

- All 244 backend unit tests passed. Focused community ownership, eligibility,
  transitions, privacy, review, transaction rollback and concurrency checks passed.
- The final broad backend integration run passed 154 of 156 cases. A community
  setup hook timed out during a long local pause, and an existing resource-
  concurrency case received a transient 503 for one reservation. Both cases were
  rerun directly against fresh isolated MongoDB instances and passed with unchanged
  timeouts. The community case had recorded an approximately ten-minute local
  pause despite a 60-second configured setup-hook limit. Full clean-run CI evidence is
  recorded on the review PR rather than describing that local run as green.
- Seven frontend unit tests passed. All seven new frontend integration cases passed.
  The broad 33-case integration run passed 32 cases and timed out in an existing
  oversized-upload test during another long local pause. Its focused rerun passed
  with the original timeout. No external network traffic was allowed in these tests.
- The full Chromium suite passed: nine tests, including the new request-info,
  resubmission, independent evidence/identity review, approved access, opt-in,
  student conversation and consent-withdrawal journey. All database records used
  by automated tests were synthetic and disposable.
- Backend source/test TypeScript checks and production build passed. Frontend
  source/test TypeScript checks, lint and production build passed. The production
  JS bundle is 635.23 kB and retains the Vite size warning. No backend lint script
  exists; strict TypeScript and relevant unit/integration tests were executed.
- Nine repository-policy checks passed. The staged index contained 243 files and
  zero forbidden environment/dependency/build-output files; whitespace checks
  passed. Credentials, local backups and screenshots stay ignored. Desktop/mobile
  directory, owner controls and admin-review screenshots were inspected.
- The Docker local app was restored on 2026-10-21. Existing admin/student logins
  returned 200, the pending company provider's full login remained 403, and the
  student community-directory API returned 200 with zero approved members. No
  local directory identity was fabricated or approved. Actual Vite requests to
  the shared catalog returned 200, while the backend `.env` and server source
  returned 403, verifying the development-server file-access boundary.

Earlier browser attempts exposed selector ambiguities and a notice assertion that
ran before a request completed. The final test waits for the actual preference-save
response and scopes the message assertion to the conversation thread. No application
security gate or test timeout was relaxed to obtain a pass. The review PR records
the exact implementation head and its complete application/security workflow results.
