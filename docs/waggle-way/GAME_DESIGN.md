# Waggle Way game design

Status: revised 2026-09-07. The [pixel-art redesign](PIXEL_ART_PIVOT.md) owns the
new hazard direction and next playable slice. Existing versions 1–5 retain
legacy behavior until an explicit rules upgrade; entries marked legacy below
describe that prototype, not the new target.

See [redesigned level specification](LEVEL_DESIGN.md) for the new campaign's
teaching progression, obstacle presentation rules and honey-recovery objectives.

## World and run

Use a top-down garden with a visible boundary. Bees emerge gradually from a
hive and seek a flower destination. Initial levels use one of each. Garden art
is decorative unless an object is explicitly marked as interactive.

Before opening the hive, players place a limited supply of tools and assign
guides. During a run, they can pause and adjust only objects marked adjustable
by that level. Terrain and hazards cannot be edited during a puzzle attempt.
Commands are recorded at the current tick, update setup state immediately, and
affect the next flight step. Paused commands consume the same resources as
commands made while running. Fast-forward changes tick throughput, not rules.

## Proposed bee behavior

Bees maintain a desired flight heading. A dance changes that heading; it does
not teleport a bee or calculate an obstacle-avoiding route. Without a new signal,
the bee keeps its last heading. No hidden pathfinding rescues a bad route.

1. A bee entering a guide's influence follows the guide's dance type: a fixed
   compass heading, left 90 degrees, right 90 degrees or reverse 180 degrees.
   Relative turns apply to the bee's incoming desired heading, not screen/camera
   orientation or a wind-distorted velocity. These are new-rule design targets.
2. In overlapping signals, use the closest guide, then stable object ID as a
   tie-breaker. Add a small, documented switching margin to prevent oscillation.
3. Desired flight velocity combines with bounded local airflow. Visible airflow
   arrows represent the actual force model. Bee-to-bee collisions are disabled
   initially to avoid unpredictable swarm pileups.
4. Clearly marked solid obstacles bounce bees without losing them. The current
   prototype reverses their heading on solid contact; choose and teach the new
   obstacle response explicitly, distinguishing a turnaround from an angled
   reflection. Hazards still have their own visible consequences. Resolve
   corners and simultaneous contacts deterministically, without wall jitter.
5. In the new rules, bees fly over ordinary water. Active spray/water curtains
   provide visible hazards; tune their exposure consequences in the new slice.
   Legacy versions lose bees on water contact. The visible world boundary remains
   a loss condition; destination contact rescues each bee exactly once.
6. Choose and test a fixed contact priority for simultaneous hazard/destination
   contact. The initial conservative rule is hazard before destination; disallow
   overlapping hazard and destination placements in valid levels.

These are candidate rules, not claims about real bee navigation. Record changes
before building campaign levels that depend on them.

## Temporary guides

Latest user feedback, 2026-09-07: guides must not be placed on water, and the
second practice garden should require both supplied dance types. The user also
questioned the separate helper heading. Version 7 prototypes automatic departure
for left/right/reverse dancers; this simplification still needs user review.

Version 7 requires dancers and legacy-style guide perches to occupy dry ground.
Ordinary water remains safe for flying bees. Reject overlapping water during
authoring, import, runtime placement and movement without spending stock or bees.
Versions 1–6 retain their exact placement and release semantics.

For a relative dancer in version 7, remember the outgoing desired heading each
time it actually signals a bee. The last signaled bee in deterministic simulation
order supplies the helper's release heading. Before its first signal, apply the
dance to the helper's incoming heading at assignment (the hive heading in setup).
Release preserves this learned heading. There is no editable release arrow or
heading control for relative dancers. Pointing dancers still use their arrow to
set the signal and their own departure. This remains indirect guidance, not
automatic navigation to the flowers; a helper still needs a safe route.

Version-6 baseline: the local slice implemented the placement,
finite-use policy, four dance types and entry rearming below. Legacy rules
remain intact. Focused swept-boundary/overlap checks and five playable teaching
gardens now exist; human acceptance is still open. See
[current evidence](IMPLEMENTATION_PROGRESS.md).

Updated user direction, 2026-09-07: place dancing bees on valid grid cells,
without needing prebuilt perches. Players have a limited number of dancers and
can choose different dance behaviors. Version 6 implements this locally; the
original campaign still uses perches under its preserved legacy rules.

