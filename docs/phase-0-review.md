# TechBridge V2: Phase 0 review

Review date: 2026-10-17 (Asia/Colombo). This report covers source review and repository stabilization, not production certification. No database, seed, or migration was executed. No integration branch, merge, history rewrite, deployment, or production-data change is authorized by this report.

## Implementation summary and acceptance criteria

Feature: repository audit and security stabilization. Branch: `audit/security-reconciliation`. Exact starting commit: `ac248bff7bec845d6a97612334f099ef47aa5915` (`development`, Phase 2). Scope: preserve application behavior, remove local credentials and reproducible artifacts from the current index, prevent reintroduction, and provide the seven requested audit deliverables. The next phase requires explicit approval under sections 3, 4, and 21 of the supplied requirements.

Acceptance criteria:

- Record branch heads, merge base, tree differences, and an integration proposal without merging.
- Trace existing modules through pages/API clients/routes/controllers/models; distinguish source evidence from executed behavior.
- Remove tracked environments, dependency trees, and compiled application output without deleting local copies.
- Add a placeholder-only environment example and automated unit/integration checks of the actual Git index and ignore rules.
- Document security findings, migration/rollback risks, testing design, and feature order.
- Execute existing builds/lint and the new repository regression checks; report failures honestly.

## Architecture audit

The application is two independent npm packages, with no root workspace package. Frontend: React 19, TypeScript, Vite, React Router, Tailwind, Axios, and shared types in `frontend/src/types/index.ts`. `App.tsx` defines routes, `ProtectedRoute` gates UI access, `AuthContext` rehydrates `/auth/me`, and the Axios interceptor attaches bearer tokens from localStorage. Existing components and green styling remain unchanged. There is no evidence identifying a separately approved UI branch in the available Git heads; its owner must supply that baseline before shared component integration.

Backend: Express 5, TypeScript, Mongoose/MongoDB, bcrypt, JWT, express-validator. `server.ts` combines app creation, middleware, route mounting, DB connection, and listening; importing it starts the server. Thirteen route modules delegate to controllers and ten Mongoose models. Business rules are largely in controllers; reusable matching, priority, provider capabilities, and token helpers live in `utils`. There is no general service layer, centralized error middleware, migration ledger, notification worker, or real-time transport.

Authentication rechecks the persisted user's role and suspension state on protected requests. Registration permits student/provider roles and resets provider verification; these are useful existing controls. Provider publishing and creator discovery have verification guards. Ownership filters protect applications and resource edits; conversation message operations require participant membership. These controls have not been verified with database-backed API tests and must be retained while adding regression coverage.

Data constraints include unique email, unique `(studentId, opportunityId)` applications, a unique conversation participant key, unique report targets per reporter, and a partial unique index for pending requests for the same student/resource. Message history has a conversation/date index. Resource requests have no equivalent unique constraint for active requests across a category. Deployment must explicitly verify which indexes exist in the real database; schema declarations alone do not prove deployed constraints.

## Branch reconciliation

Remote heads were checked using `git ls-remote --heads origin` and matched local remote-tracking refs:

| Ref | Commit |
| --- | --- |
| `development` | `ac248bff7bec845d6a97612334f099ef47aa5915` |
| `main` | `a8f4e5225710e8485897181f2295f4954b25e7e0` |
| `a` | `d3cf629c10283e49d449e8becf7e12d18db118da` |
| `b` | `e45d5661c1cfa3c080f16ec17c835ef948fddfb1` |

`main...development` has one unique commit on each side. Merge base: `418ded451b67f66b8067c5360f0e25c4aac41e11`. Main's unique commit is the merge of README work; its tree equals the merge-base tree (`git diff --stat <merge-base> origin/main` produced no changes). Development's unique Phase 2 commit changes 58 application/documentation files, with 1,563 insertions and 293 deletions when dependencies/build artifacts are excluded. Using main's tree alone would omit that work. Both historic `a` and `b` heads are already ancestors of development (`git merge-base --is-ancestor` returned 0 for each); they require no separate feature recovery.

Proposed strategy, pending approval:

