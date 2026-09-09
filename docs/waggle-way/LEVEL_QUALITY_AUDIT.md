# Campaign quality audit and redesign backlog

Audit started 2026-09-08 against `a82106c9`, with a clean worktree. Work continues
on `codex/waggle-level-quality`, based on the still-open PR #270. This is a
design audit, not a claim that the campaign has passed human difficulty review.

## Evidence and limits

The current definitions are `packages/waggle-way/src/content/redesign.ts`
(1–5), `challenges.ts` (6–11), and `advanced.ts` (12–30). The ordered catalogue
is `adventure.ts`. Existing advanced solutions are in
`src/test/waggleWayAdvanced.test.ts`; Glasshouse solutions are in
`src/test/waggleWayChallenges.test.ts`.

At the audited baseline, the advanced solver placed almost every tool before starting, then released
operators followed by dancers as each preceding group reaches home. Only
Rain Check and A Place to Wait had explicit staged shelter movement. This is
direct evidence of repetition in the known solutions, not proof that no more
interesting alternative exists. Increasing map dimensions or helper count
does not by itself introduce a new decision.

Existing omission checks remove one action from one authored solution. Existing
one-dancer probes search the departure row while keeping other supports. These
are useful regressions but do not establish minimum tool cost, rule out routes
on other rows, or test all legal release timings. New acceptance must name the
particular shortcut or sequencing mistake it covers.

Baseline verification on this branch: `pnpm exec vitest run
src/test/waggleWayAdvanced.test.ts src/test/waggleWayChallenges.test.ts
--maxWorkers=2` passed all 106 tests in 25.13 seconds. This reproduces the known
solutions and existing negative probes; it does not resolve the weaknesses below.

## Baseline level-by-level review

“Retain” means preserve the teaching purpose, not skip verification. “Revise”
means the stated design weakness needs a concrete layout or resource change.
The proposed challenge is an implementation target, not implemented behavior.

| # | Level | Current decision / source finding | Disposition and acceptance target |
|---|---|---|---|
| 1 | First Waggle | One pointing dancer and optional last-helper rescue; a short introduction. | Retain. Verify clear water crossing, dry placement, and full-hive optional success. |
| 2 | Two Little Turns | Two relative turns around a pond; both stocked dances have a teaching purpose. | Retain. Probe one-guide bypasses beyond the departure row; verify both helpers can leave. |
| 3 | Turn It Around | Reverse dance sends an outward flight home. | Retain. Keep short; verify reversal is needed and a bee does not repeatedly turn in one visit. |
| 4 | Bounce Back | Wall supplies reversal; right dancer catches returning bees behind hive. | Retain. Contrast forward placement with the return route, without adding another mechanic. |
| 5 | Watch the Spray | Fan, one cover, and a point dancer introduce active spray. | Retain. Check safe full-hive solution and an uncovered failure at an explicit cycle phase. |
| 6 | Open Sesame | One operator and one final turn; first all-eight target. | Retain. Verify operator recovery and premature dancer release separately. |
| 7 | After You | Operator starts on a different side of a partition. | Retain. Prove the operator's path adds a decision beyond the swarm's route. |
| 8 | Two Doors | Two operators must leave in upstream-to-downstream order. | Retain as the release-order lesson. Check each incorrect order causally. |
| 9 | Change of Shift | One simultaneous job forces operator-to-dancer reassignment at a rally. | Retain as the first resource-reuse puzzle; inspect touch recruitment fairness. |
| 10 | Two Wet Crossings | Two covers for two sprays can be set before departure. | Retain as a preparation lesson; later rain maps must develop a different decision. |
| 11 | Glasshouse Escape | Two shutters plus one spray; existing solution can release the initial rally immediately. | Revise rally purpose or remove it. A rally must support a necessary safe decision, not decorative interaction. |
| 12 | Across the Pond | Two-turn route resembles level 2 on a larger board. | Revise into a constrained dry-ground route choice; keep it a moderate chapter entry. |
| 13 | Mind the Branch | Three turns through a partition gap. | Retain geometry concept, tighten irrelevant open space, and test a cheaper two-turn route. |
| 14 | Bring Everyone | One shutter added before a familiar two-turn route. | Revise operator escape to use a different approach or shared dance than the swarm. |
| 15 | Garden Route | Four turns through disjoint partition gaps; prior three-turn shortcut fixed. | Retain. Broaden three-turn probes and validate release lanes through both gaps. |
| 16 | Return to Sender | Bounce before two right turns; differs from forward-turn layouts. | Retain. Verify bounce is useful and initial forward interception does not trivialize it. |
| 17 | Rooftop Relay | Two shutters followed by three turns; serial pattern. | Revise into a chapter capstone with a limited shared job or real staged rendezvous. |
| 18 | Shelter the Swarm | One cover and two turns repeat established preparation. | Revise into a compact rain chapter entry with a meaningful shelter-position tradeoff. |
| 19 | Crosswinds | Fixed fan speeds an early leg; two covers protect both sprays. | Revise so the fan changes a route or release decision, not merely travel time. |
| 20 | Rain Check | One cover reused after recovering an exposed operator into a rally. | Retain strong staged premise. Probe early/late transfer and alternate dry routes. |
| 21 | The Long Way Home | Three turns and two covers; similar to level 19 without fan. | Revise: offer a safe longer route versus a resource-constrained crossing, with an optional objective distinguishing them. |
| 22 | A Place to Wait | Fixed roof plus one portable cover; all helpers regroup before final transfer. | Retain. Verify last-helper arrival is necessary, not just waiting for the first swarm. |
| 23 | After the Storm | Two shutters, three turns, two covers; setup-heavy combination. | Revise into a rain capstone requiring at least two different staged decisions. |
| 24 | Factory Entrance | Three serial shutters and one turn; mostly level 8 with another operator. | Priority redesign: limited simultaneous jobs and safe staging should require reassignment between sections. |
| 25 | Pipework | Four turns through staggered partitions; resembles level 15. No pipe transport exists. | Revise into a return/shared-junction puzzle using existing barriers. Do not imply functional pipes. |
| 26 | High Road, Low Road | Current layout has one intended two-turn route, three shutters, and one cover. | Priority redesign: provide two actual routes with different resource or optional-goal costs. |
| 27 | Pollen on the Side | Four-turn solution collects pollen without a separate action pattern. | Priority revise optional goal: demonstrate a rescue-only solution and a distinct pollen solution with a real tradeoff. |
| 28 | The Last Dancer | Three serial operators followed by two dancers; same release pattern as earlier. | Revise around a final helper whose exit requires reuse or a different approach, not another serial shutter. |
| 29 | All Together | Six preassigned jobs; remaining swarm follows prepared route. | Revise around regrouping and reassigning scarce jobs, not count alone. |
| 30 | Field of Flowers | Seven preassigned jobs, three sprays, four bends; large serial culmination. | Revise into a capstone combining route planning, staged reuse, and final-helper recovery with clear safe pause points. |

