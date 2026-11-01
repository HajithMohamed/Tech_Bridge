# Local API startup recovery

Verified on 2026-10-27 in the current `fix/workspace-usability` working tree.

Vite's `ECONNREFUSED 127.0.0.1:5000` means its API target has no listener.
In this instance Docker Desktop/MongoDB were stopped, and unfinished authentication
and creator changes imported missing `mailDelivery` and `notifications` services.
The API therefore failed during module loading, before it could connect or listen.

## Starting the normal local application

Open Docker Desktop and wait until its engine is ready. From the repository root:

```sh
docker compose -f compose.local.yml up -d --wait
```

Keep the backend running in a separate terminal:

```sh
cd backend
npm run dev
```

Wait for `MongoDB connected` and the API listener on port 5000. In another terminal:

```sh
cd frontend
npm run dev
```

Open `http://localhost:5173`. Keep an existing Vite listener rather than starting a
second instance on the same port. Check `http://localhost:5173/api/health` to test
both the frontend proxy and backend. The persistent Docker volume keeps existing
accounts; no reseeding or volume removal is necessary.

## Startup repairs

- Restored the missing mail support module. In development, messages are written
  privately to ignored `backend/.cache/mail/*.json`; no email is sent. Keep these
  files private because verification/reset links grant account access. The default
  outside development is disabled, and local delivery refuses production mode.
  `PUBLIC_APP_URL` is validated and never derived from request Host headers.
- Restored a transactional pending campaign-notice outbox with owner/key uniqueness,
  input bounds and internal destination validation. A pending row does not mean a
  notice was delivered; the notification API/UI/delivery phase remains incomplete.
- Replaced the unfinished creator service's `Array.at` use with indexed access to
  match the backend's existing ES2020 TypeScript configuration.
- Added environment-example documentation. No real credentials or local account
  data were changed, and no unrelated unfinished changes were discarded.

## Executed verification

- Backend source/test TypeScript checks and production build passed.
- Seven mail-configuration unit cases and three isolated MongoDB outbox integration
  cases passed, including transactional rollback and idempotent enqueue.
- Nine repository-policy cases and whitespace checks passed.
- API health, opportunities and resources returned HTTP 200 on port 5000 and
  through Vite on port 5173. Existing local administrator login returned HTTP 200
  with the admin role through the same proxy; credentials/tokens were not logged.

This validates startup recovery and its new support modules. It does not certify
the other uncommitted authentication, creator or workspace features as complete.
