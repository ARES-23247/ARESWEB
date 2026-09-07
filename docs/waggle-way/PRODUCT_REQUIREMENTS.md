# Waggle Way product requirements

Status: revised direction, 2026-09-07. See the [planning index](README.md) and
[pixel-art redesign](PIXEL_ART_PIVOT.md). Implementation acceptance remains open.

## Product promise

Help a community of bees reach a field of flowers by arranging signals and wind.
The player controls the conditions and assigns helpful jobs; individual bees
follow visible, predictable rules. Making and testing a small puzzle should be
as approachable as playing one.

The creative references are indirect crowd guidance and accessible level making.
Create original names, art, audio, interfaces, and levels.

## Audience and experience

Design for students, families, and puzzle players on desktop and touch browsers.
Use short instructions, forgiving retries, and optional challenges. Do not depend
on fast clicking or an account for campaign play and local building.

The core loop is inspect, arrange, open the hive, observe, pause and adjust, then
rescue or retry. Success visibly blooms the destination. The important question
after failure is "What should I change?" rather than "What happened?"

Design principles:

1. Communication is the signature mechanic; dances express intent and wind
   changes motion.
2. Predictability comes before simulation realism or visual spectacle.
3. Helpers remain members of the hive and must have a route to safety.
4. New mechanics create decisions, not just new objects to memorize.
5. The builder and campaign use one format and one engine.
6. Feedback is available through text and symbols as well as animation and color.

## Full local release requirements

| ID | Requirement | Observable acceptance |
| --- | --- | --- |
| WW-01 | Deterministic bee guidance | Identical level, engine version, and tick-stamped actions reproduce the same outcome. |
| WW-02 | Understandable puzzle objects | Hive, flowers, dancing guides, directional fans and visible flight-blocking obstacles support a complete puzzle. Ordinary ponds are flyable in the new rules; active spray/water curtains provide clearly signaled hazards. |
| WW-03 | Freely placed, limited dancing bees | Place dancers on valid dry grid cells without required perches; water blocks guide placement but remains safe to fly across. Enforce authored dance supplies and hive population. Support pointing, left/right 90-degree and reverse dances with readable effects, predictable release and no repeated-turn loop. Prototype automatic departure for relative dancers instead of a separate heading control. |
| WW-04 | Forgiving run controls | Start, pause, resume, normal/fast speed, and restart work without losing the authored setup. |
| WW-05 | Readable results | Hive, flying, assigned, rescued, and lost counts reconcile; completion and failure reasons are explicit. |
| WW-06 | Usable local builder | Create, select, move, rotate, duplicate, delete, undo, redo, and test a level using pointer or keyboard. |
| WW-07 | Safe local persistence | Save/load drafts and import/export versioned files; invalid imports and storage failures preserve the current draft. |
| WW-08 | Shared authoring pipeline and complete campaign | Thirty campaign levels across five gardens are authored/exported through the builder and play through the same validation and engine path. |
| WW-09 | Accessible controls and state | Keyboard and touch flows, non-canvas state, reduced motion, and non-color indicators have recorded manual verification. |
| WW-10 | Repository integration | Game assets load on demand; relevant routing, build, bundle, and regression gates pass. |
| WW-17 | Cohesive pixel-art game | Terrain, bees, obstacles, effects, title/menu, HUD and workshop share an 8-bit-inspired top-down style in one embedded window with fullscreen; user review of a complete level remains required. |
| WW-18 | Direct grid interaction | Tools drag onto the grid and dancers/fans turn through on-board handles, with contextual menus plus keyboard/tap alternatives; build/test/reopen is demonstrated. |
| WW-19 | Later large-map play and authoring | Selected later levels extend beyond the viewport; mobile pan/zoom keeps pieces readable, HUD accessible, gestures distinct and offscreen helpers discoverable. The workshop uses the same camera model. |
| WW-20 | Readable obstacle bounce | Selected clearly marked solid obstacles redirect bees safely with deterministic contact/corner rules; distinguish bounce surfaces from hazards and show matching route previews. |

The user requested at least a couple dozen levels. The planning target is **30
polished campaign levels in five gardens of six**, with an initial five-level
playtest slice. That slice is not the full release. See the
[campaign plan](CAMPAIGN_PLAN.md) for the progression and proposed puzzle briefs.
Do not pad the campaign to meet a level count. A route preview must
communicate its horizon and assumptions; it is not a promise of eventual safety.

## Campaign mechanics and subsequent requirements

| ID | Requirement | Intended milestone |
| --- | --- | --- |
| WW-11 | Rally points, switches, gates, and optional pollen routes | M5, required for full campaign |
| WW-12 | Shelter leaves, timed sprinklers, and five garden themes; further jobs and hazards remain expansions | M5 campaign subset; remaining ideas later |
| WW-13 | Authenticated publishing with verified creator completion | M6 |
| WW-14 | Browse/filter published levels and report inappropriate content | M6 |
| WW-15 | Remixes with retained attribution and versioned completion evidence | M6 |
| WW-16 | Ghost replays; assess checkpoints and rewind separately | M7 |
| WW-21 | Prototype a limited-supply lift dancer that signals temporary higher flight over explicitly marked barriers; ordinary water needs no lift, tall/covered obstacles remain blocking, and the landing preview and helper rescue follow shared deterministic rules | Redesign phase 3, after slice review; exact mechanics pending prototype |

All other discussed ideas remain in the [game design backlog](GAME_DESIGN.md).
Later placement preserves an idea without promising a delivery date.

WW-17/18 and the revised WW-02 are the next redesign slice, preceding further
campaign or community expansion. Sprays and industrial environments are confirmed
directions; specific valves, vents, shutters and world ordering remain candidates.
The existing five-garden structure is provisional under this redesign; the
30-level target remains. Old lethal-water levels require versioned compatibility,
not an undocumented physics change.

## Modes

- **Story gardens:** ordered, handmade teaching puzzles with local progress.
- **Workshop:** local building, testing, and unrestricted experimentation; puzzle
  constraints are configurable but always used when verifying a solution.
- **Community gardens:** later discovery and play of published levels with honest
  empty, unavailable, and removed-content states.

## First-release exclusions

Online accounts for play, cloud saves, public publishing, multiplayer, chat,
leaderboards, procedural campaigns, executable level scripts, uploaded assets,
monetization, and full rewind are outside the full local release. General
offline availability is not promised until the actual PWA behavior is tested.

## Product validation

Record observations from prototype play sessions rather than inventing metrics.
Before calling the first release ready, demonstrate that players can explain a
dance/fan interaction, improve a failed attempt, rescue a released guide, and
build/save/reopen a small puzzle. Include desktop keyboard and touch sessions.
Record device/browser, assistance needed, confusing moments, and resulting fixes.

Require reproducible technical and manual evidence for accessibility and
performance statements. Deployment remains subject to explicit user approval.
