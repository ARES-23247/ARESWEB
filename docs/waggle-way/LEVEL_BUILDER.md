# Waggle Way level builder specification

Status: target specification, 2026-09-05. Core local editing, test mode, saved
drafts, campaign progress, JSON import/export, shelter leaves, and player tool
supplies, switches, linked gates, rallies, timed sprinklers, pollen and themes now
exist. Session proof capture, team submission and owner status/revision/deletion
screens are implemented locally. Moderator screens and remix authoring are now
saved locally with focused checks; final verification remains unfinished.
See [implementation progress](IMPLEMENTATION_PROGRESS.md).

The 2026-09-07 [pixel-art redesign](PIXEL_ART_PIVOT.md) also applies to the whole
workshop: compact pixel-art tool tray, grid drag/drop, on-board direction handles,
contextual dialogs, one game window and fullscreen. Keep keyboard/tap equivalents,
undo and safe draft recovery. The new hazard palette is planned, not implemented;
expose only validated mechanics with explicit rules versions and clear footprints.

Version 3 adds switches, gates and rally flowers while preserving exact legacy
version-1/version-2 files. New gardens use version 5; importing never upgrades a
file automatically. The explicit upgrade preserves pieces/supplies and can be
undone. Gates require a valid switch ID. The builder selects an existing switch
when placing a gate and exposes relinking; deletion identifies dependent gates
and rejects until those gates are relinked or deleted. No dangling link can be
saved or tested. The helper limit counts both dancers and switch operators.

Version 4 adds a fixed sprinkler nozzle with a downward rain range and a strict
cycle: `dryTicks` (1–1800), `warningTicks` (1–300), `wetTicks` (1–1800), and
`offsetTicks` (0 through cycle length minus one). Range is 1–16 cells and must end
inside the garden. Timing fields are rejected on other objects and in older
formats. The properties form exposes every field, explains 30 ticks per second,
and validates before replacing the draft. Test mode and Undo preserve the authored
cycle. Palette availability follows the file version; upgrading remains explicit.

Version 5 adds fixed `pollen` pieces, a `theme` enum (`sunny`, `meadow`,
`glasshouse`, `rainy`, `wildflower`) and `objectives`: required integer `pollen`
from zero through the authored token count, plus optional integer `maxTools`
from zero through total authored supply. A tool goal requires nonempty supply.
No theme URLs or executable content are accepted. Change an objective before
removing tokens/supplies that it requires. Level rules, Undo, test/return, local
save and file export preserve these fields. Versions 1–4 reject version-5 fields
and pieces until the author explicitly upgrades.

## Authoring workflow

Local iteration status: Files and saved gardens now offers New dancer garden
alongside the legacy New garden action. The new action now creates version 7 with
two pointing-dancer uses; Player tool supply can configure its dance types and
counts. Import/export and test/return preserve supported versions. Version 6
offers an explicit, undoable Upgrade dancer rules action to version 7; a guide
over water must be moved before that upgrade can validate. Read/import never
silently upgrades a file. Publishing support remains unfinished. Dancer
gardens are explicitly local/file-share only until server verification is ready.

The supply editor shows settings for the selected tool immediately, before Apply:
dancers have a fixed one-cell footprint and no fan-strength setting, relative
version-7 dances have no heading selector, and shelters expose dimensions rather
than unused direction/range controls. Type changes preserve unapplied field values
when switching back; applying still validates the complete stock definition.
Converting a wider tool into a dancer uses the required one-cell footprint.
Legacy saved values for inactive fields and version-6 release headings remain intact.

