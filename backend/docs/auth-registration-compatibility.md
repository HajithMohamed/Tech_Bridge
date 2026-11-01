# PR #24: registration contract reconciliation

The draft changed POST `/api/auth/register` from the approved 201 user/session
response to generic 202 and mandatory email verification. On head f72a2ab the CI
API suite returned 283 passed / 3 failed and Chromium returned 8 passed / 2 failed.
All five failures were existing registration journeys expecting 201. They are
genuine contract regressions, not timeouts. Their assertions remain unchanged.

## Acceptance criteria

- Preserve the approved default registration response and pending-provider rules.
- Retain the draft email-verification protocol as an explicit server rollout.
- Never mark an email verified just to restore compatibility.
- Reject client-supplied verification/role/creator authority as before.
- A configuration rollback or duplicate signup must not remove an existing email
  gate, issue another account's session or replace its credentials/profile.
- Fail startup for invalid modes or undeliverable verification configuration.
- Execute unit, real-Mongo API, full CI and existing browser regressions.

## Server-owned configuration

`AUTH_REGISTRATION_MODE=legacy` is the default when unset. It is captured once
when createApp builds the application. HTTP request fields and later process-env
changes do not select a different registration protocol for an existing app.
Restart all writers together for a deliberate rollout change.

`AUTH_REGISTRATION_MODE=email_verification` opts new registrations into generic
202. It currently requires MAIL_DELIVERY_MODE=local in development/tests and a
validated PUBLIC_APP_URL origin. The draft has no production mail adapter; this
mode deliberately refuses startup in production or with delivery disabled. This
prevents turning on a registration gate whose links cannot be delivered. It is
not a claim of SMTP/email-provider production readiness.

Only those two exact mode values are accepted; invalid/empty values fail startup
without including the supplied value in an error. No client-requested mode,
verification flag or timestamp is trusted.

## Affected API contract

POST `/api/auth/register` remains public, rate-limited and validated using the
existing fullName/email/password/confirmPassword, student/provider profile and
role rules. Only student/provider roles are allowed. Database models: User,
AuthRateLimit and, in explicit verification mode, AuthChallenge.

| Result | Default legacy mode | Explicit email-verification mode |
| --- | --- | --- |
| New student | 201, success/message/data.user/data.token | 202, success/message only |
| New provider | 201, success/message/data.user, no general token; organization PENDING | 202, success/message only; email and organization approval remain separate |
| Existing email | 400, success false/message; no existing-account token or mutation | Generic 202 identical to a new registration; resend only when appropriate |
| Concurrent duplicate key | One account created; loser receives the existing duplicate 400 contract | Generic 202, no identity/credential disclosure |
| Invalid body | Existing 400 validation envelope | Existing 400 validation envelope |
| Throttled request | Existing 429 and retry interval | Existing 429 and retry interval |
| Unexpected DB error | Generic 500, no internal details | Generic 500, no internal details |

Both modes return no password/hash/challenge value in the public response. Provider
verification state and evidence references remain server-controlled; creator
discovery remains a separate consent operation. Legacy mode does **not** set
emailVerifiedAt or pretend a new address was verified. Its existing duplicate
response still reveals account existence: it preserves the approved contract,
not the optional privacy goal of the generic protocol.

The mode affects only newly created accounts. Existing records retain their
requiresEmailVerification/emailVerifiedAt state. Login checks that persisted state
independently of the current registration mode, so switching back to legacy or
resubmitting an existing unverified account cannot bypass its email gate. Required
email checks remain required after password reset. Email verification never grants
provider approval or administrative privileges.

Challenge hashing, one-time transactional consumption, reset session revocation,
shared throttling and generic recovery responses are preserved. No production
record, account, password, mail file, index migration or dependency update ran.
No existing regression assertion or frontend source was edited by this correction.

## Validation and remaining draft work

New unit tests cover modes/defaults, bad values, trusted origins, startup validation
and disabled/production delivery. New real-Mongo tests cover 201 student/provider
responses, generic 202, one-time verification, forged authority fields, duplicate
races, captured configuration, rollback safety and independent provider approval.
Final executed totals and exact CI run links are maintained in PR #24.

CI compatibility does not complete the authentication feature. The draft frontend
expects the verification protocol, while default backend mode deliberately keeps
the approved 201 contract. The separate frontend workflow must deliberately wire
the recovery routes and select/handle the agreed registration protocol before
this draft is mergeable as a complete feature. Production delivery, recovery audit
events, identity-change races and middleware enforcement of email requirements
still need their planned security review. Keep PR #24 draft and do not merge it
merely because the compatibility checks become green. No blanket verification
backfill, automatic feature activation or production deployment is authorized.
