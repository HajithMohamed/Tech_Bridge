# Testing foundation: phase review

Review date: 2026-10-18 (Asia/Colombo); local test execution on 2026-10-17.

## Implementation Summary

- Feature: reusable unit, integration and E2E test infrastructure with PR CI.
- Branch: `chore/testing-foundation`.
- Exact base: `2132b857ec8ca7bb55fdb9a25a14fbb460cee5eb`.
- Integration baseline: `integration/techbridge-v2` was created at the approved Phase 0 head, preserving the development source at `ac248bf` plus reviewed repository cleanup. This created a branch pointer; it did not merge or rewrite either existing branch. Development remains at `ac248bf`. On resumption, remote main had advanced externally to `6ed04ddc942a9e4c9f78244f69371d3b759935bc` through PR #5; its tree equals this approved integration baseline, so no reconciliation was needed. This agent has not performed a merge.
- Status: implementation complete; verification evidence is recorded below. No future feature branch has been started.

Acceptance criteria: package-specific unit/integration scripts; real Express/MongoDB integration; representative React component/client integration; synthetic fixtures for all requested feature families; fail-closed database and network isolation; real-browser API journey; repeatable setup/teardown; application checks on pull requests; existing production builds/lint pass; no product redesign, schema migration, production-data access or merge.

## Technical Changes

Modified files:

- `.gitignore`: ignore test caches/reports; `.gitattributes` is new and keeps source/config line endings consistent across Windows and Linux.
- `README.md`: link to the testing guide.
- `backend/package.json`, `backend/package-lock.json`: pinned test dependencies, scripts, supported Node engines.
- `backend/src/server.ts`: retain environment/DB/listen bootstrap; move app creation to the new `backend/src/app.ts` factory.
- `frontend/package.json`, `frontend/package-lock.json`: pinned Vitest/RTL/MSW/jsdom/Playwright dependencies and test/typecheck scripts.
- `frontend/tsconfig.app.json`: exclude test code from production type compilation; separate test typechecking covers it.
- `frontend/vite.config.ts`: make dev/preview proxy target configurable for the isolated E2E stack; the default API target remains `http://127.0.0.1:5000`.

New files:

- `.github/workflows/testing-foundation.yml`.
- `backend/.npmrc`, `frontend/.npmrc`: explicitly use standard peer dependency resolution for repeatable installs.
- `backend/vitest.config.mts`, `backend/tsconfig.test.json`.
- `backend/tests/support/database.ts`, `backend/tests/support/fixtures.ts`.
- `backend/tests/prepare-mongo.ts`, `backend/tests/e2e-server.ts`.
- `backend/tests/unit/app.test.ts`, `auth.test.ts`, `database-safety.test.ts`, `priority.test.ts`.
- `backend/tests/integration/api.test.ts`.
- `frontend/vitest.config.ts`, `frontend/tsconfig.test.json`, `frontend/playwright.config.ts`.
- `frontend/src/test/fixtures.ts`, `setup.ts`, `mocks/server.ts`.
- `frontend/src/test/unit/protected-route.test.tsx`, `provider-capabilities.test.ts`.
- `frontend/src/test/integration/auth.test.tsx`.
- `frontend/e2e/fixtures.ts`, `student-journey.spec.ts`.
- `docs/testing.md` and this report.

Database schema changes: none. API endpoint changes: none. Authorization changes: none. Existing controllers/routes/models/pages/components are unchanged. The app factory retains the existing middleware, CORS allowlist, route mounts, health response and JSON 404 handler. A unit regression checks that importing/creating the app neither connects to MongoDB nor opens a listener.

Migration instructions: none. Install with `npm ci` in both packages, provision test binaries with the documented `test:prepare` commands, and run the checks in [testing.md](testing.md). Do not execute `seed` or `migrate:phase2` for tests. Normal production server bootstrap still loads its existing configuration; the testing entry points do not load it.

Tooling requires Node 22.12+ on 22.x, Node 24 or Node 26+. jsdom 26 is intentionally selected because the latest release's minimum Node patch version exceeds this workstation's Node 22.14. Test-only Vite is installed explicitly in the backend because Vitest requires that peer dependency. Existing locked build-tool packages changed only for `@jridgewell/sourcemap-codec` (1.5.5 -> 1.6.0 in both packages) and `picomatch` (4.0.5 -> 4.0.7 in frontend; backend hoists 4.0.7 while retaining 2.3.2 under legacy watcher dependencies). Application dependency declarations and locked application package versions were retained.

## Testing

Executed locally on Node 22.14, Windows:

| Check | Created/executed | Result |
| --- | --- | --- |
| Backend unit | 19 tests, four files | PASS |
| Backend integration | 12 tests, actual Supertest + MongoDB replica set | PASS |
| Frontend unit | 7 tests, two files | PASS |
| Frontend integration | 7 tests, real AuthProvider/LoginPage/Axios + MSW | PASS |
| Repository regression | Existing 5 unit + 4 integration tests | PASS |
| Backend typecheck | Source and test code | PASS |
| Backend build | `npm run build` | PASS |
| Frontend typecheck | Source, tests, E2E and configs | PASS |
| Frontend lint | `npm run lint` | PASS |
| Frontend build | `npm run build` | PASS; existing 592.06 kB main JS chunk warning |
| Chromium E2E | 3 real API/browser scenarios | PASS, 27.1 seconds including stack startup |