1. Review this Phase 0 branch against its exact development base. Keep development/main and local dependency contents intact.
2. Create `integration/techbridge-v2` at the recorded development commit only after approving this base. Prefer a separately approved no-content merge of main if preserving the main merge ancestry is required; do not recreate Phase 2 through piecemeal cherry-picks.
3. Submit this audit branch as its own PR into that baseline. Review the large dependency/build removals as index cleanup, separately from source files. Merge only with explicit authorization.
4. Start `chore/testing-foundation` from the resulting approved integration commit. Each subsequent branch starts from the latest approved baseline and has a separate PR.
5. The UI workflow should use the same approved baseline; resolve shared-file changes in reviewed PRs. Do not edit or overwrite another branch.

The initial working tree had one untracked dependency-local configuration file. It was not opened, altered, or staged; dependency ignore rules now cover it. Git required a command-scoped `safe.directory` because the sandbox account differs from the repository owner; no global Git configuration was changed.

## Feature implementation matrix

No product feature is classified as fully implemented and tested. Existing source wiring is evidence of implementation, not a successful end-to-end run. Paths below are relative to the package `src` directories unless otherwise stated.

| Module | Classification | Existing trace and reusable behavior | Missing behavior / risk |
| --- | --- | --- | --- |
| Authentication/profile | Implemented but untested; requires improvement | `LoginPage`, `RegisterPage`, `StudentProfilePage` -> `authApi` -> `authRoutes` -> `authController`, `auth` middleware -> `User`, JWT helpers. Hashing, role allowlist, suspension checks. | No rate limits, recovery/rotation/revocation flow, or email ownership checks; localStorage tokens; short minimum registration password; no API regression evidence. |
| Admin user management | Partially implemented | `AdminDashboardPage` -> `adminApi` -> admin-only `adminRoutes` -> `adminController` -> `User`, `AuditLog`. Search, role/page API filters, suspend/reinstate. | UI exposes only initial pages; controlled role changes and per-account history missing. Action plus audit are separate writes. |
| Provider verification | Partially implemented | Same admin trace; approve/reject with required reason; pending/rejected login restrictions. | Registration file input sends only a filename; there is no uploaded document to securely review. No request-more-info state, full decision history, or delivery notifications. |
| Moderation/audit | Partially implemented | `reportApi`, `reportRoutes`, `reportController`, `Report`; admin review/removal and `AuditLog`. Message/campaign report types exist. | Report target existence/ownership not checked. No narrow auditable evidence-review workflow. Deletes can orphan application/request references. Report resolution can be saved before removal/audit fails. |
| Faculty/alumni identities | Partially implemented; requires security improvement | `FacultyConnectionsPage` combines static `data/facultyConnections.ts` with `messageApi` directory results; `listMentors` selects verified provider users. | `seed.ts` manufactures verified identities for named contacts with shared passwords; no claim/affiliation proof, consent, availability, privacy, or deactivation workflow. |
| Messaging | Partially implemented | `MessagesPage` -> `messageApi` -> `messageRoutes` -> `messageController` -> `Conversation`, `Message`. Persistent 1:1 history, page API, unread/read state, participant checks and creation eligibility. | UI polls every 10s and requests first message page; no real-time transport, typing, blocking, preferences, search or anti-spam. Send rechecks membership only, not current relationship eligibility or recipient suspension. Admins do not have a global message-read bypass. |
| Creator profiles | Partially implemented | `CreatorProfilePage`, `CreatorDirectoryPage` -> `creatorApi` -> `creatorRoutes` -> `creatorController` -> `User.studentProfile.creatorProfile`. Explicit opt-in, verified-provider audience, restricted projection, platforms/niches/content/compensation filters. | No availability, distinct public display name/image, name search, or complete pagination; URL validation checks HTTP(S) protocol but does not verify platform domain. Counts are already labeled self-reported in the profile UI. |
| Creator collaborations | Partially implemented | Creator/provider request pages -> `promotionRequestApi` -> `promotionRequestRoutes` -> `creatorController` -> `PromotionRequest`. Invite, accept, decline, complete with participant/role checks. | Only pending/accepted/declined/completed states. No drafts, cancellation, negotiation versions, progress, submissions, review or agreement history. No payments implemented. |
| Scholarship priority | Partially implemented; requires correctness tests | Opportunity/application pages -> application APIs -> `applicationController` -> `priorityEngine` / `matchEngine` -> `Application`, `Opportunity`. Justification, need, score reasons, derived waitlist, human acceptance. | Fixed 40/30/20/10 weights; no actual eligibility enforcement, confidential evidence, persisted waitlist, appeals, reasoned overrides or decision history. Count-then-save awards can exceed capacity. Benefit aggregate uses string IDs, which Mongo aggregate does not cast to ObjectIds. |
| Resource discovery/allocation | Partially implemented; concurrency risk | Resource hub/listing/request/provider pages -> resource APIs -> `resourceController`, `resourceRequestController` -> `Resource`, `ResourceRequest`, priority helper. Borrow/share/rent/installment/interest-free/sponsor/donate forms and ownership checks; conditional atomic stock decrement. | Request acceptance and stock changes lack a shared transaction/CAS; duplicate acceptance can decrement stock twice when multiple units remain. Save failures can leak stock. Category duplicate check races. Completion does not replenish borrow stock; no reservation/return dates, overdue/dispute workflows or persisted waitlist. Prior-benefit aggregate also uses string IDs. |
| Opportunity discovery/applications | Partially implemented | Feed/detail/provider/application pages -> opportunity/application clients/routes/controllers -> `Opportunity`, `Application`, matching helper. Publish/edit, filters, deadlines, owner updates, unique applications. | No saved opportunities, alert delivery, explicit eligibility or complete search/pagination. Generic status updates lack a strict transition policy. Reads bulk-expire records as a side effect. Rule-based matching should retain its current explainable scope. |
| Mentorship | Partially implemented (listings); scheduling missing | Opportunity type supports mentor name/field/focus/availability; faculty directory and messaging reusable. | No mentorship request, booking, rescheduling, overlapping-slot protection, history, consent/preferences, or feedback models/routes. |
| Notifications | Missing centralized system | Unread chat count is computed; provider verification response merely says notification service could be enabled. | No notification model/API, preferences, worker/outbox, delivery adapter, retries or reminders. |
| Campus events | Missing | Workshop opportunity type is reusable discovery content only. | No event model, organizer authorization, registration, attendance or atomic capacity management. |
| Analytics | Partially implemented | Dashboard/provider/impact pages -> `dashboardApi`/`providerApi` -> aggregate queries in dashboard/provider controllers. Real record counts, empty fallbacks. | Platform totals available to every authenticated role; no complete role/date-scoped metrics, creator/mentorship impact or resource utilization model. No aggregation accuracy tests. |
| Production hardening/testing | Requires improvement; product tests/CI missing at base | Existing build scripts, schema indexes, bounded validation, CORS localhost allowlist. | No full test scripts, CI, rate limits, centralized errors, structured redacted logs, config validation, backup/restore runbook, production routing/CORS configuration, or health readiness distinction. Phase 0 adds only repository-policy tests/CI. |

