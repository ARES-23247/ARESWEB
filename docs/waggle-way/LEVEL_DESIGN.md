# Waggle Way redesigned level specification

Updated 2026-09-08. The [current campaign](CURRENT_CAMPAIGN.md) is the source of
truth for the implemented 30-level batch. All built-in levels now use version 8;
there is no parallel perch campaign. The industrial/honey proposals below remain
future scope where they differ from that catalogue. Human difficulty acceptance
is still open.

## Campaign structure

The current thirty levels follow the chapter breakdown in CURRENT_CAMPAIGN.md.
Their intended difficulty, changed routes, exact solution placements and bounded
failure evidence are recorded in LEVEL_QUALITY_AUDIT.md. The table below is the
earlier environment proposal, not the implemented chapter ordering. Honey
recovery and active pipe transport remain future scope; lift is now implemented.

| Chapter | Levels | Environment and learning goal |
| --- | --- | --- |
| Garden beginnings | 01–06 | Learn limited free-grid dancers, relative turns, helper rescue, airflow and safe obstacle bounce; ordinary water is flyable |
| Glasshouse routes | 07–12 | Read sprinkler warnings, shelter, valves and linked openings |
| Rooftop crossings | 13–18 | Navigate urban partitions, vents and narrow routes; optionally teach the explicit lift-dancer mechanic after its prototype is accepted |
| Irrigation works | 19–24 | Coordinate pipe outlets, linked machinery, shutters and waiting groups |
| Honey recovery | 25–30 | Enter the factory, recover honey and guide every helper and carrier out |

## Later large maps and scrolling camera

User direction recorded 2026-09-07: eventually include larger levels that extend
beyond the screen, especially on mobile. Schedule this after the first complete
slice, alongside later environment development; it is not implemented by this
planning update. Keep early teaching levels compact. Selected urban, irrigation
and factory puzzles can span connected areas with meaningful routing decisions,
rather than empty travel added to increase their size.

Treat world size separately from viewport size. On phones, maintain a readable
tile/sprite scale and allow camera panning/scrolling instead of always fitting
the whole world into the screen. The map remains a top-down flight plane;
vertical scrolling does not introduce altitude or platforming physics. The
separate proposed lift dance changes flight clearance, never camera direction.

Proposed camera controls to validate:

- Pan on empty ground or through an explicit pan tool; piece dragging and
  direction handles retain their own gestures. A camera gesture must not place,
  move or rotate an object accidentally. Keep keyboard panning and tap controls.
- Offer zoom with a readable default, a full-map overview and quick recentering
  on the hive, destination or selected helper. Decide overview/minimap treatment
  through mobile playtesting rather than adding a permanent oversized panel.
- Keep the compact HUD and run controls stationary while the board moves.
  Limit scroll capture to the game surface so normal website scrolling remains
  available outside the embedded window. Fullscreen uses the same world/camera.
- Keep offscreen simulation deterministic. Give useful offscreen activity/loss
  cues and an explicit way to find stranded helpers; avoid surprise forced
  camera jumps while a player is placing a tool.
- Share coordinate conversion and camera behavior between game and workshop.
  Preserve the editor viewport through test/return; camera movement alone does
  not modify the authored level or its replay evidence.

Acceptance: on a representative phone, traverse a map larger than the viewport,
place/turn a tool after panning and zooming, find an offscreen helper, complete
the route and round-trip the same level through the builder. Test keyboard,
touch cancellation, embedded/fullscreen bounds, and performance. Use current
schema/resource caps first; larger display areas do not automatically authorize
raising world/entity limits without profiling and validation review.

## Proposed level briefs to author

These are original fictional game designs. Each row still needs a builder-authored
layout, inventory, rescue target, instructions, recorded solution and playtest.
Titles are working names and do not replace existing level IDs or saved progress.