## Redesign acceptance

User scope addition, 2026-09-08: the active level-quality goal includes adding
new items or mechanics when needed. The existing-tool list is not a constraint
against new mechanics. Evaluate additions against the audited puzzle gaps;
prefer meaningful new decisions over cosmetic variants or more controls.
Candidates include the previously discussed lift/hop dancer, directional fan
controls, or pipe transport, but no particular candidate is selected yet.

Any selected addition needs deterministic engine rules, understandable visuals
and hazard interactions, campaign teaching and advanced uses, builder authoring
and validation, save/export/replay support, accessible desktop/mobile controls,
and solution/failure tests. Preserve one coherent current ruleset. Assess whether
it earns its complexity through distinct puzzles before expanding its use.

| Candidate | Decision it could introduce | Required clarity / cost | Audit gaps it could address |
|---|---|---|---|
| Lift/hop dancer plus low obstacles | Spend a scarce lift to cross a short obstruction, or take a longer guided route; plan the helper's own exit. | Distinguish low obstacles from full-height walls and active spray. Define lift distance, landing, and released-helper behavior without frame-perfect timing. | 12, 21, 26, 28; later capstone combination. |
| Switch-controlled fan | Choose which airflow is active while recovering the operator; distinguish route selection from mere speed. | Show the link and airflow before release; define what happens when the operator leaves. Existing fixed fans alone do not provide this decision. | 19, 23, 24, 29. |
| Paired pipe entrances/exits | Route a group to a distant exit with a specified heading, while retaining an exit for helpers. | Clearly show pairing, transit, and blocked-exit behavior. It must not become a free teleport that removes the whole puzzle. | 25, 26, 30. |

These are candidate comparisons, not commitments to add all three. Select the
smallest set that makes the weak puzzles meaningfully different, and include
teaching space before demanding combinations. Reassigning existing jobs remains
an available design technique alongside new mechanics.

### Accepted height direction

