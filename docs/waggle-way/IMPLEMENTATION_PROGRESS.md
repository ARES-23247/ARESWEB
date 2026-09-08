# Waggle Way implementation progress

Updated: 2026-09-08. Current branch: `codex/waggle-hard-campaign` in the root
checkout, based on deployed master e50952b0.

## One harder campaign — 2026-09-08

The user rejected the old perch/lethal-water maps and then explicitly rejected
an archive and old-map support. This batch removes the old campaign player and
its authored maps from runtime, replacing the main catalogue with 30 version-7
gardens. New workshop maps use version 7. No migration or archive UI is added.
[CURRENT_CAMPAIGN.md](CURRENT_CAMPAIGN.md) records the actual chapter list,
difficulty contract, and remaining future mechanics.

Three parallel scopes cover level design, independent solution/shortcut testing,
and UI/browser integration. All 19 advanced layouts pass eight-bee replay solutions;
88 focused tests cover roundtrips, setup omissions, bounded one-dancer shortcuts,
operator ordering, the corrected Garden Route gap, and causal rain-loss failures for the two staged shelter-reuse puzzles. This is not human
difficulty acceptance. Local frozen install, guards, lint, typecheck, build, bundle limits, audit and 34 rules tests pass. Full frontend coverage passes 1,738 tests and Functions coverage passes 1,011 tests with two workers; initial concurrent runs hit one unrelated timeout each. Later focused tests add the pollen objective proof, same-garden restart regression, and staged shelter reuse. Rain Check also passes a real all-eight browser solution on desktop and mobile Chromium (2/2). Twenty game browser cases pass on desktop and mobile Chromium across focused runs; release-tooling coverage, the final production build, and bundle limits pass. The restarted complete built browser gate is running against the final changes.

Previous release: PR #267 merged as e50952b0; protected CI 34268113602 passed 443
browser cases, and production run 34270018075 passed deployment, live health,
and browser-security smoke. The sections below are historical records of that
release and earlier development states.

## Direct access to original puzzles — 2026-09-08

During deployment review, the user reported that the original Story gardens
selector still locked later puzzles. Removed sequential access gating from that
selector: all 30 original puzzles are directly playable, matching the 11 current
adventure gardens. Selecting a puzzle leaves completion and skip records intact;
only an actual rescue or the explicit Skip this puzzle action writes a result.
The deployment authorization remains active and includes this correction.
Focused validation passes 31 unit tests and 10 browser cases across all five
projects, covering direct level-30 access, return to level 1, unchanged saved
records, actual rescue saving and explicit skip results.

## Authorized release integration — 2026-09-08

