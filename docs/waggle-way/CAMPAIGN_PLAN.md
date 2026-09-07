# Waggle Way campaign plan

Status: implementation active, 2026-09-05. Levels 01–30 are locally playable.
Human campaign acceptance remains open; nothing has been deployed.

## Redesign priority — 2026-09-07

New dancer/bounce direction: early redesigned levels teach free valid-grid
placement from limited supplies, fixed-heading and relative 90/180-degree
dances, helper release and visibly safe obstacle bounce. No required perch
positions in the new designs. Update inventories and recorded solutions for the
new rules; historical perch-based briefs below describe the legacy prototype.

The [redesigned level specification](LEVEL_DESIGN.md) now records the proposed
30-level replacement progression and per-level teaching briefs, including urban
obstacles, industrial controls and the honey-recovery finale. It owns the new
content design; implementation evidence below remains scoped to legacy puzzles.

The [pixel-art pivot](PIXEL_ART_PIVOT.md) requires a complete redesigned level
and workshop review before expanding the new treatment across this campaign.
Keep the 30-level target. The five existing gardens and briefs below describe
the legacy prototype; names, grouping and puzzle layouts may change. Backyard,
greenhouse, irrigation works and rooftop settings are proposals, not a finalized
replacement world list. Re-author lethal-pond puzzles around understandable
spray or industrial obstacles: ordinary water is flyable in the new rules.
Preserve old level/replay versions and record new solutions for changed puzzles.

## Later industrial and urban levels

