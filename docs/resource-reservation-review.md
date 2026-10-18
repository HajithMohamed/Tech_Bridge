# Atomic resource reservation review

Branch: `fix/resource-reservation-atomicity`. Base: fully fetched `development` commit `8a93d070821663cd9000d8132c58531f5047757e`, containing the testing foundation, safe demo seed and public-provider privacy fixes. Complete Git history is available; local development was fast-forwarded without merging, resetting or overwriting existing work.

## Existing implementation and scope

Resource request creation, provider/student-owner queues, priority explanations and status actions already exist. The approval controller previously read a pending request, decremented stock and saved request state separately. Two approvals could consume stock twice for one request; failures could leak stock. Concurrent category checks on different resources could also approve multiple benefits for one student.

This change is limited to atomic approval/status transitions. It does not complete the full resource module: request-creation category races, returns, dates, waitlists, disputes, prioritization fixes and scholarship award concurrency remain separate work.

## Acceptance criteria

- Only the recorded owner may act on a request; the resource must still belong to that owner and match the requested category/access type.
- Permit pending -> accepted/rejected and accepted -> completed only. Reject repeated or competing decisions without consuming inventory again.
- Inventory and request state commit in one MongoDB transaction. Failures roll back both changes, including the student coordination write.
- Competing students cannot overdraw stock; competing approvals for the same student/category cannot reserve two resources.
- A missing or suspended student cannot receive a new allocation. Existing rejection/completion behavior remains available to owners.
- Verify real API/database concurrency, rollback, ownership, invalid transitions, frontend compatibility and an actual provider browser approval journey.
- Retain resource and applicant labels after decisions. The existing frontend replaced populated objects with raw IDs returned by the status endpoint; preserve those display objects while applying the updated status.

## API and database changes

The existing PATCH `/api/resource-requests/:id/status` route, payload and success envelope remain. Invalid inputs return 400, ownership/not-found returns 404, transition/eligibility/stock conflicts return 409. Unexpected database failures return a generic 503 without exposing database internals. A pending -> completed action now consistently returns a conflict; clients must handle non-2xx responses rather than depend on the old 400.

No schema, index or migration change. The existing user `__v` version counter is incremented inside accepted-allocation transactions to serialize approval checks for that student across different resources. This coordination write suppresses account timestamps and does not alter profile, role, password or verification fields; it rolls back if allocation fails. All allocation writers must use this service to retain that guarantee; direct database scripts are outside the API invariant.

Deployment now requires a transaction-capable MongoDB replica set or sharded cluster for resource status changes. Standalone MongoDB must fail closed; there is no partial-write fallback. Configure and rehearse the replica set separately before deployment. This branch does not reconfigure or migrate any database. Completion keeps existing behavior: it changes request state without returning stock; an explicit return workflow requires separate approval.

## Implementation and validation

`backend/src/services/resourceReservation.ts` owns lifecycle validation and the transaction. The existing controller delegates to it and maps safe domain errors. It rechecks current request state on retries, writes the student's version counter before the same-category query, conditionally decrements the matching resource, marks exhausted inventory claimed, and conditionally changes the request status in the same transaction. Every rejection or failure aborts all these writes.

The provider queue preserves its existing populated student/resource details when a status response contains raw IDs. Its styling, filters and priority display remain unchanged. The browser fixture adds a separate synthetic resource/request so the new approval journey does not consume inventory needed by existing public-profile tests.

Unit tests cover the full lifecycle matrix, allowed decision values and input rejection before database access. Real API/database tests exercise competing approvals, last-unit contention, independent students, same-category allocations across owners, different-category eligibility, approval/rejection races, injected save failure rollback, unchanged profile fields, missing/changed resources, suspended/deleted students, owner/peer-owner permissions, final-state conflicts and generic transaction errors. Frontend component tests cover retained labels and stock conflicts; the browser journey approves, reloads, completes and checks actual inventory.

| Check | Result |
| --- | --- |
| Backend type checks | Passed for application and test TypeScript |
| Backend unit tests | 79 passed |
| Backend integration tests | 53 passed against disposable MongoDB replica sets |
| Backend production build | Passed |
| Frontend type checks | Passed |
| Frontend lint | Passed, including targeted checks of final changed files |
| Frontend unit tests | 7 passed |
| Frontend integration tests | 12 passed |
| Frontend production build | Passed; existing large-chunk warning (591.90 kB JavaScript) |
| Chromium end-to-end tests | 5 passed; normal exit in 23.6 seconds |
| Repository policy tests | 9 passed |
| Whitespace checks | Passed |

Total: 165 tests, including 57 added in this branch (32 lifecycle/input unit cases, 22 database/API cases, 2 frontend integration cases and 1 provider browser journey). After the final input-handling changes, backend type checks/build passed again and all 22 resource-specific integration cases passed in 52.5 seconds. The transaction-unavailable error case is simulated; actual successful transactions, write conflicts and rollback use a real replica set. No standalone database was reconfigured or used.

No tests use production records or a developer database. Browser traffic is restricted to the owned preview origin; the API and MongoDB are disposable local processes. No dependency additions or lockfile changes. The completed-request screenshot at `output/playwright/resource-reservation.png` was inspected: resource/applicant labels remain visible with the existing green styling. Both test-server ports (4173 and 4510) were closed after the browser run.

## Operational risks and rollback

Transactions may retry after conflicts, so no external messages or side effects occur inside the callback. Approval uses majority writes and a five-second commit time limit; the database driver governs transient transaction retries. Serializing by student also serializes simultaneous approvals in different categories. Concurrent profile array updates may encounter a version conflict and need retrying. Future allocation code must participate in this coordination or introduce a separately reviewed database constraint.

No existing allocations are repaired, and no production migrations, seed scripts or administrative database commands were run. Reconcile any already inconsistent inventory from a backed-up inventory/accounting snapshot before deploying; do not infer the original stock from the current counter. A rollback must disable status mutation rather than restore the unsafe nontransactional approval path. Existing accepted/completed records and success payload shapes remain compatible.

## Review gate

Open a separate draft PR targeting development, present executed evidence and stop for the next approval. Do not merge automatically or modify production records.