| # | Working title | Main decision / teaching goal |
| --- | --- | --- |
| 01 | First Waggle | Place one limited-supply dancer on a valid cell without a perch, set its heading and rescue the final helper. |
| 02 | Water Below | Use a left/right 90-degree dance to turn relative to approach heading; fly safely over an ordinary pond. |
| 03 | Turn It Around | Use a reverse dancer once on entry, then let the bee leave the field without spinning; explain the dancer's own release heading. |
| 04 | A Helpful Breeze | Observe how one fan changes a bee's dance-guided route. |
| 05 | Bounce Back | Use a clearly marked safe solid to redirect bees; predict its response and distinguish it from a hazard. |
| 06 | Garden Departure | Choose between two understandable routes using a small tool supply. |
| 07 | Watch the Spray | Cross one sprinkler field during its clearly signaled safe interval. |
| 08 | Under Cover | Compare waiting for a spray gap with using a covered passage. |
| 09 | Turn the Valve | Operate a bee-accessible control and follow its visible connection to a spray outlet. |
| 10 | Open the Shutter | Hold an opening for the swarm, then provide a safe exit for the operator. |
| 11 | Gather, Then Go | Hold a group at a rally point and release it through a timed opening. |
| 12 | Glasshouse Exit | Combine one protected route and one linked control without introducing another mechanic. |
| 13 | Rooftop Garden | Route between flower beds around tall ventilation housings; the roof edge is an explicit map boundary. |
| 14 | Crosswind Corner | Use or counter a clearly bounded exhaust stream near a narrow opening. |
| 15 | Mind the Intake | Recognize a pulling vent and redirect the swarm before it reaches the unsafe opening. |
| 16 | Service Passage | Choose a sheltered route through partitions instead of crossing an exposed wind field. |
| 17 | Through the Duct | Follow a visible duct entry/path/exit with predictable transit; test whether this adds value beyond an open corridor. |
| 18 | City in Bloom | Combine familiar city obstacles and rescue the final helper at a rooftop flower destination. |
| 19 | Follow the Pipe | Trace a valve's connection to its outlet; distinguish active plumbing from decorative pipes. |
| 20 | Waterwall | Stop or time passage through a visible curtain of spray. |
| 21 | Change the Flow | Switch between clearly shown outlet states to open the route needed next. |
| 22 | Holding Pattern | Stage a swarm safely while a shutter and spray cycle create a crossing interval. |
| 23 | The Last Operator | Plan the escape of the bee operating the final machine control. |
| 24 | Works Passage | Combine controls, shelter and airflow in a compact route that prepares for the factory. |
| 25 | Factory Entrance | Apply familiar controls to enter the factory; introduce the honey-recovery premise through a short scene. |
| 26 | Precious Cargo | Collect a small honey pickup and deliver it to safety; distinguish touching it from completing delivery. |
| 27 | Loading Route | Guide honey carriers around a cleaning spray using familiar shelter and timing. |
| 28 | Open the Way Home | Use linked controls to create an escape route, then release their operators. |
| 29 | One More Jar | Choose an optional honey detour while preserving a straightforward rescue route. |
| 30 | Bring Our Honey Home | Complete three readable stages: open the route, recover honey, escort carriers and remaining helpers to the safe exit. |

## First playable slice

Local iteration, 2026-09-07: five practice gardens, now on version 7, exist in
`packages/waggle-way/src/content/redesign.ts` using shared builder commands and
export validation. They are a review slice, not a replacement for the 30-level
campaign. The in-game practice selector keeps every lesson available.

| Practice garden | Current teaching route |
| --- | --- |
| First Waggle | One pointing dancer turns the hive above safe water; release the last helper north. |
| Two Little Turns | A pond prevents the single-left-dancer shortcut below the flowers. Use a left dancer to turn north on dry ground and a right dancer to send bees east. Release the lower helper before the upper one; both follow their last guided bee. |
| Turn It Around | A reverse dancer ahead of an outward-facing hive returns the bees toward home; the helper releases west. |
| Bounce Back | A partition first reverses the swarm; a right dancer behind the hive catches the return path and turns it north. |
| Watch the Spray | A fixed fan blows along the route; a supplied cover shelters a timed spray crossing above ordinary water, and a dancer turns bees toward home. |