During setup, dragging a dancer from the supply tray onto an empty valid cell
reserves one real bee from the hive. Show valid placement, the dance symbol,
its influence and remaining supply. Version 6 permits hovering above water;
version 7 requires dry ground. Solid footprints and occupied cells also block placement; dangerous
spray areas need clear warnings and explicitly validated placement rules.
Any level-specific restriction must be shown rather than hidden in the engine.

Proposed in-run assignment retains the existing local-eligibility principle:
assign a nearby eligible flying bee to the chosen cell, showing which bee is
eligible before committing. Do not teleport a distant bee across the map.
Moving an already assigned dancer during a run needs a defined travel rule;
until one is designed, release it and assign locally instead of dragging it
through obstacles. Setup relocation may be reversible without extra cost.

| Dance type | Effect on an entering bee | On-board cue |
| --- | --- | --- |
| Point a direction | Set an authored compass heading | Straight arrow with a turn handle |
| Turn left | Rotate incoming desired heading left by 90 degrees | Left elbow arrow |
| Turn right | Rotate incoming desired heading right by 90 degrees | Right elbow arrow |
| Reverse | Rotate incoming desired heading by 180 degrees | U-turn arrow |

Relative dances trigger once per entry, not once per simulation tick. A bee
must leave that dancer's influence with a documented re-entry margin before
the dance can apply again. Resolve overlapping signals in stable order and
retain entry/trigger state in previews and replay. Test lingering, re-entry,
overlap, changed dance settings and fast swept crossings to prevent spinning.

Current version-6 timing: choose the active signal at the start of a tick, then
calculate that tick's straight flight segment. On accepted movement, detect
outside-to-inside field contacts along the segment, including tangent contact;
process contacts in travel order using the same closest-guide/ID selection and
quarter-cell switching margin. A crossing updates the next tick's heading, so
it cannot retroactively alter the path used for hazard and destination contact.
Solid-contact movement is rejected and reverses the bee before crossing signals
are processed. A bee must move more than a quarter cell beyond a field's radius
before that visit clears. Changing a pointing arrow during an existing visit
does not turn that bee again; the new arrow applies to future entries and the
helper's release. These are local prototype semantics to assess in the slice.

The level authors a bounded supply by dance type, alongside the population
and shared helper cap. Proposed default: a committed placement consumes one
use; setup undo/removal restores it, while release after launch returns the
bee to flight but does not mint another use. Confirm finite uses versus reusable
slots in slice playtesting and expose the chosen policy in the tray. No extra
nectar currency is needed. Failed placements consume neither a bee nor a use.

Guides remain members of the conserved hive population and must be rescued.
Version 6 gives relative-turn dancers an explicit release heading, separate from
their effect on passing bees; version 7 replaces that control with the automatic
departure above. A dead/released guide
must not duplicate a bee or restore a spent use unexpectedly. Teach both the
placement limit and the final helper's route before combining dance types.

## Lift dancer rules

User suggestion, 2026-09-07: a bee signals other bees to fly/hop over obstacles.
Accepted and implemented in the version-8 development batch, 2026-09-08.
The lift dancer preserves heading and grants six traveled cells of high flight.
The current campaign teaches it in Across the Pond and combines it with helper
recovery, route choices and factory barriers. Release verification remains open.

Use a short, explicit higher-flight state while retaining the top-down grid.
Ordinary water and low ground scenery remain flyable without this ability.
Distinguish three readable clearance classes: ground scenery, barriers that
block normal flight but allow a lift crossing, and tall/covered obstacles that
block both flight states. A lift is not permission to bypass every hazard.

Like other dancers, this helper occupies a valid cell, uses a finite authored
allowance and remains part of the hive. Signal once per entry; show the affected
route, clearance and intended safe return to normal flight before launch. Use
an elevated sprite/shadow relationship plus a symbol/text indicator, retaining
readability with reduced motion. Screen-up remains north, not ascent.

Implemented rules and verification boundaries:

- Distance is consumed by movement, including wind displacement. Tall barriers
  and closed gates bounce bees at either height. Low barriers allow high flight;
  descending inside one causes a landing loss. A different lift signal can
  renew the allowance; one continuous visit does not renew it every tick.
