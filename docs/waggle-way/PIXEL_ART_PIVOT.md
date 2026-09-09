# Waggle Way pixel-art redesign

Recorded: 2026-09-07. Status: user-approved direction, local implementation in progress.
This decision supersedes the painterly visual target and the old immediate
priority of extending community features. Existing code and past test passes
are prototype evidence, not acceptance of this redesign.

The user has now requested implementation through the active
[redesign goal series](REDESIGN_GOALS.md). That goal includes the subsequently
endorsed industrial/urban campaign and honey-recovery factory arc; earlier
proposal wording below does not remove them from planned scope. Exact mechanic
and chapter details remain subject to the first slice and later playtesting.

## Confirmed direction

- Make a cohesive, standalone-feeling bee puzzle game. ARESWEB hosts one game
  window; the title screen, level selection, HUD, pause/results, workshop and
  dialogs belong to the game's own visual language. Preserve fullscreen.
- Use an 8-bit-inspired pixel-art style throughout: terrain tiles, bees,
  obstacles, effects, icons, typography and interface frames. This replaces
  the painterly backgrounds and smooth beveled object art.
- Keep a strict top-down view and a readable grid. No horizon, side-view
  platforms or scenery that suggests a vertical playfield. A later explicit
  lift-dancer mechanic may use local height/shadow cues within this top-down view.
- Favor direct manipulation: drag tools onto the grid, move pieces, and turn
  dancers/fans through on-board direction handles. Keep menus compact and
  contextual. Retain keyboard and tap alternatives, visible focus and pause.
- Add obstacles with understandable causes. Bees can fly over ordinary ponds;
  standing water must not act as an unexplained lethal floor in the new rules.
  Active sprays, sprinklers and water curtains are the water-hazard direction.
- Explore industrial and greenhouse environments where airflow, equipment and
  irrigation make these obstacles legible. The level builder remains core scope.
- Keep the target of 30 polished campaign levels (at least a couple dozen).
  Reassess existing puzzles for the new rules rather than treating their current
  automated solutions as design acceptance.

## Proposed mechanics to prototype

Later user suggestion, 2026-09-07: a limited-supply lift dancer can signal a
short higher-flight crossing over marked barriers. Prototype after slice review;
see [clearance and landing rules](GAME_DESIGN.md#lift-dancer-rules).
This does not make ordinary water or ground scenery require a special ability.

New user direction, 2026-09-07: dancers can be placed on valid grid cells without
prebuilt perches, with limited per-level supplies. Add fixed-heading, left/right
90-degree and reverse dances, and predictable bounce from selected obstacles.
The [guide rules](GAME_DESIGN.md#temporary-guides) define the proposed placement,
accounting, relative-turn trigger and helper-release behavior. This supersedes
perch-only assumptions for new levels; legacy rules remain preserved.

These are design candidates, not implemented features or a promise to ship all
of them. Each needs a clear footprint, active/inactive state and useful puzzle role.

| Candidate | Intended puzzle role | Question to resolve in the first slice |
| --- | --- | --- |
| Timed sprinkler / water curtain | A visible spray blocks a route while active | Exposure consequence, warning duration and safe crossing timing |
| Valve / pump control | Opens a safe interval or disables a connected spray | How it is operated and how its connection is shown |
| Ventilation fan | Redirects bees through a readable airflow field | Force, range and occlusion that match the preview |
| Intake vent | Draws bees toward an unsafe opening | Distinction from a helpful fan and recoverable approach distance |
| Tall partition / shutter | Physically blocks flight at bee height | Clear overhead silhouette and opening/closing behavior |
| Covered passage / canopy | Protects a route from overhead spray | Which forces it blocks and how covered bees remain visible |

Backyard, greenhouse, irrigation works and rooftop gardens are proposed settings.
Their order, final names and allocation across the campaign are not settled.
The user subsequently proposed more industrial and urban levels for later in
the campaign, including buttons, fans and pipes, and a possible story about bees
recovering their honey from a factory. Preserve this as later campaign direction;
the honey-recovery story and exact mechanics remain proposals. See the
[campaign expansion notes](CAMPAIGN_PLAN.md#later-industrial-and-urban-levels).
Ordinary ground decoration does not block flight; every collision needs a
visible object that plausibly reaches the bees' flight space.

## Next implementation sequence

1. Establish a small pixel-art tile/sprite palette and matching game UI, including
   the title/menu and embedded/fullscreen frame. Choose logical sprite resolution
   and scaling after checking desktop and touch readability.
2. Redesign one complete playable level with an understandable hazard, a dance,
   airflow, a clear flower destination and a route for the last helper.
3. Build and reopen that level through the matching workshop. Verify drag/drop,
   direction handles, undo and keyboard/tap alternatives in the same slice.
4. Review the complete experience with the user before expanding the redesign
   across the campaign or adding more community features.

Acceptance requires a coherent game appearance, a route the player can explain,
clear hazard warnings, easy direction setting, readable embedded/fullscreen
layouts, and a usable build/test/reopen loop. No AAA-quality claim is implied.

## Rules and compatibility

The current prototype still has lethal water and legacy rules versions 1–5.
Changing the art alone must not silently change those saved levels or replays.
Introduce an explicit rules/schema revision for changed hazard behavior, with
an intentional migration/re-authoring path and new recorded solutions. Decide
new obstacle parameters through the slice before exposing them in the builder
or enabling them for verified publication. Preserve population accounting,
deterministic previews/replays and existing authorization boundaries.

Use the [live development workflow](DEVELOPMENT.md) for iteration. Keep previous
verification history, and distinguish it from evidence for the redesigned game.
