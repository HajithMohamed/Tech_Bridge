# Scholarship award concurrency review

Branch: `fix/scholarship-award-atomicity`. Base: fetched development `8a93d070821663cd9000d8132c58531f5047757e`. Resource PR #12 remains independent and pending; this branch does not include or replace it.

Review completed: 2026-10-19 (Asia/Colombo).

## Existing behavior and acceptance criteria

Scholarship applications, provider review, status updates, priority explanations and award counts already exist. Approval previously counted accepted applications and then saved separately, allowing concurrent approvals to exceed capacity. The duplicate-benefit check also raced across providers. Editing capacity could invalidate the award limit.

- Serialize application decisions with opportunity edits and recheck counts in a real transaction.
- Do not exceed scholarship capacity under concurrent approvals, including different students; protect capacity edits from going below already accepted counts.
- Serialize the existing same-student annual-benefit check across scholarships/providers. Decline new approvals for suspended/deleted student accounts.
- Preserve existing status choices and human review. Repeat identical decisions are idempotent. No calculated score awards a scholarship.
- Preserve authenticated owner access and populated response contracts, reject malformed inputs, roll back failed writes, and return safe errors.
- Prevent changing a listing into or out of scholarship type after it has applications, so accepted benefits cannot disappear from the existing policy query.
- Run unit, database integration, frontend, browser, build, type, lint and repository-policy checks; report actual results.

## Compatibility and policy limits

No schema, index, dependency or migration change. The status route and success envelope stay unchanged; existing applied/reviewed/accepted/rejected transitions remain available. This does not implement durable award decisions, revocation reasons, appeals or agreement history. Conflicts return 409, invalid inputs 400, absent/not-owned records 404, and unexpected transactional failures generic 503. Opportunity updates retain existing validation/capability checks.

Application status changes and opportunity edits now require a transaction-capable MongoDB replica set or sharded cluster and fail closed on standalone MongoDB. Existing `__v` counters coordinate writes without altering unrelated user profile fields or timestamps. Opportunity edits and decisions serialize on the opportunity document; new scholarship approvals also serialize on the student document. Direct database writers must respect these guards.

The existing annual-benefit rule uses application submission dates since January 1 in the server-local calendar year. This is not an institution-specific academic year or an actual award-date policy. Old-year applications and unknown historic award dates need a separately approved policy/migration design; they are not silently reclassified here. A missing legacy capacity retains the existing fallback of one; invalid capacities fail closed. No universal fairness claim is made.

Scoring weights, typed benefit aggregation fixes, confidential evidence, eligibility policy, persistent waitlists, appeals, notifications, decision audit history and scholarship-type deletion/history reconciliation remain separate work. Existing status reversals are preserved and can release capacity; a future audited decision model is still required.

## Implementation and verification

`services/scholarshipAwards.ts` coordinates new scholarship acceptances on the student version counter and all application status changes/opportunity edits on the opportunity version counter. Conflicting transactions retry against a new snapshot before repeating counts. Domain validation and Mongoose validation failures return safe errors. The controller reuses existing opportunity payload, capability and model validation on the fresh document. Application responses are populated inside the transaction; a failure before committing rolls back the decision and coordination writes.

Unit coverage includes positive/invalid/legacy capacity, existing statuses, invalid input before database access and server-local year boundaries. API/database coverage includes competing awards, two-place capacity, idempotent repeats, cross-provider benefits, historic policy limits, reversals, suspended/deleted applicants, ownership, rollback, concurrent edits, type changes and unchanged non-scholarship decisions. Frontend component tests exercise explicit approval and 409 handling. The browser journey arranges a separate synthetic scholarship through the real API, submits through the student UI, and verifies a provider's decision after reload. It does not consume the scholarship fixture used by other journeys or change the shared E2E server, avoiding a fixture-file conflict with PR #12.

| Check | Result |
| --- | --- |
| Backend type checks | Passed |
| Backend unit tests | 79 passed on rerun |
| Backend integration tests | 56 passed together in CI; locally 55 passed in full run plus the final 25-case scholarship run |
| Backend production build | Passed |
| Frontend type checks and lint | Passed |
| Frontend unit/integration/build | 7 unit and 12 integration passed; build passed with existing 591.86 kB chunk warning |
| Chromium journeys | 5 passed with normal exit in 54.9 seconds |
| Repository policy tests | 9 passed |
| Whitespace check | Passed |

Total: 168 distinct passing tests on this branch, including 60 added here (32 unit, 25 API/database, 2 frontend integration and 1 browser journey). The totals exclude the independent pending resource PR #12. The full API run loaded 24 scholarship cases; the final focused run passed all 25 after the additional reverse-type case and validation refinements. After the final malformed-opportunity-ID guard, backend type checks/build passed again and the input-validation case passed; that last targeted command excluded the other 24 already-passed cases.

One existing app-import unit test exceeded its 15-second limit in the first local run. The unchanged suite passed on rerun in 6.43 seconds, without changing timeouts. Successful transactions/write conflicts/rollback use isolated real MongoDB replica sets; transaction-unavailable errors are simulated. No standalone database was reconfigured. Both owned test-server ports (4173/4510) were closed after the browser run.

The screenshot `output/playwright/scholarship-award.png` was inspected. Acceptance persisted, but the existing provider-review page has white/light text with poor contrast on its light background. No frontend product code or redesign was changed; this remains a visible limitation for the separate UI workflow.

## Pull request and CI evidence

[Draft PR #13](https://github.com/HajithMohamed/Tech_Bridge/pull/13) targets `development`. Verified implementation/test commit: `5b0ab486b5b1c54ece8bf9968c50f87f1bcd618d`.

- [Application checks run 39198422055](https://github.com/HajithMohamed/Tech_Bridge/actions/runs/39198422055): all three jobs succeeded, including clean installations, backend/frontend type checks/builds, frontend lint and MongoDB/browser provisioning. Decoded job logs confirmed 79 backend unit and 56 backend integration tests, 7 frontend unit and 12 frontend integration tests, and all 5 Chromium journeys (12.9 seconds). The full CI suites had no skipped tests.
- [Repository security run 39198422103](https://github.com/HajithMohamed/Tech_Bridge/actions/runs/39198422103): policy unit/integration tests and tracked-file audit succeeded. The staged local audit also passed all 9 checks with zero tracked environment, dependency or build-output violations across 188 files.

Together these checks verified all 168 tests on the exact committed implementation. The evidence follow-up changes documentation only. The branch was committed and pushed with a clean working tree; no branch was merged and no production records were changed.

## Rollback and remaining risks

Transactions contain no external delivery side effects. Commit attempts are limited to five seconds; the MongoDB driver governs transient transaction retries. Concurrent user/profile array saves can encounter a version conflict and require a retry. Existing inconsistent awards are not repaired; inventory grants and award dates must not be guessed. Back up and reconcile legacy records under a separately approved procedure before deployment where necessary.

Application submission and deletion workflows remain unchanged; durable award history and deletion-based benefit reconciliation need the broader scholarship lifecycle phase. To roll back safely, disable award mutation rather than restore the count-then-save path. No production data, migrations or database configuration were changed. Submit a separate draft PR to development and stop for review before another phase. Do not merge automatically.
