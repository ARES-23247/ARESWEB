# ARESWEB affected-area testing and deployment proposal

Status: approved staged implementation, 2026-09-07. Baseline: master 18ccb310. The first change implements observation, local scoped runs, full-suite browser sharding, and release readiness. Selective CI/deployment and package extraction remain gated on measured evidence; no quality gate is removed.

## Objective

Make a change to one game or website feature validate the affected behavior and shared integration surface, and deploy only affected runtime components. Preserve one repository, stable public URLs, shared authentication, existing coverage floors and protected releases.

## Feature test scopes

| Area                        | Current source boundary                                                                                                                     | Verification scope                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arcade                      | packages/buzzle, buzzello, buzzhex, pollinator, waggle-way; thin src/app wrappers                                                           | Changed game rules/UI/browser tests; Arcade navigation/fullscreen smoke; server adapter/worker tests when shared rules or online contracts change |
| Academy                     | src/app/academy, src/app/dashboard/academy, content/learning, curriculum scripts                                                            | Catalog/provenance/release validation, learning tests, Academy browser flows, public route/SEO smoke                                              |
| Simulation editor           | src/components/editor, simulation components, editor/compiler hooks, src/sims                                                               | Editor/compiler/sandbox tests, edited simulation browser run, affected lessons and simulations API tests                                          |
| Team operations             | Dashboard tasks/events/tournaments/users/profile and related public views                                                                   | Affected feature tests, role/authorization tests, event/task/roster browser flows, relevant API/rules tests                                       |
| Documents and media         | Dashboard documents/videos, gallery, media components and Drive integration                                                                 | Document/upload/DTO tests, affected browser flows, Storage/Firestore rules and API authorization                                                  |
| Public content and outreach | Public pages, blog, outreach, robots, seasons, sponsors, calendar                                                                           | Content/DTO tests, publication/SEO/prerender checks, public navigation smoke                                                                      |
| Store and finance           | Public and dashboard store/finance areas                                                                                                    | Affected business logic, public DTO/role tests and existing truthful availability checks                                                          |
| Integrations                | Communications routes, webhooks, Zulip and Robotics Studio integration                                                                      | Signature/auth/quota tests, adapter tests and affected task/simulation/document flows                                                             |
| Shared platform             | App/router, navigation, packages/ui, transport/auth/context, global CSS/PWA, dependencies, Firebase rules, shared middleware and CI tooling | Broader dependent-area checks; full gate for global/unknown impact                                                                                |

These are proposed ownership scopes, not claims that every area is already a standalone package. Begin with a checked-in ownership/dependency manifest; extract packages where independent entry points provide a measured benefit.

## Deployment components already present

- Hosting: one consistent frontend artifact including route shells and PWA assets.
- publicApi: published content, calendar, tournaments, robots, store/finance, sitemap/feed and related public DTOs.
- coreApi: inquiries, profiles and content approval.
- mediaApi: photos, videos and AI.
- driveApi: Drive operations.
- communicationsApi: tasks, simulations, webhooks, Zulip and Robotics Studio integration.
- Game Cloud Run service: online games and Waggle community/proof verification.
- web renderer and scheduled Functions: independently fingerprinted owners from the deployment contract.

A feature can affect several deployment components. A frontend-only game appearance change should not redeploy every Function. A shared game-rule change can require the game image and frontend together. Shared middleware/configuration changes fan out to every consuming service.

## Selection rules

1. Compute changes against the correct merge base for PR verification; use the last successfully deployed component fingerprint for deployment selection, not merely the previous git commit.
2. Include direct owners and transitive dependents. Account for generated game sources, dynamic route registries, CSS source scanning, static assets, content generation, workers and deployment contracts.
3. Unmapped files, selection errors, dependency/lockfile or global platform changes default to the full gate. Never silently produce an empty successful job.
4. Keep one stable required aggregate gate; it verifies every selected job and rejects failed, cancelled or unexpectedly skipped checks. Test the selector itself with representative change scenarios.
5. Keep relevant browser/device coverage, security checks and coverage ratchets. Caching may reuse exact-key artifacts, never substitute for verified source provenance.
6. Run full comparisons during rollout to prove the selector includes the expected checks; retain full validation for broad changes and release batches. A scheduled baseline would be a separately configured policy, not created by this proposal.

## Protected deployment behavior

- Continue repository-restricted Workload Identity Federation and normal protected master merges.
- Build immutable, component-fingerprinted artifacts. Public config, runtime versions, dependency locks and transitive shared source must participate in fingerprints.
- Deploy changed API components before a compatible Hosting switch; verify changed components and the overall public integration surface.
- Preserve complete resource/IAM/secret drift validation even when only some components deploy.
- Track partial failures and deployed component versions so a later release cannot incorrectly skip an undeployed change. Keep rollback artifacts and backward-compatible client/server transitions.
- Rules/index/security configuration changes require their dedicated validation and deliberate release ordering. For new indexes, wait for the declared indexes to report READY before switching dependent routes or running their health probes. No production data migration is implied.

## Measured starting point

PR #265 passed full CI run 34163441829. Its browser job took 29m52s of a 30-minute limit: 427 cases passed directly and one mobile skip-link case passed on retry. Verification/build took 6m7s. This makes two isolated full-suite shards the first performance improvement, preserving all 428 cases and the aggregate gate.

## Suggested implementation order

Production run 34165334449 initially deployed successfully but failed its community garden health probe while a newly deployed Firestore index was still building. All Waggle indexes subsequently reported READY, and the unchanged health command passed all 17 checks (including the media delivery check). This is evidence for an explicit index readiness gate.