All five have recorded-command all-bees solutions and exact replay checks.
After the user's single-guide shortcut report, the revised second garden was
checked with each single dancer at every valid setup cell; none meets the rescue
target. This is evidence for that specific placement space, not an optimality
proof for every possible sequence of actions. Water restricts guide placement
while remaining safe for flight. Version-7 relative helpers need no manual heading.
Human teaching/readability acceptance is pending; these brief layouts and their
IDs do not establish completion of the proposed campaign briefs below or above.

Start with level 01's small, readable board: one hive, one flower destination,
one available dancer use, open placement cells, a visibly tall partition and an
obvious helper exit. No preplaced perch is required. Establish the
full pixel-art game window, compact controls and workshop using that layout.
Then test a variant with one fan and one clearly warned spray crossing to settle
the revised rules. Do not add an intake, pipe network or honey objective merely
to demonstrate every planned feature in the first level.

The player should discover turning through an on-board handle, see the effect
before releasing the hive, and understand that the dancer is still a bee to
rescue. Keep the board's initial state readable without a persistent side menu.
Review the complete slice before treating any chapter layout as final.

Use separate short slice variants to teach relative 90-degree and reverse
dances plus bounce behavior. Display the dancer supply before placement and
explain whether uses replenish on release. Include approaches from different
headings, a bee remaining inside a field, overlapping fields and a helper's
release route. Never turn the bee again every tick simply because it remains
inside a relative dance. These variants test rules before wider campaign authoring.

## Later lift-dancer teaching candidate

