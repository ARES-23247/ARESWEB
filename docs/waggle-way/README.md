# Waggle Way planning index

Status: 2026-09-08 development batch. One 30-level version-8 campaign replaces
the old two-campaign menu. Five teaching gardens lead into 25 all-bee challenges.
The workshop creates current-rule maps; no archived edition is offered. See
[the current campaign](CURRENT_CAMPAIGN.md) for the actual levels and bounded
difficulty evidence. Human difficulty review and this batch's release checks
remain open.

Implementation follows [Arcade workspace architecture](../GAME_ARCHITECTURE.md):
`packages/waggle-way/` owns the game; website pages are thin route wrappers.
See [development](DEVELOPMENT.md) for the current isolated checkout and
[progress](IMPLEMENTATION_PROGRESS.md) for validation evidence.

## Purpose

The current user-approved direction is a standalone-feeling, top-down pixel-art
game with matching UI, direct grid manipulation and physically understandable
spray/industrial hazards. See the [2026-09-07 redesign decision](PIXEL_ART_PIVOT.md).
The redesign is in local development; the complete experience is not accepted.

Latest confirmed gameplay direction (2026-09-07): place dancing bees on any
valid dry grid cell without requiring a perch. Each level supplies limited
uses of fixed-heading, left/right 90-degree and reverse dances. Selected, visibly
solid obstacles safely bounce bees; ordinary water and low scenery remain
flyable, but water blocks guide placement in version 7. Helpers still belong to
the hive and need a rescue route. Relative dancers now prototype automatically
following the last bee they guided on release, replacing their separate heading
control. Pointing dancers retain their arrows. See
[guide rules](GAME_DESIGN.md#temporary-guides) and the
[slice review tasks](PLAYTEST.md#new-dancer-and-bounce-review).

The accepted **lift dancer** now grants six traveled cells of higher flight over
low barriers, with explicit landing and helper-release rules. See the
[lift rules](GAME_DESIGN.md#lift-dancer-rules) and the
[level-quality audit](LEVEL_QUALITY_AUDIT.md) for redesigned routes, solution
evidence and remaining browser/human review. The current batch is not deployed.

The finite-use refund policy and exact bounce response are prototype defaults
to validate, not additional user-approved decisions. Larger boards and a panning play camera are now part of the first challenge
conversion batch. Further industrial mechanics and workshop camera parity remain
follow-up scope.

Plan a bee-themed browser puzzle game in which players guide a hive to a flower
field using dances, airflow, and environmental tools. Include a player-facing
level builder from the first playable release, with campaign levels authored in
that same builder.

This baseline records the user's enthusiasm for the full concept and builder.
It does not treat every brainstormed mechanic as a first-release requirement.
Specific rules, technical choices, and release boundaries below are proposed
defaults that can be revised during prototyping.

## Documents

| File | Owns |
| --- | --- |
| [Redesign goal series](REDESIGN_GOALS.md) | Active five-phase implementation goal and evidence required for each phase |
| [Redesigned level specification](LEVEL_DESIGN.md) | Proposed 30-level progression, teaching briefs, obstacle logic and honey-recovery objectives |
| [Pixel-art redesign](PIXEL_ART_PIVOT.md) | Latest confirmed direction, proposed obstacles, compatibility and next slice |
| [Art direction](ART_DIRECTION.md) | Current visual contract and historical asset provenance |
| [Development workflow](DEVELOPMENT.md) | Live Vite iteration, focused checks and final verification boundary |
| [Product requirements](PRODUCT_REQUIREMENTS.md) | Experience, scope, requirement IDs, and success criteria |
| [Game design](GAME_DESIGN.md) | Bee behavior, tools, hazards, progression, and expansion ideas |
| [Campaign plan](CAMPAIGN_PLAN.md) | Thirty-level target, five gardens, puzzle briefs, and content acceptance |
| [Level builder](LEVEL_BUILDER.md) | Authoring workflow, level contract, validation, sharing, and remixes |
| [Technical plan](TECHNICAL_PLAN.md) | Repository integration, engine boundaries, persistence, and quality requirements |
| [Roadmap](ROADMAP.md) | Ordered milestones, dependencies, acceptance gates, and decision log |
| [Implementation progress](IMPLEMENTATION_PROGRESS.md) | Current code, verification evidence, and outstanding milestone work |
| [Community contract](COMMUNITY_PLAN.md) | M6 service ownership, revisions, verification limits, DTOs, moderation and deletion |
| [Replay and recovery](REPLAY_AND_RECOVERY.md) | Ghost workflow, version compatibility, checkpoint/rewind assessment |
| [Playtest record](PLAYTEST.md) | Reproducible player tasks, observations, and unfinished manual acceptance |

When changing scope, update the requirement and its roadmap milestone together.
The product requirements own release scope; the game design owns gameplay rules;
the builder document owns the proposed serialized level contract. Live source
remains authoritative about implemented behavior. The progress document records
what is available; planned features are not release claims.

## Planning assumptions

- Integrate into this ARESWEB repository as an independently loaded game area.
- Top-down 2D presentation; single-player puzzles before any multiplayer work.
- Setup-first play with pause and adjustments during a run.
- Any bee can take a temporary job; permanent specialist classes are not required.
- First release includes local campaign play, local progress, and a local builder
  with file import/export. Online publishing is a separate milestone.
- The user requested at least a couple dozen levels. Plan for 30 campaign levels
  across five gardens of six; five levels are an early playtest slice only.
- Original fictional garden content is game content, never represented as real
  team records, scientific bee behavior, or existing community submissions.

## Source context

Initial planning review on 2026-09-05 used HEAD
`aae3ac57923823696e77253f5f1a2cb307f55900` and the current, already modified
worktree. Relevant live sources: `package.json`, `src/App.tsx`,
`src/lib/buzzello.ts`, `src/components/games/GameFullscreen.tsx`,
`vite.config.ts`, and `scripts/check-bundle-size.mjs`.

Existing guidance: [agent guide](../../AGENTS.md),
[game service](../GAME_SERVICE.md), and the repository accessibility, security,
and CI skills. Implementation now follows the isolated worktree based on
`origin/master` commit `21c7c2bb`, including its current package organization
guide and live source. The initial planning change added only this folder;
subsequent implementation changes and verification are tracked in the progress file.

## Next action

Local entry points: Play gardens opens the first version-6 dancer slice;
Original gardens opens the legacy campaign. The workshop's New dancer garden
action creates a local version-6 draft. Continue the slice's relative-dance
teaching variants, spray rules, authoring/migration and layout validation before
expanding campaign content. See the progress record for current limits.

Build and review one cohesive pixel-art level plus its matching game interface
and workshop before expanding the redesign across the campaign. Preserve the
single game window, fullscreen and direct manipulation controls. Use the live
development server on port 3040 for feedback without production rebuilds.
Community UI and scheduled cleanup code are saved locally with final verification
unfinished; additional community expansion is not the immediate priority.
Automated solutions prove specific behaviors, not usability or design acceptance.