- Flowers, pollen and rally points require normal flight. Ordinary water stays
  safe at either height but cannot host a dancer. Spray remains dangerous at
  either height; low obstacles do not act as roofs over a spray lane.
- A released lift helper receives its own six-cell allowance. It may still
  need another lift farther along the route, so downstream helpers must remain
  until upstream bees can escape. Finite dance supplies and population remain
  conserved; releasing a helper does not refund a used dance.
- The sprite's offset shadow, height symbol and remaining-distance bar expose
  the state. Inspection reports remaining distance and landing losses. These
  cues support playtesting; they are not a claim that a route preview proves safety.

Version 8 stores explicit lift state and low/tall obstacle clearance. The builder
authors both, and replay/serialization tests cover them. All built-in maps and
new workshop gardens use this ruleset. Older internal fixtures are not a second
playable campaign. Community publication still waits for matching server support.

## Initial object palette

| Object | Rule | Feedback |
| --- | --- | --- |
| Hive | Finite population, release direction, fixed release cadence | Remaining bee count and exit arrow |
| Flower field | Safe arrival region; collects each bee once | Rescue count and flowers opening |
| Solid terrain / bounce obstacle | Blocks penetration; explicitly defined safe bounce, with airflow occlusion where applicable | Visible footprint and recognizable bounce surface |
| Ordinary water | Flyable ground feature in new rules; version-7 guides cannot stand on it; legacy contact hazard only | Decorative surface clearly distinct from active spray; invalid guide placement cue |
| Sprinkler / water curtain | New hazard direction; warning, timing and exposure rules to prototype | Visible nozzle/source, field and active/inactive cue |
| Dancing bee (new rules) | Place on a valid dry grid cell in version 7 using limited dance supply and a real hive member | Dance-type icon, influence and remaining uses; pointing arrow or automatic relative-helper departure |
| Guide perch (legacy) | Hosts one fixed-heading guide under existing versions | Preserved for old levels/replays; not a prerequisite for new dancer placement |
| Fan | Directional, bounded stream; solids block it | Stream extent and strength indicators |
| Shelter leaf (version 2) | Blocks wind through its rectangle; bees can fly through it | Leaf shape, explicit inspection text, and matching wind shadow |

Legacy player-placeable tools use authored supplies of perches, fans, and leaves.
Placement consumes one supplied tool. Returning an unoccupied supplied tool
restores that supply; it never creates a bee or refunds a guide job while its bee
is still assigned. There is no nectar currency. Width/height determine leaf
coverage. The builder rotates rectangular shapes by swapping dimensions; arrows
for the hive, fans, and perches rotate in 45-degree steps.

Start with a small discrete set of fan strengths and eight direction choices.
Whether both need simplifying is an M0 decision. Sum overlapping fan effects
with a speed cap; block a fan's effect where a solid intersects its line to the
bee. Preview and simulation must use the same airflow function.

## Completion and feedback

Let total population equal bees in the hive plus flying, assigned, trapped
(when introduced), rescued, and lost bees. No action creates or duplicates bees.

When the rescue target is reached, announce success and let the player either
finish or continue rescuing the rest. If all bees are resolved, finish
automatically. If rescued plus all potentially recoverable bees falls below the
target, explain that the target is unreachable and offer restart. Do not claim
to detect every possible stalemate; trapped loops can require a player restart.

Offer optional achievements for all bees rescued, pollen collected, and fewer
tools. Ordinary completion has no time pressure. Do not penalize pause, slower
play, reduced motion, or accessibility controls.

## Initial playtest sketches

These are original proposed puzzles, not existing levels or team artifacts.
They form the five-level M4 playtest slice. The full release targets 30 levels
across five gardens; see the [campaign plan](CAMPAIGN_PLAN.md). Refine and reuse
these sketches in that campaign rather than counting playtest copies as extras.

| Level | Teaching goal | Proposed setup |
| --- | --- | --- |
| First Waggle | A dance changes heading | Safe ground, one turn, one guide with a clear release route |
| Across the Pond (legacy brief) | Airflow adds to intended movement | Re-author around spray/airflow; ordinary pond crossing must be safe and destinations are on the same top-down plane |
| Mind the Branch (legacy brief) | More wind is not always better | Re-author with a clearly flight-blocking partition or obstacle |
| Bring Everyone | Helpers also need rescue | Two guidance points with an explicit final-guide route |
| Garden Route | Combine and refine | Two viable routes and a fewer-tools optional challenge |

