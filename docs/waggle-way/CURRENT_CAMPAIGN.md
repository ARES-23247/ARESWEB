# Current Waggle Way campaign

Updated 2026-09-08. This development batch replaces the two-campaign menu with
one 30-puzzle campaign. The user explicitly rejected an archive, dual rulesets,
and old-map migration work: treat Waggle Way as a fresh game.

All built-in maps use version 8. Ordinary water is safe to fly over, dancers
require dry ground, limited helpers can be placed freely on valid cells, and
solid barriers turn bees around. Sprinklers, rather than ponds, threaten bees.
Lift dancers provide six traveled cells of high flight across low obstacles.
Tall walls and shutters still block, spray remains dangerous, and landing in a
low obstacle loses the bee. High bees pass over flowers, pollen and rally points
until they descend. Released lift helpers receive their own six-cell flight.
New workshop gardens use the same rules and dancer supplies. There is no
original/archived campaign button. Old authored maps are test fixtures only;
they are not shipped as another playable campaign.

## Chapters and puzzles

| Chapter               | Levels | Puzzles                                                                                                              |
| --------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| Learn the dances      | 1–5    | First Waggle; Two Little Turns; Turn It Around; Bounce Back; Watch the Spray                                         |
| Glasshouse challenges | 6–11   | Open Sesame; After You; Two Doors; Change of Shift; Two Wet Crossings; Glasshouse Escape                             |
| City gardens          | 12–17  | Across the Pond; Mind the Branch; Bring Everyone; Garden Route; Return to Sender; Rooftop Relay                      |
| Rain gardens          | 18–23  | Shelter the Swarm; Crosswinds; Rain Check; The Long Way Home; A Place to Wait; After the Storm                       |
| Factory escape        | 24–30  | Factory Entrance; Pipework; High Road, Low Road; Pollen on the Side; The Last Dancer; All Together; Field of Flowers |

`content/adventure.ts` owns the ordered chapter catalogue. `content/campaign.ts`
exports that same catalogue for consumers. `redesign.ts`, `challenges.ts`, and
`advanced.ts` own the validated level definitions; they use the workshop's
editor/serialization path. The 19 new IDs are `adventure-12` through
`adventure-30`. The previous 11 current-rule maps keep their IDs.

Every puzzle is selectable immediately. Selecting a puzzle does not write a
completion or skip result. Actual rescues save against the exact definition;
optional pollen and tool results are recorded alongside the rescue. The final
level returns to the same chooser rather than opening a different ruleset.

## Difficulty contract

The teaching levels remain short. All 25 challenge levels require all eight
bees, including operators and dancers. Advanced boards use 24–52 columns and
20–34 rows; use the existing pan/zoom camera rather than shrinking mobile tiles.

The advanced layouts combine:

- Two to four required turns through staggered partitions, with limited left
  and right dancers and water restricting viable placement.
- A return flight that uses a solid barrier's bounce before applying dances.
- Shutters whose operators must escape in a deliberate order.
- One to three spray lanes with limited covers. Crosswinds moves the hive into
  a different lane without changing its heading; it is a routing constraint.
- Reusable shelters and staged recruitment from waiting bees. Rooftop Relay,
  After the Storm, Factory Entrance and the final two puzzles require new jobs
  during the rescue. Shelter reuse also matters in Rain Check and A Place to Wait.
- Low barriers, clear landing space, and lift-helper dependencies. The Last
  Dancer and the finale require the downstream lift to remain for its predecessor.
- Distinct rescue-only and pollen routes in The Long Way Home, High Road, Low
  Road, and Pollen on the Side. Optional pollen never blocks progression.

Do not claim 19 completely new mechanics. Most challenges combine existing
placement and helper-release decisions; difficulty is not a timer or a bigger
board alone. Honey recovery, active pipe transport, and distinct
industrial artwork remain future features. The current factory chapter uses
barriers, low obstacles, switches, shutters, rally points and cleaning sprays.

## Intended progression

Difficulty labels below are design targets awaiting human playtesting.