## Security findings

Severity below is source-based triage, not a penetration-test result. No secret values are reproduced.

| ID | Severity | Evidence and impact | Disposition |
| --- | --- | --- | --- |
| S01 | Critical if deployed/exposed credentials are active | `backend/.env` is tracked on both main and development, including `MONGODB_URI` and `JWT_SECRET`; history includes earlier versions. Historical compiled output/dependencies can retain sensitive examples too. | Remove current tracking; keep local file. Treat all historical signing/DB credentials as compromised until owner rotates/revokes them. This change cannot revoke credentials or erase history. |
| S02 | High | `seed.ts` has predictable admin and shared community passwords; named faculty/alumni accounts are inserted as verified. README advertises a default admin login. | Stop using seed for real environments. Restrict future seed to disposable synthetic identities; review existing seeded users with the owner, revoke sessions/reset or quarantine only after a backup and approval. No existing account is changed here. |
| S03 | High | Resource acceptance decrements stock before separately saving the request; no conditional request-state update or transaction. Scholarship awards use count-then-save. | Add replica-set-backed concurrency tests and transactional/CAS changes in separately scoped fixes after the test foundation. |
| S04 | High | `getPublicProviderProfile` selects and returns the entire `providerProfile`, including verification filename/rejection reason/contact fields; public listings also populate contact fields. | Define a deliberate public-field allowlist and owner/admin-only verification evidence access. Regression tests must check serialized responses, not only Mongoose query shape. |
| S05 | Medium/high | `sendMessage` checks participants, but not recipient suspension or current relationship permissions; no blocking or rate limiting. | Preserve participant checks, add current communication policy and anti-spam tests before real-time events. Admin conversation creation permission is broader than ordinary users, but no global private-history read route was found. |
| S06 | Medium | Mutations and audit inserts are not atomic; audit targets omit reports/campaigns/applications. Invalid/oversized reasons can fail audit after an account change. | Transactional action/evidence history with bounded mandatory reasons and restricted audit-writing paths. |
| S07 | Medium | No rate limiter, startup environment validation, token revocation, centralized JSON error handler, secure upload processing, or structured logging. Default JSON-parser failures may return Express HTML. | Treat production deployment as blocked pending dedicated fixes. CORS is currently a localhost allowlist, not a wildcard; add configurable exact production origins. |
| S08 | Medium | Benefit aggregation `$match` receives string student IDs against ObjectId fields; missing prior benefits may distort fairness. Resource duplicate checks are not backed by category-active uniqueness. | Correct typed aggregation IDs; fixture-test repeat benefits and concurrency. Do not equate a score with eligibility or entitlement. |
| S09 | Medium | Reports can reference arbitrary syntactically valid IDs; private message/campaign evidence is not scoped at submission. | Verify target existence and reporter access; create narrowly scoped auditable complaint evidence rather than global admin message access. |
| S10 | Engineering/security hygiene | Base tracks 4,526 dependency files and 135 compiled backend files; no root ignore policy or CI. | Remove only index entries; add ignore rules, placeholder env, actual-index tests and PR security check. Regenerate output with builds and dependencies with lockfiles. |

