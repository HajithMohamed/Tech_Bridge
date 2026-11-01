# Local Docker database and admin access

This development setup runs MongoDB in Docker and the existing Express/Vite apps on
the host. It does not copy, migrate, or modify an Atlas database. A new local
database starts empty; ordinary users and providers can register through the app.
No faculty/alumni identities or example platform statistics are seeded.

## Start the database

Docker Desktop must be running with its Linux engine. From the repository root:

```sh
docker compose -f compose.local.yml up -d --wait
docker compose -f compose.local.yml ps
```

The health check initializes the `techbridge-local` replica set only when MongoDB
reports that it has not yet been initialized. It then waits for a writable primary.
The host connection uses `directConnection=true` because the container advertises
its internal `mongo:27017` address. The database port is published only on
`127.0.0.1:27018`. This unauthenticated, single-node setup is for local development;
do not expose it through a network port or use it for production/student records.

## Configure the normal app

Preserve a private copy of any existing `backend/.env` before changing it. Both
`.env` and `.env.*` backups are ignored by Git. Configure:

```dotenv
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27018/techbridge_local?replicaSet=techbridge-local&directConnection=true
JWT_SECRET=REPLACE_WITH_A_NEW_RANDOM_LOCAL_SECRET
JWT_EXPIRES_IN=7d
```

Generate the signing secret locally, for example with
`node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`.
Never commit the generated value. Start the backend once to create its ordinary
collections and indexes:

```sh
cd backend
npm run dev
```

The health endpoint is `http://localhost:5000/api/health`. If this is unavailable,
Vite's proxy will report `ECONNREFUSED`; fix backend/database startup first.

## Create an administrator

In `backend`, copy `admin-create.env.example` to `.env.admin`. Choose your own
email, name and unique password (16+ characters, at most 72 UTF-8 bytes). Set:

```dotenv
ADMIN_CREATE_ENABLED=true
ADMIN_CREATE_CONFIRM_DATABASE=techbridge_local
ADMIN_CREATE_EMAIL=YOUR_ADMIN_EMAIL
ADMIN_CREATE_NAME=YOUR_ADMIN_NAME
ADMIN_CREATE_PASSWORD=YOUR_UNIQUE_PRIVATE_PASSWORD
```

Keep `MONGODB_URI` exclusively in `.env`. Run from `backend`:

```sh
npm run admin:create
```

The command requires explicit development/test mode, opt-in and exact database
confirmation. It does not initialize or replace indexes, promote another user,
reset a password, unsuspend an account, or rewrite existing records. A standard
unique email index and transaction-capable MongoDB are required. User creation
runs the existing bcrypt save hook and commits together with an audit entry.
Concurrent commands cannot replace the winning password. The CLI prints no
password, hash, signing secret or connection URI.

The audit action is `admin_created_local_cli`. Because the schema requires an
administrator actor, its `adminId` refers to the newly created account, with a
reason explicitly stating that creation was performed offline by a machine
operator. It does not claim that the new admin authenticated before creation.

After recording the credentials privately, remove `ADMIN_CREATE_PASSWORD` and set
`ADMIN_CREATE_ENABLED=false` in `.env.admin`. There is no default admin password.
Repeat commands preserve an existing admin's credentials and suspended status.

Start Vite in another terminal:

```sh
cd frontend
npm run dev
```

Open `http://localhost:5173/login` and use the newly created account. A successful
admin login opens `/admin`.

## Persistence and rollback

`docker compose -f compose.local.yml stop` stops the database and retains its named
volume. `docker compose -f compose.local.yml start --wait` resumes it. Ordinary
`down` also retains the volume; **do not use `down -v`** unless you explicitly
intend to delete the local database.

To return to the earlier connection, stop the backend, restore your private `.env`
backup and restart it. This changes configuration only; it does not merge local
and remote records. Returning to Atlas still requires valid Atlas database-user
credentials and appropriate database permissions. Atlas application credentials
are separate from database-user credentials, and special characters in URI
credentials must be percent encoded. See the official
[Atlas connection troubleshooting](https://www.mongodb.com/docs/atlas/troubleshoot-connection/)
and [Node driver troubleshooting](https://www.mongodb.com/docs/drivers/node/current/connect/connection-troubleshooting/).

## Review boundary

Branch `fix/local-admin-bootstrap` is based on provider-verification commit
`c921f2d9199de1b8280f9b4f0c349a1309f21a95` and depends on PR #16. It adds local
Docker setup, an offline admin-creation command, and sanitized database startup
diagnostics. It introduces no HTTP admin-registration endpoint, schema changes,
production migrations, or unrelated community-verification implementation.

## Executed validation (2026-10-20)

- Backend unit suite: 207 passed, including 36 new configuration/startup checks.
- Backend integration suite: all 127 cases were executed. The initial full run
  passed 126 cases and timed out in the new admin/login test at 15 seconds while
  Docker was extracting its image. A focused rerun of all nine new admin tests
  passed, including that login case. No application code was changed to obtain
  the rerun result. Coverage includes real bcrypt login/admin authorization,
  concurrent creation, preservation of suspended/existing accounts, refusal to
  promote other roles, unique-index enforcement, transactional rollback when
  audit insertion fails, the actual CLI, production refusal and configuration
  redirect prevention. Full CI results are reported on the pull request.
- Backend strict type checks (source and tests) and production build passed.
- Frontend lint, source/test TypeScript checks and production build passed. The
  unchanged 612.72 kB JavaScript bundle still produces Vite's size warning.
- Existing Chromium admin-management regression: one passed using its owned,
  disposable test database. A separate Chromium check against the requested
  Docker development account passed login, `/admin`, user listing and absence
  of browser/API errors. Its screenshot was visually inspected.
- Docker Compose configuration validation passed. MongoDB 8.0.34 reported a
  writable `techbridge-local` primary. The image is pinned by digest. The account
  and its single audit entry survived actual container recreation, and login
  returned HTTP 200 afterward.
- The actual Vite `/api/health` proxy, admin login and authorized admin-users API
  each returned HTTP 200. Backend and Vite remain running for local use.
- Repository security unit/integration checks: nine passed. The actual local
  `.env`, `.env.admin`, Atlas backup and temporary verification scripts were
  confirmed ignored. Generated credentials were never included in tracked files,
  logs, screenshots or this report. Bootstrap opt-in was disabled after creation.

No production records, migrations, existing remote accounts or remote credentials
were changed. The private Atlas configuration backup remains available for the
owner. Review this branch separately from PR #16; neither branch is automatically
merged. Faculty/alumni claims remain the next feature phase after review.
