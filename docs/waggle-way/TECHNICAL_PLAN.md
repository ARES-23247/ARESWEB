# Waggle Way technical plan

Status: architecture baseline, 2026-09-05. Local play and builder routes now exist;
the prototype uses SVG with DOM controls in a private workspace package. Server
verification, the local community API, website interfaces and scheduled retirement
wiring exist locally; final verification of the latest additions remains open.
Local ghost comparison and timeline
review now run in a cancelable worker. Local campaign mechanics
through version 5 (pollen, optional goals and themes) are implemented. See
[implementation progress](IMPLEMENTATION_PROGRESS.md).

## Current redesign and iteration direction — 2026-09-07

Use the [live Vite workflow](DEVELOPMENT.md), not repeated production builds,
for visual/gameplay iteration. Follow the [pixel-art redesign](PIXEL_ART_PIVOT.md)
for game-owned UI and art. Preserve semantic controls and shared fullscreen
behavior; game-scoped visual tokens may differ from website styling. Pixel art
does not by itself require replacing SVG with Canvas. Evaluate sprite scaling,
rendering and input in one complete slice before choosing a renderer change.
Changed water/hazard behavior requires explicit rules/schema versioning and
replay/preview/server parity before enabling publication of those mechanics.

## Existing integration points

The live repository uses Vite, React 19, TypeScript, and React Router. Follow
[Arcade workspace architecture](../GAME_ARCHITECTURE.md): canonical game code
belongs in a private package, with thin website route wrappers and Arcade
discovery. Waggle Way uses `@ares/ui/button` and `@ares/game-common/fullscreen`.
Its package declares its own imports and never imports website `src/` or Firebase
authentication. The site supplies navigation elements; future authenticated
community clients must also be injected by the website.

Use `/waggle-way` for play and `/waggle-way/builder` for authoring. These paths
are implemented for the prototype. Inspect Hosting, prerendering, navigation, route
metadata, and PWA behavior when adding them; changing React routes alone is not
a complete integration. Keep the builder separately lazy-loaded.

The existing [game service](../GAME_SERVICE.md) handles online matches. The first
release needs no match service or identity flow. Future level publishing is a
content lifecycle, not frame-by-frame match synchronization. Inspect existing
backend source and API/security skills before specifying that API. Any later
multiplayer must evaluate the reusable match service instead of duplicating it.

## Canonical module boundaries

| Responsibility | Suggested location / boundary |
| --- | --- |
| React route shells | `src/app/waggle-way/` and its builder child |
| Game and builder entry points | `packages/waggle-way/src/Game.tsx` and `Builder.tsx` |
| Accessible controls and viewport | `packages/waggle-way/src/ui/` |
| Pure simulation, commands, validation | `packages/waggle-way/src/core/` |
| Draft state and persistence adapters | Separate modules under package `src/core/` |
| Original campaign level payloads | `packages/waggle-way/src/content/`, authored through shared builder commands |
| Domain tests | Repository Vitest conventions; no browser dependencies in engine tests |
| Browser flows | Dedicated Playwright play and builder specifications |

These paths describe the isolated `codex/waggle-way` worktree under
`scratch/waggle-way`, based on repository commit `21c7c2bb`. Earlier prototype
files in the parent checkout are not the canonical implementation. Commands run
from this worktree root. Keep all changes within the existing pnpm workspace and
release flow. M6 extends the existing game staging contract for the exact pure
rules needed by server verification; do not edit generated deployment copies or
assume Functions can import frontend dependencies directly. Local play needs no
server connection; the community service executes staged rules in a bounded worker.

## Engine and rendering

The new dancer system needs versioned free-grid assignment commands, per-type
supply accounting and versioned helper departure. Version 6 retains authored
release headings. Version 7 updates an assigned relative helper's direction when
it actually signals a bee, in stable tick/bee/contact order, and preserves that
direction on release; before its first signal the dance applies to its assignment
arrival heading. Reject manual adjustment for those helpers. Also reject guide/
water overlap in the shared validator, preserving flight across water. Track
per-bee influence entry/rearm state deterministically so left/right/reverse
effects cannot apply every tick. Resolve overlapping fields and swept entry
in stable order. Validate resource failures atomically. Selected bounce surfaces
need explicit collision responses with corner/penetration handling; the current
prototype's heading reversal is legacy behavior, not proof of a new reflection
model. Add matching editor, preview, replay and server rules before publication.

