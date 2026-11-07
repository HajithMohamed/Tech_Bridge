# TechBridge frontend

The React 19 + Vite single-page app for TechBridge. It talks to the Express API in [`../backend`](../backend). See the [main README](../README.md) for the full feature list and API.

## Run it

You need Node.js 22.12 or newer and the backend running on `http://127.0.0.1:5000`.

```bash
npm install
npm run dev
```

The app opens at `http://localhost:5173`. Vite proxies `/api` requests to the backend (see `vite.config.ts`).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check for the app and the tests |
| `npm run test:unit` | Vitest unit tests (`src/test/unit`) |
| `npm run test:integration` | Vitest + React Testing Library + MSW tests (`src/test/integration`) |
| `npm run test:e2e` | Playwright end-to-end tests (`e2e/`). Run `npm run test:prepare` once to install Chromium |

## Structure

```text
src/
  api/          Typed Axios clients, one per backend area, with JWT handling
  components/   Shared layout, navigation, route guards and landing-page sections
  context/      Authentication state
  data/         Static content such as the public community directory snapshot
  hooks/        Reusable React hooks
  pages/        One component per screen (student, provider and admin portals)
  test/         Unit and integration tests
  types/        Shared TypeScript types
  utils/        Small shared helpers
e2e/            Playwright specs for the main user journeys
```