No registration-to-admin escalation was established: the router validates roles and controller allows student/provider only. No claim that all IDOR paths are safe is made. Unit/integration API tests must cover every ownership and role boundary, malformed IDs, revoked verification, suspended users, confidential justification responses, and upload byte/type restrictions.

Credential response plan: inventory exposed historical credentials without printing values; rotate at the credential provider; deploy fresh secrets; invalidate old JWTs; reset/quarantine affected demo accounts under owner approval; verify old credentials no longer work. Only then consider historical cleanup in a separate clone with an agreed maintenance window, protected-branch coordination, backup refs and a collaborator reclone plan. Do not force-push, rewrite, reset, or delete branches as part of this phase.

## Identity-claim design

Keep public directory entries separate from login accounts. A directory record has source/affiliation/expertise and no password or implicit verified identity. An authenticated user submits a claim tied to an entry; verify institutional email ownership through an expiring single-use token where appropriate, plus explicit affiliation evidence/manual review for alumni. Prevent concurrent approved claims with a database uniqueness rule. An authorized admin approves/rejects with a reason and history; approval binds the actual account, not an automatically generated identity. Use neutral directory labels until approved. Verification, contact permission, public visibility, availability, and account status are separate controls. Default messaging permissions conservatively; support revocation, deactivation and an appeal path. No known shared passwords or automatic verified real-person accounts.

## Migration compatibility and rollback risk

`migratePhase2.ts` backfills application/request justification, declared need and resource category. It loads all matches into memory and updates one by one, has no dry run, transaction, checkpoint, migration ledger, backup hook or rollback snapshot. It ignores missing/null/invalid values outside its `$exists:false` selection and does not reconcile legacy provider verification/account status. Normal Mongoose defaults do not backfill stored data. Its read-then-write predicate can overwrite a concurrent update. Derived default `medium` need must be marked legacy/unknown in any fairness assessment; it is not evidence of a student's circumstances.

Rehearsal plan, requiring an isolated restored copy:

1. Owner supplies a backed-up dataset through an approved mechanism. Confirm restore works before any write; record DB version, topology, indexes, counts, legacy omissions, duplicate keys and orphan references.
2. Inventory affected documents without exposing confidential records. Design bounded batches, idempotent conditional updates, explicit invalid/null handling, a migration ledger, and before-images for changed fields.
3. Rehearse older/newer API compatibility and constraints against the copy. Verify record counts, historical timestamps, benefit scores, provider states, and repeat-run no-ops. Review unique-index failures before building new constraints.
4. Approve a write pause or concurrency-safe rollout; deploy only after the backup and application rollback have been verified. Multi-document transactional allocation requires a MongoDB replica set, including tests.
5. Roll back by restoring the exact pre-migration data snapshot or reviewed before-images while controlling writes; a code rollback alone does not undo database changes. Do not remove newly required fields blindly or drop data/indexes without a separate plan.