After the slice review, prototype one safe crossing over a clearly marked
normal-flight barrier, with one lift allowance and a visible clear landing.
Contrast it with nearby flyable ground scenery and a tall obstacle that still
blocks lifted bees. Follow the [lift rules](GAME_DESIGN.md#lift-dancer-rules);
do not introduce lift, a new vent type and a timed spray in the same lesson.

If retained, revise an existing rooftop brief (for example level 16, Service
Passage) to compare a lift crossing with a longer open route. Teach it before
combining it with factory controls. Keep the campaign target at 30 levels.
Record clearance, lift duration/range, landing behavior and the final helper's
escape in the authored solution; verify the same route after save/load and replay.

## Obstacle and camera rules

- Maintain a strict top-down plane. Screen-up is north, not upward flight.
  Roofs and ducts do not introduce jumping, gravity or platforming by implication.
- Ordinary ponds and ground-level pipes are flyable scenery under the new rules.
  Solid barriers must visibly extend into flight space; show their actual footprint.
- Sprays have visible sources, affected areas, warnings and inactive states.
  Pause freezes their simulation clock; preview and replay use the same timing.
- Differentiate intake and exhaust through shapes and arrows, not color alone.
  Their influence areas must match the engine's actual bounded force model.
- Give safe bounce surfaces a consistent visual cue. Settle turnaround versus
  angled reflection explicitly; teach the chosen response before using it in
  a narrow corridor. Avoid corner jitter and immediate repeated collisions.
- Show button/valve connections and held/toggled state. Use bee-accessible
  actuators and explain whether an operator must remain assigned.
- Separate the visual language for water pipes, air ducts and bee passages.
  No unexplained teleportation between indistinguishable pipe endpoints.
- Covers must state whether they block spray, airflow or both, while keeping
  bees underneath readable. Do not infer protection from decoration alone.
- No irreversible trap for a required helper in a advertised all-bees solution.
  Provide fair retry and pause rather than requiring rapid control sequences.

## Honey-recovery objective

Use the factory premise as playful fiction. Honey is transported by bees to an
explicit safe destination; collection, carrying and delivery must be distinct.
Use existing pollen delivery as a reference, not as proof honey rules are done.
Decide pickup capacity, lost-carrier recovery and required versus optional totals
through prototype play. Display honey and bee-rescue counts separately.
Keep ordinary progression forgiving; optional extra honey must not silently
become a requirement. Preserve the route and accounting for the last helper.

## Authoring and acceptance checklist

For each selected brief, record:

- Chapter, title, one primary teaching goal and previously taught prerequisites.
- Versioned builder file, grid dimensions, objects, inventories and objectives.
- Per-dance allowances, shared helper cap and the intended placement choices.
  Teach each new dance in isolation before requiring combinations; do not quietly
  recreate mandatory perches by making every puzzle have only one usable cell.
  Record whether an exact placement is intentional in precision challenges.
- For relative dances, example incoming/outgoing headings and the helper's own
  escape heading. The recorded solution must respect the actual supply policy;
  it cannot rely on unlimited release-and-reassign cycles.
- For each collidable obstacle, its flight-blocking footprint and safe response
  versus hazardous effect. Record the predicted exit heading at representative
  contacts, including corners when the solution uses them; validate it in play.
- Short introduction, a cause-based hint and clearly identified safe destination.
- A complete replay solution meeting the required goal; an all-bees/helper route
  and each advertised optional objective, without claiming every route is optimal.
- Failure/retry behavior, hazard boundaries and at least one meaningful player
  choice; avoid padding the campaign with recolored copies of the same puzzle.
- Desktop/touch and keyboard observations, especially drag/turn, focus, compact
  screens and fullscreen. Record assistance needed and revise confusing layouts.
- Save/load/export/import and build/test/return compatibility using the same
  objects and rules as campaign play. No campaign-only machinery shortcuts.

Keep old levels and replays on their exact rules versions. Re-author and migrate
deliberately; do not overwrite old IDs/content and call old solution evidence
validation of the redesigned campaign. Future publication requires matching
server rules verification before accepting these new mechanics.


## Conversion batch and challenge criteria — 2026-09-07

The user authorized further conversion after reviewing the improved slice, then
requested harder puzzles and larger boards with mobile panning. The main play
route now contains the five `pixel-*` teaching gardens followed by this first
batch. These six `route-*` IDs are new definitions, not replacements for legacy
IDs. The thirty-level chapter table above remains a future campaign brief; it
must not be presented as thirty converted levels.

| ID | Garden | Board | Required decision |
| --- | --- | --- | --- |
| route-06 | Open Sesame | 24 × 16 | Combine a switch operator with a freely placed left dancer; rescue both |
| route-07 | After You | 24 × 16 | Give the operator a separate safe exit above a partition |
| route-08 | Two Doors | 32 × 16 | Rescue upstream operators while downstream shutters remain open |
| route-09 | Change of Shift | 28 × 16 | Gather the group and release the operator before recruiting a dancer under a one-job cap |
| route-10 | Two Wet Crossings | 28 × 16 | Protect two staggered spray lanes with two covers and a limited dancer |
| route-11 | Glasshouse Escape | 32 × 20 | Combine rally departure, two operators, spray protection, and final helper rescue |

Each challenge requires all eight bees. No-input attempts fail. The test suite
checks complete builder round trips and deterministic all-bees replays, omitted
setup actions, and the wrong operator release order. These are bounded bypass
checks, not exhaustive searches over all possible commands. In particular, a
failed static route with one omitted cover does not prove that a player cannot
reuse a movable cover with clever timing. Alternative clever
solutions are welcome; reject accidental shortcuts that remove a level's main
lesson, not every solution different from the author's.

Increase difficulty through route tradeoffs, constrained simultaneous helper
jobs, limited dance uses, operator escape routes, and combinations of already
introduced mechanics. Reserve tight timing for optional mastery goals; pause and
precise placement remain available. Reusing a *helper job* does not refund a
spent dance use. New switch/fan tradeoffs, duct transport, honey carrying and lift
dances require shared engine/workshop rules before campaign use.

Use compact boards for teaching. Larger boards should contain several meaningful
areas and intermediate decisions rather than empty travel time. Start this
batch at 24–32 columns and 16–20 rows; the schema's 128 × 72 limit is a technical
ceiling, not a target. The play camera keeps tools and counters stationary,
separates panning from placement, offers zoom/fit and hive/flowers/helper
recentering, and keeps camera state out of replay physics. Workshop currently
retains its existing zoom/scroll controls; matching direct pan controls and a
minimap/offscreen indicators remain follow-up work.
