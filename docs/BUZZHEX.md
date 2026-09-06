# BUZZHEX in ARESWEB

BUZZHEX is playable at `/buzzhex`, alongside the existing `/buzzello` and
`/buzzle` games. Open Arcade > BUZZHEX from the site navigation.
This implementation is local two-player play on one device.

## Game and assets

- Fixed 11 x 11 rhombus: 121 flat-top hexagonal cells.
- White empty cells with black grid lines, matching the physical white-pocket
  board revision. Black/yellow tile faces and goal edges retain their colors.
- Exact black/yellow reversible Buzzello rosette faces in
  `public/images/games/buzzhex/`, supplied from the physical print project.
- Black connects A to K (q=0 to 10); Yellow connects 1 to 11 (r=0 to 10).
- Six shared-edge neighbors, corner edge membership, immediate path detection,
  and a visible winning chain. No captures, flips, passes, or scoring.
- Opening pie rule exchanges human color assignments and leaves the first
  black tile in place. The original opener plays Yellow after a swap.
- Undo replays the remaining legal actions, including swaps and wins.
- Player nicknames and action history save under `ares:buzzhex:v1` in browser
  localStorage. Restoring validates the bounded payload and replays legal
  actions; saved board/turn/winner claims are never trusted. Storage failures
  and invalid saves display an explicit notice while allowing fresh play.
- Keyboard: arrows follow two grid axes, Page Up/Down the third. Enter/Space
  places a tile; Home/End selects row ends. Occupied cells remain inspectable.
- Touch selects then requires a placement confirmation. Pointer cancellation,
  non-primary pointers, and drags do not place tiles. Zoom uses a scrollable
  board; Fit board shows all cells. The shared fullscreen control is reused.
- Rules and reset/name dialogs reuse the site's focus-managed dialog component.

## Code

- `packages/buzzhex/src/rules.ts`: pure game engine, board geometry, serialization.
- `packages/buzzhex/src/Game.tsx` and `buzzhex.css`: screen and input controls.
- `src/app/buzzhex/page.tsx`: website SEO and navigation wrapper.
- `src/test/buzzhex.test.ts`, `src/test/BuzzhexPage.test.tsx`: engine and UI tests.
- `e2e/buzzhex.spec.ts`: complete play/swap/save/undo/reset, keyboard/dialog/zoom,
  and winning-after-swap/drag-rejection browser flows.
- `src/App.tsx` and navigation: lazy route and Resources entry.
- `scripts/prerender-static-routes.mjs` and `firebase.json`: route metadata and
  static hosting rewrite. No production deployment has been performed.

## Run and verify

Use the project's Node 24 and pnpm 11 toolchain:

```powershell
pnpm dev
# Open http://localhost:3000/buzzhex
pnpm exec vitest run src/test/buzzhex.test.ts src/test/BuzzhexPage.test.tsx
pnpm exec playwright test e2e/buzzhex.spec.ts --workers=2
```

The complete repository gate is defined in AGENTS.md. Do not weaken its
coverage, security, lint, or bundle thresholds. Local browser progress is not
an offline app-install promise: loading the site still needs available assets.
Online multiplayer and computer opponents remain features of the existing
other games; BUZZHEX currently offers same-device human play.

## Prototype validation record (2026-09-05)

- Node 24.19.0 and pnpm 11.21.0; frozen-lockfile install passed.
- Agent configuration, route security, Functions lockfile validation, frontend
  and Functions lint, typecheck, Functions build, production build, and bundle
  budgets passed. Production output includes the BUZZHEX prerender shell.
- Frontend coverage run: 244 test files / 1,359 tests passed.
- Functions coverage run: 72 test files / 840 tests passed.
- Firebase emulator rules run: 31 tests passed.
- BUZZHEX focused unit/UI tests: 12 passed. Engine coverage independently
  measured 100% lines, statements, branches, and functions.
- Full browser regression: 274 passed on the first run; four instances of the
  new BUZZHEX victory/undo assertion failed due to a Windows text-encoding
  mistake in the assertion. Fixed that assertion and reran all 15 BUZZHEX
  browser cases across the five desktop/mobile projects: all passed, including
  those four cases. No unrelated browser regression failures were reported.
- Production dependency audit met the high-severity gate; it reported two
  moderate findings, outside this game change.
- Inspected desktop/mobile screenshots and corrected Fit board clipping.

Detailed command logs are under ignored `scratch/buzzhex-*.log`. The game is
implemented locally; deployment requires the existing project's approval flow.

## White-board revision validation (2026-09-05)

Empty cells now use pure white (#FFFFFF), with the black grid and original
black/yellow tile faces and goal rails retained. Inspected desktop and mobile
screenshots; all 121 pocket polygons compute to rgb(255, 255, 255).

Reran every AGENTS.md gate. Frozen install, configuration/security validations,
both lint checks, typecheck, Functions build/coverage, emulator rules, production
build, bundle budgets, and the high-severity dependency audit passed. All 278
browser tests passed, including the 15 BUZZHEX desktop/mobile cases.

The frontend coverage run passed 1,357 of 1,359 tests; two UI cases exceeded the
unchanged five-second timeout (BUZZHEX saved-swap/reset and BUZZLE winner flow).
Reran both complete UI suites and the BUZZHEX engine suite with one worker:
all 17 tests passed without changing assertions or timeouts. Logs are in
`scratch/buzzhex-white-gate-*.log` and `scratch/buzzhex-white-ui-retry.log`.

The corresponding physical project regenerated all six board sections and its
fit coupon with white pocket floors (third board filament). Geometry hashes
match the previous revision for all seven 3MF files; all 21 print-library tests
and the output-library validator passed. The website-agent prompt and handoff
ZIP now include the white board specification and updated preview.