Use builder-exported levels for every campaign puzzle. Keep instructions short
and introduce one concept before combining it with prior concepts.

## Preserved expansion backlog

### Implemented Glasshouse rules (13–18)

The following rules now exist in schema/rules version 3, the shared engine,
builder, replay and semantic inspector. Six recorded solutions pass; player
validation and broader acceptance remain open.

- Introduce schema/rules version 3 while retaining exact version-1 and version-2
  import/export and replay behavior. Upgrading is explicit and undoable.
- A switch flower holds one helper using the same assignment eligibility and
  shared helper-job limit as a dance perch. It emits no dance signal. Releasing
  its helper uses the authored direction, and that bee still needs rescuing.
- Each gate links to one switch by stable object ID; one switch may operate
  several gates. A closed gate blocks flight and airflow, an open gate blocks
  neither. If a helper leaves while a bee is inside the gate, closure waits for
  the gate rectangle to clear. Show the pending-close state explicitly; never
  crush or teleport a bee on closure. Derive this state deterministically.
- A rally flower holds arriving bees without reserving a helper. Its bounded
  capacity is the level population. Hold/release controls work while paused.
  Release drains bees in stable-ID order at the level release interval and
  remains open to incoming bees until the player chooses Hold again. Released
  bees follow its authored direction. Waiting bees remain alive and count
  separately from assigned helpers and rescues.
- The builder exposes switch/gate links and rally direction with labeled
  controls. Deleting a referenced switch must identify its connected gates and
  preserve a recoverable edit; undo restores the complete relationship. Invalid
  or dangling links must not enter runnable/exported content.
- Route previews use these same rules and show current switch/rally state.
  Later player commands can change the route; no prediction may imply otherwise.

Acceptance must cover operator release, pending gate closure, multiple linked
gates, rally admission/release/re-hold, population conservation, legacy versions,
invalid links, edit undo, keyboard controls and replay equality. Each of levels
13–18 needs its own authored layout and all-bees solution, including the last
operator. No campaign-only triggers may substitute for these shared mechanics.

### Implemented Rainy Garden rules (19–24)

Schema/rules version 4 adds predictable downward rain. A cycle has dry, warning
and rain phases; dry and warning are safe. The offset selects the starting point.
The UI forecasts the next simulation step, including its phase and ticks until
the next transition. Pausing stops the clock; step, fast-forward, preview and
replay all use the same tick sequence. There is no wall-clock hazard behavior.

The nozzle's width defines the rain columns; rain begins at its bottom and ends
at its bounded range. In each vertical band, the first shelter leaf, branch or
closed gate stops the rain. Open gates let rain through. The scene shows the same
exposed rectangles used by collision checks: dashed outlines for dry/warning and
visible rain strokes during rain, even with optional wind overlays disabled.

Exposed flying, waiting and assigned bees are lost. The hive protects unreleased
bees, and rescued bees stay rescued. Swept flight segments are checked so fast
movement cannot skip a thin exposed corner. A newly lost operator stops holding
its gate for the next tick. Individual inspection identifies rain losses. Rain
does not consume or damage a leaf. Helpers still need their own safe exit.

Levels 19–24 teach timing, supplied shelter, sheltered gathering, a second helper
crossing, a choice of timed or sheltered routes, and a combined gate/rally/rain
sequence. Seven recorded solutions include both advertised routes through A Dry
Detour. Automated feasibility does not establish human difficulty acceptance.

### Wildflower Valley (25–30), implemented rules version 5

Optional pollen goals use the shared schema, builder, engine and progress
pipeline. A pollen token is a fixed collectible with a stable ID. A flying bee
carries it after contact; delivery counts only when that bee reaches the flower
field. A lost carrier returns the token to its authored location, allowing another
bee to collect it. Each token can be delivered once per attempt. Waiting and
assigned bees retain carried pollen when their role changes. Show available,
carried and delivered counts in text as well as on the scene.

Pollen never gates the base rescue target, next-level unlock, or an explicit skip.
Save a pollen achievement only from a successful attempt against the exact level
content. Advertise a pollen goal only when a recorded solution achieves it and
rescues every helper. Existing best-rescue and all-bees records stay separate.
Where an authored supply choice supports it, an optional fewer-tools goal uses
peak concurrent supplied tools, not total placement clicks or helper jobs.

