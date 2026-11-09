# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TechBridge is a fullstack educational platform connecting students (ICT, Engineering Technology, Biosystems Technology departments) with opportunities, resources, and mentors. Stack: Express 5 + MongoDB/Mongoose 8 on the backend, React 19 + React Router 7 + Vite 8 + Tailwind CSS v4 on the frontend.

## Common Commands

### Backend (from `backend/`)
```bash
npm run dev        # ts-node-dev watch mode
npm run build      # tsc compile to dist/
npm start          # node dist/server.js
node_modules\.bin\tsc --noEmit   # type-check without compiling (use this, not npx tsc)
```

### Frontend (from `frontend/`)
```bash
npm run dev        # Vite dev server (port 5173)
npm run build      # Vite production build
npm run preview    # preview production build
```

## Architecture

### Backend structure
- `src/app.ts` — Express app wiring (all 20 route registrations, security middleware, 404/error handlers)
- `src/server.ts` — DB connect, notification worker start, graceful shutdown
- `src/middleware/auth.ts` — `authenticate()` with tokenVersion check; exports `protect`, `protectVerification`, `protectNotifications`, `authorize()`
- `src/models/` — Mongoose models with TypeScript interfaces; `User.ts` carries both `studentProfile` and `providerProfile` sub-documents
- `src/controllers/` — One file per resource; each imports its policy/service layer for business rules
- `src/services/` — Pure business logic (`opportunityPolicy.ts`, `scholarshipPolicy.ts`, `messageReports.ts`)
- `src/utils/jwt.ts` — `generateToken`/`verifyToken` with `userId`, `role`, `version`, `scope` claims

### Auth flow
JWT tokens include a `tokenVersion` field. Incrementing `user.tokenVersion` in the DB invalidates all existing sessions for that user. Rate limiting is handled via the `AuthRateLimit` model, not in-memory.

### Frontend structure
- `src/App.tsx` — All routes; `DesignSystemPage` lazy-loaded in DEV only
- `src/styles/foundation.css` — CSS custom properties with `--tb-*` prefix; portal layout classes (`tb-button`, `tb-card`, `tb-field`, etc.)
- `src/index.css` — Tailwind v4 `@theme` block with `--color-primary-*` mapped to green-600 (#16A34A)
- `src/components/PortalLayout.tsx` — Sidebar + workspace layout for authenticated pages
- `src/pages/` — One file per route

### Design system
Primary color: `#16A34A` (green-600) — use `primary-600` / `--tb-action` / `--tb-brand`.
CSS token prefix: `--tb-*` (foundation.css). Tailwind utility prefix: `primary-*`, `surface-*`, `accent-*`.
Reusable portal classes: `tb-button`, `tb-button--primary/secondary/outline/danger`, `tb-card`, `tb-field`, `tb-badge`, `tb-notice`, `tb-dialog`.

### Key patterns
- **Pagination**: all list endpoints accept `page`/`limit` query params and return `{data, total, page, limit, pages}`.
- **Opportunity search**: `opportunitySearch()` in `opportunityPolicy.ts` builds the Mongo filter; query params must be single strings (arrays throw 400).
- **Transactions**: multi-document writes (scholarship, messaging, applications, resources) use MongoDB sessions/transactions.
- **Audit log**: admin actions call `audit(actorId, action, targetType, targetId, note)` from `adminController.ts`.
- **Student degrees**: `'ict' | 'et' | 'bst' | 'other'` — used in eligibility matching and department filter chips on the feed page.

## Routing conventions
- Public pages (landing, login, register, setup-profile): no `PortalLayout` wrapper
- Authenticated pages: wrapped in `<PortalLayout>` via nested `<Route element={<PortalLayout />}>`
- Role protection: `<ProtectedRoute allowedRoles={['student']}>`
- Profile setup wizard: `/setup-profile` — standalone full-page (no sidebar), outside `PortalLayout`