The user explicitly requested deployment of the game update. Master advanced to
9735075c (sign-in recovery, PR #268), which independently completed the same
ARES 17.0.2 source refresh as the prerequisite PR #266. Release integration keeps
master's complete Academy source, provenance and review-digest set, including
its later motion-profile correction, instead of duplicating overlapping lesson
paragraphs. The game and CI/release-readiness changes from #266 are being
released together through PR #267 targeting master, with full protected checks.
The earlier stacked-PR instructions below describe the previous review state.

## Garden library and readable numerals — 2026-09-08

The game chooser now separates five learning gardens and six Glasshouse
challenges, with a jump control for mobile/keyboard users and direct access to
the 30 original gardens. Its toolbar button is explicitly labeled Gardens.
Numerals fall back to a clear monospace font across game and workshop UI,
including rescue counts and supplies; the bundled pixel font remains unmodified.

The user's screenshot was of the old five-garden dialog. The current checkout
already contained 11 gardens, but its port-3041 server had stopped. Restarting
that checkout and checking the actual browser confirmed the new library.

Previous commit 2381e90 passed remote verification run 34178682355, including
both browser shards and the required gate. PR #267 remains a draft stacked on
#266; no production deployment has occurred. UI follow-up validation: frozen install, agent/route/deployment-lock guards,
root and Functions lint, TypeScript, Functions build, production build/prerender,
bundle limits and production audit pass. Frontend coverage passes 1,643 tests in
277 files; Functions coverage passes 1,011 tests in 83 files; emulator rules pass
34 tests. The targeted chooser and first-flight checks pass in all five browser
projects, including keyboard chapter jumping, selection/return focus, original
campaign access and mobile guide-release visibility. Desktop and mobile chooser
screenshots were inspected. The initial WebKit font assertion needed to accept
its equivalent unquoted CSS font-family serialization; the actual font and
navigation assertions remain in place.

The full built-site browser run completed 436/438 tests successfully, including
all 130 Waggle gameplay/workshop/community cases. Two desktop WebKit BUZZHEX
opening-move assertions failed during the two-worker run. Both passed unchanged
against the same built artifact with CI's one-worker setting (2/2, 9.8 seconds).
No BUZZHEX implementation or assertions were changed. This is not a clean
438-case single-run result; no root cause beyond the observed recheck is claimed.
Logs: `.tmp/library-full-browser.log`, `.tmp/library-buzzhex-recheck.log` and
`.tmp/gate-*.log`.

## Current conversion batch — 2026-09-07

The user explicitly requested continued conversion, challenging puzzles, and
larger boards with mobile panning. This supersedes the earlier expansion hold.
Six new version-7 challenge definitions now follow the five teaching gardens.
All require eight rescues and use freely placed dancers, limited helper jobs,
shutters, rallies and spray protection. The original 30 levels and their exact
IDs/rules/progress remain available. No new schema or physics is introduced.

The main menu states both level counts. Completed gardens expose Next garden
beside the play controls, including when progress was saved in an earlier visit;
the last new garden links to the original campaign. Save failures remain errors
and do not prevent in-session advancement. The play camera separates pan mode
from placement, provides zoom/fit and hive/flowers/helper centering, and preserves
SVG coordinate conversion and deterministic simulation. Boards reach 32 × 20 in
this batch; the workshop retains its existing zoom/scroll controls.

Initial validation: all six all-bees routes and exact replay/builder round trips
pass. Missing setup actions and incorrect operator order fail as intended.
Focused camera browser checks passed in all five supported projects, including
a real Chromium touch-event drag. A mobile camera-height regression initially
clipped the release button; the height was corrected and its existing visibility,
rescue and fullscreen checks passed on recheck. Final local evidence is below.
Human difficulty/playability and physical-device review remain open.

Final local verification for this batch:

- Frozen dependency install, agent/route/deployment-lock checks, root and Functions
  lint, TypeScript, Functions build, emulator rules, production build/prerender,
  bundle limits and production dependency audit pass.
- Frontend coverage: 1,642 tests across 277 files; Functions coverage: 1,011 tests
  across 83 files; Firestore/Storage rules: 34 tests. Existing coverage floors hold.
- Initial full browser run: 430/433 passed. The iPhone release control was partly
  clipped; the mobile toolbar/counters and camera height were corrected.
- Final production-style Waggle recheck: 123/125 passed across the five browser
  projects, including all gameplay/camera cases. Two desktop WebKit community
  playtests again reached their existing animation deadline under concurrent
  execution. Both passed against the same built artifact with CI's one-worker
  setting (2/2); their assertions and timeouts were unchanged. Do not describe
  this as a clean 433-case single run. No root cause beyond the observed
  concurrency-sensitive timing is claimed.
- Camera evidence includes touch dragging in Chromium, pointer panning in all
  projects, helper recentering after zoom/scroll, precise placement, fit geometry,
  guide rescue, saved progression and fullscreen. Screenshots were inspected.
- Logs are in this worktree's ignored `.tmp/gate-*.log`, `.tmp/review-single.log`,
  with images under `test-results/campaign-final/` and earlier live-test outputs.
  Protected remote CI is still required for release; no production approval or
  deployment is implied by this local verification.


## Earlier implementation history

The entries below describe their original worktree and review state at the time;
they do not override the current conversion authorization above.

### Positive visual feedback and release-readiness discussion

The user says the game looks a lot better and asks whether to deploy or refine
first. The recommended next milestone is a beta of the current pixel-art slice
and workshop, following release verification; the industrial/urban mechanics,
scrolling maps and rebuilt campaign remain later work. This records positive
visual feedback, not full completion or deployment authorization.

Readiness inspection confirms the work remains uncommitted in `codex/waggle-way`.
The existing passing local checks are recorded below. A fresh `docker info`
check on 2026-09-07 still cannot connect to `dockerDesktopLinuxEngine`, so the
container/runtime gate needs a running Linux Docker engine or CI. The release
still needs a reviewed changeset, protected CI and the normal approved deployment
workflow. Physical-device/input and screen-reader evidence remains outstanding.

### Contextual workshop supply controls

The supply editor now presents fields for the currently selected tool and dance
without requiring Apply to refresh the controls. Dancers have a fixed one-cell
footprint, with no invalid size inputs or unrelated fan-strength field. Relative
version-7 dancers hide direction immediately; pointing dancers and legacy
version-6 guides retain it. Shelters show their footprint instead of unused
guidance/airflow settings. Applying a conversion from a wider tool to a dancer
normalizes its footprint to one cell through the existing validated editor path.

The form retains unapplied values while switching types and preserves saved
inactive fields. No schema or engine rule changes are introduced. Five new
component tests check contextual fields, draft retention, numeric editing,
validated conversion, removal, and legacy format behavior. The mixed-dance
browser authoring round trip now checks the reduced controls before saving,
testing and reopening the garden.

Desktop Chromium and phone-sized Chromium screenshots of the open supply panel
were inspected. Relative guides show four relevant fields and their departure
explanation without horizontal clipping. The panel still scrolls vertically for
multiple supplies; this is not physical-device or screen-reader acceptance.

Focused browser checks pass in all five projects; the full frontend suite passes
1,564 tests in 268 files. Root lint, frontend typecheck, production build and
bundle limits pass. Evidence is under `.tmp/contextual-supply-*`. The full browser
gate passes all 378 cases in one run with four workers (8.8 minutes), including
the previously corrected Wildflower case, legacy campaigns, community flows and
installable-app updates. The untouched backend, dependency and configuration
checks retain the passing evidence from the preceding gate refresh below.
This continues phases 1–2; player acceptance and campaign expansion remain gated
on review.

The final production rebuild restores all 32 prerendered shells after E2E, and
bundle limits pass. Formatting/diff checks pass, and the unchanged Vite live game
responds on port 3040. Final build evidence is in
`.tmp/contextual-supply-build-final.log` and `.tmp/contextual-supply-bundle-final.log`.

### User feedback: dry-ground guides and simpler departure

Post-feedback gate refresh (local, 2026-09-07): root/Functions lint, frontend
typecheck, production build and bundle limits pass. The frontend coverage suite
passes 1,559 tests in 267 files with four workers; all 161 game-core functions
are exercised. Functions build and coverage pass (1,008 tests in 83 files), as
do 34 Firestore/Storage rule tests and ten native Functions emulator integration
tests. The production dependency audit reports no known vulnerabilities. Local
production and game deployment contract validation also pass; nothing was deployed.

The first coverage run exposed a stale expected Function inventory; its exact
list now includes the already-declared `cleanupWaggleGardens` export. A subsequent
run passed its tests but found two unexercised dancer lifecycle callbacks. Added
real command-history/replay checks verify setup release refunds a supplied guide
and an authored dancer cannot be reassigned after its launched use is spent,
including version-6 compatibility. Final coverage passes without lowering floors.
Evidence is under `.tmp/redesign-gate-*`. The full browser run completed with
373 passes and five failures, all in the legacy pollen/theme case described
below. Physical input/accessibility checks and renewed player review remain open.

The broader browser run also exposed an obsolete legacy pollen/theme assertion
for the removed `wildflower-overhead-v2` image. Inspection found a related visual
regression: Wildflower used the same pixel ground as Sunny. Wildflower now uses
the existing dark grass/purple sprite palette with sparse overhead flower pixels.
The test checks that actual pattern, pollen delivery, exported theme/objective
data and the restored saved garden. All five live-browser retests pass in
`.tmp/redesign-theme-browser.log`; the phone-sized WebKit screenshot was inspected.
Focused lint and frontend typecheck pass after this correction. A fresh built
artifact also passes all five corrected cases in
`.tmp/redesign-theme-built-browser.log`. The unchanged 373 cases were not rerun;
these are a full-run result plus a focused correction, not a claimed single
378-pass run.
The final normal production build restores all 32 prerendered route shells after
E2E, and bundle limits pass (`.tmp/redesign-gate-build-final.log` and
`.tmp/redesign-gate-bundle-final.log`). Vite live development remains on port 3040.

The user called the practice slice better, reported that the second garden
could be solved without both guides, questioned separate helper headings and
requested no guide placement on water. This is improvement feedback, not full
acceptance. The active slice and New dancer garden now use explicit version 7.
Version-6 files remain readable and retain their original behavior; their editor
offers an explicit, undoable upgrade, rejecting it if guides still overlap water.

Version 7 prevents dancers/perches overlapping water during authoring, import,
placement or movement. Flying bees still cross ordinary water safely. Rejected
placement/movement preserves stock, population and the existing setup. The
second garden now places a pond below the flower approach to remove the reported
single-left-dancer shortcut. Both supplied dancers still have an all-bees route.

Left/right/reverse helpers now prototype following the last bee they guided
when released. Each actual signal updates the helper's departure direction in
deterministic simulation order. Before a first signal, the dance applies to its
arrival heading at assignment. Their separate arrow and heading controls are
removed; pointing dancers retain an editable signal arrow. The prototype and
fallback remain subject to user review. Preview/replay use the same state updates.
Practice sessions key off the exact definition so live content updates cannot
retain a run built from an older version of the garden.

Current evidence:

- `.tmp/dry-dancer-regression-tests.log`: 200 passing core regression tests in
  15 files, including legacy rules and campaign behavior.
- `.tmp/dry-dancer-final-tests.log`: 49 passing focused UI/rule tests in eight
  files. New checks cover atomic water rejection, builder overlap in either
  object order, upgrade rejection/undo, automatic departure/fallback, preview
  isolation and retained manual departure in version 6.
- The second garden is checked with each single supplied dancer at every valid
  setup cell; none reaches its target. All five full-hive solutions still pass
  through export/import and real command-history replay. The enumerated check
  is scoped placement evidence, not a proof covering every imaginable action.
- `.tmp/dry-dancer-browser.log`: 19 of 20 initial checks passed, including the
  updated workshop in all projects. Mobile WebKit exposed a real save race:
  immediate reload after the final visible rescue sometimes retained 5/6.
  Result publication now runs in a layout effect before that success frame paints.
- `.tmp/dry-dancer-final-browser.log`: all ten paired-turn/spray checks pass
  across the five browser/device projects after the save fix. They cover water
  rejection, absent manual relative-heading controls, direct helper rescue and
  a persisted 6/6 result after immediate reload. Revised screenshots were inspected.
- `.tmp/dry-dancer-final-types.log` and `.tmp/dry-dancer-final-lint.log`: frontend
  typecheck and focused game ESLint pass. `.tmp/dry-dancer-games-prepare.log`
  records shared package staging. No new community rules were enabled for publishing.

Before this feedback arrived, frozen install, agent configuration, route security,
Functions deployment-lock validation, frontend/Functions lint and typecheck passed
in the gate refresh. The agent validator initially could not spawn Git inside the
sandbox, then passed with the approved child-process access. That partial gate
predates the version-7 changes; the post-feedback verification above supersedes
that partial status. Physical input/accessibility checks and renewed user review
remain outstanding. Broad campaign expansion still waits.

### Five practice gardens and direct helper control — local iteration

Play gardens now opens a five-garden practice slice. Its compact numbered button
opens a game-styled selector; every lesson is available, changing gardens creates
a fresh attempt, and the shared fullscreen controller survives selection. Menu
selection restores focus to the new heading; opening navigation pauses play.
Completed results save through the existing exact-definition progress store,
preserving unrelated legacy records. Unreadable progress is preserved, shown as
an explicit error and never used to lock the practice gardens.

Shared builder commands and export validation author First Waggle, Two Little
Turns, Turn It Around, Bounce Back and Watch the Spray. The new routes teach
paired relative turns and helper release order, once-per-entry reversal, a safe
partition turnaround followed by a right dance, and a supplied cover protecting
a timed sprinkler crossing above ordinary water. The spray garden includes a
fixed fan. No engine version or legacy campaign level was changed by this work.

The real playthrough exposed a direct-selection defect: assigned dancer art had
only a painted outline while the visible bee ignored pointer events, so clicking
the bee's center failed to select it. Objects now have a transparent hit surface
covering their actual authored footprint. Dancers also now appear in the shared
drag-arrow handle allowlist. Relative dancers show a separate elbow/U-turn badge;
their straight draggable arrow remains the helper's own release heading.

Evidence:

- `.tmp/practice-final-tests.log`: 39 passing focused tests across teaching
  routes, title/menu, dancer rules and progress. All five teaching gardens have
  actual command-history all-bees solutions after export/import, with identical
  replay. A negative spray route verifies exposure losses without the cover.
- `.tmp/practice-preview-browser.log`: four new UI flows initially failed at
  direct helper selection. The hit-surface fix resolves that product defect.
- `.tmp/practice-final-browser.log`: 25 passing checks across five projects
  after the selection fix, including title/fullscreen and legacy drag controls.
- `.tmp/practice-handles-browser.log`: 15 passing final first-flight, paired-turn
  and spray flows across all five projects after adding dancer handles/badges.
  The paired-turn flow drags a relative helper's release arrow to north and back
  east, checks the heading controls and unchanged dance badge, rescues both
  helpers directly from the scene and confirms a saved 6/6 result after reload.
- `.tmp/practice-final-types.log` and `.tmp/practice-final-lint.log`: frontend
  typecheck and focused ESLint complete cleanly; changed source formatting passes.
- Screenshots were inspected on desktop and phone-sized browser projects;
  final evidence is retained under `.tmp/practice-handles-evidence/`. Physical
  touch, screen-reader review and human difficulty acceptance are still open.

The user has been asked to review cohesion, dance/helper controls and the spray
crossing. No response or acceptance is recorded yet. Broad campaign expansion
waits for that review. The full repository gate is now being refreshed; the
frozen install passed with Node 24.19.0, pnpm 11.21.0 and Java 21.0.12 available.
Further checks must be recorded individually before claiming gate completion.

### Compact dancer workshop — local iteration

Version-6 authoring now groups pieces into Guidance, Landscape and Machines,
with drag/drop and tap placement, on-board turns, a selected-object control and
contextual properties. Dancer properties include the dance type and release
heading; the supply panel supports separate finite allowances for mixed dances.
Files, supplies, puzzle rules, precise placement and community actions use
bounded disclosures instead of persistent inspectors. Legacy gardens retain
their original controls. Imports clear the active placement tool; returning to
a legacy garden cannot leave an unavailable dancer selected in the tray.

The compact toolbar uses Test, fullscreen, community, undo/redo and Save.
Community copy explicitly says dancer gardens can save/export locally but are
not supported for publishing. Existing owner/review actions remain available.
Portaled dialogs preserve their launching disclosure so closing them restores
focus to a visible button. No server publication support was expanded.

Fit garden now accounts for the workshop's 50dvh viewport and the scene border.
The first layout assertion exposed both the old 65dvh sizing mismatch and a
remaining two-pixel border overflow; the corrected sizing fits without clipping.
Zoom still creates a scrollable board. Desktop and phone screenshots were
inspected. The workshop is more compact, but small-screen authoring still scrolls
and larger-map camera work remains later scope; this is not player acceptance.

Evidence:

- `.tmp/workshop-verified-tests.log`: 64 passing focused editor, storage,
  level-validation, workshop-state and community-workshop tests across five files.
- `.tmp/workshop-verified-browser.log`: 19 of 20 checks passed across five
  browser/device projects, covering first-flight rescue, legacy game-window
  behavior, legacy builder persistence and the new dancer workshop. The remaining
  mobile WebKit test attempted a pointer drop above the visible viewport after
  changing zoom. Its gesture now explicitly brings both endpoints on screen.
- `.tmp/workshop-final-browser.log`: the corrected dancer-workshop flow passes
  all five projects. It authors a reverse dancer and mixed finite supplies,
  saves/exports the actual file, wins with all eight bees including the helper,
  returns without changing the draft, reloads the page and reopens identical
  content. It also checks fit/zoom and community-dialog focus restoration.
- `.tmp/workshop-final-types.log`, `.tmp/workshop-final-lint.log`: frontend
  typecheck and focused ESLint complete cleanly; changed source formatting passes.
- Final workshop screenshots are retained under `.tmp/workshop-final-evidence/`.

These are live-Vite iteration checks, not the full repository gate or physical
touch/screen-reader review. Next: relative-dance, bounce and spray teaching
variants, remaining visual/control polish, and the complete slice's user review
before broad campaign expansion. The lift-dancer suggestion is documented as
WW-21 for a later phase-3 prototype, not a new implemented dance.

### Compact play dock and bundled pixel type — local iteration

The version-6 play window now keeps its supply tray and helper action visible
while coordinate placement and detailed tool controls open in bounded panels.
Opening a disclosure pauses play. Done/Escape restore trigger focus; pointer
interaction outside closes the panel without losing draft/run settings. The
heading selector, object picker, numeric placement and single-step command remain
available. The ordinary toolbar now has back, play/pause, restart, speed and
fullscreen controls. Short mission/view/sound/bee disclosures replace the long
utility labels. Legacy controls keep their existing structure.

Mobile uses a compact two-row dock and the board's authored aspect ratio.
Desktop uses one dock row when it fits and lets the board shrink within the
available frame. The first browser check caught a desktop flex sizing error:
release existed but was below the visible frame. The fix removed the play area's
implicit minimum size, retaining a strict full-visibility assertion. Fullscreen
now explicitly clears the embedded minimum height, including a 360-pixel-tall
viewport. Larger scrolling worlds are still future work.

Pixelify Sans is now bundled locally for the game and workshop; the original
font, SIL OFL 1.1 license, author metadata and pinned source/hash are recorded in
[font provenance](../../packages/waggle-way/src/assets/fonts/README.md).
Browser checks load the real local font. Focus retains a visible outline using
the game's light-paper palette. Desktop and phone screenshots were inspected;
the font and dock are more coherent, but artwork, control icons and workshop
interaction still need polish and player review.

Evidence for this iteration:

- `.tmp/compact-dock-final-tests.log`: nine passing focused title, preference
  and ghost UI tests across three files.
- `.tmp/compact-dock-final-browser.log`: 15 passing first-flight, title/fullscreen
  and legacy game-window checks across five browser/device projects after the
  font change.
- `.tmp/compact-dock-layout-final.log`: ten passing first-flight/title checks
  after the final single-row desktop dock and focus color changes. First-flight
  checks cover full visibility of release, unchanged board bounds while a panel
  opens, Escape focus, pause/Done/resume, full-hive rescue and builder file test.
- `.tmp/compact-dock-short-screen.log`: five passing title/fullscreen checks
  including a 360-pixel-high frame and visible play/exit controls.
- `.tmp/compact-dock-lint-final.log` and `.tmp/compact-dock-types-final.log`:
  focused ESLint and frontend typecheck output; source checks complete cleanly.
- Final desktop/phone first-flight screenshots are retained separately under
  `.tmp/compact-dock-evidence/` so later live test runs do not overwrite them.

No production build or deployment was needed for these iterations. Full
repository verification and human acceptance remain outstanding. Next: complete
the workshop's compact interactions and real create/save/reopen checks, then
finish relative-dance and spray teaching variants before presenting the slice.

### Dancer contact follow-up — local iteration

Version 6 now detects outside-to-inside dance-field contacts along an accepted
flight segment. This fixes missed turns when both tick endpoints lie outside a
field, including a wind-driven grazing crossing. Entries resolve in travel order
with stable closest-guide/ID selection and the existing switching margin; their
turn affects the following tick. Rejected movement into a solid cannot trigger
signals along the rejected segment. Versions 1–5 retain their prior sampling.

`src/test/waggleWayDanceContacts.test.ts` adds 11 focused cases for swept contact,
near misses, simultaneous entries, overlap hysteresis, wall/corner escape inside
a pointing field, changed arrows during a visit, preview state isolation/parity,
and a real relative-dance command history replay. Controlled contact fixtures
are separate from that replay evidence. An initial test expected visit memory
after its bee had already left the rearm margin; its observation tick was
corrected to inspect the intended in-field state.

Evidence: `.tmp/dance-contacts-tests.log` records 92 passing tests across five
files, including legacy engine/campaign/replay checks. Focused ESLint and full
frontend typechecking completed cleanly (`.tmp/dance-contacts-lint.log` and
`.tmp/dance-contacts-types.log`), using direct Node entry points after the local
pnpm ESLint shim failed to resolve. `pnpm run games:prepare` refreshed canonical
rule staging. `.tmp/dance-contacts-browser.log` records five passing live Vite
desktop/mobile Chromium, Firefox and WebKit first-flight flows in 33.3 seconds:
drag placement, six-bee rescue, file round-trip and builder test/return. No website
production build or deployment was performed for this iteration.

At that checkpoint the mobile screenshot showed too much space devoted to
controls and long contextual rows; the compact play-dock follow-up above addresses
that layout. Workshop layout, relative-dance teaching variants,
spray puzzle review, complete authoring/save/reopen, and full repository gates
remain open. These contact checks do not constitute human slice acceptance or
completion of the redesign phases.

### Pixel renderer work in progress

#### Version-6 dancer slice — current local iteration

Play gardens now opens an independent builder-authored `pixel-01` First Waggle
slice from `src/content/redesign.ts`; Original gardens retains the thirty legacy
puzzles and their existing identities. The slice supplies one pointing dancer,
safe ordinary water and a solid turnaround obstacle. Its complete six-bee
solution, including helper release, reproduces through the shared replay engine.

Version 6 supports one-cell `dancer` pieces and per-type stock (`point`, `left`,
`right`, `reverse`). Placement atomically reserves an eligible real bee and one
use. Setup movement relocates its assigned bee; setup release/recovery refunds
the use. After launch, release sends the helper along its authored heading and
keeps the use spent. Distant in-run assignment and occupied in-run movement are
rejected. Ordinary water is flyable and permits overlapping hovering pieces only
under version 6. Versions 1–5 retain their prior rules and serialization.

Relative dances turn the incoming desired heading once per field entry, with a
quarter-cell rearm margin. Tests cover lingering and re-entry; the contact
follow-up above adds swept-boundary, competing-field and collision checks.
The rules still need teaching variants and human review. The current solid response remains a 180-degree
turnaround, not a new angled-reflection model.

The workshop has an explicit New dancer garden action and dancer stock/type
editing. Default legacy New garden and library helpers remain at version 5;
an intentional legacy-to-6 migration UX is still pending. Imported version-6
files can be tested and exported. Community submission of version-6 gardens is
disabled with an explanation; the server proof contract remains capped at 5.
New rules must not be enabled for publication without matching server evidence.

Evidence: `.tmp/dancer-tests-final.log` records 105 passing focused tests across
six files, including the real first-flight solution. `.tmp/dancer-types-final.log`
and `.tmp/dancer-lint-final.log` completed cleanly for that source checkpoint.
The first browser run found a test-label mismatch (Guides versus Helpers), not
a failed placement. After correction, `.tmp/dancer-browser-recheck.log` records
five passing desktop/mobile Chromium, Firefox and WebKit flows for drag placement,
full-hive rescue, exact file round-trip and builder test/return. Screenshots were
inspected and prompted further dock-layout refinement. These are focused iteration
checks; full repository gates, complete authoring/save/reload flows, relative-dance
teaching variants, revised spray puzzles and human acceptance remain unfinished.

The title screen is now implemented with original pixel lettering, Play gardens,
Workshop/Arcade links and shared fullscreen that persists into gameplay. Focus
moves into the level on entry. `.tmp/pixel-title-tests.log` records six passing
tests, including two title-to-play integration tests; typechecking and focused
lint completed cleanly for that source pass. `.tmp/pixel-title-live.log` records
desktop/phone title entry, full-hive rescue, menus, fullscreen and builder checks.
Screenshots of the title were visually inspected at both sizes.

`pnpm run test:waggle:live` now runs local play/workshop browser flows directly
against Vite without building or overwriting `dist`. It excludes authenticated
community/PWA suites. `.tmp/pixel-title-browser.log` records 10 passing title/
fullscreen checks across all five ordinary browser/device projects in 20.4 s.
See [development workflow](DEVELOPMENT.md). Full code-handoff verification and
the finished redesigned slice remain pending; these are iteration checks.

Latest planning addition: the user requested free-grid, limited-supply dancers,
90-degree/reverse dance types and selected obstacle bounce. Those new rules
are documented in [game design](GAME_DESIGN.md#temporary-guides) and phase 2;
they are not implemented by the title/art changes.

The first art pass now replaces the board's painted backgrounds and smooth object
art with original 16-pixel sprites and procedural pixel ground in `ui/PixelArt.tsx`.
The palette and board share sprites; paths are grouped by color rather than
creating one DOM node per pixel. Game-scoped styling adds square frames and a
consistent palette. This is not the finished title/menu/mobile redesign; typography,
new level content and changed hazard rules remain pending. Legacy physics are
unchanged. Existing bitmap sources remain preserved.

Focused evidence: `.tmp/pixel-focused.log` records 73 passing tests in six files;
`.tmp/pixel-lint.log` and `.tmp/pixel-types.log` completed cleanly after removing
an unused import. `.tmp/pixel-live-check.log` records live Vite Chromium checks
at 1280×900 and 390×844: all six bees rescued, menu Escape/focus restoration,
fullscreen fallback entry/exit, builder visibility and no document overflow or
page errors. Screenshots are under `.tmp/pixel-*.png`. Full milestone verification
is still pending; these focused results are not a completed code handoff.

The user additionally requested eventual larger scrolling levels, especially
on mobile. WW-19 and redesign phases 3–4 now track camera and content work;
see [level camera design](LEVEL_DESIGN.md#later-large-maps-and-scrolling-camera).

A new active implementation goal now tracks the
[five-phase redesign series](REDESIGN_GOALS.md), including the user-endorsed
industrial/urban progression and honey-recovery factory arc. All five phases
start pending; this planning update does not claim redesign code is complete.

- **Agreed, not implemented:** [pixel-art redesign](PIXEL_ART_PIVOT.md), matching
  standalone game interface, direct grid controls, flyable ordinary water under
  new rules, and understandable spray/industrial hazards. Review one complete
  level and workshop before expanding the redesign. The old art is not accepted.
- **Development loop running at time of check:** Vite on port 3040 serves source
  with its live-update client. A headless Chromium startup check found one game
  window and no page errors. No production build was needed. Restart instructions
  and iteration/final-gate boundaries are in [development](DEVELOPMENT.md).
- **Saved before the pause:** public remix loading/confirmation, admin/coach
  candidate play/review, exact-version report removal and separate resolution,
  plus the bounded `cleanupWaggleGardens` schedule and deployment declaration.
  The new UI still uses the old visual direction. These are local code changes,
  not deployed or fully accepted community features.
- **Recorded focused evidence:** `.tmp/community-review-focused.log` has 24 tests
  in 3 files passing; `.tmp/community-review-browser.log` has 15 browser checks
  passing; `.tmp/community-review-functions.log` records the Functions build
  and 18 index tests passing. These logs were rechecked for this status update.
- **Still open:** final full gate for those saved additions, moderation playtest
  screenshot review, scheduler deployment-contract/operational review, and human
  game/builder acceptance. Remix parent context currently does not survive a
  local draft export/reload; do not claim the remix lifecycle fully complete.

Earlier results below are historical evidence for their named revisions; they
do not validate the planned redesign or replace unfinished final checks.

## Canonical workspace

Implementation now lives in the isolated `codex/waggle-way` worktree at
`scratch/waggle-way`, based on `origin/master` commit `21c7c2bb`. This follows
[Arcade workspace architecture](../GAME_ARCHITECTURE.md). Earlier prototype files
in the parent checkout are preserved but are no longer the working source.

- `packages/waggle-way/src/core/`: pure engine, schema, editor, replay and local
  persistence adapters.
- `packages/waggle-way/src/ui/`: game scene, controls, campaign and builder UI.
- `packages/waggle-way/src/content/`: original builder-authored puzzles and
  recorded solutions.
- `src/app/waggle-way/`: thin play/builder routes and SEO. Arcade discovery lives
  in the website navigation registry.
- Domain/UI tests: `src/test/waggleWay*.test.ts` and
  `src/test/WaggleWayExperience.test.tsx`; browser flows: `e2e/waggle-way.spec.ts`.

The private package uses shared UI/fullscreen exports and receives navigation
and its authenticated community transport from the website. The
pure engine has no React, DOM, authentication or wall-clock dependency. Local play
does not require the server verifier. M6 stages canonical rules into Functions;
the local game service now mounts community publication, discovery and moderation
routes. Guest browsing/play/reporting, publishing, moderator UI, remix authoring
and cleanup schedule wiring exist locally. Their latest verification limitations
are recorded above; the schedule is not deployed.

## Implemented behavior

Thirty distinct puzzles cover Sunny Garden, Breezy Meadow, Glasshouse, Rainy Garden and Wildflower Valley, with hints,
per-garden selection, exact-content progress, best rescues, skips and helper
rescue. Version 3 adds switch/gate
links, safe deferred gate closure, rally hold/release, explicit waiting counts,
shared helper jobs, and builder controls with protected link deletion.
Version 4 adds fixed sprinklers, bounded dry/warning/rain cycles, downward rain
occlusion, a textual forecast, and losses for exposed flying/waiting/helper bees.

Play supports pause/resume, fast-forward, single ticks, restart, bee/state
inspection, cancelable worker route previews, optional sound (off initially),
persisted reduced-motion preferences, system motion settings and fullscreen.

The local workshop supports hive, flowers, perches, fans, branches, water,
shelter leaves, switches, gates, rallies, sprinklers and pollen; numeric and pointer placement/movement, arrow/shape rotation,
duplication, deletion, undo/redo, zoom, and isolated test/return. Version 2 adds
bounded perch/fan/shelter supplies. Players place and recover supplied tools;
occupied guides cannot be recovered. Supply counts and peak usage are visible.

Draft storage holds at most 20 levels, with strict bounded JSON import/export,
visible storage errors and recovery export. Legacy versions 1–4
preserve canonical serialization and progress compatibility. An explicit upgrade
to version 5 preserves existing inventory and can be undone; unsupported versions
preserve source content.

## Rules and evidence

The first five puzzles retain schema/rules version 1. Puzzles 6–12 use version
2; Glasshouse uses version 3, Rainy Garden version 4 and Wildflower Valley version 5. Positions use 1,000 integer units per cell at 30 ticks/second. Desired speed is
60 units/tick; fan force is 35 units/tick per strength, capped at 180 combined.
Closest guide wins with stable-ID ties and quarter-cell switching hysteresis.
Branches block wind and reverse flight at contact. Leaves block wind but permit
flight. Water/edges lose bees, flowers rescue them, and helpers count toward the
same conserved population. Authored object rectangles cannot overlap.

Thirty-six recorded solutions (including alternate routes for puzzles 5, 23, 25, 26, 28 and 30) rescue
all six bees in every puzzle. Each reproduces the exact final state through
bounded command replay. New puzzles 6–30 fail with an unassisted hive release,
so their tools and hazards have consequences. All use shared editor/export
commands and have workshop round-trip coverage.

Replay validation binds exact level content and rules version, with at most
54,000 ticks and 10,000 actions. This is a local verifier, not public completion
attestation. The ghost UI uses the same replay engine.

## Ghost comparison and recovery assessment (2026-09-06)

Restart retains the previous started attempt in memory for the current garden.
An optional comparison shows dashed G outlines and separate textual counts, using
exact rules/content identity. Pause to scrub its timeline without changing the
live hive; resuming/stepping returns to the live clock. The end of a recording is
explicit, and leaving the garden clears it. No ghost persistence/upload is claimed.

The shared replay engine now supports incremental and backward seeking. Worker
requests coalesce, discard stale frames, and compute at most 120 ticks per chunk
so a new timeline target can replace unfinished work. Hiding comparison or leaving
terminates the worker. Engine, inventories, pollen, scores and sound remain
independent of ghost state. See [replay and recovery](REPLAY_AND_RECOVERY.md) for
the full contract and the assessment deferring live checkpoints/rewind.

The initial frontend run passed 1,459 tests / 255 files, core 99.69% lines / 100%
functions, with both new worker/hook modules at 100% statements, branches,
functions and lines. Five browser/device configurations passed the failed-attempt
review and new-hive rescue flow. Functions lint/build, 894 tests / 74 files,
33 emulator rules tests, frozen install, validators, root lint/TypeScript and audit
passed. The full site browser run passed all 318 checks in 5.9 minutes. After adding
120-tick seek chunks, the final ghost flow passed again in all five browser/device
projects (5 checks, 1.1 minutes). The final frontend run again passed 1,459 tests / 255 files, including the
chunked-seek tests and 100% function coverage for both new worker/hook modules.
Production build passed (32 prerendered route shells) and all bundle budgets
passed. Nothing was deployed. Human ghost readability and screen-reader acceptance remain open.

## Wildflower Valley implementation

Version 5 adds fixed pollen tokens, carried/delivered state and five allowlisted
visual themes. Lost carriers return their tokens to the original location;
waiting and assigned helpers retain theirs. Delivery, peak concurrent tools and
all-bees results are independent optional achievements stored only for successful
attempts against exact level content. Rescue and explicit skip still unlock the
next puzzle. Imports retain versions 1–4 until an explicit, undoable upgrade.

Six builder-authored puzzles and ten recorded routes finish the 30-level content
set. Every advertised pollen/tool goal has an all-bees solution with exact replay
equality; all six puzzles fail an unassisted release. A regression check protects
runtime placement/movement in levels with zero-tool goals: geometry validation
must not interpret deployed objects as a new authored supply budget.

Full frontend coverage passed 1,455 tests / 254 files, with game core 99.69% lines
and 100% functions. Functions lint/build and 894 tests / 74 files, 33 emulator
rules tests, frozen install, validators, root lint/TypeScript and audit passed.
The full browser suite passed 312/313 checks, including all 55 Waggle Way checks.
One unchanged BUZZLE Word Help test timed out on desktop WebKit waiting to click
a preview button. A fresh focused run passed all 15 checks: that unchanged Word
Help test plus pollen authoring/delivery and all 30 campaign workshop round-trips
on five browser/device projects. This run includes the final per-tick pollen
lookup optimization. Screenshot review then corrected stretched art on wide
rally/sprinkler footprints; all 30 campaign workshop round-trips passed again on
five browser/device projects (5 tests, 56.6 seconds), with updated finale captures.
Final production build passed with 32 prerendered route shells; every bundle
budget passed. Final frontend lint and TypeScript passed after the art correction.
No production deployment, rules/data mutation or secret change was performed.
Human acceptance of the art, controls, difficulty and complete campaign is open;
At this checkpoint, M6 community workflows were unimplemented. M7 implementation is
recorded in the ghost-comparison section above.

## Overhead art and direct manipulation refresh

Player feedback moved this work ahead of levels 25–30. The landscape backgrounds
were rejected and removed from the package. Five overhead ground variants now
have PNG masters and WebP copies; all five campaign gardens load their own art, and version-5 workshop levels can
select any of the five built-in themes.

All twelve SVG piece types and the bees were redrawn from above. The palette and
supply tray use matching piece art. Direction arrows support pointer dragging,
placed objects show movement during dragging, and both builder pieces and player
supplies can be dragged onto the garden. Tap-to-place, keyboard direction buttons,
precise coordinate forms, undo, import/export and validation remain available.

The game/workshop routes now use an immersive shell with an Arcade exit, skip
navigation and route announcements. Canvas and a compact action dock replace the
permanent sidebar; detailed properties and campaign selection use centered dialogs.
The game pauses when opening the campaign chooser or beginning a drag.

Verification on Node 24.19.0 / pnpm 11.21.0 / Java 21:

- Frozen install, agent/route/deploy-lock validators, frontend lint and TypeScript passed.
- Frontend coverage: 1,439 tests in 253 files; game core 99.66% lines / 100% functions.
- Functions lint/build and 894 tests in 74 files passed; 33 rules tests passed;
  production audit found no known vulnerabilities.
- The full browser run passed 306 of 308 checks and exposed native tray dragging
  failing in desktop/mobile WebKit. Replacing native dragging with pointer capture
  fixed it. All 50 Waggle Way checks then passed across five browser/device projects
  in 3.2 minutes, including the two previously failing cases, movement preview,
  undo, keyboard turning, campaign progression, file round-trips and rescue flows.
  Unrelated browser flows were not rerun after that isolated fix.
- Desktop/mobile screenshots were inspected, and an actual fan drag from the tray
  was manually verified in the in-app preview. Workshop letterboxing was removed.
- Final production build passed (32 prerendered route shells); every bundle budget passed.

Player acceptance remains open. See ART_DIRECTION.md for camera constraints,
asset paths and the complete built-in generation prompts. This is a UI/art
revision of the existing 24-level game, not completion of M5–M7 or deployment.

## Rainy Garden verification (before UI refresh)

The focused run passed 151 tests across 11 files: 99.66% core line coverage and
100% function coverage. The coverage artifact explicitly includes `weather.ts`
with all 26 statements and six functions exercised; fully covered files are
omitted from the abbreviated console table. New checks cover exact phase
boundaries, offsets, strict cycle validation, retained versions 1–3, partial
canopies, nearest rain blockers, open/closed gates, exposed operators and waiting
bees, swept flight exposure, replay equality and preview behavior.

The new workshop flow passed on desktop and touch Chromium: invalid range
rejection, cycle editing, canopy placement, paused and single-step forecast,
all eight bees rescued, and test/return preservation. The mobile fullscreen
screenshot shows the exposed rain ending at the canopy. Root TypeScript/lint,
frozen install, agent/security/deploy-lock validators, Functions lint/build/894
tests, 33 rules tests and the dependency audit passed. Full frontend coverage
passed 1,439 tests / 253 files with 99.66% core lines and 100% functions. The full
browser suite passed 303 tests across six projects in 6.8 minutes, including all
24 workshop round-trips and the new timing/canopy flow. Final production build (32 route shells) and bundle checks passed. These results do not establish
that the complete 30-level goal or manual acceptance is finished.

## Glasshouse verification (historical 18-level checkpoint)

Version-3 gate/rally/link tests and all 19 recorded solutions across 18 puzzles
passed. Results at that checkpoint in the canonical worktree (Node 24.19.0, pnpm 11.21.0,
Java 21):

| Check | Observed result |
| --- | --- |
| Frozen install, agent/security/deploy-lock validators | Passed. |
| Root/Functions lint and TypeScript | Passed. |
| Focused domain/UI/package checks | 139 tests passed; core 99.63% lines and 100% functions. |
| Full frontend coverage | 1,427 tests / 252 files passed; core 99.63% lines and 100% functions. |
| Functions build and coverage | 894 tests / 74 files passed. |
| Firestore/Storage rules | 33 tests passed. |
| Production dependency audit | No known vulnerabilities reported. |
| Full browser suite | 298 tests passed across Chromium, mobile Chromium, mobile WebKit, Firefox, WebKit and PWA Chromium in 7.4 minutes. |
| Production build/prerender/bundle gate | Final rebuild passed after the SVG text-color correction; 32 route shells and all unchanged bundle budgets passed. |

Desktop/touch authoring checks passed for constructing a linked switch/gate/rally
puzzle, protecting linked deletion, releasing the gathered group, rescuing the
operator and restoring the gate through Undo. Mobile Chromium fullscreen
screenshots were reviewed after changing the new SVG labels to the existing
light text token. These observations do not establish human playtest acceptance.
The additional Docker and Hosting-emulator limitations recorded below remain open.

## Verification record

Before package migration, the 12-puzzle prototype passed 121 focused domain tests
with 99.58% line / 100% function coverage across six core modules, plus 14
Chromium desktop/touch browser checks. Typecheck, lint, repository validators,
Functions build/840 tests, 31 rules tests and the high-severity dependency audit
also passed in that earlier checkout. These results are historical; they do not
verify the migrated workspace. The earlier five-puzzle slice additionally passed
the full frontend/build/bundle/browser gate, as recorded in prior task history.

Historical 12-puzzle migrated-workspace results (before the Glasshouse expansion) (Node 24.19.0, pnpm 11.21.0, Java 21):

| Check | Observed result |
| --- | --- |
| Frozen install and package staging | Passed; lockfile adds only private workspace links. |
| Agent, route-security and Functions deploy-lock validators | Passed. |
| Root/Functions lint and TypeScript | Passed. |
| Focused domain/UI/package boundary checks | 127 tests passed. |
| Full frontend coverage | 1,413 tests / 251 files passed; Waggle core 99.58% lines, 100% functions. |
| Functions build and coverage | 894 tests / 74 files passed. |
| Firestore/Storage rules | 33 tests passed. |
| Functions authorization emulator | Five tests passed. |
| Production build/prerender/bundle gate | Passed; 32 route shells, all budgets unchanged. |
| Runtime, security observability, game/production deployment contracts | Passed. |
| Academy provenance/release/migration gate | Passed: 142 pinned hashes checked, 55 migration tests. |
| Production dependency audit | No known vulnerabilities reported. |
| Full browser suite | 293 tests passed across Chromium, mobile Chromium, mobile WebKit, Firefox, WebKit and PWA Chromium in 6.3 minutes. |
| Hosting emulator route check | Both Waggle pages returned 200 with expected content; unknown page/API routes returned 404. Full script failed the existing Pollen embedded-page header expectations (SAMEORIGIN and self frame-ancestors not observed). Header configuration was not changed. |

The initial browser run passed 281/283; both timeout cases passed unchanged in
isolation. A repeated cumulative timeout across 15 public routes was fixed by
splitting the smoke check into three five-route batches, preserving all assertions
and existing timeouts. The earlier superseded rerun was stopped explicitly. The
final full run passed, including the unmodified WebKit preferences interaction.

The standalone container check is unavailable locally: Docker is installed, but
its Linux engine pipe is absent. The container build/runtime gate remains for CI
or a host with a running Docker engine; no deployment readiness claim is made.
The Hosting emulator reported unavailable configuration and a denied test-project
secret lookup, but the unknown API request still returned the expected 404.
The separate Pollen header failure needs diagnosis against the emulator/runtime
before calling all current CI checks green. No production state was changed.

Desktop workshop and mobile Meadow screenshots were inspected after migration.
The gold hive remains distinct from the green Meadow accent. These observations
are not screen-reader or external playtest acceptance. No threshold was lowered.

Use `ARES_E2E_PORT` with a free port to start an owned Playwright server instead of
reusing another checkout. Port 3038 serves the older parent prototype and is not
evidence for this worktree. The migrated development preview is on port 3039; its
package Game module returned HTTP 200 and the browser panel was requested.

## Performance and manual acceptance

The pre-migration Node 24.19.0 Windows sample of a 128 x 72 garden with 512 objects
and 100 active bees measured 5.43 ms median / 7.90 ms p95 per tick (250 samples;
20.64 ms maximum). A 264-point wind overlay took 1.88 ms and a three-second preview
491.91 ms, motivating the worker. Reproduce with
`node scripts/profile-waggle-way.mjs`; do not generalize this host sample to all
layouts or devices. The migrated script also ran successfully: under concurrent
browser load it measured 12.45 ms median / 16.24 ms p95 per tick, 43.99 ms maximum,
and a 1,169.77 ms preview. A sample after browsers stopped (while the production
build ran) measured 13.15 / 16.83 ms, 38.00 ms maximum, and 1,237.98 ms preview.
These shared-host timings reinforce keeping previews off the UI thread; they
are not controlled reference-device measurements. Reference mobile rendering
and an isolated performance baseline remain open.

The Rainy Garden stress scenario (`node scripts/profile-waggle-way.mjs --rain`)
uses a 128 x 72 garden with 512 objects, including 204 active sprinklers and a
mixed fan/branch field below 100 simultaneously flying bees. On Node 24.19.0,
250 repeated tick samples measured 5.46 ms median, 7.82 ms p95 and 24.62 ms maximum;
264 wind samples took 18.27 ms and the three-second preview took 540.57 ms.
The full browser suite was running concurrently. This is a reproducible host
sample for one accepted-size layout, not a worst-case bound or reference-device
rendering measurement. It supports retaining worker-based previews.

Automated flows and prior screenshot review do not establish WCAG conformance.
External difficulty/readability playtests, screen-reader use, broader keyboard,
touch, zoom/contrast and recovery observations remain in [PLAYTEST.md](PLAYTEST.md).

## Single game window revision — 2026-09-06

The player requested a contained video-game window and fullscreen mode. Campaign
play now lives in one framed surface with a compact heading, playback HUD,
population strip, overhead garden, contextual tool dock, status line and utility
rail. Mission/hints, view/preview, sound/motion, forecast and bee inspection open
over the frame rather than extending the website. Opening a utility panel pauses
the run; Escape closes it and restores its summary focus, and clicking elsewhere
closes it. Pointer dragging, turning arrows and keyboard direction controls remain.

Fullscreen is owned by the campaign, so switching puzzles keeps the game expanded.
The visible toggle exits it; browsers that reject the native API retain a viewport
fallback. Existing dialogs remain available above the game. Narrow layouts use
labelled icon buttons and prioritize assigning/releasing the selected helper.
Small viewports scroll inside the frame instead of overlapping the HUD and dock.
The embedded site header retains Arcade and Workshop navigation.

M6 was interrupted by this UI priority. Its unmounted worker foundation is retained:
canonical schema/rules staging, bounded proof payloads and worker deadlines, exact
content binding, optional-goal witnesses, and validation tests. The compiled worker
was exercised against real canonical rules. There are no community endpoints,
published records or production changes from this foundation.

Verification completed in this dirty worktree on 2026-09-06:

- Frozen install; agent, route-security and deployment-lock validators; frontend
  and Functions lint; TypeScript; Functions build; audit and whitespace checks pass.
- Frontend coverage: 1,459 tests / 255 files pass. Functions coverage: 940 tests /
  78 files pass. New proof/worker adapters retain 100% statements and functions;
  the compiled-worker integration runs separately to avoid duplicate source maps.
- Firestore/Storage emulator rules: 33 tests pass. Production build prerenders
  32 route shells; every bundle budget passes.
- Full browser gate: 323 tests pass (8.0 minutes). After tightening the embedded
  frame width, all 10 fullscreen/window/drag flows pass across the five browser
  projects (51.6 seconds), followed by a fresh production build and bundle check.
- Desktop/phone screenshots were inspected. Native fullscreen retained state
  across a puzzle change in both Chromium and WebKit; fallback fullscreen,
  in-frame panels, focus restoration and drag interactions are covered in E2E.

Earlier verification attempts exposed and resolved a phone replay/footer overlap,
a missing icon dependency declaration, and a randomized BUZZLE test fixture that
could choose an unassigned blank before reaching its intended connection check.
An interrupted full browser run was restarted to obtain a terminal result. Local
logs are under `.tmp/window-*`; normal repository commands reproduce the gate.
The M6 follow-on contract is [COMMUNITY_PLAN.md](COMMUNITY_PLAN.md).
Player approval of visual cohesion, touch use and accessibility remains open.

## Community server implementation — 2026-09-06

The resumed implementation adds strict head/revision records, exact-proof-bound
publication, member/owner isolation, admin/coach review and removal, transactional
creator capacity limits, guest discovery, owner revision retrieval, and categorical
reporting. Published content stays available during candidate editing/rejection;
pending text and private ownership never enter public DTOs. All 30 campaign levels
and 36 canonical solutions are exercised by server proof tests.

Approved remixes remain independent after parent deletion. Every detail response
rechecks the parent's current visibility and generation. Reusing an expired
parent's identifier cannot restore attribution or revive an unapproved remix.
Reports are deduplicated by category and exact publication, without reporter
identities or counters. Removed/replaced content disappears from their DTOs.

`/api/waggle-way` is mounted in the existing game service before generic body
parsing. Real middleware-chain tests cover current/archived/unknown authorization,
App Check, quotas before parsing, 400/401/403/404/409/413/415/429/503 responses,
generic upstream errors and a complete submit/approve/report/remove/delete flow.
Hosting rewrites, route groups, the game-service validator and deployment health
contract were synchronized locally; runtime resources and secret grants are unchanged.

Bounded retirement removes expired tombstones and leftover content in resumable
transactions, plus expired reports/audit records. It has no public endpoint and
is not yet scheduled. Native Firestore tests exercise concurrent submissions,
capacity, authorization races, compound cursors, report deduplication and cleanup.
At this server checkpoint, the website still needed its injected community client,
proof capture/invalidation, publishing controls, browse/play/remix and moderator
interfaces. Guest UI progress is recorded below.

Current local evidence (`.tmp/community-resume-*`):

- Frozen install, agent/route-security/deployment-lock validators, runtime,
  security-observability and both deployment contracts pass.
- Frontend and Functions lint, frontend TypeScript and Functions build pass.
- Frontend coverage: 1,462 tests / 256 files. Functions coverage: 1,006 tests /
  83 files. The new HTTP router has 100% line/function coverage; all new server
  utilities meet their 85% line / 100% function ratchets. Test-only memory-store
  helpers are excluded from production coverage.
- Native Functions emulator: 10 tests / 3 files. Rules emulator: 34 tests /
  2 files, including direct denial of the private reports collection.
- Production build and unchanged bundle budgets pass; dependency audit reports
  no known vulnerabilities. The full browser gate passes: 323 tests in 6.9 minutes.
- The final packaging review added the five staged Waggle core inputs to the
  Docker context allowlist and its validator. Without those inputs, a clean
  container build could not run game preparation.
- Hosting emulator checks now pass, including both Waggle routes and Pollen's
  embedded security headers. The earlier header failure was reproduced in the
  installed Superstatic dependency: `glob-slash` used Windows path separators,
  which its glob matcher interpreted as escapes. A pinned development dependency
  patch uses POSIX separators, and a real static-server regression verifies both
  embedded and ordinary site headers. Production header rules were not weakened.
- The protected Academy checks pass (142 remote source hashes, release candidate
  validation and 55 migration tests). A full container build remains unavailable:
  `docker info` confirms the `dockerDesktopLinuxEngine` pipe is absent.
- The reproducible verifier profile is recorded in COMMUNITY_PLAN.md. A winning
  blank garden verified in 133 ms; dense accepted-size stress inputs stopped at
  the 5-second worker deadline, at up to 102.2 MiB sampled whole-process RSS.
  BUZZELLO rule computations continued. This is a host measurement, not a
  production fractional-CPU, HTTP-load or reference-mobile acceptance claim.

The earlier root coverage run interrupted by pause is superseded by the completed
run above. Hosting was first attempted against the E2E build, which intentionally
lacks prerendered route shells; the passing check uses the restored production
build. A sandbox process-launch restriction was resolved with approved local test
execution. No production state was changed; M6 is not complete.

## Community game interface — 2026-09-06

The package now owns a concrete community HTTP client, while
`src/lib/waggleCommunity.ts` injects the shared authenticated/App Check transport.
Every server operation has a transport method with encoded paths, a request abort
signal, uncached reads, explicit failures and no automatic mutation retries. Returned
collections/revisions are validated before use, including playable level data.
An uncertain mutation asks the player to reload rather than claiming success.
The client enforces a 20-second deadline across transport startup and response
parsing, and aborts the HTTP signal when it expires. The host still owns token
acquisition, but a delayed token cannot leave the workshop waiting indefinitely.

An in-game Community gardens button opens a shared accessible dialog. Guests can
filter and page through approved cards, inspect a top-down garden preview, follow
currently available parent attribution, play the fetched garden in the same game
frame, and return to the story. Difficulty and length are labelled creator
estimates. Community results do not change campaign unlocks or saved story scores.
Opening the collection pauses play. Categorical reports have loading, failure and
confirmed intake states; empty catalogs are distinct from failed requests.

Focus returns to the selected card, the game heading or the originating button
as appropriate. Browser testing exposed Escape closing both a dialog and viewport
fullscreen; the shared fullscreen hook now gives the active dialog first use of
Escape. The preview retains its level aspect ratio without flat side bars.

Focused transport/component/fullscreen tests pass (36 tests); the complete root
suite passes 1,491 tests in 259 files. Functions remain at 1,006 tests in 83 files,
and 34 Firestore/Storage rule tests pass. The full browser gate passes all 333
tests, including all ten new community browser cases, with two workers. The
community client has 100% statement/function coverage (121 statements / 36
functions). M6 remains open.

The final verification also corrected a dependency-test assumption: the
`stream-json` security regression now resolves Firebase CLI's actual dependency
instead of relying on a transitive root hoist. Its existing depth-limit assertions
are preserved and pass after a frozen install. Earlier runs exposed an unrelated
Academy import timeout and a transient 320-pixel WebKit overflow; the unchanged
overflow case passed three focused repetitions and the final full browser gate.
Coverage used four workers for the final passing run; no timeouts, thresholds or
layout assertions were relaxed. Evidence is under `.tmp/community-ui-*`.

The checkpoint's frozen install, production audit, agent/route-security/deploy-lock
validators, root/Functions lint, TypeScript, Functions build, native Functions
emulator (10 tests), and runtime/security/deployment contracts pass. Academy
remote provenance, release validation and 55 migration tests also pass. The final
production build restores all 32 prerendered route shells after E2E; bundle budgets
and Hosting-emulator route/header checks pass. Docker's Linux engine is still
unavailable, so container resource validation remains open. No deployment,
production data change or secret change was performed.

## Community workshop and fullscreen — 2026-09-06

The builder now shares the framed game presentation and fullscreen controller
with test flights. Returning to editing retains fullscreen and restores focus to
the Test garden button. Sharing and owner status appear in a themed dialog.

Successful tests retain at most three complementary replay witnesses for rescue,
pollen and tool objectives. Every actual level edit, Undo/Redo, import and load
invalidates the current evidence. Flight bounds fail explicitly while preserving
the draft and earlier recordings. These are session recordings; server replay
verification remains authoritative.

Current team accounts can submit a tested garden with an explicitly entered
public nickname. The submission's ID/version is held separately from local level
files and bound to the current account. Undo preserves the editing origin while
updating its optimistic version; imports cannot claim publication ownership.
Account changes clear private bindings and panels. Uncertain submissions retain
their generated ID and require a server check before retrying. No mutation is
automatically retried.

My submissions exposes status/reasons, a confirmed revision load with an export
option, and confirmed community deletion. Loading a revision requires a fresh
test before resubmission. Deleting the community copy keeps the local draft and
explains that approved remixes survive. Owner-list errors remain explicit.

Focused model/client/component tests and the root coverage suite pass: 1,506
tests in 261 files. The new workshop state utility has 100% line/function coverage.
Moderator screens, remix authoring and operational scheduling remain
unfinished; this is not an M6 completion claim.

The full browser run passed 337 cases; its 30-level round-trip case hit the
45-second limit on mobile WebKit at the last garden with four workers. The
unchanged assertions passed with two workers in the final ten-case run, which
also checks workshop fullscreen, submission, focus restoration and unclipped
status text in all five browser configurations. Desktop (1280×900) and mobile
(390×844) screenshot review confirmed the fixed status layout and no page
overflow. No timeout or coverage threshold was relaxed. Evidence is under
`.tmp/community-workshop-*` and `.tmp/workshop-*`.

Frozen installation, root/Functions lint, TypeScript, runtime/security/deployment
contracts, the Functions build and 1,006 Functions tests pass. The rule emulator
passes 34 tests and the native Functions emulator passes ten. Academy remote
provenance/release checks and 55 migration tests pass; the production dependency
audit reports no known vulnerabilities. The final production build restores all
32 prerendered route shells after browser testing; bundle budgets and Hosting
route/header checks pass. The last Docker check found no Linux engine, so
container resource validation remains open. Nothing has been deployed.

## Remaining work

M4 and M5 manual acceptance remain open. All 30 puzzles, pollen, builder support,
teaching content and recorded solutions are implemented. Review difficulty and
the refreshed art/controls with the player before calling the local release accepted.

M6 needs moderation interfaces and remix authoring, scheduled cleanup ownership,
browser acceptance and
runtime resource validation. Server verification, revision lifecycle, moderation,
discovery and reporting/removal are implemented locally and tested. Current
authorized team members may submit with admin/coach review. Approved remixes
survive parent deletion, with the deleted parent content/link removed and only
private moderation lineage retained. Server enforcement and privacy tests cover
these decisions; end-to-end browser and operational acceptance remain open.

M7 ghost attempts and checkpoint/rewind evaluation are implemented; human replay
readability review remains open. See REPLAY_AND_RECOVERY.md.
The full goal is not complete; local verification is not deployment authorization.
