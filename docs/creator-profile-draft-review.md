# Creator profile API draft publication

Prepared 2026-10-27 from existing workspace changes on `feature/campus-creators`,
based on messaging commit 09a9bdb / PR #22. Campaign lifecycle changes and auth
changes are separate branches. This is a review draft, not completion of section 9.

The existing profile/discovery API now validates platform domains and bounded
public links, optional aliases and availability, uses transactional owner updates,
requires current provider verification, honors explicit discovery opt-in and
returns a public allowlist. Search treats punctuation literally and uses bounded
pagination. Creator metrics remain supplied by their owner; no scraping or
independent audience verification is introduced. Account registration opt-in
protection is in the separate authentication draft.

Backend source/test types and all 296 unit tests passed in the review worktree.
Four new isolated API cases cover opt-in/permissions, withdrawal, literal alias
search/filter validation and unauthorized updates. Results are recorded in the PR.

Outstanding: frontend alias/availability/image controls, complete discovery
pagination UI, institution/privacy requirements, explicit self-reported metric
labels, concurrency/abuse cases and relevant browser acceptance coverage. The
existing UI does not expose every new API field. This branch also contains shared
campaign input validators needed by the separate collaboration draft, but does not
change campaign models or lifecycle routes.

No accounts, production backfills, passwords or secrets are included. New profile
fields are optional; no destructive migration. Production link policy and rollback
must preserve privacy. Keep draft until remaining feature requirements are approved
and verified; do not merge automatically.
