# Arcade workspace architecture

The website and games share one Git repository, one pnpm workspace, and one
protected release flow. The game packages are private workspace packages, not
Git submodules or separately published repositories.
The website stays in `src/`; the existing APIs and game process stay in
`functions/`. Public URLs and Firebase/Cloud Run service identities are unchanged.

| Owner | Responsibility |
| --- | --- |
| `src/app/arcade/`, navigation | Arcade discovery and website navigation |
| `src/app/buzzle/`, `src/app/buzzello/` | Thin route wrappers and SEO |
| `src/app/pollen/` | Website wrapper, opaque game iframe, fullscreen controls, and bounded score bridge |
| `src/lib/*Online.ts` | Bind package client factories to the website's authenticated transport |
| `packages/buzzle/` | Rules, AI, workers, game UI, dictionary lookup, physical tools, canonical lexicon |
| `packages/buzzhex/` | Local Hex rules and UI; thin site wrapper at `/buzzhex` |
| `packages/buzzello/` | Rules, AI, worker, game UI, online client contract |
| `packages/pollinator/public/` | Classic-script physics, rendering, local game UI, assets and dependency license |
| `packages/game-common/` | Hex geometry and fullscreen behavior |
| `packages/ui/` | Existing shared buttons, dialogs and class-name utility |
| `functions/src/lib/*Game*.ts` | Validate persisted state/actions, authoritative match adapters, private DTOs |

Packages declare their imports in their own manifests. Game packages do not
import `src/` or Firebase authentication. The site passes a stable online client
to each game component; each factory receives the authenticated request function.
Shared rules import geometry only and can execute without React, DOM or Node APIs.
UI packages use the website's Tailwind/design tokens; `globals.css` explicitly
scans their sources. Keep its CSS imports consecutive, with the package
`@source` directive after all imports. An intervening directive makes PostCSS
drop the design-token import and breaks the site's colors despite a successful
build. The Arcade E2E test checks the compiled token and primary button color;
visually inspect the built site as well as testing its interactions.
Existing `src/lib` and UI re-exports preserve import
compatibility while consumers migrate. Do not add new logic to those re-exports.

## Persisted online compatibility

BUZZELLO's 61 cells keep their original column-major order. BUZZLE's local board
has 217 row-major cells, but its persisted online board uses column-major order.
`BUZZLE_ONLINE_INDICES` converts both ways by transposing axial coordinates.
The online client translates received boards and outgoing placements; the server
adapter translates into shared-rule order and back into the persisted order.
No Firestore migration is needed. Existing games retain their board slot IDs.
This also corrects the previous browser/server disagreement about word direction.

The server obtains tile values from validated racks, checks tile uniqueness and
the complete stored state, uses cryptographic randomness, retains bounded match
budgets, and exposes only the requesting player's rack. Shared rule errors carry
stable codes that the server maps to `ApiError`; unexpected errors still propagate
to the existing global handler. API paths, match envelopes and authentication are
unchanged. Pollinator remains a device-only game in an opaque `allow-scripts`
iframe, with the existing bounded host score bridge.

## Build and deployment

Run all commands from the repository root:

```text
pnpm install --frozen-lockfile
pnpm games:prepare
pnpm dev
pnpm --filter functions build
pnpm build
```

Installation, frontend dev/build and backend build run `games:prepare`. It stages
canonical rules into `functions/src/generated/games/`, rewriting the known
geometry package import to a local import for the existing CommonJS compiler.
It also stages Pollinator into `public/games/pollen/` and the single BUZZLE lexicon
into the existing browser and server data locations. These deployment copies are
ignored and must never be edited. Run preparation again after shared-rule edits
when keeping a backend process open. Pollinator source edits require preparation
and a page reload during development.

`pnpm games:generate-lexicon` updates the canonical package lexicon and its existing
source/license metadata, then refreshes deployment copies. The public dictionary
URL and offline Word Tools cache entry remain stable.

Firebase Functions retain their standalone npm manifest/lock and `lib/index.js`
entry. CI compiles and uploads the verified `lib/` artifact. An empty `gcp-build`
prevents Google from rebuilding that artifact without the workspace sources;
this is the [documented Node build override](https://docs.cloud.google.com/run/docs/runtimes/nodejs).
The Cloud Run Docker build uses the repository root with a dedicated allowlist
in `functions/Dockerfile.game.dockerignore`, stages the same canonical rules,
then copies only runtime dependencies, compiled code and dictionary data into
the final non-root image. No workspace protocol dependencies reach npm deploy.

## Verification and future games

The full root `AGENTS.md` gate still applies. Coverage thresholds follow the
canonical files; generated backend copies are not counted a second time. Server
adapters retain their own coverage thresholds. Tests verify package import
boundaries, deployment staging, all board-index conversions, every BUZZLE word
axis, existing privacy/authorization behavior, gameplay and offline reopening.

For another game, add a private package under `packages/`, declare exports and
dependencies, keep browser UI separate from pure rules, add a thin site route
and Arcade entry, and register an adapter in the existing game service only if
remote play is needed. Extend the deployment staging manifest and its tests only
for rules needed by the server or static assets needed by Hosting. Use the shared
agent guide for Codex, Gemini and Antigravity; do not create per-vendor policies.
