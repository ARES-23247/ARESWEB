# Waggle Way local development

Updated: 2026-09-07. Current campaign conversion work is isolated on
`codex/waggle-campaign-conversion` at
`C:\Users\david\dev\robotics\ftc\ARESWEB\scratch\waggle-campaign`, based on
PR #266's verified area-testing foundation. Earlier `scratch/waggle-way` work is
preserved. Use port 3041 for this checkout to avoid another task's dev server.

## Live iteration

Run from that worktree root, using Node 24.15+ in the Node 24 line and pnpm 11.21.0:

```powershell
pnpm run dev --host 127.0.0.1 --port 3041 --strictPort
```

Open <http://127.0.0.1:3041/waggle-way> for play or
<http://127.0.0.1:3041/waggle-way/builder> for the workshop. Keep the server running.
The existing `dev` script prepares game packages once and starts Vite; it does
not build/prerender the entire production website. Vite serves source modules
and updates code/styles on save. Some module changes reload the page or reset
the current run, so save/export a draft before disruptive engine work.

The live server was started and checked on 2026-09-07: the game frame rendered,
the Vite client was present, and the headless Chromium smoke check recorded no
page errors. This verifies startup, not all gameplay or backend operations.
The process must be restarted after it is stopped or the machine restarts.

Port 3039 is the existing built preview. `vite preview` serves `dist`, so source
edits do not update that preview until another build. Use 3041 for everyday
visual/gameplay feedback. Dev PWA support is disabled in the current Vite config;
this separate origin also avoids reusing the preview's service worker.
If 3041 is occupied, inspect its owner or choose another explicit port; do not
terminate an unknown process.

## Focused checks while editing

Examples, also from the worktree root:

```powershell
node node_modules/vitest/vitest.mjs run src/test/waggleWayEngine.test.ts src/test/waggleWayWeather.test.ts
node node_modules/vitest/vitest.mjs run src/test/waggleWayEditor.test.ts src/test/WaggleWayExperience.test.tsx
```

Select checks for the behavior being changed. Use the live browser for visual
iteration and direct interaction checks. Local game browser flows can now run
against Vite without a production build:

```powershell
$env:ARES_WAGGLE_LIVE_PORT = "3041"
pnpm run test:waggle:live --project=chromium --grep "pixel title|one game window"
```

`playwright.waggle-live.config.ts` defaults to port 3040; the override above
selects 3041 for this checkout, reusing its dev server or starting it when absent. Run it from the active worktree and ensure any
existing server belongs to that checkout. `ARES_WAGGLE_LIVE_PORT` selects another
explicit port. It includes only `waggle-way.spec.ts` local play/workshop flows;
authenticated community and PWA tests remain in the normal E2E configuration.
It does not overwrite `dist`. This focused dev path is additional iteration
evidence, not a substitute for required production-style checks.

The normal `playwright.config.ts`
launches an E2E build/preview; narrowing its test selection does not by itself
remove that build. Do not point its authenticated test fixtures at the normal
dev server or claim the full suite has become build-free. E2E writes `dist`;
do not run it concurrently with a production build or mistake its artifact for
a production preview.

Game source belongs in `packages/waggle-way/`; site wrappers remain thin.
Local campaign play and local building need no community backend. Community
operations need the appropriate local backend/test setup; starting Vite alone
does not provide that service. Do not redirect writes to production by default.
When changing shared rules with a backend development process running, run
`pnpm games:prepare` and rebuild/restart that backend as its workflow requires.
Never edit generated game deployment copies.

## Handoff and release

Use live updates and focused checks during iteration. Once a code change is ready
for handoff, run the full [repository verification gate](../../AGENTS.md) and
required CI checks. This workflow changes iteration speed, not coverage floors,
security boundaries or release requirements. Record actual results and remaining
limitations in [implementation progress](IMPLEMENTATION_PROGRESS.md).
Production deployment still requires explicit approval.


## Game CI direction

Use the existing pipeline with affected-game jobs and one required aggregate,
not a separate release system for each game. PR #266 provides focused local
selection and full-suite browser sharding; selection in CI is still advisory.
Game-only selective PR checks and component deployment fingerprints/ledger are
later stages in [the area testing plan](../AREA_TESTING_AND_RELEASE_PLAN.md).
Until their dependency coverage is proven, full handoff/release checks remain
required. Shared engine changes also need server proof-verification coverage;
shared UI/auth/build changes fan out beyond Waggle Way. Local Vite and the live
browser config already avoid a production website rebuild during UI iteration.


The current conversion's observation report selected the full gate because
`docs/waggle-way/*` is not yet assigned in the ownership manifest. Game source
and tests are mapped. Add explicit ownership for the game planning documents
with selector regression evidence during the next CI rollout step; do not
ignore unmapped files just to obtain a smaller suite. Use the focused live-game
commands above while that observation mapping is refined.
