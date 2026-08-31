# Academy local ARES source-worktree audit

Date: 2026-08-31

ARESWEB branch: `codex/areslib-reference-learning-depth`

Academy authority: ARES Robotics `099e5188f35c639d49e78a3c80309841e91920fa`

Inspected local checkout: `C:\Users\david\dev\robotics\ares`

Local branch and HEAD: `codex/studio-project-session-refactor` at
`3d10f63a57c9f11de5d15a4b82bff3417f5607d0`

## Decision

Do not refresh Academy lessons from the currently checked-out local branch.
Git ancestry proves that local HEAD is an ancestor of the Academy's pinned
authority commit. It is therefore older, not a newer replacement authority.
The local worktree also contains uncommitted and untracked changes owned by
other work. Those files were not treated as reviewed curriculum evidence.

The released Academy sources remain newer and continue to pass remote blob and
version verification. Curriculum content was intentionally left unchanged.

## Durable guard added

`pnpm run content:audit-source-worktree -- --repo <path>` now compares all 142
unique source paths used by the 244 Academy references with a local ARES
checkout. The audit distinguishes:

- a checkout aligned with the pinned authority;
- an older checkout that must not be used for a refresh;
- a newer checkout with or without changes to pinned lesson sources;
- a divergent branch;
- missing referenced paths; and
- uncommitted edits to referenced paths.

The command is a manual source-review gate rather than a CI gate because the
separate ARES Robotics checkout is not present in ARESWEB CI.

## Evidence

The local audit returned:

```text
ARES Academy source worktree: checkout-behind
Pinned authority: 099e5188f35c639d49e78a3c80309841e91920fa
Checkout HEAD: 3d10f63a57c9f11de5d15a4b82bff3417f5607d0
Git relationship: behind
Catalog source paths: 142
Committed relevant changes: 0
Uncommitted relevant changes: 0
Missing relevant paths: 0
The checkout is older than the pinned Academy authority. Do not refresh lessons from this branch.
```

The focused utility suite passed seven tests covering aligned, ahead, behind,
divergent, dirty, missing-path, and no-relevant-drift states.
