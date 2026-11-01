# Phase 1: dependency security and technical hardening

Branch: `chore/dependency-hardening`. Base: approved `development` commit
`ccff0d4fdcbf633b06cb5b75c06833154baa1022` (PR #22 merged).
This phase extends the existing Express authentication, validation and messaging
services. It adds no endpoints, models, indexes, migrations or frontend changes.

## Acceptance criteria and implementation

- Patch vulnerable backend dependencies within their existing major versions;
  retain Express 5.2.1 and existing request/response contracts.
- Verify bearer syntax and HS256 session claims consistently in normal HTTP
  authentication and the existing live-message stream.
- Preserve persisted role checks, account suspension, provider verification and
  token-version revocation. A signed role claim cannot grant an administrative role.
- Reject unsafe production signing/CORS configuration before connecting to MongoDB.
- Prevent caching of protected responses and sanitize parser errors.
- Exercise security regressions with synthetic data and an owned disposable MongoDB.
- Add an npm audit gate to the existing backend CI job.

New files: `src/config/security.ts`, `src/utils/bearer.ts`, this document and
`tests/{unit,integration}/security-hardening.test.ts`.
Updated: application middleware, authentication middleware, JWT verification,
live-message authentication, startup ordering, `.env.example`, backend manifests,
messaging OpenAPI description and the existing application CI workflow.

## Dependency findings and fixes

The initial production dependency scan reported four affected packages: two
critical, one high and one moderate (Express inherited its transitive findings).
An additional full scan found two high development-tool findings.

| Path | Before | After | Treatment |
| --- | --- | --- | --- |
| Express -> body-parser | 2.3.0 | 2.4.0 | Compressed-body decoder crash patch |
| Express -> proxy-addr | 2.0.7 | 2.0.8 | Mapped IPv6 trust-subnet patch |
| body-parser / Superagent -> qs | 6.15.3 | 6.17.0 | Attacker-controlled isBuffer crash patch |
| ts-node-dev -> glob -> minimatch -> brace-expansion | 1.1.18 | 1.1.21 | Compatible development dependency patch |
| Vitest -> backend Vite | 8.2.1 | 8.3.5 | Compatible development server security update |

Runtime dependencies were updated through existing semver ranges in the lockfile.
The backend's existing exact Vite development dependency was advanced within v8.
No major upgrades, forced audit fixes or framework migrations were used.

Primary advisories: [body-parser](https://github.com/advisories/GHSA-27r3-jxmh-p828),
[proxy-addr](https://github.com/advisories/GHSA-jqcg-44mw-7w3h),
[qs](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g).

Run `npm ci`, `npm run audit:security` and `npm audit --omit=dev` in `backend`.
The CI gate fails on moderate-or-higher findings in the full backend dependency
tree, including development tooling. Audit results reflect registry information
at execution time and do not prove the absence of all vulnerabilities.

## Shared HTTP/API contract

These rules apply to existing methods/URLs; their request bodies, successful
responses, authorized roles and database writes remain unchanged.

| Existing operation | Authentication / roles | Security behavior |
| --- | --- | --- |
| `POST /api/auth/login` | Public | Existing email/password validation and 200 success; malformed body 400, decoded JSON over 5 MiB 413, unsupported compression 415 |
| `POST /api/auth/register` | Public student/provider registration | Existing validation and 201 success retained; same shared parser errors |
| `GET /api/auth/me` | Full bearer session; student/provider/admin | Invalid scheme, signature, claims, expiry or revoked version returns 401; existing suspended/provider restrictions remain |
| Existing protected API routes, including `GET /api/dashboard/stats` | Existing route roles and ownership | `Cache-Control: no-store`, including authorization failures |
| `GET /api/messages/events` | Full bearer session and existing messaging eligibility | Same token parser/signature policy as ordinary HTTP; existing participant privacy, revalidation and stream limits retained |
| `GET /api/health` | Public; no database writes | 200 contract unchanged; safe response headers and configured CORS allowlist |

Session credentials use a case-insensitive `Bearer` scheme followed by exactly
one three-segment JWT, with the entire header bounded to 4096 characters.
Only HS256 signatures are accepted. Claims require a nonempty bounded string
`userId`, a recognized platform role and an integer expiry; jsonwebtoken still
enforces expiry and not-before. `version` must be a nonnegative integer when
present. Legacy tokens without `version` continue to mean version zero. The only
restricted scope is `verification` for providers and it remains confined to
verification endpoints. Non-expiring or externally issued HS384 sessions must
sign in again. Platform-issued tokens already follow the accepted format.
No user role or identity is inferred from forwarding headers.

All responses set `X-Content-Type-Options: nosniff` and
`Referrer-Policy: no-referrer`; `X-Powered-By` is disabled. Proxy trust remains
explicitly disabled. Approved CORS origins receive the existing credentialed
headers; unknown origins receive no access-control-allow-origin header. CORS
does not authenticate clients, and requests without an Origin remain valid.

Compressed JSON and extended URL-encoded parsing remain supported. Parser errors
use `{ "success": false, "message": "..." }` with no submitted body or stack:

| Status | Message |
| --- | --- |
| 400 | `Invalid request body.` |
| 413 | `Request body is too large.` |
| 415 | `Unsupported request encoding.` |
| 500 (unhandled error) | `Unable to process the request.` |

Existing route-level validation/authorization error envelopes remain unchanged.
After response headers have been sent, errors delegate to Express rather than
attempting to write a second JSON response.

## Configuration, secrets and compatibility

`NODE_ENV` accepts development, test or production. Local development retains
the existing localhost:5173 and localhost:3000 allowlist if `CORS_ORIGINS` is
unset. Configure up to ten comma-separated explicit HTTP(S) origins, without
credentials, wildcard hosts, non-root paths, query strings or fragments.

Production now requires an explicit HTTPS `CORS_ORIGINS` allowlist and a private
`JWT_SECRET` with at least 32 bytes after trimming. Empty, short, whitespace-only
and obvious example/test/demo secrets are rejected without reflecting their
values. Length validation is not an entropy guarantee: generate a random secret
in the deployment secret manager. Startup validates configuration before MongoDB
connection/listening. Existing deployments must set these values before rollout.

The environment example contains placeholders, and actual environment files,
admin credentials, dependency directories and build output remain ignored.
Historical credentials must still be rotated by the credential owner; no history
rewriting, live secret rotation, account resets or database migration occurs here.

Rollback: revert this PR and restore the previous application artifact/settings;
there is no database rollback. Restoring vulnerable dependencies reintroduces
the corresponding risks and should only be a temporary operational measure.

## Validation and limits

Tests cover configuration boundaries, malformed bearer headers, signature
algorithms/claims, proxy subnet behavior, persisted authorization/revocation,
CORS, private cache headers, malformed credentials, compressed trailing bytes,
unsupported encodings, decompression limits and extended form parsing. HTTP
parser regressions also make a subsequent health request to prove that the
process survived. Integration databases are random, test-only loopback replica
sets; the normal Docker database and application accounts are not accessed.

Final executed counts and CI links are recorded in the pull request report.
General authentication rate limiting/recovery (existing PR #24), role-specific
analytics privacy, deployment monitoring and the separate frontend dependency
tree remain outside this phase. This phase does not declare production readiness.
