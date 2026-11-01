# Personalized opportunities — backend review

## Scope and existing implementation audit

Branch `feature/personalized-opportunities` starts at fetched, approved `development` commit `17d864c223bc78508d043836fb61db49161c1b4d` (analytics PR #35 merge). No multidisciplinary aggregation branch or PR was found. The user's follow-up removes the aggregation requirement and asks that suggestions also follow extracurricular activities such as **content writing, video editing and photography**. There are no crawlers, external imports, portal redirects or external profile disclosures in this change.

| Existing feature | Verified state before this change | Action |
| --- | --- | --- |
| Legacy matched feed | Implemented with tests: 60% skills, 25% career relevance, 15% location; no separate interest/activity dimensions; missing skills treated as a perfect skill score | Retain its enabled-mode contract; introduce the separately versioned rule engine below; honor the new opt-out on the legacy route |
| Student profile | Academic programme/year, skills, goal, location and one work-mode preference exist; no editable multi-interest/activity preferences | Add optional private fields and a guarded self-service preference endpoint |
| Opportunity discovery | Search, verified-owner visibility, logical expiration, bounded pagination and explicit eligibility exist | Reuse filters and visibility; add bounded ranked discovery and optional provider metadata |
| Saved opportunities | Owned, transactional, idempotent internal saves with a 500-save cap and unique student/listing index exist | Reuse unchanged endpoints/records; add saved feed view and per-row saved flag |
| Source aggregation | No referenced feature branch or implementation present | Excluded following user clarification; all returned sources are TechBridge listings |
| Frontend feed controls | New controls are absent | Deferred to `design/personalized-opportunity-feed` after backend approval; no frontend design changes |

Acceptance criteria: activity/interest matches can outrank department-only defaults; all departments remain discoverable; unknown facts are not confirmed mismatches; scores need sufficient evidence; relevance never grants eligibility; opt-out and All browsing do not personalize; self-owned updates reject stale revisions and forbidden fields; unavailable/expired listings stay out of the open feed; pagination and data privacy have API regression coverage.

## API

The new [OpenAPI contract](./personalized-opportunities.openapi.json) documents the additional endpoints. Existing publishing, saving, search, eligibility and application routes remain available.

| Method and endpoint | Behavior |
| --- | --- |
| `GET /api/opportunities/recommendation-preferences` | Active student's own academic/recommendation DTO; defaults for legacy/missing profiles; no target-user parameter |
| `PATCH /api/opportunities/recommendation-preferences` | Partial update with mandatory current numeric `revision`; returns incremented revision and resolved preferences. Stale/concurrent edit: 409 |
| `GET /api/opportunities/recommendations` | Default recommended feed; filters, sort, pagination, source attribution, match explanations and owned saved state |
| `POST /api/opportunities`, `PUT /api/opportunities/:id` | Existing verified-provider authorization/revision rules; optional `recommendationMetadata` accepted and validated |
| `PUT /api/opportunities/:id/saved`, `DELETE /api/opportunities/:id/saved` | Existing owned, idempotent save/remove behavior |
| `GET /api/opportunities/saved` | Existing saved-history contract, including unavailable rows; open saved feed excludes unavailable rows |

Example self-service update:

```json
{
  "revision": 0,
  "extracurricularActivities": ["content writing", "video editing", "photography"],
  "careerInterests": ["creative work"],
  "preferredOpportunityTypes": ["job", "freelance", "internship"],
  "preferredWorkArrangements": ["remote", "hybrid"],
  "preferredEmploymentArrangements": ["part-time", "contract"],
  "personalizationEnabled": true
}
```

Other editable fields are degree (`ICT`, `ET`, `BST`, `other`), studyYear (1–6), specialization, skills, careerGoal, location, preferredLocations and careerStagePreference (`internship`, `graduate`, `either`). Interests/activities accept up to 20 plain-text labels of 80 characters; skills up to 25 of 50 characters; preferred locations up to 10 of 100 characters. Empty lists explicitly clear those choices. Creator discovery/consent, institution, identity, role, verification, token version and server weights are not writable through this endpoint. Optional recommendation fields are private, never compulsory registration data.

Feed views: `recommended` (default), `all`, `ICT`, `ET`, `BST`, `interdisciplinary`, `saved`. Programme views are manual filters; they do not restrict the default catalogue. `department`, `interest`, `activity`, `type`, `skill`, `q`, `workMode`, `location`, `providerId`, `deadlineFrom`, `deadlineTo`, `isPaid`, `isFree` can be combined. `source=techbridge` is the only enabled source. `sort=recommended|newest|deadline`; page 1–100, limit 1–50. Unknown fields, repeated/non-scalar filters and MongoDB operator shapes fail validation.

The response returns `asOf` and preference `revision`. Reuse both across pages to exclude newer inserts and detect preference changes. Anchors expire after 24 hours; live expiration still excludes newly expired listings. Each response uses a read-only database snapshot for account/profile, saves, provider status and listings. Across separate requests, listing edits, withdrawals, saves or provider status changes can alter membership/order; the anchor is **not** a persisted historical snapshot. Ties resolve by createdAt descending then `_id` descending; deadline sort uses ascending deadline first.

All mode and explicit opt-out return `personalized=false`, null recommendation objects and newest ordering unless deadline was selected. They do not return personal match explanations. Legacy `/matched` keeps its existing enabled-mode fields/version/weights, but an explicit opt-out switches it to non-ranked newest discovery and omits per-row match percentages. The new UI must consume version 3 explicitly; existing dashboard consumers are not silently switched in this backend phase.

## Ranking and explanations

Default factors are interests/activities 35%, department 25%, skills 20%, academic/experience level 10%, location/working/type preferences 5%, freshness 5%. Explicit career interests and extracurricular activities share the interest factor; when present they take precedence over fallback keywords from the old career goal/specialization. No activity is scraped or inferred from creator/social metrics.

Listings can optionally supply `recommendationMetadata` with departments (multiple supported), interests, activities, target studyYears, careerStage (`internship`, `entry`, `graduate`, `experienced`) and employmentArrangement (`full-time`, `part-time`, `contract`, `freelance`, `volunteer`). These are relevance hints, **not** the structured eligibility policy. Without department metadata, transparent keyword rules provide broad classification; without activity tags, bounded phrase aliases recognize legacy titles/descriptions/skills such as copywriter, video editor and photographer. The classifier exposes `provider_metadata`, `keyword_rules` or `unclassified` as its department method. Heuristics can miss synonyms or negation and are not identity or eligibility verification.

Ordering tiers, followed by observed weighted relevance and deterministic tie-breaking:

1. Explicit interest/activity plus own-programme relevance.
2. Explicit interest/activity or skill relevance, including work outside the usual programme.
3. Other own-programme opportunities.
4. Other interdisciplinary opportunities.
5. General discoverable opportunities.

Cold starts prefer internship/entry/graduate roles within the tier, then weighted relevance and recency. Students with no profile can browse and receive a completion suggestion. Profile incompleteness does not restrict discovery or equate to ineligibility.

Each factor is 0–100 when both sides supply usable evidence, otherwise null. Interest coverage is matched unique interests divided by selected unique interests; skills use matched unique required skills divided by required skills. Explicit programme membership is 100/0 when known. Known level/preference sub-signals are averaged. Freshness declines linearly from 100 to 0 over 30 days; it is never sufficient evidence alone. Exact skill aliases distinguish Java from JavaScript and C from C++.

The normalized value is `sum(observed factor × configured weight) / sum(observed weights)`. Publish a score only with **at least two positively weighted semantic factors** among interests, department, skills and level, and **at least 40 observed weight points**. Otherwise `score=null`, `scoreStatus=insufficient_information`. Unknown information is not multiplied in as a zero mismatch. Observed weight is coverage, not a statistical confidence or chance of acceptance. Explanations identify matched interests/activities, skills or programme and use conditional language for level. Eligibility always points to the existing separate check endpoint; no score changes award/application rules.

Operators can set `OPPORTUNITY_RECOMMENDATION_WEIGHTS` to a JSON object with all six factor names, finite nonnegative values totaling 100. Invalid configuration prevents app creation. Clients cannot edit these weights. Zero-weight dimensions do not create ranking tiers. The two-semantic-factor display threshold is independent of a custom weight distribution. Weights and editorial tier priority are policy choices, not universal fairness claims; review outcome distributions and student feedback before rollout.

Deterministic example inputs with a fresh posting, no level/preference evidence and no mandatory eligibility claim:

| Student | Opportunity signals | Expected explanation / outcome |
| --- | --- | --- |
| ICT, Java, programming interest | ICT, programming, Java | Tier 1; 100 relevance from 85 observed weight points; programme, interest and Java explanations |
| ET, programming interest, no skills | ICT software role tagged programming | Tier 2; explicit interest outranks an ET-only default; separate eligibility still required |
| BST, photography activity, photography skill | Photography role with that activity/skill but no department metadata | Tier 2; 100 relevance from 60 observed points; no missing-department penalty |
| Any programme, content writing/video editing | Role tagged with the chosen activity | Activity explanation; score withheld if insufficient other evidence |

Scores are conditional relevance values, not hiring predictions; the ET cross-programme example can have a lower percentage yet rank above a department-only item because tiers deliberately prioritize explicit interests.

## Database, security and backward compatibility

Adds only optional fields on existing User and Opportunity records; **no new collections, destructive backfill, fabricated student preferences or index changes**. Existing opportunity status/date indexes and the existing owned-save constraints are reused. No production connection or migration is needed for this additive schema change. Legacy records remain valid.

New specialization, interests, activities and recommendation preferences are `select:false`; only the self-service engine/DTO explicitly selects them. Preference responses and protected feed responses are `Cache-Control: no-store`. Feed opportunity/provider projections are allowlisted, excluding unknown future private fields. Ranking uses degree/year, explicitly supplied skills/interests/activities/goals and working/location preferences; gender, ethnicity, religion and other sensitive attributes are neither accepted by this update API nor read by the algorithm. No account/profile is sent to another website and source paths carry no profile data or tokens.

New requests recheck active student role, required email verification and JWT token version against the database inside the transaction. Optimistic revision checks plus transactional writes reject stale edits, preserving creator preferences and unrelated academic data. Registration ignores the new private fields; students set them through the validated self-service API. Saved state is scoped to the requester. Existing verified-provider visibility prevents suspended, revoked, withdrawn or expired sources from appearing as open. Feed reads reuse the shared database throttle at 60 requests per student per minute, return 429 with Retry-After on exhaustion, and fail closed on limiter failure; this is distinct from production ingress/network protection.

Ranking streams at most 10,000 candidate listings, retains at most page×limit (5,000) rows, bounds each database aggregate to five seconds and overall candidate processing to ten seconds. Candidate/time overflow fails with sanitized 503 and **no partial page**; narrow filters or an indexed ranking redesign are needed at larger scale. This is not production load-test certification. No cross-request recommendation cache or persisted personalized score is introduced, so preference edits take effect on the next response.

Rollback should disable the new feed/UI while retaining optional profile fields and existing saved rows. Preserve the opt-out handling if legacy matching stays active. Do not restore private-data exposure, remove source/audit records, or reset student preferences as an automatic rollback.

## Validation and handoff

Unit/API tests cover extracurricular and academic matching, unknown metadata, weights, explanations, preference changes/opt-out, cold starts, saved ownership, provider visibility, filters, anchored ties, stale/concurrent edits, private projections and revoked sessions. Exact executed totals, CI links, final commit and PR URL are recorded in the final PR description and completion report after execution. A first local API-suite attempt was blocked before any case ran by the disposable MongoDB startup timeout; this is not a passing run. No test timeouts or production policies were weakened.

The backend CI job budget increases from 15 to 20 minutes to accommodate the added database-backed cases alongside the existing 552 API cases. Per-test timeouts, assertions, retries and security checks are unchanged. The existing release-readiness audit also records an inherited messaging browser typing-cooldown failure and frontend dependency advisories. They are not resolved by this recommendation feature. Backend approval is required before starting the separately branched frontend implementation. Do not automatically merge, deploy, import external jobs or start the release-readiness implementation phase.