The user explicitly selected height after the initial comparison. Implement lift
as a core mechanic, not merely a possible future item. The initial version-8
engine foundation adds a lift dancer and low/tall terrain. Lift preserves the
bee's heading and lasts six traveled cells. The released lift helper receives
its own six-cell flight. Low barriers can be crossed while lifted; tall barriers
and closed shutters still block. Descending inside a low obstacle loses the bee
with a distinct landing reason. Ordinary water stays safe. Active spray remains
dangerous, and low obstacles do not provide rain cover. Flowers and rally points
require normal flight height. Airborne bees cannot be recruited as helpers.

The in-progress work is not a verified campaign release. Implemented so far:
altitude/shadow and remaining-distance cues, separate low/tall obstacle art,
landing explanation in bee inspection, workshop controls and stock labels, and
an introductory lift route in Across the Pond. All 30 built-in levels and new
workshop gardens now use version 8, retaining one current campaign ruleset.
The first height route places lift at (4,16), left at (10,16), and right at
(9,4), then rescues lift, left, and right helpers in that order after preceding
bees reach home. It passes the eight-bee simulation and replay checks.

Current focused evidence: 113 engine/campaign tests and 15 title/workshop tests
pass; TypeScript passes. Desktop inspection confirms the lift supply and low
barrier render in level 12. This is not yet a complete browser playthrough.
Still required: interaction edge-case tests, actual desktop/mobile height
playthroughs and builder roundtrips, advanced height combinations, the remaining
level redesigns, and all release gates. Do not ship two parallel playable rulesets.

### Route-choice follow-up

- Level 26 now has a two-tool high route (lift at 13,20; left at 32,20) and
  a three-tool ground route (left at 12,20; right at 11,6; left at 32,7).
  Both rescue eight bees; only the ground route delivers the optional pollen.
  A lift at 12,20 fails with an actual landing loss inside the three-cell-wide
  low wall. Both routes use the same map; no mode switch or alternate ruleset.
- Level 27's normal solution leaves pollen at 18,16. Its pollen solution moves
  the middle right dancer to 11,14 and the following left dancer to 30,15.
  Both rescue eight bees. The bonus requires a lower crossing rather than
  extra tools; do not claim that it has a higher tool cost.
- The new real-control lift browser case passed desktop and mobile Chromium
  (2/2). It places all three helpers, inspects an airborne bee's visual cue,
  releases each helper through UI controls, and finishes with eight rescued and
  zero lost. The mobile screenshot was visually inspected. The new route-choice
  levels still need browser playthroughs and broader shortcut probes.

### Helper recovery follow-up

- Level 11 removes the unnecessary initial rally and retains its introductory
  shutter-order/spray combination. The instructions and solution omit the
  redundant release command.
- Current-rule helpers may recruit a nearby waiting bee as well as a normal
  flying bee. Older replay rules retain their prior recruitment behavior. The
  one-cell limit and job limit remain enforced; high-flight bees are ineligible.
  A focused test verifies near-rally recruitment, rejects a distant placement,
  and reproduces the result through replay.
- Level 24 uses two jobs and two rally stages. Assign the operator and lift at
  16,20; collect six bees at rally-1 (12,20), recover the operator, then release
  that group over the low wall. Gather seven at rally-2 (24,20), recover the lift
  helper, recruit a waiting bee for a left dance at 25,20, then release the rally
  and finally the dancer. The all-eight replay passes. This replaces three
  serial shutters with job reuse and safe regrouping.
- Level 28 uses an operator, lifts at 14,20 and 23,20, a left dancer at 34,20,
  and a cover at 19,7. Both low walls and the landing-lane spray matter in the
  omission checks. The complete rescue passes; reversing the two lift helpers'
  release order leaves a live bee stranded between the low walls, with zero
  rain losses. This is a route dependency, not an invalid-command failure.

Browser playthroughs for levels 24 and 28 remain outstanding. These notes record
simulation evidence, not human acceptance or completed release verification.

For each revised level, record the intended decisions, exact working commands
or replay, resource use, and a specific tempting failure/shortcut. The failed
attempt must fail for the intended reason (for example rain loss, blocked
operator exit, or exhausted helper jobs), rather than an invalid command or a
test that simply abandons a helper. Alternative valid solutions are welcome;
close shortcuts only when they erase the level's intended decision.

Optional pollen must have separately demonstrated rescue-only and pollen
solutions. Avoid calling pollen a detour when the ordinary solution collects it
automatically. Avoid exact-frame execution: provide safe waiting points and
verify that pause, inspection, and deliberate touch input can execute the plan.

The final evidence table must cover all 30 levels, name which retained maps were
rechecked, and distinguish source inspection, simulation, real browser controls,
and human feedback. Human questions include: can the player identify why a route
failed; does the chapter introduce a new thought rather than repeat chores; and
can a phone player inspect and execute each stage without fighting the camera?