No schema/index changes or migration command are included in this branch. Keeping local `.env` preserves developer configuration; new clones copy `backend/.env.example` to `.env` and supply fresh local values. Never use production data for tests or run seed against a shared database.

## Test infrastructure plan (next branch, not implemented here)

Frontend: Vitest, React Testing Library, user-event, jsdom, MSW; deterministic API handlers, per-test resets, no live network. First tests: pending-provider registration has no session, auth rehydration/denials, protected routes, and a real API-client-to-render integration test with MSW. Retain existing approved components/styles.

Backend: separate an exported `createApp`/app module from DB/listening bootstrap without changing route URLs. Vitest or Jest + Supertest; isolated MongoDB Memory Server replica set or a CI-provisioned replica set. Before any connection, require `NODE_ENV=test`, an explicit test URI and an approved loopback test database name; fail closed before loading `.env` or any production credentials. Run migrations only on disposable fixture databases. Create indexes before concurrency tests and close connections/listeners after the suite.

Fixture factories: synthetic student, provider (pending/verified/rejected/suspended), admin, unclaimed directory lecturer/alumni and claimed identities, scholarship/capacity/application, resource/request, participant/nonparticipant messages, campaign. Use fixed timestamps, deterministic IDs and test-only secrets; hash passwords where login is exercised. Database cleanup must target only each suite's own validated test database, never a configured production database.

E2E: Playwright against a dedicated API/database and Vite preview; seed synthetic accounts through test-only fixture code. Cover student application, provider verification, participant messaging and resource reservation. No UI feature completion claim until these exercise real APIs. Keep MSW component coverage distinct from real API E2E evidence.

Scripts to add in each package: `test:unit`, `test:integration`, appropriate lint/typecheck/build; add `test:e2e` with documented stack startup. Inspect installed tool and Node engine compatibility before selecting versions. Use `npm ci` and lockfiles. Full PR CI must run frontend lint/build/unit/integration, backend typecheck/build/unit/integration and significant E2E journeys. Avoid implicit binary downloads during tests; provision/cache MongoDB and browser binaries explicitly. Upload reports without secrets, fixture passwords, private messages or applicant records. Phase 0's repository-only workflow is not a substitute for that pipeline.

## Prioritized implementation roadmap

Only this Phase 0 branch is active. Every row requires review and explicit approval before the next branch; no automatic merges.

| Order | Branch / scope | Dependencies / key acceptance gate |
| --- | --- | --- |
| 0 | `audit/security-reconciliation` | This audit, index hygiene, credential response and baseline decision. |
| 1 | `chore/testing-foundation` | Approved integration baseline; isolated fixtures, API/component tests, E2E scaffold, CI. Address existing lint failures in a narrowly reviewed prerequisite if needed. |
| 2 | Smaller security branches split from production-readiness scope | Seed safety, public-field projections, startup/error/auth policy regression tests. Owners rotate compromised credentials before shared deployment. |
| 3 | `feature/admin-management` | Authorization, controlled role updates, robust transactional history. |
| 4 | `feature/provider-verification` | Secure evidence storage/review, state transitions, reasons/history; notification adapter dependency explicit. |
| 5 | `feature/community-verification` | Genuine claims, affiliation checks, consent/privacy. |
| 6 | `feature/internal-messaging` | Current permission policy, blocking/anti-spam and real-time authorization. |
| 7 | `feature/campus-creators` | Opt-in privacy, profile/domain validation, audience-scoped discovery. |
| 8 | `feature/creator-collaborations` | Lifecycle, deliverable review, agreement history; no payments. |
| 9 | `feature/scholarship-priority` | Typed benefit queries, configurable explanations, human review, atomic award capacity, appeals. |
| 10 | `feature/resource-priority` | Transactional/CAS reservation, concurrency and rollback tests, return lifecycle. Promote this focused fix earlier if real allocation is currently in use. |
| 11 | `feature/opportunity-management` | Saved/search/eligibility/deadline/status workflows. |
| 12 | `feature/notification-system` | Central preference-aware outbox/delivery; initial branches must explicitly report undelivered notification dependencies. Can move earlier by approval when dependent workflows need delivery. |
| 13 | `feature/mentorship-system` | Verified mentors, contact consent, atomic booking, notifications. |
| 14 | `feature/campus-events` | Organizer permissions, registration/capacity concurrency, reminders. |
| 15 | `feature/platform-analytics` | Role/date-scoped actual metrics and privacy. |
| 16 | `chore/production-readiness` (split as needed) | Full regression, backup/restore rehearsal, load/index measurements, production CORS/routing/secrets/monitoring and release rollback approval. |

