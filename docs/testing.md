# Testing TechBridge

Requires Node 22.12+ on the 22.x line, Node 24, or Node 26+; CI uses Node 22. Test dependencies are pinned in the two package lockfiles. Run commands from the indicated package directory; do not run the production seed or migration scripts to prepare tests.

## Install and provision

```sh
npm ci --prefix backend
npm ci --prefix frontend
npm run test:prepare --prefix backend
npm run test:prepare --prefix frontend
```

The backend provisioning command explicitly downloads MongoDB 7.0.24 into ignored `backend/.cache/mongodb-binaries`. On Windows the archive is large (about 600 MB); retain the cache across runs. If a compatible binary is already installed, `MONGOMS_SYSTEM_BINARY` can name that executable. The harness starts a new process and replica set; it never connects to an existing database. Do not override the pinned version without reviewing platform support and tests. Test suites set runtime downloads off, so missing binaries fail rather than silently downloading during a test. GitHub Actions provisions/caches this binary before integration/E2E checks.

The frontend provisioning command installs Playwright's Chromium browser and headless shell into Playwright's normal local cache. Linux CI uses `npx playwright install --with-deps chromium` for required OS libraries. Provisioning requires internet access; subsequent tests use loopback services or MSW mocks only. Installing dependencies/browser binaries executes their standard package/tool installers; keep lockfiles and CI tool versions reviewed.

## Package checks

Backend:

```sh
npm run typecheck --prefix backend
npm run build --prefix backend
npm run test:unit --prefix backend
npm run test:integration --prefix backend
```

Frontend:

```sh
npm run lint --prefix frontend
npm run typecheck --prefix frontend
npm run build --prefix frontend
npm run test:unit --prefix frontend
npm run test:integration --prefix frontend
npm run test:e2e --prefix frontend
```

`npm test` in either package runs that package's unit suite followed by its integration suite. Commands use `vitest run`, not watch mode. Backend typechecking includes application code and tests; no separate backend ESLint policy is introduced in this phase. Frontend typechecking includes unit/integration/E2E/config files, while production TypeScript compilation excludes `src/test`.

Repository-only checks remain available at the root:

```sh
node --test tests/repository-security.unit.test.mjs tests/repository-security.integration.test.mjs
node scripts/repository-security.mjs
```

## Backend isolation and fixtures

`tests/support/database.ts` starts a fresh loopback MongoDB replica set, assigns a random `techbridge_test_<32 hex digits>` database name, and requires `NODE_ENV=test`. It never accepts `MONGODB_URI`. Before collection cleanup, it verifies the URI, database name, and current connection host. An existing Mongoose connection is rejected at startup. Suite setup creates schema indexes, `beforeEach` removes only this owned database's fixture documents, and teardown closes the connection and stops its own replica set. No shared/production data or production `.env` is read. Data files belong to the memory-server process's disposable temporary directory.

Tests are serial within each suite and files run with one worker to avoid shared default-Mongoose-connection races. Database names/ports are generated per run; synthetic record IDs, names, timestamps and content are deterministic. Use `tests/support/fixtures.ts` factories for students, providers, admins, synthetic lecturers/alumni, scholarships, applications, resources, resource requests, conversations, messages and campaigns. Overrides let each test express its edge case. Domain `example.test` and explicitly test-only credentials must remain synthetic. Do not reuse real named directory identities or production passwords.

API tests use Supertest against the actual `createApp()` router and a real isolated MongoDB, with no mocked model calls. The production `server.ts` still loads the normal environment, connects to its configured DB and listens as before. Tests import `app.ts`, which does none of those startup operations. Add future concurrency and transaction tests to this replica-set harness. The initial resource-owner and scholarship-submission checks do not certify the known allocation/award race conditions as fixed.

## Frontend mocks and integration boundary

Unit tests cover route guards and provider capability rules. Integration tests render the real login page or `AuthProvider`, use the actual Axios interceptors, and intercept HTTP with MSW. Each test gets clean localStorage, reset handlers, restored spies and React cleanup. Unhandled network frames throw, including asset requests; new API usage requires an explicit handler. There is no production service access or catch-all success handler.

MSW 3 uses `onUnhandledFrame`; the suite follows the installed package API. Test user fixtures live in `src/test/fixtures.ts`. A mocked integration pass verifies client/UI behavior only; it does not verify the Express API. Backend integration and the E2E suite cover that separate boundary.

## Browser E2E

Build the frontend, then run `npm run test:e2e --prefix frontend`. Playwright owns both local servers: a test-only API on `127.0.0.1:4510` with its own disposable database and Vite preview on `127.0.0.1:4173`. If either port is already occupied, the run fails rather than reusing another process. Tests never call the normal `server.ts`, seed script, or a configured production URI. `TECHBRIDGE_API_PROXY` changes only Vite's dev/preview proxy; default remains `http://127.0.0.1:5000`.

The initial browser scenarios exercise login/session rehydration/application tracking, signed-out admin-page denial, and invalid-login handling through real APIs. A reusable browser fixture aborts requests outside the owned preview origin (the real API is reached through its proxy); external fonts/services do not affect test results. The stack is seeded once for the serial browser suite with synthetic data; each test has a fresh browser context. Tests that mutate the same domain records must use separate fixture records or an isolated API/database instance when expanded. Do not add public fixture/reset endpoints to the production app.

Playwright reports and screenshots live under ignored `output/playwright/`. The successful student journey captures `student-application.png` as a real-API demonstration with synthetic data. Traces are disabled to avoid persisting auth headers and request bodies by default. Use only synthetic data if enabling diagnostic capture. CI uploads failure reports for seven days. Clean shutdown closes the API listener and database on signals; memory-server also manages child-process cleanup. On an interrupted Windows run, check the two fixed ports and stop only the test processes from that run before retrying.

## CI and limits

`.github/workflows/testing-foundation.yml` runs backend typecheck/build/unit/integration, frontend lint/typecheck/build/unit/integration, and Chromium E2E on PRs and pushes to integration/testing-foundation. The earlier repository-security workflow also runs on PRs. Jobs have timeouts, read-only repository permissions and no production secrets. CI provisions binaries explicitly and never deploys or migrates data.

This is representative reusable coverage, not complete certification of Phase 2. Remaining security findings from Phase 0 require their own scoped, tested fixes and approval. Existing dependency advisories must be reported separately from actual regression-check results; a passing test does not clear an advisory. Never run blanket dependency upgrades or production migration scripts as a side effect of these checks.

Tool references: [Vitest configuration](https://vitest.dev/guide/), [MSW Node integration](https://mswjs.io/guides/integrations/node), [MongoDB memory-server configuration](https://typegoose.github.io/mongodb-memory-server/docs/api/config-options/), [Playwright web servers](https://playwright.dev/docs/test-webserver).