## Implementation and verification record

### Consolidated verification update

This latest evidence supersedes pending-check notes in the earlier design
follow-ups below. Full frontend coverage passes 1,771 tests and Functions
coverage passes 1,011. Rules, production build and bundle budgets pass. The
full 553-case browser gate is running; do not treat it as complete.
Workshop height/lift editing, undo/redo, save/reopen, export and test/return pass
on desktop and mobile Chromium (2/2). The mobile workshop screenshot was
inspected. The first workshop attempt used the wrong Playwright locator for
the select; the test now uses its actual accessible combobox name.

The new real-controls route suite covers levels 14, 18, 19, 21 (both routes),
24, 25, 26 (both routes), 27 (both routes), 28, 29 and 30 on desktop and mobile
Chromium. The broad run passed 26/28; desktop Bring Everyone and Shelter the
Swarm exhausted total test time while still flying with zero losses. Both
passed unchanged in isolation (2/2). Logs: `scratch/waggle-quality-browser.log`
and `scratch/waggle-quality-browser-retry.log`. Earlier current-batch browser
evidence covers levels 12, 17, 20 and 23. These are automated playthroughs, not
human difficulty acceptance or full cross-browser release verification.

The entire Waggle unit run passed 411/412; the saved-revision workshop focus
assertion passed in isolation. Preserve that timing failure until full-gate
results are available. The existing Two Little Turns all-cell single-dancer
probe passed in the broader run. A new Mind the Branch probe checks more than
100 legal two-turn routes across three approach rows and ten gap/edge rows;
none wins. This is bounded evidence, not exhaustive minimum-tool proof.

Node 24.19.0, pnpm 11.21.0 and Java 21.0.12 are verified. Frozen install,
agent validation, route-security validation, Functions lock validation and
TypeScript pass. The remaining full repository gate runs sequentially using
`scratch/waggle-quality-gate.ps1`, with status in its JSON record and per-gate
logs. A running or absent result is not a pass. PR delivery and final evidence
review remain outstanding; no deployment is authorized.

### Final capstone follow-up

- Level 29, All Together: three concurrent jobs replace six. Start both
  operators, lift 24,28 and roof 11,15. Gather at rally-1, recover the operators
  upstream first, and transfer the roof to 37,3. Cross the low wall into rally-2
  and recover the lift. Recruit left at 32,27, gather at rally-3 and recover that
  helper. Recruit right at 33,11 for the final crossing. The climb placement
  matters: at 33,28, its own released bee misses the upper rally's lane.
- Level 30, Field of Flowers: four initial jobs replace seven. Start both
  operators, lifts 22,30 and 31,30, and roofs 11,17 and 27,17. Gather at rally-1
  while recovering operators then lifts upstream first. Transfer the first roof
  to 44,1. Recruit left at 40,29 for the climb into rally-2 and recover it;
  recruit lift at 40,13 for the last low beam into rally-3 and recover it;
  recruit right at 41,5 for the final flight. Both low-wall lifts are needed by
  the initial swarm, and the first lift helper still needs the second to escape.

Both intended all-eight solutions replay. Targeted faults cover premature and
missing shelter transfers, the misplaced climb helper, and reversed lift order.
Browser playthroughs for both final maps remain required. The capstone negative
solver now stops at the first regrouping deadline it cannot meet, preserving
that failure state instead of attempting later commands without eligible bees.
This improves causal evidence and avoids repeated empty waits in shortcut probes.

### Route-choice and return-path follow-up

- Level 18, Shelter the Swarm, is narrower (24 columns). Its spray now crosses
  the upper dancer and route. Cover at 11,1 protects both turns (12,18 and
  11,4). Cover at 11,10 leaves the upper helper exposed and causes a verified
  rain loss. The teaching decision is shelter position along the whole route.
- Level 21, The Long Way Home, has a low wall, a dry far bank, and optional
  pollen in the upper spray lane. Short rescue: lift 14,24, left 34,24, roof
  5,12. Pollen route: left 13,24, right 12,10, left 34,11, roofs 5,12 and 21,2.
  Both rescue eight; only the longer route delivers pollen. The demonstrated
  peak tool counts are three and five respectively, not claimed global minima.
- Level 25, Pipework, now combines a return flight with a northbound lift.
  Right at 8,24 catches the hive after bouncing from the east end wall; lift
  at 9,15 crosses the low beam; right at 9,5 and left at 39,6 finish the route.
  Release those helpers in route order. The all-eight replay passes. Placing
  the first right dancer ahead of the hive at 16,24 turns outgoing bees south
  and loses them at the boundary. The low cross-pipe is a barrier, not transport.

