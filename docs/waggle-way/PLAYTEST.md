# Waggle Way campaign playtest record

Updated: 2026-09-08. Current scope: one thirty-level version-8 campaign and the
local workshop. No original-map campaign is exposed. The accepted height
mechanic and quality redesign are documented in CURRENT_CAMPAIGN.md and
LEVEL_QUALITY_AUDIT.md. This record distinguishes human feedback, automated
verification and historical evidence. A structured screen-reader session has
not been completed. Sections below the current review are historical feedback,
not a description of today's campaign chooser or release status.

## Current level-quality review

Automated playthroughs exercise actual placement, pause, helper release,
waiting-bee recruitment, shelter movement and camera controls. Engine solutions
and targeted negative probes are separate evidence. Neither establishes that
players find a puzzle enjoyable or its difficulty label accurate.

Human review questions for the current batch:

- Across the Pond and Bring Everyone: is the six-cell lift and its landing
  space understandable, and is the helper's own crossing predictable?
- Crosswinds: can the player see that the gust moves the lane without changing
  heading, and place a dancer to catch it?
- The Long Way Home, High Road Low Road and Pollen on the Side: do the pollen
  choices feel worthwhile without obscuring the basic rescue?
- Rooftop Relay, Factory Entrance and After the Storm: does regrouping make
  recruitment deliberate, and is it clear when a shelter can safely move?
- All Together and Field of Flowers: are the stages distinct and satisfying,
  or do the waits and repeated controls feel tedious? Can a phone player find
  every helper and complete the plan without fighting the camera?

Keep teaching levels approachable. Change geometry or resource tradeoffs when
feedback reveals an uninteresting shortcut; do not add arbitrary timing pressure
or declare a puzzle hard merely because it is large. Record the exact level,
route and misunderstanding before revising it.

## Garden library and numeral feedback — 2026-09-08

The user reported that Play gardens still showed only five practice gardens and
that the pixel font made 2 and 5 difficult to read. Their screenshot captured
the old Practice gardens dialog. The port-3041 development server was no longer
running when inspected; the campaign checkout was restarted and the actual
browser page verified with all 11 current-rule gardens.

The chooser now groups five learning gardens and six Glasshouse challenges,
provides a keyboard-accessible jump to challenges for small screens, and links
to the 30 original gardens. Its toolbar control is labeled Gardens rather than
an unexplained fraction. ASCII digits use a clear monospace fallback throughout
the game and workshop; pixel lettering and artwork remain unchanged.

Review the current build at `http://127.0.0.1:3041/waggle-way`: Play gardens,
then Gardens. Human acceptance of this revision remains open. Automated checks
cover selecting challenges, reaching the original campaign, keyboard focus,
Escape restoration, mobile controls and font rendering in five browser projects.

## Earlier feedback and next review — recorded 2026-09-07

Latest follow-up: the user said the game looks "a lot better" and asked whether
to deploy or refine it first. This supports the current visual direction and
opens a release-readiness discussion. It does not establish completed physical
device/screen-reader testing, acceptance of the future industrial campaign, or
authorization to deploy. Assess the current slice as a possible beta release;
keep the remaining redesign phases in scope.

The user remained dissatisfied with the whole game after the previous visual
and interface revisions, and endorsed a pivot to 8-bit/pixel art throughout.
They want a standalone game window and fullscreen, a matching game interface,
more drag/drop and fewer direction-setting menus. They explicitly noted that
bees can fly over water and proposed industrial settings, sprinklers and waterwalls.
This is continuing negative feedback, not acceptance of the earlier artwork.

The [redesign record](PIXEL_ART_PIVOT.md) defines the next complete level and
workshop review. Check whether the user understands why each obstacle affects
flight, can turn guides directly, rescues the final helper, and builds/tests/
reopens a small level. Review coherent pixel visuals and readable embedded and
fullscreen views on desktop and touch. Record observations before expanding it.
The historical tasks and evidence further below apply to the legacy prototype.

## Earlier dancer and bounce review

The earlier local practice slice was available from **Play gardens**, then the **1/5**
button at `http://127.0.0.1:3040/waggle-way`. Its five gardens are First Waggle,
Two Little Turns, Turn It Around, Bounce Back and Watch the Spray. Any garden
can be selected; switching gardens starts a fresh attempt. Successful rescue
results save locally against the exact level definition, alongside preserved
legacy campaign records. Storage errors remain explicit and do not block play.

A user review on 2026-09-07 described the slice as "better", reported that the
second garden did not need both guides, questioned separate helper headings and
requested that guides cannot be placed on water. This is improvement feedback,
not full acceptance. Version 7 now prototypes dry-ground placement and automatic
relative-helper departure; the revised second garden uses water to constrain the
shortcut. Review those changes before treating the mechanic choice as settled.