Version-6 local contact handling now checks each accepted flight segment for
circle entry, with travel-time ordering and stable guide selection. It applies
crossed signals to the following tick's desired heading while preserving the
actual segment for collision, weather and destination checks. Legacy rules do
not use this sweep. Preview uses the same `stepRun`; focused tests check grazing,
overlap hysteresis, a rejected step through a wall, escape after corner bounce,
arrow changes within a visit, and a real command-driven relative-dance replay.
See [timing rules](GAME_DESIGN.md#temporary-guides) and the progress record for
the tested scope. These checks do not settle final obstacle design or usability.

The prototype uses a small custom kinematic engine and SVG world rendering, plus
semantic DOM controls and an object/state inspector. SVG keeps the initial art
and interaction in the existing React stack. Rendering choice remains subject to
maximum-size profiling; move the renderer to Canvas if measured performance
requires it without changing the engine or removing DOM alternatives.

Use a fixed simulation timestep, stable object iteration, explicit command
ordering, and versioned rules. Store authoritative positions in bounded integer
or fixed-point units to make replay portable. Cosmetic bobbing and particles
must never affect collisions, resources, or outcomes.

Keep authored `LevelDefinition`, runtime `RunState`, and `EditorState` distinct.
Simulation advancement accepts a validated level, prior state, and commands;
it must not read DOM state, wall-clock time, or unseeded randomness. Physics,
airflow, collision queries, and route preview share implementation boundaries.

Use the animation frame loop for rendering and an accumulator for fixed ticks.
Bound work per frame; pause on page hiding rather than silently simulating an
unbounded backlog. Resuming restores the exact state. Dispose loops and listeners
on navigation. Avoid publishing every bee position through React state each tick.

Preview a short bounded horizon using the same engine and label it as a preview
under the current setup. Dynamic hazards and later player commands can change
the eventual result. Preview work is bounded and cancelable. The first maximum-size
measurement took about 492 ms on the local host, so the UI now calculates previews
in a module worker and terminates it when the setup, play state, or route changes.
Only results for the current run are displayed. See the progress document for the
measurement's scope and remaining device profiling.

## Accessibility and input

Later camera work separates world coordinates from the viewport and shares the
transform across drawing, pointer placement, drag previews and hit testing.
Pan/zoom must not change simulation ticks, rules or replay outcomes. Evaluate
render culling for larger scenes while continuing to simulate offscreen bees;
profile before raising existing schema/entity caps. The current validator allows
width 8–128 and height 6–72 cells; these bounds are not evidence that every such
scene is already usable on a phone. Follow the
[camera acceptance tasks](LEVEL_DESIGN.md#later-large-maps-and-scrolling-camera).

- Semantic, labeled controls with visible focus and predictable focus restoration.
- Keyboard equivalents for placing, selecting, moving, rotating, deleting, and
  assigning jobs; touch alternatives to dragging and hover.
- A DOM object list/property inspector with position and state, plus textual
  hive/run counts, objectives, and important events. Canvas alone is insufficient.
- Pause and optional step controls make state inspection possible without reflex
  requirements. Throttle announcements to meaningful events, not every bee tick.
- Reduced motion removes cosmetic movement without changing outcomes; sound is
  optional and never the sole hazard cue. Respect repository design tokens.
- Manually verify screen-reader inspection, keyboard completion of a representative
  puzzle and builder workflow, zoom/reflow, contrast, touch, and error recovery.

## Data and trust boundaries

First release persists only non-sensitive drafts, progress, and preferences
locally. No credentials or tokens in browser storage. Imported files and stored
documents are untrusted; use explicit schema validation and resource caps from
the [builder specification](LEVEL_BUILDER.md). Render text as text. Data-only
levels do not expose custom code, arbitrary asset URLs, HTML, or script hooks.

Before online publishing, design authenticated and role-authorized writes,
App Check, rate limits before expensive parsing/replay, bounded payloads and
queries, concurrency-safe revision changes, and explicit public DTOs. Keep
private ownership and moderation metadata server-side. Public identity is limited
to approved nickname/avatar. Apply the existing API error pipeline and redacting
loggers; preserve user-visible failures. Write emulator allow/deny tests.

Server replay requires strict limits on ticks, actions, objects, verification
time, and per-creator submissions. Record cost assumptions before deployment.
Published-state and deletion filters must apply to direct retrieval as well as
discovery. No production mutation or deployment is authorized by this plan.

## Verification strategy

Unit tests should cover invariants and meaningful edge cases: population
conservation, guide release, collision corners, overlapping signals/fans, speed
caps, pause/restart, repeated deterministic replays, version rejection, import
limits, persistence recovery, and editor undo/redo round trips.

Playwright covers a successful puzzle, a loss/retry, helper rescue, edit/test
round-trip, local save/reload, invalid import, keyboard operation, and touch
layout. Community milestones add server replay forgery and authorization/rule
tests, published visibility, ownership, reporting, and removal flows.

Profile a typical campaign scene and the proposed maximum scene on named desktop
and mobile devices. A provisional aim is responsive controls and 60 fps on the
selected reference devices; record actual frame timings and memory before
claiming support at any cap. Verify multiple render rates preserve outcomes.

Every implementation handoff must run the full root `AGENTS.md` gate with Node
24.15+ in the Node 24 line, pnpm 11.21.0, and Java 21+ for emulators. New utilities
and API routes require 85% line and 100% function coverage; existing coverage
ratchets remain intact. Check both initial and aggregate lazy/PWA bundle budgets.
Record actual gate results in the implementation progress document. A prototype
test pass does not establish completion of the 30-level campaign or future modes.

M6 implementation boundaries, resource defaults and required evidence are recorded
in [the community contract](COMMUNITY_PLAN.md). Routes are mounted locally in the
existing game service; production deployment is not authorized by these changes.


## Play camera implementation — 2026-09-07

`ui/GardenViewport.tsx` owns visual scroll position, bounded tile zoom and fit
mode. The engine still simulates the entire grid with fixed-point coordinates.
The SVG retains its full-world viewBox; pointer placement uses its screen matrix,
so scrolling and zoom do not change grid coordinates or replay commands. Large
new-rule boards start with 32-pixel cells near the hive; fit gives an overview.
Legacy play retains its prior view. Camera state is not serialized into levels,
proofs, or progress.

An explicit Pan board toggle captures pointer gestures and disables scene input
while panning. Placement mode restores the existing drag/drop and precise
coordinate controls. Arrow-key/native scrolling and hive/flowers/helper buttons
provide alternatives to dragging. Pointer release, cancellation and lost capture
end the pan. The HUD/tool dock remain outside the scroll region. Workshop's
existing zoom/scroll remains unchanged in this batch; shared direct pan controls,
minimap/offscreen indicators and physical-device performance profiling are still
follow-ups, not claimed features.