The targeted tests pass for these three maps, including the alternate pollen
route and concrete wrong-placement failures. Browser playthroughs are pending.

### Rain chapter follow-up

- Level 19, Crosswinds: the fixed fan now blows north across the eastbound
  departure at 7,22, strength 3. It shifts the swarm about five cells without
  changing its heading. The intended first dancer moves from 12,20 to 12,15;
  the remaining turns are 11,6 and 30,7. Both spray columns still need covers.
  A simulation checks the actual shifted position and eastward heading, and
  demonstrates failure when the first dancer stays on the old departure row.
- Level 23, After the Storm: four helper slots and one cover replace five
  preassigned helpers and two covers. Use both operators, left at 25,24, right
  at 24,9, and cover at 12,11. Gather at rally-1 (28,9), recover both operators
  followed by the dancers, then move the cover to 29,2. Release into rally-2
  (36,9), recruit a waiting bee for the final left at 37,10, and bring everyone
  home. The all-eight solution replays. Moving the roof before the operators
  escape or never transferring it causes rain losses in targeted tests.

Real-control desktop/mobile Chromium tests for both the staged rooftop and storm
routes pass (4/4, `scratch/waggle-staged-browser.log`). They recover all eight
bees, recruit from the waiting hive, transfer the storm shelter, and use Find
helper to pan to the final dancer. The desktop and mobile screenshots were
inspected. This is automated interaction evidence, not human difficulty approval.
The focused campaign/height suite passes 123 tests
(`scratch/waggle-rain-quality.log`); TypeScript and lint for the changed level and
test files also pass. Full repository release checks remain outstanding.

### Rooftop and operator/lift follow-up

- Level 17, Rooftop Relay, now has four helper slots for five sequential jobs.
  Assign both switches, left at 25,22 and right at 24,7. Gather the free bees
  at the tall rally at 34,7, then recover switch-1, switch-2, left and right in
  that order, waiting for each helper to regroup. Recruit the final left dancer
  at 35,8 from the waiting hive, release the rally, then rescue that dancer.
  The intended all-eight solution replays. A fifth simultaneous job is rejected;
  reversing the operators leaves a live bee behind the second shutter.
- Level 14, Bring Everyone, now combines shutter recovery with a northbound
  lift crossing. Assign switch-1, left at 16,18, lift at 14,12, and right at
  15,4. Release those helpers in that order after the free group reaches home.
  The lift crosses a low horizontal beam at y=9–10 and lands before the final
  turn. Releasing the lift before the first turn helper rescues seven bees but
  makes that helper bounce south and leave the board. This gives the lift a
  concrete route dependency instead of adding a decorative obstacle.

These changes have simulation evidence; desktop and mobile playthroughs remain
required before release. Their challenge ratings still need human feedback.

Height follow-up: the user reaffirmed the height direction. The focused height
suite now passes 11 tests, including flying over pollen and rally points without
collecting them and verifying that low obstacles do not shelter the spray lane.
These checks preserve distinct flight heights without making lift a universal
hazard bypass. Full release verification and the remaining campaign work below
are still outstanding.

## Remaining delivery work

Human feedback on Open Sesame: the player could not discover how to open the
shutter and placed the left dancer before it. The mission now explains that
selecting the purple switch and choosing Assign operator works across the closed
shutter, before opening the hive. It also explains the dancer's position beyond
the switch and the operator-before-dancer rescue order. This is a teaching clarity
correction, not evidence that the puzzle is too difficult once understood. The
selected switch now also shows an explanation beside Assign operator, outside
the collapsed menus. A fresh unaided human attempt remains a playtest question.

Built screenshot review on 2026-09-09 covered the mobile All Together final
recruitment, desktop Field of Flowers final recruitment, and desktop height
workshop (the mobile workshop was reviewed in the focused run). The camera
centers the recruited helper and rally, the status counters and actions are
readable, and low wooden slats remain distinct from the tall brick barrier.
These observations are scoped visual evidence, not a full accessibility claim.

The full browser run exposed three stale workshop export assertions expecting
version 7; new gardens correctly use version 8. Expectations were updated to the
current contract; the affected browser flows still require rerunning.

- Finish the full browser gate and dependency audit; resolve any failures.
- Inspect final built screenshots and reconcile the evidence table with results.
- Deliver the quality changes through a normal PR with required checks passing.
- Retain the human playtest questions and unproven optimality limits; automated
  success does not establish enjoyment or an exact difficulty rating.
- No deployment is authorized.