Total: 48 application checks (26 unit, 19 integration, 3 E2E) plus 9 repository-policy regression tests passed locally. No tests were skipped to obtain these results.

Unit scenarios: missing/wrong/admin roles, signed/tampered JWTs, explicit test-database allowlist and redacted rejection, cleanup ownership, no app-import side effects, declared-need monotonicity, capacity-derived waitlist without automatic award, and matching explanations. Frontend unit scenarios exercise actual protected-route redirects/loading and provider capability boundaries.

API integration scenarios: health/404; real hashed-password login and `/auth/me` without password disclosure; missing/invalid tokens and credentials; rejected admin registration; client-supplied verification ignored with no pending-provider token; persisted roles/suspension checked despite issued token claims; real admin approval/audit event; scholarship submission/unique index; participant privacy including no admin bypass; resource ownership; schema-valid fixtures across all requested feature families.

Frontend integration scenarios: real login form/session establishment; bearer-header rehydration; invalid stored-session cleanup; pending-provider registration stays signed out; logout clears both keys; invalid credentials do not create a session; unmocked network traffic returns the explicitly blocked synthetic response. MSW's installed v3 API uses `onUnhandledFrame`, with a custom rejecting callback so even unmocked asset requests cannot bypass isolation.

Database isolation: a test-owned loopback replica set and random namespaced database; incoming `MONGODB_URI` is ignored; production mode, remote hosts, ordinary database names and credential-bearing URIs are rejected; cleanup revalidates the actual connection's identity. Tests create indexes before exercising uniqueness, clear only the owned database between cases, and stop/disconnect their server afterward. Runtime binary downloads are disabled; provisioning is a separate explicit command.

E2E isolation: Playwright owns API port 4510 and preview port 4173 and refuses to reuse pre-existing servers. Each browser context is fresh; fixture data and the database belong only to this run. A browser fixture blocks non-preview origins. No public test-reset endpoint is added. Reports/screenshots use synthetic data; traces are disabled to avoid recording auth headers.

CI: separate backend, frontend and E2E jobs run the same checks on PRs; no production secrets, migrations or deployment. MongoDB binary caching/provisioning is explicit. The previous repository-security workflow remains active on PRs. Initial PR CI passed frontend and repository checks but caught a backend lockfile/peer-resolution mismatch at `npm ci`: this workstation's global npm setting enabled legacy peers. The package settings now explicitly disable legacy peer resolution. The corrected backend lockfile passed a fresh `npm ci --ignore-scripts` using CI's npm 10.9.9 in an isolated directory (278 packages installed; existing local node_modules preserved). Final CI evidence will be recorded after verification; this install check alone does not prove CI test success.

## Security Issues and Limits

`npm audit` reported six backend findings (one critical, four high, one moderate) and three frontend high findings. Affected existing packages and versions match the approved starting lockfiles: backend `proxy-addr` 2.0.7, `qs` 6.15.3, `brace-expansion` 1.1.18, `braces` 3.0.3, `chokidar` 3.6.0 and `ts-node-dev` 2.0.0; frontend `axios` 1.19.0, `brace-expansion` 5.0.9 and `source-map-js` 1.2.1. No blanket upgrade or `npm audit fix` was run during test setup. These unresolved dependency risks belong in a separately scoped security update; passing tests do not clear them.

The Phase 0 seed identity, exposed-secret rotation, public-field projection, communication-policy and allocation race findings remain open. The new tests preserve representative current controls, not full Phase 2 correctness or production readiness. Resource-owner tests do not certify inventory concurrency, and priority tests do not validate fairness or atomic award capacity. No actual credentials, private applicant data, production records or real faculty/alumni identities were used as fixtures.

Environment notes: MongoDB's Windows archive was about 600 MB; the explicit local download completed. Playwright retried one browser download after a network timeout. Cached binaries avoid that download on subsequent runs. Product UI design/components were preserved. Backend lint is not represented as ESLint: no prior backend lint policy existed; this phase runs strict TypeScript checks and builds, while the frontend retains its real ESLint check.

## Demonstration

Run the commands in [testing.md](testing.md). The browser journey signs in through the real backend, reloads the persisted session, submits a scholarship application and displays it on My Applications. It saves a synthetic-data preview to ignored `output/playwright/student-application.png` when successful. Additional browser checks cover signed-out admin denial and incorrect credentials. API integration assertions verify actual HTTP statuses and persisted MongoDB records, including the admin audit entry.

The generated screenshot was inspected. It confirms the synthetic application and applied status, and also exposes inherited white/light text contrast on My Applications. The existing page/component styles were not changed in this infrastructure phase; the contrast issue belongs to the separately approved UI workflow. E2E visibility assertions do not certify color contrast or complete accessibility.

## Git Review

Branch: `chore/testing-foundation`; base `2132b857ec8ca7bb55fdb9a25a14fbb460cee5eb`. Initial implementation commit: `511def7ded0bfface4f1929df377cde21d56f1ab`. [Draft PR #6](https://github.com/HajithMohamed/Tech_Bridge/pull/6) targets `integration/techbridge-v2`. Final CI evidence will be recorded after verification. No merge, conflict resolution, history rewrite, production-data change, or subsequent feature branch has been performed. Dependencies: reviewed integration baseline, explicit test binaries and the existing application contracts. Future feature branches should use these fixtures/checks after approval and any separately approved merge.

Approval gate: review this testing-foundation branch and its evidence before proceeding to another scope. Approval of this phase is not automatic permission to merge or perform production migrations.
