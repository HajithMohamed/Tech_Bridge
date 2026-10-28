# Phase 2: campus creator profile backend

Continues existing branch `feature/campus-creators` and PR #25. The branch was
reconciled without history rewriting with approved `development` commit
`9cc281378b6f5f446072322197ace0204e042b85` after PR #27 merged. It deliberately
reuses the existing User creator profile, routes and validation/discovery draft.
The earlier draft report is historical; this document defines the backend phase.

## Audit and acceptance criteria

| Area | Existing draft | Phase 2 acceptance |
| --- | --- | --- |
| Profile editing | Transactional owner update, alias/availability | Optional image URL; institution visibility defaults private; server-owned revision; bounded plain-text fields |
| Social links and portfolio | Platform domains, bounded links | Official Instagram/TikTok/YouTube/Facebook domains; optional other public links; IPv6/IP/credential/control-character rejection |
| Opt-in | Full form update required | Dedicated hide/re-enable endpoint; hiding incomplete legacy profiles needs no other fields |
| Discovery | Verified-provider gate; basic filter/pagination tests | Combined filters, deterministic pagination, suspension/role checks, hidden direct-ID protection |
| Privacy | Raw embedded creator object returned | Explicit public allowlist, alias masks legal name, institution needs separate consent, no private account fields |
| Metrics and verification | Unlabeled supplied follower counts | Metrics labeled self_reported, verification unverified; supplied verification claims cannot override labels |
| Concurrency | Account lock; unconditional replacement | Optional expected revision gives 409 on stale updates, including simultaneous hide/edit |
| Documentation/tests | Four draft API tests; limited unit boundaries | OpenAPI and regression coverage for consent, ownership, public fields, filters, boundaries, compatibility, error handling and conflicts |

Creator participation stays optional. Registration strips creator profile input;
ordinary student-profile editing preserves the existing creator profile. Only
explicit creator routes can change discovery consent. No profile scraping,
audience verification, identity claims, payments, campaign lifecycle changes or
notification delivery are introduced. Verification remains optional future work;
this API does not claim that self-reported content or affiliations are verified.

Expanded compatibility testing found that ordinary academic-profile replacement
could fail by re-casting a live Mongoose creator object and could race with a
creator consent withdrawal. `PUT /api/auth/student-profile` now writes only its
validated academic fields atomically, preserving creator consent and revision.
The existing 200 response and academic validation remain; an account that becomes
inactive during the update is rejected. Tests cover both supplied creator-data
injection and a real concurrent academic edit/consent withdrawal.

## API and backward compatibility

See [creator-profiles.openapi.json](creator-profiles.openapi.json) for methods,
roles, bodies, validation, success/error envelopes and model/business rules.

- `PUT /api/creators/profile`: existing full replacement endpoint for active
  students. Existing fields and 200 `{success,message,data:{user}}` remain.
  Adds optional `profileImageUrl`, `showInstitution` and expected `revision`.
- `PATCH /api/creators/profile/visibility`: new owner-only endpoint with boolean
  `isDiscoverable` and optional expected revision. Hiding does not require the
  full form or erase stored portfolio details. Re-enabling validates current
  completeness and link rules; incomplete legacy profiles must first be edited.
- `GET /api/creators`: existing verified-provider-only directory, literal public
  name/niche/content filtering, platform/compensation/availability filters and
  bounded page/limit metadata. Public aliases take precedence over legal names.
- `GET /api/creators/{studentId}`: existing verified-provider-only public detail.
  Hidden, suspended and nonexistent students produce the same 404 envelope.
- Existing `GET /api/auth/me` remains the owner's way to retrieve the saved
  profile and its current revision. Authentication and registration contracts
  remain unchanged.

Public responses retain `_id`, `fullName` (public alias if set) and
`studentProfile.creatorProfile`, with additive metrics/verification labels and
availability defaults. Only explicitly consented institution data is added.
Owner updates return the existing own-user envelope; public discovery never
returns email, password, token version, study programme, private account fields,
profile revision or arbitrary embedded metadata. Public image/portfolio links
are syntax-validated references, not uploaded or fetched by the server. DNS
ownership, redirect destinations, social ownership and image contents are not
verified. URL validation must not be reused as authorization for server-side fetching.

Existing clients can omit optional fields. Omitted `showInstitution` means false;
omitted images are removed by full replacement. Legacy discoverable profiles
without availability are treated as available. Legacy missing revision means
zero; a successful mutation increments it. Full replacement remains last-write
wins when the expected revision is omitted. Clients needing conflict protection
must send the last revision returned by the owner profile. A 409 requires reload
and deliberate retry; do not silently resend stale discovery consent.

Discovery defaults: page 1, limit 12; page <=10,000 and limit <=24. Filter strings
are bounded to 80 characters and interpreted literally, never as Mongo operators
or regex patterns. Unknown query keys are ignored by the existing simple query
parser. Sort uses display name, legal-name fallback and unique ID, so ties are
stable for an unchanged dataset. Pagination/counts can change with concurrent
profile edits; there is no cross-request snapshot guarantee.

## Database and security

The existing `User.studentProfile.creatorProfile` gains optional `profileImageUrl`,
`showInstitution` (default false) and `revision` (default zero). No new collection,
index, backfill, production record mutation or destructive migration is needed.
Profile mutation uses the existing account lock and MongoDB transaction pattern;
a replica set is required, as in the already configured local Docker setup.
Authorization uses the persisted authenticated account, never a body-supplied ID
or role. Suspended owners cannot mutate and suspended creators cannot be discovered.

Student discovery consent and current provider verification remain required.
Administrators do not receive special marketplace access. All creator responses
are no-store and reuse Phase 1 bearer/session controls. Validation returns 400,
unauthorized access 401/403, missing public profiles 404, stale revisions 409, and
service failures a sanitized 503. Input cannot manufacture a verified badge.

No frontend files are authored or edited in this phase. PR #25 already contained
two optional TypeScript declarations for alias/availability; those existing lines
are preserved. Image, institution-consent, revision conflict and visibility-patch
UI controls belong to the separate frontend workflow. Existing consumers retain
the previous response shape and full PUT workflow.

## Validation and rollout

Unit and real Express/MongoDB integration tests cover all acceptance rows above.
The concurrency test issues competing real HTTP mutations with the same revision;
one succeeds, one returns 409, and stale retries cannot restore withdrawn consent.
Existing complete backend, frontend compatibility and browser suites are run
before review. Databases contain synthetic fixtures in owned disposable loopback
replica sets; the normal Docker database/accounts are not accessed. Executed
counts, CI runs and feature commit are recorded in PR #25's final review report.

Deploy only after approval with the existing Phase 1 production configuration.
Rollback uses the previous application artifact; additive stored fields are
safe for the prior schema. Preserve current `isDiscoverable` values during any
rollback. An application rollback must not restore an old database backup merely
to undo these code changes. Revision conflict handling is available only while
the corresponding backend is deployed; prior versions lack that protection.

Separate known work: frontend dependency advisories and its existing bundle-size
warning; creator UI controls; optional independent creator verification; richer
campaign lifecycle (Phase 3); centralized notifications and production monitoring.