These fields use explicit schema/rules version 5. Preserve exact
versions 1–4 without silently upgrading imports or rewriting progress. Validate
targets against available tokens and supplies; no arbitrary scripts or URLs enter
the format. The builder exposes the five built-in garden themes;
theme selection changes presentation, while placed objects define mechanics.

Levels 25–30 must each add a distinct decision: a pollen detour, alternative tool
routes, sheltered staging before a gate, the last dancer's escape, full-hive
coordination, and a multi-stage finale. Ten recorded routes cover these choices
and every advertised optional goal. Player difficulty acceptance remains open.

### Ghost review, implemented M7 behavior

Restart retains the previous started attempt for this garden visit. Optional G
outlines follow the current clock; pause to scrub a separate previous-attempt
timeline. Ghosts never change the live hive or its achievements. An endpoint
message distinguishes a recording ending from an assumed future result. See
[replay and recovery](REPLAY_AND_RECOVERY.md) for bounds, supported versions and
the assessment deferring live checkpoints/rewind.

### Further ideas

Later industrial/urban direction was proposed by the user on 2026-09-07,
including a possible honey-recovery factory story. See the
[campaign notes](CAMPAIGN_PLAN.md#later-industrial-and-urban-levels). Candidates
below are design exploration, not current engine or builder capabilities:

| Candidate | Distinct interaction | Rules to settle before implementation |
| --- | --- | --- |
| Bee-operated button / lever | A helper opens a shutter or changes a connected fan/valve | Held versus toggled state, clear connection, safe operator release |
| Pipe and valve network | Routes water or air to visible outlets | Show the active path; choose one purpose per pipe type; decorative pipes do not block flight |
| Open ventilation duct | Routes bees between readable entry and exit points | Visible route, travel timing and occupancy; avoid unexplained teleportation |
| Industrial intake / exhaust | Pulls or pushes a swarm through a constrained route | Clear distinction from helpful fans, warning and bounded influence |
| Factory honey pickup | Carry recovered honey to the safe exit | Delivery accounting, lost-carrier recovery and optional versus required objective |

Introduce these one at a time before combinations. Machine cycles remain
deterministic and pause-friendly. Convey state through shapes/arrows/text as
well as color, and support the same objects in the player builder.

| Idea | Intended decision or interaction | Dependency / concern |
| --- | --- | --- |
| Resting flowers / rally points | Hold a group and release it through a timed opening | Define capacity and release ordering |
| Switch flowers and gates | A helper operates a route for others | Clear wiring and state; release the operator |
| Movable barriers / shelter leaves | Redirect or block wind; shelter from rain | Visible airflow occlusion |
| Optional pollen | Choose a riskier route for an extra objective | Avoid confusion with rescue completion |
| Bud flowers | Pollen delivery opens a perch or passage | Deterministic activation and visible threshold |
| Nectar budget | Trade limited tool use against route complexity | Avoid redundant currencies; prototype separately |
| Scent trails | Sketch temporary guidance that wind can disperse | Distinguish from dances; bound trail complexity |
| Webs and rescuers | Recover temporarily trapped bees | Define rescue range, capacity, and any timer |
| Sprinklers / rain / gusts | Coordinate with predictable hazard cycles | Preview phase and remain pause-friendly |
| Moving flowers and platforms | Time arrivals at changing targets | Clear collision and timing rules |
| Hollow stems / one-way passages | Create directional routing | Clear entrances, exits, and occupancy |
| Multiple hives and destinations | Coordinate intersecting groups | Explicit population and destination rules |
| Ladybugs | Operate switches on predictable patrols | Teach without adding hidden randomness |
| Caterpillars | Temporarily block a passage | Visible patrol and safe contact rules |
| Other pollinators | Show a route or create an optional rescue | Explain whether helpful or interactive |
| Builder bee job | Alter a limited part of the route | Define a specific action before committing |
| Checkpoints / rewind | Recover without replaying the entire level | Full state and action-history restoration |

Garden progression can move from sheltered garden to windy meadow, greenhouse
vents, and rainy garden. Each theme must introduce a mechanical difference.
Visual extras include distinct dances, readable reactions, optional sound cues,
and destination blooms; none may be the sole carrier of essential information.
