# Waggle Way roadmap and decisions

Status: implementation active, 2026-09-06. M0–M3 foundations are implemented;
acceptance remains in progress. The M4 five-level slice is implemented with
playtest and accessibility acceptance still open. M5a–M5d have thirty playable puzzles, shelter/tool supplies,
switches, gates, rallies, timed rain, optional pollen/tool goals and five themes.
M5 player acceptance and M6 remain pending. M7 ghost comparison and timeline
review are implemented, with checkpoints/rewind assessed and deferred; human
replay usability review remains open. See
[implementation progress](IMPLEMENTATION_PROGRESS.md). No delivery dates assumed.

The immediate priority, revised 2026-09-07, is the [pixel-art redesign](PIXEL_ART_PIVOT.md):
one complete top-down level, matching standalone game UI and workshop, direct
grid interaction, fullscreen and understandable spray/industrial hazards.
The user has now reviewed the slice positively and authorized harder campaign
conversions and larger boards with mobile panning. The first new batch contains
six glasshouse challenges after the five teaching gardens; community expansion
is still a separate scope.
Use the [live development loop](DEVELOPMENT.md) for iterative feedback.

See [replay and recovery](REPLAY_AND_RECOVERY.md) for the implemented M7 workflow
and separate assessment of live recovery. This additive local work does not
claim M4/M5 human acceptance.

## Delivery sequence

The user requested a new implementation goal on 2026-09-07. The active
[five-phase redesign series](REDESIGN_GOALS.md) orders the current work:
pixel-art slice, direct controls/hazards/workshop, industrial mechanics,
30-level urban/factory campaign, and integrated polish/verification. The first
two phases implement R1 below. Earlier M milestones remain historical scope and
evidence; their unfinished community work does not supersede this sequence.

| Milestone | Depends on | Scope / requirements | Exit evidence |
| --- | --- | --- | --- |
| R1: Pixel-art redesign slice (next priority) | Existing local prototype | Revised WW-02, WW-17/18; one level, complete game UI, workshop, explicit hazard/rules revision | User can explain the route and hazard, guide the last helper, and build/test/reopen with direct controls; review desktop/touch and embedded/fullscreen. |
| M0: Movement experiment | Planning baseline | One bee, dance, fan, collision, water, destination; WW-01/02 exploration | A player can explain the route and adjust it; record chosen movement rules and renderer. |
| M1: Playable swarm | M0 | Population, guide assignment/release, resource limits, completion, pause/speed/restart; WW-01 through WW-05 | Reproducible pond puzzle; all population invariants hold, including the last guide's rescue. |
| M2: Builder foundation | M1 | Shared versioned schema, palette, properties, edit commands, undo/redo, test isolation; WW-06 | Build the M1 puzzle without source edits; edit/test/return preserves the authored level. |
| M3: Local workshop | M2 | Draft persistence, progress, import/export, validation and recovery; WW-07 | Round-trip a level; malformed import and storage failure cannot destroy an open draft. |
| M4: Five-level playtest slice | M3 | Five builder-authored levels, onboarding, accessibility, sound/motion preferences, site integration; partial WW-08 and WW-09/10 | Slice, keyboard and touch builder flows, manual review, profiling, and required repository gates pass. This is not the full campaign release. |
| M5: Thirty-level local release | M4 | Five gardens of six levels; rally points, switches/gates, pollen, shelter leaves, timed sprinklers; complete WW-08 and WW-11/12 campaign subset | All 30 levels pass campaign acceptance; each mechanic has builder support and teaching content; repeat full release validation with the expanded campaign. |
| M6: Community gardens | M5, with published mechanic set frozen | Authenticated publishing, server completion verification, moderation, discovery, remixes; WW-13 through WW-15 | Verified revision lifecycle, privacy/abuse tests, operational ownership, and removal/reporting workflow demonstrated. |
| M7: Replay and polish | M5 | Ghost attempts; evaluate checkpoints/rewind; WW-16 | Version-compatible replay; if rewind ships, full state restores without changing resources or outcomes. |

M5 completes the requested campaign before community features. Build its gardens
incrementally according to the [campaign plan](CAMPAIGN_PLAN.md). A mechanic cannot be enabled
for publishing until the server supports its exact rules version. Stages describe
product dependencies, not authorization for parallel agents or production changes.

## Immediate implementation checklist

- [x] Recheck the worktree and repository instructions before making code changes.
- [ ] Create a one-bee test scene with simple original shapes and explicit arrows.
- [x] Implement the pure tick/command boundary with population and collision tests.
- [ ] Compare dance-only, fan-only, and combined routes.
- [x] Test contact corners, competing dances, blocked fans, and the world edge.
- [x] Add pause and state inspection early, including a keyboard control path.
- [ ] Record playtest observations and lock the first rules version.
- [ ] Proceed to a swarm only when the single-bee behavior is understandable.

M0 may use a small explicit test fixture. Before M4, the campaign and its teaching
levels must be authored through the shared builder. Test fixtures are fictional
game content and must never be presented as real team or community records.

## Decision log

