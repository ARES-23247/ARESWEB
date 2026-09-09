# Current Waggle Way campaign

Updated 2026-09-08. This development batch replaces the two-campaign menu with
one 30-puzzle campaign. The user explicitly rejected an archive, dual rulesets,
and old-map migration work: treat Waggle Way as a fresh game.

All built-in maps use version 7. Ordinary water is safe to fly over, dancers
require dry ground, limited helpers can be placed freely on valid cells, and
solid barriers turn bees around. Sprinklers, rather than ponds, threaten bees.
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
bees, including operators and dancers. New boards range from 28 × 20 to
52 × 34; use the existing pan/zoom camera rather than shrinking mobile tiles.

The advanced layouts combine:

- Two to four required turns through staggered partitions, with limited left
  and right dancers and water restricting viable placement.
- A return flight that uses a solid barrier's bounce before applying dances.
- One to three shutters whose operators must escape in a deliberate order.
- One to three spray lanes with limited covers; some routes also use fan speed,
  rally staging, or an optional pollen detour.
- Reusable shelters in Rain Check and A Place to Wait: regroup at a rally,
  recover the exposed operator or all remaining dancers, then move a cover to
  protect the next leg. Correct initial placement alone is insufficient.
- Up to seven simultaneous helper jobs in an eight-bee hive, requiring the
  player to plan the final helpers' journey as carefully as the first bee's.

Do not claim 19 completely new mechanics. Most challenges combine existing
placement and helper-release decisions; difficulty is not a timer or a bigger
board alone. Honey recovery, lift dancers, active pipe transport, and distinct
industrial artwork remain future features. The current factory chapter uses
existing barriers, switches, shutters, and cleaning sprays.

## Verification and acceptance

The advanced test suite verifies all 19 eight-bee solutions, replay equality,
and export/import roundtrips. It rejects opening-only solutions and every
single omitted setup action. Bounded shortcut probes try one dancer at every
legal cell on the departure row of multi-dancer maps, with other supports
retained. Seven multi-switch maps test reversed operator release order.

Independent review found overlapping passage heights in Garden Route that
could permit a shorter route; the second partition was tightened and a
three-dancer regression added. Field of Flowers has disjoint passage heights
requiring four turns on a direct forward route.

These checks establish concrete solvability and resistance to specific
shortcuts, not exhaustive optimality or human difficulty acceptance. Browser,
mobile layout, full repository gates, and release evidence are recorded in
[implementation progress](IMPLEMENTATION_PROGRESS.md). Human playtesting must
still assess whether the challenge curve is enjoyable and readable.
