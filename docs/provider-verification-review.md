# Provider verification review

Feature: provider verification and evidence review. Branch: `feature/provider-verification`. Base: development `c8b345b90d6709ae836a5c6ca07b54a2a2ad29c7` (merged admin PR #14). Scope approved on 2026-10-19. Implementation is ready for owner review after the checks below. No automatic merge or production migration.

The existing queue is unpaginated, registration stores a filename without bytes, approval needs no evidence/reason, and user changes/audit events commit separately. Pending/rejected providers cannot sign in to submit corrections. The existing public provider DTO already excludes verification/contact evidence and will remain an explicit allowlist.

Acceptance: bounded private PDF/PNG/JPEG submission; owner/admin-only attachment downloads; a short-lived verification-only session without full portal access; pending, needs-information, rejected and verified states; paginated admin queue and per-provider history; mandatory bounded decision reasons; approval of the exact current document only after the acting administrator downloads it; atomic account/decision/audit updates; stale-decision and concurrent-upload protection; in-app decision notices with owned read state; resubmission after rejection/information requests. Identity/contact edits withdraw verification and require new evidence; ordinary service/description edits retain it. Public resource badges derive from current owner verification rather than the old creation-time snapshot. The existing green styles, admin user management, moderation and allocation behavior are preserved.

API additions: `/api/provider-verification/session`, authenticated status, documents, history and notice-read routes; admin provider history/document download and request-info routes. Existing admin verify/reject paths remain but require a reason and explicit current `documentId` (null when absent). Approving a filename-only legacy submission is intentionally disallowed. Existing verified accounts are not automatically revoked or treated as newly identity-verified.

Data: new private `verificationdocuments` and `verificationevents` collections; optional current document ObjectId and NEEDS_INFO enum value on provider profiles; audit snapshots include verification status. Document bytes/hash are excluded from default queries; only the authorized attachment handlers explicitly select bytes. New indexes cover provider/date history, owned unread decisions and actor/document review lookups. No field/index removal or destructive backfill. Transactions require a MongoDB replica set/sharded cluster, including provider profile edits. Old filename values remain legacy metadata until a real submission replaces them. Existing resource snapshot flags are retained in storage; public responses calculate their current value. Database backup/retention and scanner integration must be addressed before production document collection.

Document policy: at most 2 MiB decoded, five uploads/account/rolling 24 hours, strict base64, sanitized bounded names, permitted extensions matched to file signatures, structural checks and obvious active PDF actions rejected. Documents are downloaded as opaque attachments with no-store/nosniff/sandbox headers, never embedded. These checks do not constitute antivirus scanning or identity authenticity verification; the administrator must inspect evidence and confirm affiliation independently. No social scraping, production accounts or real-person seed changes.

New backend files are the provider-verification controller, service, policy, model, router and session rate limiter; new frontend files are the verification API client, provider verification page, admin review panel and shared history component. Existing auth middleware/JWT, registration, admin routes/controller, provider/profile controller and public resource/provider responses are updated. Existing User and AuditLog schemas gain the additive fields above. Registration/login links and the admin dashboard connect the new screens. Provider profile fields receive associated accessible labels and explain when reverification is required. Unit/API/component/browser fixtures and tests accompany the implementation; the older admin-approval integration test now submits real fixture bytes and reviews them first.

| API | Access and contract |
| --- | --- |
| POST `/api/provider-verification/session` | Provider email/password; 15-minute verification-only JWT held in React memory |
| GET `/api/provider-verification` | Current provider status, safe current-document metadata and unread decision count |
| POST `/api/provider-verification/documents` | `{fileName, content: base64, note?}`; owner-only submission, 2 MiB decoded, five/rolling 24h |
| GET `/api/provider-verification/documents/:documentId` | Owner-only current or historical attachment; foreign IDs return 404 |
| GET `/api/provider-verification/history?page=1` | Owned history, 20 entries/page; actor name/role, no actor email |
| PATCH `/api/provider-verification/history/:eventId/read` | Owned admin-decision notice only; idempotent read state |
| GET `/api/admin/providers?status=PENDING&q=&page=1` | Admin-only search and status filter; 20 providers/page; ALL supported |
| GET `/api/admin/providers/:id/history?page=1` | Admin-only verification history, 20 entries/page |
| GET `/api/admin/providers/:id/documents/:documentId` | Admin-only private attachment; actor reauthorized and download audited transactionally before bytes are released |
| PATCH `/api/admin/providers/:id/verify`, `/reject`, `/request-info` | Admin decision with `{reason, documentId}`; documentId must equal the current value, explicitly null when absent |
| PUT `/api/provider/profile` | Existing endpoint; identity/contact/location/website changes atomically withdraw verification, record history and revoke prior sessions |

| From | Action | Result |
| --- | --- | --- |
| PENDING | Approve exact stored document downloaded by the acting admin | VERIFIED |
| PENDING or NEEDS_INFO | Reject with reason | REJECTED |
| PENDING or VERIFIED | Request additional information | NEEDS_INFO; verification withdrawn |
| PENDING, NEEDS_INFO or REJECTED | Submit evidence | PENDING; new immutable document and history entry |
| VERIFIED | Change identity/contact/location/website | NEEDS_INFO; fresh supporting evidence required |
| VERIFIED | Edit description/logo/services without identity changes | Verification retained |

Repeated/stale decisions and approval from NEEDS_INFO/REJECTED return 409. A corrected submission must first return the account to PENDING. Suspended accounts cannot obtain restricted sessions or submit evidence; verification approval cannot reinstate a suspended account. Restricted tokens cannot authenticate any general platform/admin endpoint. All authenticated requests check the current persisted role/account status and private token version. Verification decisions and identity edits revoke old full and restricted sessions, so owners sign in again to read the newest decision. The independent verification API client does not overwrite or clear an unrelated full platform session. After an identity edit, full-session cleanup occurs on the public verification route to avoid a protected-route redirect race.

Transactions lock the acting administrator and target provider as applicable, serialize submissions against the per-account quota, require an exact current document for decisions, and commit the account/version, decision notice and audit log together. Audit/history persistence failures roll back the account change; an audit failure prevents an administrator download from releasing bytes. Concurrent profile edits cannot overwrite verification withdrawal. Public provider/resource projections exclude filenames, document IDs, notes, reasons and contact evidence. Validation errors use 400/413, invalid/revoked sessions 401, role/suspension denials 403, foreign/missing documents 404, stale decisions 409, rate/quota bounds 429 and operational transaction failures a generic 503. Parser errors return bounded JSON without echoing uploaded bodies.

Deployment compatibility: deploy frontend and backend together because the old verify/reject clients omit required review fields and the new NEEDS_INFO state requires updated UI/model support. Existing Phase 2 verification flags are retained; historical demo flags are not evidence of a real person's identity and require the previously documented owner-led identity audit. Records missing their Phase 2 verification status still require the reviewed migration/backfill procedure; no migration was run here. No automatic faculty/alumni claim, payments, real-time messaging or general notification/email delivery is introduced. Verification decisions have their own in-app history/unread notices; the centralized notification phase remains separate.

Production limits: signature/structural/PDF checks do not replace malware scanning. PDFs with encryption, forms, object streams or obvious active actions are rejected by the conservative policy. Attachments are downloaded rather than previewed, and a download record cannot prove an administrator actually inspected the document. Operators must provide malware scanning, a retention/deletion policy, backups, database/storage access controls and independent affiliation checks before collecting production identity evidence. Session-attempt throttling is bounded in process (10/normalized email and 60/IP per 15 minutes); shared edge throttling and correct trusted-proxy configuration are required for multiple instances. Existing historical verification flags are not automatically revalidated. This feature is not a claim that the entire V2 production-hardening roadmap is complete.

No deployment, production data operation, secret change or destructive migration was performed. Rollback should disable verification decision/submission writes first, preserve both private collections and audit records, and use a build that understands NEEDS_INFO. An older application can otherwise restore the unsafe filename-only approval behavior; prefer a forward fix over a blind rollback.

The disposable browser demonstration uses `/provider-verification` and `/admin`: register a synthetic provider, upload actual PNG bytes, download/review as admin, request information, resubmit, reject, resubmit, approve, read notices and sign in to the provider portal. Changing organization identity then signs out and requires updated evidence. Run `npm.cmd run build` and `npm.cmd run test:e2e` from `frontend` after preparing the local MongoDB binary per the testing foundation docs. The checked screenshots are ignored local artifacts under `output/playwright/`: `provider-verification-admin.png`, `provider-verification-owner.png`, `provider-verification-mobile.png`, and `provider-reverification.png`. Test data uses synthetic `.example.test` accounts and disposable loopback MongoDB replica sets, with no production records or outbound notification delivery.

Executed locally on 2026-10-19; review finalized on 2026-10-20:

| Check | Executed result |
| --- | --- |
| Backend unit suite | 171 passed; 42 new provider policy, token, rate-limit and current-badge cases |
| Backend integration suite | 118 passed; 27 new provider verification, privacy, concurrency and rollback cases |
| Frontend unit suite | 7 passed |
| Frontend integration suite | 26 passed; 9 new verification/profile-edit cases |
| Chromium regression suite | 8 passed; includes the new multi-actor verification/reverification journey |
| Repository policy suite | 9 passed |
| Backend/frontend TypeScript checks | Passed |
| Frontend lint | Passed; no backend lint script exists, so backend validation uses strict TypeScript and tests |
| Backend/frontend production builds | Passed; frontend retains the bundle-size warning (612.72 kB JavaScript) |
| Staged Git index policy and whitespace | Passed; no tracked environment, dependencies or build output |

Total: 339 passing test cases, 79 new in this branch. The focused final verification/privacy run also passed all 80 cases. Both test-server ports closed after the browser run; disposable databases were stopped. No production records were accessed. One intermediate browser startup failed because the disposable MongoDB instance exceeded its startup deadline; the final complete eight-test browser run passed without increasing timeouts. The component tests found and verified the fix for a protected-route/logout redirect race after identity edits. File-input component tests explicitly submit the form because JSDOM cannot validate user-event's synthetic FileList; Chromium covers native file selection and required validation.

Review status: implementation complete for this scoped branch, awaiting owner review. The associated PR records the exact head commit and fresh CI links. Do not automatically merge or start community verification before owner approval. Production scanning/retention controls and the broader V2 roadmap remain outstanding as described above.
