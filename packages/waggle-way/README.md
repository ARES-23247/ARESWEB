# Waggle Way

Private ARESWEB workspace package for the bee swarm puzzle game and local level
builder. Website routes and SEO belong in `src/app/waggle-way/`; Arcade discovery
belongs in the website navigation registry.

- `src/core/`: versioned level validation, pure fixed-tick simulation, editor
  commands, bounded replay verification and local persistence adapters.
- `src/content/`: original campaign puzzles and recorded solutions, authored
  through the same editor and serialization pipeline as player levels.
- `src/ui/`: SVG scene, semantic controls, campaign player, builder inspectors,
  preferences and cancelable preview worker.
- `src/Game.tsx` and `src/Builder.tsx`: package entry points. The site injects
  navigation elements. Future community API clients must be injected too.

Game code must not import website source or Firebase authentication. Pure engine
and schema code must remain usable without React, DOM, wall clock or randomness.
Preserve shared accessible UI/fullscreen behavior. The current redesign uses
game-scoped pixel-art styling rather than inheriting the website's appearance.

Run commands from the workspace root, following `AGENTS.md`. Focused checks:

For live iteration, run `pnpm run dev --host 127.0.0.1 --port 3040 --strictPort`
from the active `scratch/waggle-way` worktree root, then open
<http://127.0.0.1:3040/waggle-way>. Source edits use Vite live updates without a
production rebuild. See [development workflow](../../docs/waggle-way/DEVELOPMENT.md)
for backend, E2E and final-gate distinctions. The
[pixel-art pivot](../../docs/waggle-way/PIXEL_ART_PIVOT.md) records the planned
standalone interface and new hazard direction; it is not yet implemented.

```text
pnpm exec vitest run src/test/waggleWay src/test/WaggleWayExperience.test.tsx src/test/gamePackageBoundaries.test.ts
node scripts/profile-waggle-way.mjs
node scripts/profile-waggle-way.mjs --rain
```

See `docs/waggle-way/README.md` for requirements and implementation status. The
30-puzzle campaign remains a local playtest pending human acceptance. Version 5
adds optional pollen/tool goals and five built-in overhead themes; old imports
retain their exact rules until explicitly upgraded.

The overhead visual contract, generated background sources/prompts, and direct
manipulation behavior are documented in `docs/waggle-way/ART_DIRECTION.md`.

Ghost comparison uses the shared replay engine and a cancelable worker; restarting
keeps one local recording for the current garden visit. Review is independent of
the live hive. See `docs/waggle-way/REPLAY_AND_RECOVERY.md` for the workflow and
checkpoint/rewind assessment.
