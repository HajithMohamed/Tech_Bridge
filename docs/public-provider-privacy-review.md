# Public provider privacy review

Branch: `fix/public-provider-privacy`. Base: approved integration commit `994634ef925474b76ba822274f6790707987a311`. The independent demo-seeding PR #9 remains pending; this branch does not include or replace it.

## Scope and acceptance criteria

Phase 0 finding S04: the anonymous provider endpoint returns the complete provider profile, including verification document names, rejection reasons and registration contact details. Public opportunity and resource population also exposes account email; resources expose contact email and phone. There is no public-contact consent setting.

- Define an explicit public profile allowlist and a restricted listing-provider projection. Unknown future fields must remain private.
- Keep organization identity, display name, location, website, logo, description, offerings and verification badge, and published listings available.
- Remove login email, contact person/email/phone, verification status/reason/document and account metadata from these public provider objects. Apply the same restriction to matched opportunity providers and peer resource owners.
- Preserve owner profile editing and authorized admin verification access, with API regression evidence.
- Update public frontend types and remove contact rows that no longer have a public data source; preserve existing styling and messaging rules.
- Run unit, database-backed integration, frontend, browser, type, build, lint and repository-policy checks; record actual results before review.

## API and database compatibility

No routes, schema, indexes, migrations or stored records change. Public response envelopes and listing IDs remain stable. Removing private fields is an intentional API contract restriction; clients that previously read them must update. Display names and provider-authored listing text remain public. Owner `/api/auth/me`, provider profile editing and admin review contracts remain unchanged. This scope does not add public-contact consent, change provider visibility/status rules, or complete the broader provider-verification workflow.

Public profile details: `organizationName`, `organizationType`, `verified`, `location`, `website`, `logoUrl`, `description`, `opportunityCategories`, `resourceAccessMethods`. The enclosing provider retains `_id`, `fullName` (existing display name) and `createdAt`. Public listing providers retain `_id`, `fullName`, organization name/type and the existing verified flag; resource owners also retain their role. A verified badge continues to reflect the stored flag; this fix does not establish genuine identity verification.

Anonymous routes covered: `/api/providers/:id`, `/api/opportunities`, `/api/opportunities/scholarships`, `/api/opportunities/:id`, `/api/resources`, `/api/resources/:id`. The student-only matched-opportunities route uses the same safe provider projection. Existing create/edit responses sharing these projections also receive the restricted provider summary.

## Implementation

- `backend/src/utils/publicProvider.ts`: explicit nested field projection plus a serializer that copies only allowed fields, even if given an unprojected document. Shared listing selections exclude login email, contact details and verification metadata.
- Four existing controllers reuse these selections. No authentication, ownership, filtering, scoring or allocation behavior changes.
- Frontend public response types are separated from private provider settings types. The public page removes its contact email/phone rows; organization details, website, badges, listing links and the existing eligible-student messaging action remain.
- Two unit tests cover unknown/private fields and missing optional data. Eleven real API/MongoDB integration cases cover anonymous routes, matched providers, peer owners, private owner access/editing, admin document review and invalid IDs. Three component integration tests cover the restricted response, student messaging action and unavailable profiles. One Chromium journey checks real serialized data, visible organization/listing content and navigation to scholarship details.

## Validation

| Check | Result |
| --- | --- |
| Backend `npm run typecheck` | Passed after correcting the test input type |
| Backend `npm run test:unit` | 21 passed |
| Backend `npm run test:integration` | 23 passed against disposable MongoDB |
| Backend `npm run build` | Passed |
| Frontend `npm run typecheck` | Passed after correcting two Testing Library query options |
| Frontend `npm run lint` | Passed |
| Frontend `npm run test:unit` | 7 passed |
| Frontend `npm run test:integration` | 10 passed |
| Frontend `npm run build` | Passed; existing large-chunk warning (591.86 kB JavaScript) |
| Chromium `npm run test:e2e` | 4 passed |
| Repository unit/integration policy checks | 9 passed; zero forbidden tracked files |
| `git diff --check` | Passed |

PowerShell blocks the `npm.ps1` shim on this machine; checks use `npm.cmd`, without changing execution policy. No dependency or lockfile changes. Browser tests use owned local API/preview servers and disposable MongoDB, with external browser traffic blocked. No production records or developer database were used.

The first browser run passed all four assertions but stalled in Windows child-process teardown under the sandbox. Its owned API/preview/MongoDB process trees were explicitly identified and stopped; unrelated processes were left alone. A rerun with process-cleanup permission passed all four tests, exited normally with code 0 in 1.5 minutes, and closed the owned API and preview ports.

Total: 74 tests on this branch, including 17 new privacy regression tests. This branch starts from the approved testing baseline, so these totals exclude the independent demo-seeding PR's tests. The public profile screenshot at `output/playwright/public-provider.png` was inspected: organization details, badges and published listing cards render correctly with the existing green theme.

## Pull request and CI evidence

[Draft PR #10](https://github.com/HajithMohamed/Tech_Bridge/pull/10) targets `integration/techbridge-v2`. Verified implementation/test commit: `d36abfefd82520064da3ab9956fbe691eb9d0aa7`.

- [Application checks run 39125365758](https://github.com/HajithMohamed/Tech_Bridge/actions/runs/39125365758): all three jobs succeeded. Backend: clean install, type checks, build, unit and MongoDB integration tests. Frontend: clean install, lint, type checks, build, unit and component integration tests. E2E: clean installs, MongoDB/browser provisioning, frontend build and Chromium tests.
- [Repository security run 39125365753](https://github.com/HajithMohamed/Tech_Bridge/actions/runs/39125365753): policy unit/integration tests and tracked-file audit succeeded.

This CI evidence update changes documentation only. No branch was merged; no production data was changed. The working tree was clean after committing and pushing the review evidence.

## Remaining risks and rollback

Public-contact opt-in, provider visibility/suspension policy, real identity claims, secure verification uploads and dependency advisories remain separate work. Free-text descriptions and listing-specific contact instructions are intentionally published content, and are outside the account-field restriction. External clients must remove reliance on the deleted private fields. Existing historical credential rotation remains an owner action documented in Phase 0.

There is no data migration to reverse. If a client needs additional public information, add a reviewed consent/authorization design and test it rather than restoring the complete private document. Rollback can restore the UI independently while keeping private response fields excluded.

## Review gate

Submit this scoped change for review and stop for approval before another improvement. Do not merge automatically. No production database changes or history cleanup are part of this branch.
