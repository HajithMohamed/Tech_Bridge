# Authentication recovery draft publication

Prepared 2026-10-27 from the existing uncommitted workspace, on the independent
`feature/auth-recovery` branch. Based on messaging commit 09a9bdb / PR #22.
This publishes work for review; it is not an approved complete authentication phase.

## Existing work preserved

- Registration preserves the approved 201 contract by default. Explicit server
  AUTH_REGISTRATION_MODE=email_verification enables generic 202 and required
  email verification with a configured local adapter. Existing accounts retain
  their persisted requirement independently of the current registration mode.
- Challenge tokens are random, stored as SHA-256 hashes, purpose/email-bound,
  expiring and transactionally consumed once. Password resets bcrypt-hash the
  new password, increment tokenVersion and consume sibling links.
- Per-account/network limits persist in MongoDB; forwarding headers are not trusted.
- Recovery/verification API clients, pages and forms give generic request notices,
  bounded new-password validation and fragment-token handling.
- Development mail writes private JSON files in ignored backend/.cache/mail.
  No external mail is sent. Tests/production default to disabled delivery; local
  delivery refuses production. No production adapter is implemented.

## Review blockers / incomplete work

- The three new standalone pages are not registered in App.tsx yet. Component
  tests mount their own routes; this is not full application route coverage.
- The 201/202 backend compatibility regression is reconciled through explicit
  server rollout configuration; existing regression assertions are preserved.
  See [the contract and acceptance criteria](../backend/docs/auth-registration-compatibility.md).
  The draft frontend still expects the verification protocol and needs deliberate
  integration before the whole feature is ready to merge.
- Production mail delivery, recovery audit events, complete authentication feature
  integration and approval of the optional verification contract remain outstanding.
- The normal protection middleware's handling of email-verification requirements,
  identity-change races and delivery-failure operator feedback need further review.
- No real account migration or production record change is proposed. Do not set
  requiresEmailVerification on existing users through a blanket backfill.

## Validation

The original publication's source/test TypeScript, build and 288 backend unit cases passed in the
isolated review worktree. Seven targeted API cases exercise login compatibility,
verification, password reset/session revocation, competing resets, invalid links,
generic undelivered-mail behavior and throttling against a disposable database.
Their executed results and frontend results are recorded in the PR.
The seven new API cases passed. Frontend lint, source/test types, production build,
10 unit cases and all 54 integration cases passed. The full backend regression
run at that time had the now-reconciled registration-contract failures. The current
correction's full executed results and CI links supersede those historical counts
and are recorded in PR #24. Do not infer readiness of the full feature from CI alone.

No local administrator password, password hash, JWT, .env.admin or mail-spool file
is included. The requested local administrator reset affected only Docker data and
the ignored credential file, and cannot be transported through a Git push.

Keep this PR draft until the listed blockers are addressed and the feature phase is
explicitly approved. No automatic merge or production migration.