New-rule requirement (2026-09-07): author the supply of freely placed dancing
bees by type, with no required perch locations. The play tray supports direct
grid placement of fixed-heading, left/right 90-degree and reverse dancers.
The builder exposes bounded per-type allowances, shared helper limits, influence
and pointing arrows, plus explicitly typed bounce obstacles. Version-7 relative
dancers learn their release direction from the last bee guided; hide the unused
heading controls. Reject dancer/perch overlap with water in either editing order.
Show connection/
influence previews and reject invalid placement without consuming stock or bees.
Preserve version-6 manual release headings when editing old files. Persist
these fields only in an explicit new schema/rules version; old perches and
legacy tool inventories retain exact import/replay behavior. See
[guide rules](GAME_DESIGN.md#temporary-guides) for resource-policy proposals.

Acceptance for this authoring revision: create a garden with a small mixed dance
supply, place a dancer away from any authored perch, and test both a relative turn
and a marked safe obstacle. Confirm that exhausted stock prevents placement,
invalid placement preserves the bee/use counts, and each helper can be released
and rescued. Save/reopen and export/import must preserve dance types, allowances,
pointing arrows, versioned helper-departure rules and obstacle behavior. Repeat with touch and keyboard controls;
authoring unlimited objects must not bypass the puzzle's test-mode inventory.

Create a blank garden, choose bounded dimensions, place the hive and destination,
draw terrain, add hazards and tools, configure puzzle rules, then test. Provide
explicit New, Save, Load, Import, Export, Test, and Return to editor controls.

Desktop and touch use a world-first view with a compact palette and contextual
properties dialog, avoiding persistent side menus. Dragging always has a
select-then-place alternative. Keyboard users can select an object from a list,
move it by grid increments, rotate it, and edit labeled properties.

Required editing operations: select, place, move, rotate, duplicate, delete,
snap to grid, undo, redo, pan, and zoom. Coalesce a drag into one undo operation.
Reject invalid placement with a reason and preserve the last valid state.
Deleting a referenced object identifies affected connections before completing
the edit; undo restores both object and connections.

## Later lift-dancer authoring

The [lift-dancer proposal](GAME_DESIGN.md#later-lift-dancer-proposal) is later
scope, not a version-6 palette capability. If retained after prototyping, expose
finite lift supply and explicit obstacle clearance in a new supported format.
Use distinct grid symbols for flyable scenery, lift-clearable barriers and
tall/covered blockers. Show the temporary flight route and intended landing
with the same simulation as play. Validate incompatible clearance/cover data,
preserve legacy files, and reject unknown dance types. Include create/test/return,
undo, save/reopen and replay checks for a crossing and its helper's rescue.

## Editing and playing are distinct

Later large-map support must share the game's panning/zoom coordinate conversion
and readable mobile scale. Keep pan gestures distinct from piece placement and
rotation, offer overview/recenter controls, and preserve viewport through Test
and Return. A camera-only move must not dirty the draft or enter its undo history.
See [large-map camera design](LEVEL_DESIGN.md#later-large-maps-and-scrolling-camera).
This extends the target specification; complete mobile camera support is pending.

Maintain an authored draft separately from a running simulation. Entering Test
creates a fresh run from that draft using its bee count, inventory, and rescue
target. Returning to the editor discards run state and restores the draft, tool
selection, and viewport. In-run fan adjustments do not rewrite the draft.

Campaign authors use this exact workflow and export the same format. No hidden
campaign-only objects or alternate physics. Puzzle-constrained testing and
unrestricted experimentation are clearly labeled; only constrained completion
is eligible for later publication verification.

## Proposed level contract

This table describes the full target contract. `packages/waggle-way/src/core/level.ts`
supports versions 1–6 locally. Version 1 retains the original six core objects and
canonical serialization. Version 2 adds shelter leaves and an explicit inventory.
Version 3 adds switch/gate connections and rally flowers; version 4 adds timed rain.
Version 5 implements built-in theme keys and optional pollen/tool objectives.
Version 6 adds free-grid dancers and safe ordinary water in the local prototype;
community verification remains capped at version 5.
Version subsequent schema/rules changes explicitly.

Version-2 inventories contain at most 20 named supply entries. Each defines an
allowlisted tool (perch, fan, shelter), count of 1–20, dimensions, direction,
influence range, and strength. Initial objects plus all supplied counts must fit
the 512-object limit. Placement consumes one from its entry; returning an
unoccupied supplied tool refunds it. Author-placed objects cannot be returned.
An occupied guide perch cannot move or return until its bee is released.
Peak concurrently deployed supply tools are tracked separately from guide jobs.

Importing a version-1 file does not upgrade or rewrite it. An explicit **Upgrade
garden format** action enables the current version 5, preserves all existing pieces and
properties, adds an empty inventory, and participates in undo/redo. Save/export
is still explicit. The original five campaign levels keep their version-1
content so existing exact-revision progress and replay remain compatible.

| Field group | Content |
| --- | --- |
| Version | Schema version and simulation rules version |
| Identity | Stable local level ID; bounded plain-text title and instructions |
| World | Grid dimensions, theme key from a built-in allowlist |
| Population | Hive object, total bees, release interval, release direction |
| Objectives | Rescue target and supported optional objective definitions |
| Inventory | Counts of player-placeable tools and assignable jobs |
| Objects | Stable unique IDs, allowlisted type, grid position, orientation, validated properties |
| Permissions | Whether a placed tool is fixed, adjustable, or player-movable |
| Connections | Later: typed source/target object references for switches |
| Determinism | Explicit seed if a later mechanic needs controlled randomness |

Runtime bees, selection, undo history, local progress, and publication evidence
are not part of the playable level payload. Save viewport/editor preferences
separately. Local metadata is never accepted as proof of public authorship.

Provisional limits: 256 KiB UTF-8 import size, a 128 by 72 cell world, 512 placed
objects, 100 bees, 80 title characters, and 500 instruction characters. These
are caps to validate and profile, not demonstrated performance capacities.
Campaigns should start far below them. Bound run duration and action history
separately for future server verification.

## Validation and persistence

- Check file size before reading/parsing; accept data-only JSON, not archives,
  scripts, URLs, uploaded images, or executable expressions.
- Validate version, nesting, arrays, finite numbers, bounds, supported fields,
  object IDs, references, object overlaps, and resource ranges.
- Require one hive and one destination initially; require the rescue target to
  be positive and no greater than the total bee population.
- Reject impossible start placement, overlapping hazards/destinations, and
  missing connection targets. Structural validity does not prove solvability.
- Unknown versions or object types produce an actionable error. Do not silently
  delete unknown data or replace a valid open draft after a failed import.
- Save drafts and campaign progress locally using a versioned persistence
  adapter. Show save status, quota/unavailable-storage errors, and export as a
  recovery option. Do not claim a save succeeded if the write failed.
- Preserve prior data during migrations; offer recovery/export if migration
  cannot complete. Validate data read from browser storage just like imports.

## Online publishing, later milestone

User-confirmed policy (2026-09-05): currently authorized team members can submit
levels; admins/coaches must review before public publication. Guest play and local
building remain available. Apply existing current-record role and archive checks;
do not introduce open public signup as part of this feature.

The creator must complete the exact level revision with its configured inventory,
rescue target, and supported rules version. Upload a bounded tick-stamped action
log; the server re-simulates it with the shared engine and verifies the outcome.
A client success flag, local hash, or screenshot is not verification.

Bind verification to the canonical level content hash, engine version, and
objective set. Gameplay edits require a new verified revision. Moderation applies
to displayed text too. Never label unsupported historical versions as currently
verified; migrate and reverify or expose an explicit unavailable state.

Publishing and moderation are separate gates: draft, pending review, published,
rejected, and removed. Only published, non-deleted revisions are discoverable.
Provide reports and an authorized review/removal workflow before public launch.
Define ownership, deletion, storage quotas, revision retention, and moderation
responsibility during M6 planning. No chat or public free-text profiles.

## Discovery and remixes

Browse published levels with bounded pagination and filters for supported
mechanics, creator-assigned difficulty, and estimated length. Label estimates as
such; do not invent ratings, popularity, or play counts. Show an honest empty
state when the catalog is empty and a distinct error if it cannot load.

A remix becomes a new draft with server-recorded lineage to its parent revision.
Retain permitted public attribution without exposing internal IDs. Remixes need
their own constrained completion and moderation. User-confirmed deletion policy:
already-approved remixes remain published when their parent is deleted; remove
the deleted parent's content and public link. Keep only private lineage needed
for moderation. Do not create new remixes of removed content. A moderation action
can still remove a derivative independently if it contains the same violation.

## Builder acceptance scenarios

1. Build the pond puzzle, undo/redo a move, test it, and return to the unchanged
   draft with the same viewport.
2. Save/reload and export/import it; canonical gameplay content remains identical.
3. Complete all essential editing actions using keyboard and using touch.
4. Import oversized, malformed, unsupported, and out-of-bounds files; explain the
   failure and preserve the open draft.
5. Force a storage failure; the draft remains editable and exportable.
6. Later: a forged completion, changed revision, unauthorized edit, or unpublished
   record cannot become a discoverable verified level.