Planned review tasks from the 2026-09-07 direction; no human pass is recorded.
Run these in short slice variants before expanding the campaign:

1. Place a dancer on dry ground without a perch, then try an invalid water cell
   in version 7. Explain why flying bees can cross it while a guide cannot stay there.
   Explain what the remaining supply counts.
   Try an invalid drop and exhausted supply; neither should consume another bee.
2. Predict left/right 90-degree and reverse turns from two approach headings.
   Keep a bee inside a field, then leave and re-enter it. Confirm that one entry
   creates one turn and that overlapping fields do not produce unexplained spins.
3. Observe how a version-7 relative helper follows the last bee it guided when
   released, including the fallback before its first signal. Pointing dancers
   retain an arrow. Rescue the last helper and check setup refunds versus spent uses
   after launch. Record whether this finite-use default feels clear and fair.
4. Predict a marked solid's bounce before contact, then test a corner and a
   narrow passage. Distinguish a safe turnaround from spray exposure and flyable
   scenery. Record confusion before settling turnaround versus reflection.
5. Build, test, save and reopen a small mixed-dance puzzle with a safe bounce
   obstacle. Repeat placement and heading changes using touch and keyboard;
   neither flow should require a persistent direction-setting side menu.

Record device/input, observed failures and rule changes in each review. Automated
determinism/resource checks support these tasks but do not establish usability.
Large-map camera testing remains a later phase and does not gate this compact slice.

## Historical response (2026-09-05)

The player reported that the game did not feel cohesive, side menus were hard to
use, graphics needed a full refresh, and direction setting needed more dragging
and fewer menus. The initial generated landscape backgrounds were rejected
because they implied a vertical playfield; the intended view is top-down.

This is negative playtest feedback, not acceptance. The active revision replaces
those assets with overhead ground art, redraws all eleven piece types and bees,
reuses piece art in the palette, moves the canvas ahead of forms, adds drag-to-turn
and drag/drop tools, and moves detailed properties and campaign selection to
centered dialogs. Coordinate and direction-button alternatives remain available.
The revised game shell has an Arcade exit instead of the site's navigation/footer.
Review the complete revised game and builder on desktop and touch before accepting
M4 or proceeding to the final six campaign puzzles.

All 50 revised game browser checks passed across desktop/mobile Chromium,
Firefox and WebKit after fixing native drag compatibility with pointer capture.
The suite checks arrow turning, placement, movement preview and undo alongside
the earlier rescue, persistence and accessibility control flows. An in-app fan
placement drag was manually verified. This does not replace player acceptance.

## Current observations

- Thirty-six recorded solutions rescue all six bees in each of the thirty puzzles,
  including both routes through Garden Route and A Dry Detour. Command replay reproduces each
  final state. This proves those routes work, not that new players can find them.
- Desktop and touch Chromium checks cover guide assignment/release, rescue,
  restart, progression, skip/reload, preferences, keyboard heading controls,
  fullscreen, worker preview, and unreadable progress preservation.
- Workshop checks cover place/undo/redo, save/load/export/import, rejection of
  malformed content, and test/return preservation. The thirty-puzzle import/export
  compatibility flow is included in the browser suite.
- Desktop/mobile screenshots were inspected for readable text, control layout,
  and horizontal overflow. The campaign chooser now groups six puzzles per garden; inspect its revised
  mobile layout again before extending to 30.
- Maximum accepted-size engine profiling found a roughly 492 ms route preview
  on this machine. It now runs in a worker that is terminated on setup changes,
  play, or navigation. Small campaign previews pass the browser flow.

Glasshouse desktop/touch browser checks also build a switch/gate/rally puzzle,
protect linked deletion, release a waiting group, rescue the last operator and
restore the gate through Undo. Screenshot review found dark SVG labels on dark
pieces; the new labels now use the existing light text token. The corrected
fullscreen result was reviewed on mobile Chromium with no horizontal overflow
or website-header obstruction. The full browser suite passed 298 tests across
six projects; see the progress record for scope and remaining environment limits.

Rainy Garden adds five domain tests covering phase boundaries, strict validation,
occlusion, exposed populations and legacy behavior, plus seven verified solutions.
The new desktop/touch browser flow authors a sprinkler and leaf, rejects an
out-of-bounds range, verifies pause/single-step timing, rescues the whole hive
under the canopy and preserves the authored cycle on return. The mobile screenshot
shows rain above the leaf and the dry crossing below. Full Rainy Garden checks
passed 303 browser tests across six projects and 1,439 frontend tests. These
automated results do not replace the human tasks below.

## Wildflower Valley review