| Level                  | Intended decision                                                            | Target               |
| ---------------------- | ---------------------------------------------------------------------------- | -------------------- |
| 1 First Waggle         | Place a point dancer; optionally recover its helper.                         | Tutorial             |
| 2 Two Little Turns     | Use left and right relative to the approach.                                 | Tutorial             |
| 3 Turn It Around       | Reverse once, then leave the signal.                                         | Tutorial             |
| 4 Bounce Back          | Catch a wall-assisted return flight.                                         | Tutorial             |
| 5 Watch the Spray      | Protect the crossing and recover the point helper.                           | Tutorial             |
| 6 Open Sesame          | Recover the operator before removing its turn.                               | Easy                 |
| 7 After You            | Include the operator's separate approach lane.                               | Easy                 |
| 8 Two Doors            | Recover upstream operators first.                                            | Moderate             |
| 9 Change of Shift      | Reassign the only helper job after regrouping.                               | Moderate             |
| 10 Two Wet Crossings   | Protect both spray lanes.                                                    | Moderate             |
| 11 Glasshouse Escape   | Combine shutters, spray and helper recovery.                                 | Moderate             |
| 12 Across the Pond     | Learn lift distance and safe descent before two turns.                       | Moderate             |
| 13 Mind the Branch     | Route through the partition opening.                                         | Moderate             |
| 14 Bring Everyone      | Preserve the lift for the returning turn helper.                             | Moderate             |
| 15 Garden Route        | Budget four turns through disjoint gaps.                                     | Hard                 |
| 16 Return to Sender    | Catch returning bees behind the hive.                                        | Moderate             |
| 17 Rooftop Relay       | Four helper slots must serve five jobs.                                      | Hard                 |
| 18 Shelter the Swarm   | Protect the upper helper as well as the lower approach.                      | Moderate             |
| 19 Crosswinds          | Catch the lane displaced by the sideways gust.                               | Hard                 |
| 20 Rain Check          | Recover the exposed operator before moving the only roof.                    | Hard                 |
| 21 The Long Way Home   | Choose a short lift rescue or a costlier pollen crossing.                    | Hard; optional extra |
| 22 A Place to Wait     | Regroup all helpers before the final shelter transfer.                       | Hard                 |
| 23 After the Storm     | Combine job reuse and one roof across two curtains.                          | Hard                 |
| 24 Factory Entrance    | Two jobs serve an operator, lift and final turn in stages.                   | Hard                 |
| 25 Pipework            | Combine a return flight, lift and offset helper approaches.                  | Hard                 |
| 26 High Road, Low Road | Choose a precise lift crossing or a pollen route.                            | Hard; optional extra |
| 27 Pollen on the Side  | Change the middle crossing to collect optional pollen.                       | Hard; optional extra |
| 28 The Last Dancer     | Preserve the second lift for the first lift helper.                          | Hard                 |
| 29 All Together        | Three jobs serve staged shutter, lift and turn routes.                       | Expert target        |
| 30 Field of Flowers    | Recover a two-lift chain, reassign the climb and last lift, and reuse roofs. | Expert target        |

## Verification and acceptance

The advanced test suite verifies all 19 eight-bee solutions, replay equality,
and export/import roundtrips. It rejects opening-only solutions and every
single omitted setup action. Bounded shortcut probes try one dancer at every
legal cell on the departure row of multi-dancer maps, with other supports
retained. Multi-switch maps test reversed operator release order. Additional
tests target shelter transfer, landing faults, the shifted crosswind lane,
waiting-bee recruitment, alternate pollen routes and lift release dependencies.

Independent review found overlapping passage heights in Garden Route that
could permit a shorter route; the second partition was tightened and a
three-dancer regression added. The finale now uses staged recruitment and lift
dependencies instead of its former seven preassigned helper jobs.

These checks establish concrete solvability and resistance to specific
shortcuts, not exhaustive optimality or human difficulty acceptance. Browser,
mobile layout, full repository gates, and release evidence are recorded in the
[quality audit](LEVEL_QUALITY_AUDIT.md) for this in-progress batch. Prior release
evidence remains in [implementation progress](IMPLEMENTATION_PROGRESS.md).
Human playtesting must
still assess whether the challenge curve is enjoyable and readable.
