# Admin management review

Base: development `302a19f1fdb0ce6f61a545a5ec552516e5347478`, containing both merged allocation fixes; fetched again on 2026-10-19. Branch: `feature/admin-management`. Provider verification follows on its own branch after this review, following the requested one-branch/approval sequence. No automatic merges or production operations.

Acceptance criteria: real user search, role/status filters, stable pagination, suspension/reinstatement with bounded reasons, controlled admin promotion/restoration, self-protection and an active administrator remaining under concurrent actions. Account mutation and actor/target/before/after/reason audit evidence must commit atomically. Role/status changes revoke previously issued sessions. Administrators can inspect paginated per-user and global action history. Existing provider/moderation screens remain available.

Role policy: grant admin only to an active student with a complete student profile or verified provider with a complete provider profile. Remember the original role; restore only that role. No direct student/provider conversions, self changes, or implicit profiles. Legacy administrators without a recorded original role require an explicit provisioning/recovery procedure; they cannot be guessed into another account type.

Compatibility: existing user listing and status routes remain; reasons (3–1000 characters) are now required for reinstatement and role changes as well as suspension. Add PATCH `/api/admin/users/:id/role` and GET `/api/admin/users/:id/history`. All mutations require a transaction-capable MongoDB replica set/sharded cluster and recheck the actor inside the transaction. New optional `adminBaseRole` and private `tokenVersion` fields need no backfill; legacy missing versions mean zero until mutation. New JWTs carry the version; old version-zero tokens remain valid only until the account changes. No schema/index removal or production migration is executed.

The frontend uses the existing green palette and portal layout. User management and action history are connected to the real APIs. Sign-in now routes administrators to `/admin`, providers to `/provider`, and students to `/dashboard`; previously the shared sign-in path sent administrators to the student dashboard.

New files: `backend/src/services/adminUsers.ts`, backend unit/integration tests, frontend `AdminUsersPanel` and `AdminAuditPanel`, frontend API integration tests, and the administrative browser journey. Existing controllers, middleware, JWT helper, User/AuditLog models, admin routes, AuthContext/LoginPage, admin dashboard, API client and shared user types are updated.

Reproduce the browser demonstration with `npm.cmd run build` then `npm.cmd run test:e2e` in `frontend` after preparing the disposable MongoDB binary as described in the testing foundation docs. The test signs in a synthetic administrator, searches for a synthetic student, suspends/reinstates that student with reasons, grants admin access then restores the recorded student role, and reads each action from the actual database-backed history. Screenshot: ignored local artifact `output/playwright/admin-management.png`.

This scope does not claim completion of provider document verification, content moderation, account recovery, rate limiting, or the full V2 roadmap. Existing provider approval and moderation workflows remain as they were and require their own improvements.

Operational limits: transactions require a replica set/sharded MongoDB; on a standalone server mutations fail safely with a generic 503 and no partial user/audit update. Administrative role recovery and initial provisioning remain operator-controlled. Rolling back to older code would remove token-version enforcement, so coordinate session invalidation before such a rollback. No credentials, production records, destructive migrations or dependency changes are introduced.

Executed on 2026-10-19 (Windows, disposable local MongoDB replica sets and synthetic fixtures):

| Check | Result |
| --- | --- |
| Backend unit tests | 129 passed, including 18 new admin validation cases |
| Backend integration tests | 91 passed, including 13 new admin management cases |
| Frontend unit tests | 7 passed |
| Frontend integration tests | 17 passed, including 3 new admin API/UI cases |
| Chromium regression suite | 7 passed |
| Repository policy tests | 9 passed |
| Frontend lint and both TypeScript checks | Passed |
| Both production builds | Passed; frontend retains the existing >500 kB bundle warning (598.10 kB JavaScript) |
| Git index policy and whitespace check | Passed; no tracked environment/dependency/build artifacts |

Total: 260 passing test cases across those suites (35 new). Security coverage includes persisted-role authorization despite forged JWT role claims, revoked sessions remaining invalid after reinstatement/restoration, fresh sign-in after revocation, self-action protection, incompatible-role denial, concurrent administrators retaining an active administrator, bounded input validation, safe response projections, and rollback when audit creation fails. No production database was contacted. A previous failing fresh-login assertion found a missing `+tokenVersion` projection; that defect is fixed and the full integration suite passed afterward. The administrator landing-route failure found by the first browser run is fixed and the complete browser suite passed afterward.

Review status: implementation complete for this branch, awaiting owner review. The pull request supplies the commit SHA and CI run links. Provider verification is the next scoped branch after approval; do not automatically merge or start subsequent feature phases.
