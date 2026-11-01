# Demo seed safety: phase review

Review date: 2026-10-18 (Asia/Colombo).

## Implementation Summary

Feature: prevent automatic real-person identity creation and built-in credentials in the demo seed workflow. Branch: `fix/demo-seed-safety`. Base commit: `994634ef925474b76ba822274f6790707987a311`, the reviewed integration merge of testing-foundation PR #6. Implementation is scoped to seeding and its documentation/tests; later security or product features require another review and approval.

Repository reconciliation: fetched all origin refs/tags with pruning, then fetched remote development/integration into their local refs using non-forcing fast-forward refspecs. The repository has full history (`--is-shallow-repository=false`). Development now points to `2a862d0` (audit PR #4 merge); integration points to `994634e` (testing PR #6 merge). Their unique commits reflect reviewed branch/merge history and the testing foundation; no unreviewed functional module was replaced. No merge, rebase, reset or history rewrite was performed. This branch uses integration so it retains the approved test infrastructure that development does not yet contain.

Audit finding: the former `seed.ts` automatically created an admin with a built-in password and manufactured verified faculty/alumni accounts for real named directory contacts using shared credentials. The README advertised a default login and recommended this seed for initial setup. Exposed historical values are deliberately omitted here.

Acceptance criteria:

- No built-in seed password or automatic real faculty/alumni account creation.
- Explicit opt-in and mode/target/password validation before any connection.
- Only one clearly synthetic local demo administrator may be created.
- Existing credentials, roles, status and unrelated users are never overwritten.
- Concurrent runs use the existing unique email index to create at most one account.
- CLI errors and success output disclose neither passwords nor connection strings.
- Unit, real-database/CLI integration, and appropriate application regression checks provide executed evidence.

## Technical Changes

Modified:

- `backend/src/seed.ts`: replace hardcoded identities/credentials and implicit dotenv loading with a guarded CLI wrapper and redacted errors.
- `backend/package.json`: add `seed:demo` to explicitly load the private `.env.demo`; preserve `seed` for callers supplying environment variables directly.
- `backend/tests/support/database.ts`: expose an ownership-checked URI getter so subprocess and service integration tests can use the disposable database.
- `README.md`: replace default credentials and unsafe seed advice with explicit local demo setup; remove the recommendation to run a migration blindly during initial setup.

New:

- `backend/src/services/demoSeed.ts`: pure configuration validation plus an isolated-connection, create-only demo seed service.
- `backend/demo-seed.env.example`: placeholder configuration with an empty password; copy to ignored `.env.demo` locally.
- `backend/tests/unit/demo-seed.test.ts` and `backend/tests/integration/demo-seed.test.ts`.
- This review report.

API endpoints: none added/changed. Authorization middleware and login behavior: unchanged. Schema changes/migrations: none. The service uses the existing User schema, bcrypt save hook and unique-email index. Frontend components/styles and public directory records: unchanged.

## Behavior and Compatibility

Development mode requires `ENABLE_DEMO_SEED=true`, a loopback `mongodb://` target named exactly `techbridge_demo`, and a caller-supplied password of at least 16 characters and at most 72 UTF-8 bytes. Production/staging/unset modes, missing opt-in, remote hosts, credential-bearing URIs, ordinary database names and unsupported/duplicate URI options fail before connection. Only a valid `replicaSet` name and `directConnection=true` may be specified; the driver is forced into direct-connection mode to avoid following advertised remote replica members. Tests use `NODE_ENV=test` and only the existing randomly namespaced test database pattern.

Only `admin@demo.techbridge.test`, named `Demo Administrator (Synthetic)`, can be inserted. The supplied password is hashed through the existing model hook. No faculty, alumni, student, directory contact or verified provider is seeded. The reserved `.test` identity is explicitly synthetic and cannot represent a real directory person.

Repeat runs preserve the existing demo administrator's password, role and status, including suspension. A reserved email owned by another role is rejected, rather than promoted. Concurrent attempts may both validate, but the unique index permits one insertion; the loser observes the existing administrator without resetting its password. Separate connections are closed in `finally`, including failure paths.

`npm run seed` now requires explicit environment variables and never loads the normal `.env`. For a local demonstration, copy the new example to `.env.demo`, supply your own password, and run `npm run seed:demo` from backend. Start the development API against the same isolated demo database if you want to log in. No actual developer demo database was seeded during this work: execution used disposable test databases only.

This is not a production admin-provisioning mechanism. Normal API development/start commands are unchanged. Existing installations remain compatible because existing users and database records are not edited; old seed credentials cease to be an accepted default for new seeds.

## Testing

Executed local results (Node 22.14, Windows):

| Check | Result |
| --- | --- |
| Backend typecheck/build | PASS |
| Backend unit | PASS, 45 tests (26 new seed-safety tests) |
| Backend database/CLI integration | PASS, 20 tests (8 new seed tests); final seed-only suite also passed all 8 |
| Frontend typecheck/build | PASS; unchanged 592.06 kB bundle warning |
| Frontend lint/unit/integration | PASS, 7 unit and 7 integration tests |
| Chromium regression | PASS, all 3 journeys, 28.5 seconds including startup |
| Repository security | PASS, all 9 unit/integration checks |

All 91 local checks passed (45 backend unit, 20 backend integration, 7 frontend unit, 7 frontend integration, 3 browser journeys, 9 repository checks). This branch adds 26 unit and 8 integration tests. Initial implementation commit `d17edea444c005949d5127583fc037b7911afc3e` passed CI. The final verified test commit `f16d8cd41c958581660bdf8cc7ea2d817bb6c03b`, including the env-file command check, passed [all application CI jobs](https://github.com/HajithMohamed/Tech_Bridge/actions/runs/39100957654) and [repository security CI](https://github.com/HajithMohamed/Tech_Bridge/actions/runs/39100957636). Linux CI confirmed clean installs, backend/frontend checks and Chromium journeys. A later documentation-only commit records this evidence. The suites include:

- Unit: explicit mode/opt-in gates; connection not opened on invalid mode; URI host/scheme/database/credential/query restrictions; bcrypt byte limits and required password; isolated test namespace handling; no supplied values in configuration errors.
- Database integration: one synthetic admin only; bcrypt hashing and actual API login; unrelated provider preservation; idempotency without password/status changes; role-collision rejection; concurrent attempts with different passwords preserve the winner's credential.
- CLI integration: actual `node --import tsx src/seed.ts` subprocess succeeds against the owned test database, exits/cleans up, and prints neither password nor URI; production-mode subprocess exits nonzero with no user records changed and no sensitive output. The documented tsx env-file loader is also executed against the blank example and must refuse it before connection; all supplied connection targets in these tests point to the owned memory-server instance.
- Regression: existing backend unit/API suites, frontend lint/typecheck/build/unit/integration, existing Chromium journeys and repository-security checks. The existing PR CI workflow discovers the new tests automatically; no new pipeline or dependencies are needed.

The changed workflow is a CLI rather than a frontend journey. Its real CLI/database/login checks are the feature demonstration; existing browser journeys provide broader API/frontend regression coverage. A test pass does not certify complete identity verification, secure production admin setup, or production readiness.

## Security and Existing Data

This change closes the unsafe creation path going forward. It does not revoke credentials already exposed in Git history, invalidate previously issued tokens, remove old seeded users, reset existing passwords, or retroactively establish verified identities. Those actions require a separate inventory, backup, owner-reviewed classification and approved migration/rollback plan. Old seeded faculty/alumni accounts must not be assumed genuine merely because their stored verified flag is set.

Historical secrets remain compromised until rotated by their owners. Existing dependency advisories, public-profile privacy, message policy and allocation concurrency findings remain outside this branch. No secret values appear in this report or test/CLI output. Test passwords are synthetic fixtures only; the real seed has no fallback password.

Rollback: reverting this source change would restore the unsafe seed path and is discouraged. Keep the seed command disabled instead if a development compatibility issue is found. No production data/schema rollback is needed because no production data/schema change was made. Do not delete/reset existing users as an automatic rollback action.

## Git Review and Approval

Branch: `fix/demo-seed-safety`; base SHA recorded above. Initial implementation commit: `d17edea444c005949d5127583fc037b7911afc3e`; final verified test commit: `f16d8cd41c958581660bdf8cc7ea2d817bb6c03b`. [Draft PR #9](https://github.com/HajithMohamed/Tech_Bridge/pull/9) targets `integration/techbridge-v2` and has passing implementation CI. The test preview/API ports were confirmed closed after browser teardown. The working tree was clean after publishing the implementation/tests. Development, integration and main are preserved; no feature merge or next branch has been started. Use `git log -1 --format=%H fix/demo-seed-safety` for the report-updated head. Review this scoped fix and its test evidence before approving another improvement. Merge approval remains separate.