| Decision | Current disposition | Revisit by |
| --- | --- | --- |
| Art and interface | User approved 8-bit-inspired pixel art across board, sprites and all game UI; one standalone-feeling embedded window plus fullscreen | R1 user review |
| Hazard logic | User confirmed bees can fly over ordinary water; active sprays/waterwalls and industrial settings replace arbitrary pond danger in new rules | R1 rules/version design |
| Later industrial/urban campaign | User proposed buttons, fans, pipes and denser urban obstacles; reclaiming honey from a factory is a possible later story arc, not a locked chapter or additional level-count commitment | After R1, during campaign re-authoring |
| Direct controls | Drag/drop and on-board dancer/fan direction handles; fewer persistent menus, keyboard/tap equivalents retained | R1 play/workshop review |
| Larger maps and camera | User requested later scrolling levels, especially on mobile; readable scale, pan/zoom and overview/recenter with workshop parity | Redesign phase 3 foundation, phase 4 content |
| Dancer placement and behaviors | User requested free valid-grid placement without perches, limited supply, 90-degree turns and reversing dances; explicit release and entry-trigger rules required | Redesign phase 2 |
| Obstacle bounce | User requested bees bounce off selected obstacles; distinguish harmless redirection from hazards and settle contact/corner semantics through playtests | Redesign phase 2 |
| Dry-ground guides and automatic departure | User requested no guide placement on water and reported a single-guide shortcut in lesson 2. Version 7 restricts placement and prototypes relative helpers following their last guided bee; pointing arrows remain. Preserve version 6 and review the simplification. | Redesign phase 2 follow-up |
| Lift dancer | User suggested a bee that signals others to fly/hop over obstacles; prototype finite supply, explicit clearance classes, temporary higher flight and a predictable landing while keeping ordinary water flyable (WW-21) | Redesign phase 3, after slice review |
| Development loop | Existing Vite dev server on port 3040; focused checks during iteration, full gate before code handoff | Development tooling changes |
| Core concept and level builder | User-supported direction from the planning conversation | Scope changes |
| Title: Waggle Way | Working title only | Public naming/art pass |
| Setup-first versus continuous action | Proposed: setup, then pause-friendly adjustments | M0 playtest |
| Bee specialization | Proposed: any bee can take a temporary job | M1 |
| Dance overlap and solid collision | Candidate rules in game design; not yet validated | M0 |
| Renderer and exact simulation bounds | SVG with a semantic DOM inspector; fixed-point positions and 30 ticks/second; maximum-size Node sample recorded and route previews moved to a worker; reference-device rendering measurements pending | M4 device profiling |
| Site location | Local routes `/waggle-way` and `/waggle-way/builder` implemented with lazy imports and Hosting/prerender configuration | M4 release integration review |
| Campaign size | User requests at least a couple dozen; target 30 levels in five gardens, with a five-level playtest slice | M5 content acceptance |
| Online creator eligibility | User confirmed: current authorized team members may submit; admin/coach review is required before publication | Enforce and test during M6 |
| Remix deletion policy | User confirmed: retain already-approved remixes after parent deletion, removing deleted parent content and link | Enforce and test during M6 |
| Cloud saves | Not required for initial local release; community drafts use authenticated ownership in M6 | M6 design |
| Exact physics constants and schema limits | Tune and document; current limits provisional | M2 contract freeze |
| Science/education claims | Playful fiction; factual educational content needs separate verification | Any educational expansion |

## Risks and mitigation

| Risk | Response | Acceptance evidence |
| --- | --- | --- |
| Flight appears arbitrary | Simple deterministic rules and truthful influence previews | Players explain failures and reproduce fixes. |
| Last guide cannot escape | Design and test release behavior before campaign authoring | An all-bees solution includes every helper. |
| Builder grows faster than the game | Expose only validated engine objects; share schema | Every palette object has a gameplay use and test. |
| Touch or canvas blocks access | Build alternate controls and state inspection early | Recorded keyboard, screen-reader, and touch tasks. |
| Oversized levels stall the page | Enforce payload/world/entity limits and profile | Maximum accepted content remains responsive on reference devices. |
| Rule updates break saved puzzles | Version rules, preserve old drafts, migrate explicitly | Old/unsupported content has a tested recovery path. |
| Forged public completions | Server replay bound to exact revision and rules | Altered/forged runs fail verification. |
| Public content exposes youth data or abuse | Minimal DTOs, authorized writes, moderation and reports | Deny-path tests and an exercised removal workflow. |
| Feature expansion delays the campaign | Validate M4, then build only mechanics needed by the 30-level plan before pursuing the remaining backlog | M5 contains 30 distinct, tested puzzles and a usable builder. |

## Definition of done

For each milestone, update requirements and documentation to describe actual
behavior, record relevant tests and manual observations, and resolve or explicitly
record remaining issues. Follow the full repository verification gate for code
handoffs. Do not mark a milestone complete based only on files existing.

Release readiness and deployment are separate. Record required operational steps
and obtain explicit user approval before production deployment or data changes.

## Fresh-game campaign decision — 2026-09-08

The user superseded the parallel original/current campaign approach. The current
30-level catalogue in [CURRENT_CAMPAIGN.md](CURRENT_CAMPAIGN.md) is the only
built-in campaign, with current-rule workshop authoring. Archive and migration
work are out of scope. Honey/lift/pipe mechanics remain future scope; do not
confuse those proposals with the implemented factory shutter/spray puzzles.