Later chapters may include maps larger than the screen, as requested on
2026-09-07. Prioritize readable mobile sprites with camera scrolling over fitting
every level into one tiny board. See [large-map design](LEVEL_DESIGN.md#later-large-maps-and-scrolling-camera).
This is later scope after the initial slice and camera validation, not a reason
to enlarge every puzzle or raise existing resource caps now.

Subsequent decision, 2026-09-07: the user endorsed this direction and requested
its implementation as a new goal. The [redesign series](REDESIGN_GOALS.md) now
includes the industrial/urban progression and honey-recovery factory arc. Exact
chapter allocation and objective behavior remain to be designed and tested.
The original proposal notes below preserve the reasoning behind that scope.

User proposal recorded 2026-09-07: later environments could include buttons,
fans, pipes and more urban obstacles. A possible narrative is the bees reclaiming
their honey from a factory. This is a proposed story arc, not a locked objective
system or implemented chapter. Keep the first pixel-art slice as the next task.

One possible progression is garden/greenhouse learning, city rooftop challenges,
then a honey-factory finale. Final chapter names, order and level allocations
remain open within the existing 30-level target; this does not add another
mandatory campaign on top of those levels.

| Setting candidate | Puzzle opportunities | Teaching focus |
| --- | --- | --- |
| Rooftop gardens | Ventilation units, rooftop partitions, irrigation sprays and sheltered flower beds | Read wind and find safe routes through dense spaces |
| Urban service passages | Narrow openings, fan exhausts, shutters and visible pipe outlets | Coordinate signals and timed passages |
| Honey factory | Buttons linked to valves/shutters, ventilation ducts and timed cleaning sprays | Coordinate helpers, recover honey and bring the whole hive out |

Prototype a factory finale as three readable stages: open an entry route,
collect honey, then guide carriers and every helper to a safe flower/hive exit.
Decide whether honey recovery is optional or required only after testing it;
show rescue and honey-delivery objectives separately. Existing optional pollen
delivery offers a starting point, but is not automatically a complete honey mode.
Keep the tone playful and convey the premise through short pixel-art scenes and
environment details rather than lengthy exposition.

Every new obstacle must affect flight for a visible reason. Ground-level pipes,
roads and puddles are scenery unless a raised structure, active outlet or other
explicit interaction explains their effect. Show linked controls and machinery
states. Required buttons must have bee-operable logic, such as a helper-operated
lever, rather than an unexplained heavy floor plate. Every operator needs an exit.
Use the shared builder and versioned rules for any mechanics selected to ship.

## Historical first-five implementation evidence

`packages/waggle-way/src/content/campaign.ts` authors five original layouts through the
same edit commands, validator, and export/import format used by the workshop.
`solutions.ts` records six all-bees solutions, including both routes in level 05.
All six reproduce identical final states through the bounded replay verifier.
Each meets the base target and rescues its helpers. Level 05 currently limits
simultaneous guide jobs; player-placeable supplies are introduced in level 06.

The browser suite exercises the player workshop's import/export/test round-trip
for every included campaign level. This demonstrates compatibility with the
player editor; it is not evidence of an external human authoring playtest.
Instructions and expandable hints introduce each puzzle's decision. Results,
all-bees completion, and explicit skips persist locally against exact level content.

External difficulty/readability playtests and the remaining accessibility review
are still required before calling the slice accepted. See
[implementation progress](IMPLEMENTATION_PROGRESS.md) for current evidence.

## Sunny Garden and Breezy Meadow expansion

`packages/waggle-way/src/content/meadow.ts` adds levels 06–12 through the same authoring
helpers as the first five. This expansion completed the first two gardens of six
unique puzzles. Seven new recorded solutions rescue every bee and replay identically;
unassisted straight flight fails all seven, so their tools/hazards are consequential.

Level 06 introduces supplied tool placement as the final Sunny Garden exercise.
Levels 07–12 teach a still-air pocket, counterwind balance, ending a lift at the
right height, a calm detour around headwind, overlapping lift streams, and a
combined crossing with horizontal/vertical shelters and two helpers. The Long
Way Round uses an exposed straight route versus a longer calm route; it does not
advertise the exposed path as independently completable.

Selection is grouped by garden. Cross-garden progression still depends on
completion or an explicit skip, and all-bees results remain optional. The first
five retain their original version-1 definitions; the expansion uses version 2.

## Glasshouse implementation

Levels 13–18 use version 3 and the shared builder pipeline in
`packages/waggle-way/src/content/glasshouse.ts`. Each has a distinct all-bees
solution which replays identically. Open Sesame teaches a gate helper; After You
requires a separate operator exit; Gather Round holds and releases the group;
Two Doors sequences two operators; Change of Shift reuses one job for an operator
and a dancer; Glasshouse Escape combines a rally, gate, lift and two guides.

Switches, links and rallies are available in the workshop. Referenced switches
cannot be deleted until their gates are deliberately relinked or deleted; Undo
restores each edit. Gates wait for occupying bees to clear before closing. Waiting
rally bees remain alive and release in stable-ID order at the level interval.
Automated solutions establish feasibility, not external difficulty acceptance.

## Rainy Garden implementation

Levels 19–24 use version 4 and the shared builder pipeline in
`packages/waggle-way/src/content/rainy.ts`. They cover a timed crossing, a supplied
canopy, a sheltered rally with a long release interval, a separate crossing for
the last dancers, timed versus sheltered alternate routes, and a gate/rally/rain
finale with a high operator exit. Seven recorded all-bees solutions replay exactly;
both advertised routes in A Dry Detour are verified. All six fail an unassisted
hive release. Sprinkler timing and rain-blocking shelter are available in the
player workshop. Wildflower Valley now completes the content count; full campaign
acceptance remains open.

## Wildflower Valley implementation

Levels 25–30 use schema/rules version 5 and the same editor/export pipeline in
`packages/waggle-way/src/content/wildflower.ts`. Pollen on the Side offers a detour;
High Road, Low Road trades a shelter for a movable dancer route; A Place to Wait
combines a protected gathering and an operator delivery; The Last Dancer keeps a
return guide for the carrier; All Together sequences two gates and a dry interval;
Field of Flowers gives the last helper a second crossing. Ten recorded solutions
rescue all bees, cover every advertised pollen/tool goal and replay identically.
These are six distinct levels, not ten. Player difficulty review remains open.

## Size and release scope

The user requested at least a couple dozen levels. Target **30 distinct handmade
campaign levels: five gardens with six levels each**. The earlier five-level
scope becomes the M4 playtest slice; M5 delivers the full 30-level local campaign
and builder. Community levels, tutorials embedded in puzzles, optional objectives,
and alternate solutions do not count as additional campaign levels.

Thirty gives each garden room to introduce, practice, combine, and challenge.
Avoid cosmetic copies or adding more bees as the only source of difficulty.
Rework a weak puzzle rather than counting it as finished to reach the target.

## Garden progression

| Garden | Levels | Focus | Required mechanics |
| --- | --- | --- | --- |
| Sunny Garden | 01–06 | Learn guidance and bring helpers home | Dances, fans, terrain, water |
| Breezy Meadow | 07–12 | Shape airflow and choose routes | Existing tools plus movable shelter leaves |
| Glasshouse | 13–18 | Sequence actions and cooperate | Switch flowers, gates, rally points |
| Rainy Garden | 19–24 | Gather and release at the right moment | Timed sprinklers and rain-blocking shelter leaves |
| Wildflower Valley | 25–30 | Solve larger combinations and optional detours | Pollen objectives plus previously taught tools |

Use a gentle introduction at the start of each garden, then build toward a finale.
The fifth garden combines familiar mechanics rather than adding a large new
system. Pollen is an optional collectible here; pollen-activated buds remain an
expansion. Webs, moving platforms, scent trails, nectar currency, multiple hives,
and additional insect characters are not dependencies of these 30 levels.

## Proposed level briefs

Titles and layouts are working ideas. Each brief needs an authored layout and
tested solution before it becomes a finished level.

| Level | Working title | Distinct puzzle objective |
| --- | --- | --- |
| 01 | First Waggle | Use one dance to turn toward flowers; release the guide safely. |
| 02 | Across the Pond | Combine a lift fan with a heading change over water. |
| 03 | Mind the Branch | Keep the airflow route below an overhead obstruction. |
| 04 | Bring Everyone | Release two guides in an order that preserves the last bee's route. |
| 05 | Garden Route | Choose between two routes with a limited tool supply. |
| 06 | Leaving the Nest | Combine turns, lift, and helper release without a new mechanic. |
| 07 | In the Lee | Place a shelter leaf to block an unwanted fan stream. |
| 08 | Crosswind | Balance intended heading against wind from the side. |
| 09 | Gentle Landing | Reduce exposure to lift so bees reach a low flower field. |
| 10 | The Long Way Round | Trade a short exposed route for a longer sheltered one. |
| 11 | Two Breezes | Manage overlapping fan streams without overshooting the turn. |
| 12 | Meadow Crossing | Use a small tool inventory to connect sheltered pockets. |
| 13 | Open Sesame | Assign a bee to a switch flower to hold a gate open. |
| 14 | After You | Route the gate operator home after the others pass. |
| 15 | Gather Round | Hold bees at a rally point, then release the group together. |
| 16 | Two Doors | Sequence two gates without stranding either operator. |
| 17 | Change of Shift | Release a helper while another bee maintains the needed route. |
| 18 | Glasshouse Escape | Combine rally, gates, dances, and fans in one sequence. |
| 19 | Between Showers | Cross one clearly signaled sprinkler during its safe phase. |
| 20 | Under a Leaf | Place shelter to create a safe waiting area beneath rain. |
| 21 | Wait for Everyone | Gather the swarm before a timed crossing. |
| 22 | One More Trip | Retrieve the final helper through a recurring safe interval. |
| 23 | A Dry Detour | Choose a longer sheltered path or a shorter timed route. |
| 24 | Rain Check | Coordinate a gate, rally point, and sprinkler crossing. |
| 25 | Pollen on the Side | Complete a familiar route with an optional pollen detour. |
| 26 | High Road, Low Road | Choose routes that use the same tools in different ways. |
| 27 | A Place to Wait | Use shelter and a rally point to stage a gate crossing. |
| 28 | The Last Dancer | Preserve a difficult but readable escape for the final guide. |
| 29 | All Together | Coordinate the full hive through several previously taught interactions. |
| 30 | Field of Flowers | A multi-stage finale rewards planning and gives every helper a safe finish. |

## Production batches

1. M4: author and test the first five sketches. Revise rules and onboarding using
   observed player confusion before expanding the content pipeline.
2. M5a: finish Sunny Garden and Breezy Meadow, reaching 12 unique levels.
3. M5b: implement validated switch/rally behavior and finish Glasshouse, reaching 18.
4. M5c: implement predictable sprinkler cycles and shelter behavior; finish Rainy
   Garden, reaching 24. This meets the user's minimum requested scale, but the
   planning target remains 30.
5. M5d: add optional pollen routes and finish Wildflower Valley, reaching 30.
6. Review the entire difficulty curve and rerun release validation before M5 exits.

New mechanics must work in the shared engine, schema, and builder before levels
depend on them. Do not add campaign-only scripts to achieve a proposed layout.

## Completion and replay value

Every level has a base rescue objective plus an all-bees goal. Add fewer-tools
challenges where meaningful and pollen goals after pollen is introduced. These
provide replay value without inflating the campaign count. No mandatory speed
medals; pausing and accessibility controls do not invalidate achievements.

Proposed progression: completing a level unlocks the next; optional challenges
never gate progression. A clearly labeled skip unlocks the next puzzle without
marking the skipped one completed. Preserve completed, skipped, and optional-goal
states separately so difficult puzzles do not block access to the rest of the game.

## Per-level acceptance

- Author/export through the player builder and validate through the shared schema.
- Record a reproducible base-completion solution and an all-bees solution against
  the exact level and engine version; verify each advertised optional goal.
- Include every assigned helper in the all-bees solution.
- Confirm it introduces or combines a distinct decision, with no unexplained
  dependency on a mechanic introduced later.
- Test pause/restart, readable failure feedback, keyboard control, and touch
  interaction; do not make precision clicking the intended source of difficulty.
- Record playtest assistance, retries, and observed completion time without
  fabricating a promised campaign duration.
- Recheck solutions after layout or engine changes. Local regression replays are
  campaign QA; online publication still requires the server verification in the
  builder specification.
