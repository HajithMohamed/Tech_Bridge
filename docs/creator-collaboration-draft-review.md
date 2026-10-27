# Creator collaboration draft publication

Prepared 2026-10-27 from the existing uncommitted campaign work, on the separate
`feature/creator-collaborations` branch. Depends on `feature/campus-creators` and
messaging PR #22. Authentication recovery is independent. No automatic merge.

The proposal adds transactional invitation/status/submission/review operations,
participant account locks, optional expected revisions, bounded history and
submission counts, reasoned cancellations, review/resubmit history and legacy
accepted-campaign completion compatibility. Provider review approval currently
completes a new workflow campaign. Pending notices are stored in a transactional
owner/key-unique outbox; there is no delivery worker or notification UI here.
Only generic campaign-update notices are queued; no private evidence is copied.

This is a draft for review, not completion of section 10. Outstanding work includes
the full proposed Draft/Pending/Accepted/In Progress/Submitted/Reviewed/Completed
product lifecycle, frontend deliverable/review/cancellation/history controls,
campaign pagination, agreement/compensation policy, anti-spam, full concurrency
coverage and relevant browser acceptance tests. Revision remains optional for
backward compatibility and needs an explicit migration/compatibility decision.
No payment processing is implemented.

The additive model fields default for legacy documents; no destructive backfill or
production migration was run. Existing unit validators cover public URLs, field
bounds and submissions. Seven focused API cases cover invitation, permissions,
review/resubmission, decline/cancel, rollback and legacy behavior; three outbox
integration cases cover idempotency, rollback and unsafe input. Executed results
are recorded in the PR. E2E coverage for the unfinished new campaign UI is pending.

The historical local-runtime recovery guide describes how the combined local
workspace was restored. Its mail adapter belongs to the independent auth draft;
the only support module added here is the pending campaign outbox. The original
working tree is preserved, with no local passwords, credential files or database
records committed. Keep this PR draft pending feature approval and the listed work.
