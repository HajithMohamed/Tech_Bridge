# Backend audit refresh — 31 October 2026

The mandatory Phase 7 audit reported five backend dependency findings on the
unchanged `development` baseline (`d22803f`): one high and four moderate, counting
the vulnerable development dependency chain. This maintenance change is isolated
on `chore/backend-audit-refresh` and targets development separately from mentorship.

- `follow-redirects` 1.16.1 is affected by the cross-realm sensitive-header issue
  [GHSA-mrwp-f3q8-3g9p](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p).
  Update the existing transitive dependency to compatible patch 1.16.2 or newer
  within the parent range; no new HTTP implementation or API behavior is introduced.
- The unused `ts-node-dev` development dependency retains the legacy
  `rimraf → glob → minimatch` chain reported under
  [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
  No source or script uses this runner; `npm run dev` already uses `tsx watch`.
  Remove the unused runner rather than overriding its glob dependency across majors.

The two advisories were updated in the GitHub Advisory Database on 30 October
2026. This explains the newly failing audit after the earlier phase's green run;
it does not mean the historical audit had the current advisory data.

Only backend package metadata, its lockfile and this report change. No runtime
source, public API, database schema, account, frontend source or CI threshold
changes. No `npm audit fix --force`, audit suppression, test skipping or arbitrary
major upgrade is used. New dependencies are installed only in this clean isolated
worktree; normal application dependencies remain untouched.

Validation uses the standard backend audit/type/build/unit/integration checks and
the unchanged GitHub Actions frontend, browser and repository-security regression
suites. Actual final counts and links are reported in the pull request. This PR
must be reviewed independently; mentorship consumes the same maintenance commit
so its own complete regression checks can run with the repaired dependency tree.