The new browser flow drags a pollen piece into a blank garden, selects Wildflower
art, authors a delivery target, saves/exports, delivers the token in test mode and
reopens the saved garden. A failed selector in the first run was corrected to
address the theme control by its combobox role; the control was present and
correctly named in the browser accessibility tree. Desktop and mobile screenshots
show matching overhead ground and piece art, an unobstructed board, and readable
pollen delivery counts. This is screenshot review, not human gameplay acceptance.

Player review should distinguish touching pollen from bringing its carrier home,
try both routes in High Road, Low Road, and bring the last dancer through Field
of Flowers. Optional goals must feel optional and should never be confused with
the rescue target. Record whether decorative flowers are confused with HOME.

## Ghost comparison evidence

The browser flow retains a failed first attempt, seeks to its end using the
keyboard range control, matches the live tick, changes the guide and rescues all
six live bees while the ghost retains its own result. It verifies a paused tick,
separate individual ghost state, hiding and clearing on navigation. All five
browser/device projects passed the focused flow. Desktop/mobile screenshots
were inspected; G labels and hollow outlines distinguish the old attempt without
intercepting controls. User comprehension remains unverified.

## Human tasks still to run

Record device/browser, input method, observations, and concrete failures for each.
Do not count an automated script as a human screen-reader or difficulty test.

1. **First Waggle without hints:** explain what the guide changes; assign it,
   turn up, open the hive, then release the last helper. Record where the player
   first understands that helpers count toward the population.
2. **Across the Pond:** predict the effect of stronger lift before trying it.
   Use pause and preview to explain any missed flower field.
3. **Mind the Branch:** compare medium and strong lift; determine whether the
   branch collision and wind shadow are understandable from the display.
4. **Bring Everyone:** bring both helpers home. Record whether release order is
   clear and whether the inspector is sufficient to recover from a mistake.
5. **Garden Route:** find one route, then another. Confirm the two-guide-job
   limit is understandable; distinguish the two-guide-job limit from the supplies taught in later puzzles.
6. **Keyboard workshop:** place a guide using coordinates, rotate and move it,
   duplicate/delete, undo/redo, test, return, save, export, and import. Check
   focus visibility and restoration at each transition.
7. **Touch workshop:** repeat placement and movement with touch controls and
   numeric alternatives. Check scrolling, zoom, and accidental placement.
8. **Screen reader:** inspect objective, selected object, nearby-bee eligibility,
   population, individual bee state, errors, hints, and completion. Check that
   routine simulation ticks do not cause continuous announcements.
9. **Zoom/motion/sound:** review at 200% zoom and narrow reflow; use system and
   in-game reduced-motion settings. Verify cosmetic wings stop while paused and
   results remain understandable with sound off.
10. **Recovery:** retain an open draft during rejected import and denied storage;
    export preserved content and confirm the message explains what was saved.

11. **Ghost review:** fail a route, restart, compare, scrub to the failure and
    return to the live clock. Explain which bees are real, whether the recording
    ended, and why reviewing it has not changed live resources. Repeat with
    keyboard, touch and a screen reader.

12. **Game window/fullscreen:** compare the framed view with fullscreen; switch
    puzzles without losing fullscreen, open the story map, and return to the
    frame. On a phone and at 200% zoom, inspect a ghost while reaching every tool.
    Open mission, preview and bee panels; close with Escape or outside interaction.
    Confirm they pause the hive and never cover controls after they close. Assess
    whether this feels like one cohesive game rather than a website form.

## Acceptance status

M4 remains open until the unfinished manual tasks and device-render measurements
have recorded evidence and any material findings are addressed. Do not advertise
WCAG conformance or a completed 30-level release based on this slice.


## Challenge conversion and larger boards — pending player review

The user authorized this batch after positive slice feedback. Check Open Sesame,
After You, Two Doors, Change of Shift, Two Wet Crossings and Glasshouse Escape in
the Adventure gardens chooser. The first five lessons remain available, and the
30 original gardens have a separate title-screen entry.

- Can the player explain why each operator must leave in a particular order?
- Does Change of Shift feel like planning with one helper job, with pause making
  recruitment manageable, rather than a test of tapping speed?
- Can a required tool be omitted or an obvious direct path bypass the main idea?
  Record the alternate route; clever intended alternatives need not be removed.
- Does mobile panning keep the hive, hazards and last helper findable? Verify
  switching back to placement, guide dragging after pan/zoom, Fit, and fullscreen.
- Is Next garden obvious after a win, including after returning to a saved game?
- Do the larger boards justify their travel time with decisions? Identify empty
  stretches to shorten before authoring additional industrial chapters.

Automated solution and browser checks are recorded in implementation progress.
Physical-device, screen-reader and subjective difficulty acceptance are pending.