The deployment retry created revision aresweb-game-api-00031-f7t. Both Hosting and direct revision URLs temporarily returned platform HTML 500 responses while the previous revision responded successfully. The new revision subsequently recovered without another configuration change. The unchanged production health script then passed all 17 checks, and the production browser security script passed against Firebase Hosting. The GitHub run remains failed because its health window expired before recovery; its browser job was skipped. Root cause of the platform 500 interval is unconfirmed. Add bounded readiness verification before route switching and a verification-only recovery path, so repeating a health check does not rebuild or redeploy healthy components.

0. Split the full browser run into two isolated CI shards with unique diagnostics and an aggregate gate that requires both. Address the observed skip-link test instability with behavioral evidence.
1. Add the ownership/dependency manifest and a selector that reports its decisions while the existing full gate still runs.
2. Split broad E2E files by feature; provide local affected-area commands and validate the selector against full runs.
3. Enable selected PR jobs under the unchanged aggregate gate; synchronize AGENTS.md and the CI skill instructions with the approved policy.
4. Add component build/deployment fingerprints and explicit changed-target deployment under the existing protected workflow.
5. Extract additional packages incrementally, using measured test/build time and dependency coupling to decide priority.

Full E2E sharding is also a separate, low-risk way to shorten broad release checks while keeping every test. It complements selective testing and does not itself determine deployment scope.

## Acceptance examples

- Waggle presentation-only edit selects Waggle browser/UI checks plus host integration; shared engine edit additionally selects server verification.
- Academy lesson edit selects curriculum/Academy/SEO checks without unrelated game suites.
- Task API edit selects task/authorization/communications tests and the communications deployment component.
- Authentication, root dependencies, shared styles or unknown paths cannot evade the broad gate.
- A failed previous deployment is retried correctly even when the next commit contains only unrelated changes.
- A deploy with unchanged backend fingerprints does not rebuild or redeploy those services, while full drift validation still passes.

## First implementation: commands and behavior

- `pnpm test:affected --base origin/master` reports changed files, owning and dependent areas, the selected unit/browser files, and potential deployment components. It does not run tests or authorize deployment. Git comparison uses the merge base and includes staged, unstaged, untracked and deleted paths; renamed files include both sides.
- `pnpm test:affected --base origin/master --suite unit --run` prepares canonical game sources and runs area unit tests; backend selections also compile Functions. `--suite e2e --run` runs the selected browser files, including navigation and authentication smoke coverage. These are iteration commands; the full handoff gate remains required.
- Unknown files, shared platform/configuration/dependencies, unavailable base history, and empty diffs select all areas. An empty mapped unit suite fails with an explicit instruction to run the full suite. Paths containing shell syntax remain arguments to Node/Git; the runner does not construct a shell command.
- `infra/verification-areas.json` is an explicit observation map, not a complete inferred import graph. Its `dependsOn` relationships fan changes out to consumers. `potentialComponents` is advisory and must never be used as deployment authorization or a skip list. Unmapped source retains full verification. Improve mappings from actual reports before enabling selective jobs.
- Full CI retains frontend/Functions coverage, lint/types, rules, content provenance, container constraints, build and security checks. Browser cases run on two isolated runners. Both report their complete discovered inventory and their actual shard results. The required gate rejects missing reports, mismatched inventories, duplicate/omitted cases, wrong shard identities, failed or skipped cases.
- The former mixed `interactive.spec.ts` is split into tasks, events, store and editor suites with the same test bodies. No behavior or platform coverage is removed. The observed mobile skip-link retry remains under investigation; this change does not claim a fix without a reproducible cause.
- `pnpm test:release-tooling` verifies selector, readiness and shard-gate failures with at least 85% line and 100% function coverage.

## Release readiness and recovery

The protected release deploys indexes first and waits up to ten minutes for all declared composite indexes to report READY. Missing or still-building indexes hold the release; repair/permission/schema errors fail it. Existing explicit field order, including an explicit document-name tie breaker, must match.

After backend deployment and the unchanged full IAM/resource/secret drift checks, the game HTTP contracts must pass directly before switching Hosting. A separate bounded five-minute Hosting readiness window permits pinned-route propagation before the existing complete health checks. HTTP readiness waits are at most five minutes each; individual requests time out after fifteen seconds. No resource limits or security checks are relaxed. Readiness does not prove a root cause for the earlier platform 500 interval.

`Verify Current Production` is a manual, read-only GitHub workflow on master. It runs the existing full health and browser-security scripts against the current production site, without deploy credentials, new images, a Hosting switch, or inquiry storage. It creates a separate verification result; it does not rewrite an earlier failed deployment or prove that a requested commit is deployed. Its SHA is a unique probe identifier. Normal releases still follow protected CI and require deployment authorization.

## Remaining rollout gates

1. Collect area-selection reports alongside full successful runs, including focused game, Academy, task/API and shared changes. Investigate the mobile skip-link failure from a trace if it recurs.
2. Expand the manifest and split other broad tests when reports show meaningful savings. Prove transitive imports, generated sources and dynamic routes are covered before enabling selective PR jobs. Update agent/CI handoff policy only at that point.
3. Introduce component content fingerprints and a durable ledger of each component's last successful deployment. Unknown or incomplete ledgers must deploy the affected components conservatively. Test partial failure recovery and dependency/config changes before skipping any deployment. Keep full drift validation and one coherent Hosting artifact.
4. Extract further private workspace packages only where measurements show independent development/build benefits. A new package does not imply a new production service.

This staged delivery is intentionally explicit: the first change shortens broad browser CI and speeds local iteration, but does not yet claim that an Academy edit skips unrelated CI or that backend deployments are selective.
