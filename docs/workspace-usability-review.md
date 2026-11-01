# Workspace usability and follow-up

Reviewed locally on 2026-10-26. Branch: `fix/workspace-usability`, based on the
published internal-messaging commit `09a9bdb`.

## Result

- Resource cards identify the item, listing owner, current provider verification,
  condition, availability and terms. Student-shared equipment has a distinct label;
  its owner is not linked to the provider directory. Missing owners, own listings,
  unavailable listings and zero stock have no request action.
- Application and request pages use readable text and status labels on light cards.
  Student applications link to the opportunity and permitted provider messaging.
  Resource requests link to the provider and messaging when the owner is identifiable
  as a provider. Rejected records, deleted peers, malformed IDs and known student
  owners do not receive inappropriate message actions. Server authorization remains
  responsible for current eligibility, blocking, verification and consent.
- Providers with no opportunities receive a first-listing action. Loading failures
  have retry controls, and stale responses cannot replace the selected applicant
  queue. Decision responses preserve populated applicant/listing labels when the
  server returns raw IDs. Pending decisions disable their controls.
- Resource access filters scroll within their row on narrow screens. Shared cards
  no longer have floating shadows; footer text and input placeholders have stronger
  contrast. Nested full-viewport heights no longer create excess blank space.
- Nullable populated references are represented in client types, with corresponding
  guards in opportunity application tracking and the landing-page resource preview.

## Validation

- Frontend lint, source/test type checks and production build passed. Backend type
  checks passed for the expanded disposable browser fixtures.
- Full frontend checks passed: 10 unit tests and 66 integration tests. Two later
  eligibility regressions were added; the final targeted workspace run passed all
  22 cases across resource discovery, student follow-up and provider review.
- Final Chromium suite: 13 passed, including all three new workspace scenarios.
  New browser fixtures use a separate synthetic provider and scholarship; the test
  stack owns its disposable database and never loads the normal development URI.
- Screenshots were checked at 1440, 768 and 390 pixels. The resource-page browser
  inspector reports zero failures and zero warnings at all three widths. Images
  and inspection output are ignored under `output/playwright/`.
- Whitespace checks and repository environment/dependency/build-output policy pass.
  Vite retains its existing warning for a production bundle over 500 kB.

The first browser attempt timed out during an existing administrator navigation and
exposed an incorrect organization name in the new fixture assertion. The assertion
was corrected to the actual fixture; the final serialized suite passed without
raising timeouts or weakening assertions.

## Visual decisions

The app-screen direction was Achromatic ledger, seed 1043103624, adapted to the
existing TechBridge green palette, Inter/Poppins typography and navigation. No redraw
was used. Each screen leads with its real object and next action: identify equipment
and its provider; follow up on an application/request; or review applicants and create
the first listing. Status colors carry meaning, and counts come from the returned
records. The only sample accounts and listings added are isolated browser fixtures.

## Local runtime

The reported proxy errors were caused by stopped local MongoDB/API services. Docker
Desktop, the existing local MongoDB service and the backend were started. API health,
opportunities and resources returned HTTP 200 through Vite. The configured local
administrator authenticated successfully through that proxy. No credential values
are recorded in this report.

## Publication review, 2026-10-27

Published separately on `fix/workspace-usability-review`, based on messaging
commit 09a9bdb (PR #22). Authentication, mail, creator and campaign changes were
excluded. Shared client types include only the nullability/follow-up changes.
The original running workspace and its uncommitted files were preserved.

Re-executed in the isolated review worktree: frontend lint, source/test types,
production build, 10 unit and 68 integration tests passed. Browser and CI evidence
for this exact publication commit will be recorded in the PR. The complete local
Chromium run passed all 13 cases, including three workspace scenarios at 1440,
768 and 390 pixels. The bundle is
655.39 kB and retains Vite's existing size warning. No credentials, private mail
files, environment overrides, dependency directories or compiled output are included.
