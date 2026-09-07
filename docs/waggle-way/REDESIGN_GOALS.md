# Waggle Way redesign goal series

Created 2026-09-07 at the user's request. One active implementation goal tracks
the five phases below. Phases 1–2 are in progress: pixel art/title entry and an
independent version-7 dancer slice exist locally with focused checks. No phase
is accepted or complete. No deadline or token budget was requested.

Latest local iterations add compact play/workshop controls and a bundled pixel
font, with browser/device panel, focus, rescue and fullscreen checks. A mixed
dancer garden now passes real create/save/test/reopen checks in all five browser
projects. Five practice gardens now teach pointing, relative turns, reversal,
bounce and a covered spray crossing; all-bees routes and browser play checks
exist, while human slice/workshop review remains open. See
[implementation evidence](IMPLEMENTATION_PROGRESS.md). These checks do not
advance the campaign expansion gate or stand in for the user's slice review.

The user endorsed the later industrial/urban campaign and honey-recovery factory
direction. Include that arc in this goal; exact chapter names, level allocation,
machine rules and honey-objective details remain design choices to playtest.
This advances those ideas from the earlier proposal record into planned scope.

## Phase 1 — Pixel-art playable level

Replace the prototype's visual language with coherent top-down pixel tiles,
sprites, effects and game-owned interface. Deliver one complete level plus its
title/menu, HUD, pause/results and contextual controls within one embedded game
window and fullscreen. Preserve aspect ratio and legibility on desktop and touch.

Evidence: inspect the actual rendered game, including its menus and fullscreen;
demonstrate a complete run and rescue of its last helper. Do not equate an asset
mockup or automated win with acceptance of the overall experience.

## Phase 2 — Direct controls, hazard logic and workshop

Updated scope from the user, 2026-09-07: replace required perch placement in new
rules with freely placed, supply-limited dancing bees. Add fixed-heading,
left/right 90-degree and reverse dances and readable obstacle bounce. Prototype
these in small variations of the slice before large-map or campaign expansion.
Verify entry-only relative turns, overlap, resource accounting, helper release,
corner contact and shared builder/preview/replay semantics (WW-03 and WW-20).

Feedback follow-up: the user called the practice slice better, reported a
single-guide shortcut in lesson 2, requested dry-ground-only guide placement and
questioned separate helper headings. Revise that lesson and use explicit version
7 for water placement restrictions and a prototype where relative helpers follow
the last bee they guided on release. Keep pointing arrows and preserve version 6.
The automatic-release choice needs further review; this is not full acceptance.

Complete the same slice's grid drag/drop, dancer/fan direction handles and compact
contextual editing, with keyboard/tap alternatives and undo. Introduce explicit
versioned rules where ordinary water is safe to fly over and active sprays or
waterwalls have understandable warnings, footprints and effects. Build, test,
save and reopen the slice through the matching pixel-art workshop.

Evidence: deterministic hazard and helper behavior, faithful previews/replays,
safe legacy-file handling, and a demonstrated authoring round trip. Present the
complete slice to the user and address their feedback before expanding the new
treatment across the campaign. Track human review separately from automated checks.

## Phase 3 — Industrial and urban mechanics

Prototype the user's later lift-dancer suggestion (WW-21): a limited helper
signals a short higher-flight crossing over marked barriers. Follow the
[lift design](GAME_DESIGN.md#later-lift-dancer-proposal) to settle clearance,
duration, blocked landing, other hazards and helper rescue. Keep the top-down
camera and ordinary water flyability. This is a later experiment after slice
review, with matching versioned builder/preview/replay support if retained.

Later-scope addition from the user, 2026-09-07: develop panning/scrolling and zoom
for levels larger than the viewport, prioritizing readable mobile play. Follow
the [camera specification](LEVEL_DESIGN.md#later-large-maps-and-scrolling-camera)
for gesture separation, stationary HUD, overview/recenter, offscreen awareness
and workshop parity. Complete this foundation before authoring large-map puzzles.

Develop and teach a coherent set of bee-operated buttons/controls, fans,
pipes/valves or ducts, shutters and protective passages. Each chosen mechanic
must add a useful decision, show its connection/state and plausibly affect flight.
Decorative ground objects do not become arbitrary barriers. Introduce machinery
individually before combining it; every helper operating a control needs an exit.

Evidence: representative teaching puzzles, deterministic timing and interactions,
builder support, readable active/inactive states, and simulation/preview/replay
parity. Resolve whether pipes carry air/water or provide bee passages by type;
do not make one ambiguous sprite represent incompatible rules.

## Phase 4 — Thirty-level campaign and honey recovery

Use [the level-design specification](LEVEL_DESIGN.md) for the proposed chapter
allocation, thirty teaching briefs and per-level authoring/acceptance checklist.
Refine those defaults using the slice review rather than treating them as fixed.

Re-author the campaign to progress from approachable garden/greenhouse puzzles
into urban routes and a honey factory. Keep the total target at 30 meaningful
levels; exact world allocation may change from the existing five gardens.
Use larger scrolling maps selectively in later chapters after camera validation;
keep early teaching levels compact and avoid padding routes with empty travel.
Build a readable factory finale: enter, recover honey and bring the carriers
and remaining helpers safely out. Settle required versus optional honey goals
through playtesting, with rescue and delivery progress clearly distinguished.

Evidence: every level uses the shared builder format, introduces or combines a
distinct decision, has a reproducible solution and recoverable helper routes,
and receives recorded difficulty/readability review. Preserve old content and
progress compatibility intentionally; old solutions do not validate new puzzles.

## Phase 5 — Polish, verification and handoff

Finish consistent feedback, transitions, optional sound/motion, responsive
layouts and error/recovery states. Check keyboard/touch and assistive access,
representative device performance, legacy migration and relevant integrations.
Run the full repository verification gate for code handoffs; this phase also
provides final integrated evidence and resolves earlier outstanding checks.

Evidence: actual test results, scoped manual observations, documented limitations
and user feedback addressed. Do not claim AAA quality, accessibility conformance
or completion based solely on test counts. Deployment is a separate action
requiring explicit approval.

## Working boundaries

- Work in `scratch/waggle-way` on `codex/waggle-way`; preserve unrelated edits.
- Follow [live development](DEVELOPMENT.md): port 3040 for source updates and
  focused checks while iterating, full required checks at code handoff.
- Preserve legacy rules versions and require explicit, recoverable upgrades.
- Preserve saved community work and its unfinished verification. Additional
  community expansion does not displace this redesign. New mechanics cannot be
  published until the server verifies their exact rules; do not silently weaken
  validation or existing member/admin/coach authorization boundaries.
- Update this file and [implementation progress](IMPLEMENTATION_PROGRESS.md)
  as phases advance. Record user review honestly; do not mark pending review as
  passed or infer approval from silence.

See [art and gameplay direction](PIXEL_ART_PIVOT.md),
[campaign planning](CAMPAIGN_PLAN.md) and [roadmap](ROADMAP.md) for context.