## Technical changes and review boundaries

New: root `.gitignore`, `backend/.env.example`, `scripts/repository-security.mjs`, two `tests/repository-security.*.test.mjs` files, `.github/workflows/repository-security.yml`, and this report. Removed from index only: `backend/.env`, `backend/node_modules/**`, `backend/dist/**`. Source files, package scripts, schemas, API URLs, authorization behavior and frontend presentation are unchanged. Runtime security findings above remain open for scoped fixes; repository cleanup is not a claim of production readiness.

The policy CLI reads filenames from `git ls-files -z` and reports only category counts. It does not inspect or print secrets and is not a content/history secret scanner. Unit tests cover environment variants, examples, Windows paths, dependencies/output and legitimate source files. Integration tests exercise the actual repository index, Git's ignore engine, the environment example, and CLI output. They do not use MongoDB or certify application API behavior.

## Execution evidence

Checks below were executed during Phase 0. Run repository checks from the repository root:

```sh
node --test tests/repository-security.unit.test.mjs
node --test tests/repository-security.integration.test.mjs
node scripts/repository-security.mjs
```

- Backend `npm run build`: PASS, exit 0 (TypeScript compilation).
- Frontend `npm run build`: PASS, exit 0 (TypeScript + Vite, 1,915 modules); emitted a 592.06 kB main JS chunk warning, a later performance concern.
- Frontend `npm run lint`: PASS, exit 0.
- Repository unit tests: PASS, 5 tests executed, 0 failures.
- Repository integration tests: PASS, 4 tests executed, 0 failures. Actual Git index contains zero forbidden environments/dependencies/build outputs. Tests also verify future ignore behavior and that the example remains trackable.
- Repository security CLI: PASS, exit 0; 142 files tracked after staging the seven new audit files; environment/dependency/build-output counts all zero. All nine tests passed again against that index. Local `.env`, `node_modules`, and `dist` directories were each verified to remain on disk.
- Product `test:unit`/`test:integration` and E2E: absent at base; not claimed as executed. Backend lint script absent. Full reusable infrastructure belongs to the next approved branch.
- Runtime API preview/DB regression: not run; no safe test database is configured and importing `server.ts` connects/listens immediately. The concrete demonstration for this scope is the real-index security CLI and its integration tests.
- CI: repository-security workflow PASS on the implementation commit; PR-triggered [run 39033799394](https://github.com/HajithMohamed/Tech_Bridge/actions/runs/39033799394) completed with conclusion `success`. Full application PR checks remain planned for the testing foundation.

## Git review and approval gate

Branch: `audit/security-reconciliation`; base SHA recorded above. Implementation commit: `54eb5e5edd88cb350403a19bcfa8beba57e0f049`. [Draft PR #4](https://github.com/HajithMohamed/Tech_Bridge/pull/4) is published for review against `development`; retarget it to the approved integration branch before any eventual merge. This report's evidence update is a separate documentation commit; use `git log -1 --format=%H audit/security-reconciliation` for the final head. The working tree was clean after the implementation commit, application sources/manifests/lockfiles matched the base, and development/main refs were unchanged. No merges or conflict resolution have been attempted. Integration dependencies: owner approval of baseline/tree strategy, credential rotation, isolated testing infrastructure, and the separately approved UI baseline.

Approve the Phase 0 scope and the proposed development-based integration strategy before creating the integration branch or starting `chore/testing-foundation`. Approval of this review is not approval for production-data changes, destructive migrations, Git history rewriting, or automatic merges.
