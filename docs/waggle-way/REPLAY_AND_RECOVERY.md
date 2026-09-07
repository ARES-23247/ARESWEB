# Replay and recovery decision

Date: 2026-09-06. Scope: WW-16 / M7 in the local `codex/waggle-way`
worktree. This is implementation and design evidence, not player acceptance or
permission to deploy.

## Implemented ghost workflow

Restarting an attempt that opened the hive retains its bounded command recording
in memory. **Compare previous attempt** is off initially. When enabled, outlined
bees marked G follow the current run's tick. Their counts and individual positions
are reported separately from the live population. They never enter live collision,
guide assignment, inventories, achievements, sound cues or progress saving.

Pause to scrub the **Previous attempt time** range with pointer or keyboard.
**Match current run**, starting/resuming, or stepping returns the comparison to
the live clock. Seeking reviews only the old recording; it does not restore or
alter the current hive. At the recording endpoint, its last snapshot remains
visible with an explicit endpoint message. An interrupted attempt is not shown
as if its unrecorded future had been calculated.

Only the most recent started attempt is kept. Restarting an unopened setup
preserves the existing recording. Leaving the garden, returning to the builder,
or reloading clears it; there is no ghost file import, upload or cloud save.
Overlong recordings produce a visible message and ordinary restart remains usable.

The same pure playback implementation powers full replay verification and
incremental seeking. Exact canonical level content and rules version must match;
versions 1–5 remain supported. Inputs are copied after validation. Commands at the
requested tick apply in recorded order, including multiple commands at tick zero
and explicit finish. Seeking backward reconstructs from the original level.
Limits remain 54,000 ticks (30 minutes) and 10,000 actions.

Calculation runs in `ghost.worker.ts`. The hook permits one request in flight,
coalesces intermediate ticks, computes at most 120 ticks per message, and never
renders a partial result or a frame from the wrong tick or
recording. A new scrub target replaces the old target between calculation chunks.
Hiding comparison, replacing its recording or leaving the level
terminates the worker. Failures are visible and do not stop the live game.
Ghost outlines have no pointer events or decorative animation. The existing bee
inspector supplies their status, position and direction in text.

## Checkpoint and rewind assessment

| Option | Benefit | Required additional behavior | Decision |
| --- | --- | --- | --- |
| Read-only ghost timeline | Inspect a past failure and compare a changed setup | Independent clock for inspection, exact replay, clear ghost identity | Implemented in the local game. |
| Named checkpoints | Retry a particular decision with less repetition | Atomically restore all simulation and UI state; define whether checkpoint branches qualify for publishing | Defer from this local release; collect player evidence that restart plus ghost review is insufficient. |
| Continuous live rewind | Explore timing freely | Bounded snapshot cache, future-command truncation, branch identity and achievement/verification rules | Defer. Full rewind is explicitly outside the local release in PRODUCT_REQUIREMENTS.md. |

This assessment uses the current `RunState` rather than an assumed physics model.
A live restore would have to restore tick/phase; every bee's position, heading,
status, helper/signal/rally-exit IDs and loss reason; current object configuration;
deployed stock and peak usage; pollen ownership/delivery; rally mode and next
release tick; and command history. Gate state and weather derive from these fields
and must reproduce the same result after restoration. Restoring only bee positions
would create or destroy resources and change timing.

A future live-restore implementation must also reset the animation accumulator,
drag state, preview/ghost requests and result/sound deduplication together. It must
truncate abandoned future commands and define whether progress earned on an
abandoned branch remains. Community verification must accept only an explicit,
bounded command history under the agreed rules; a client snapshot is not evidence
of completion.

Saving a full 512-object/100-bee snapshot at every tick for 30 minutes is an
unnecessary memory burden. If live recovery is later selected, evaluate sparse
checkpoints plus deterministic command replay in a worker, with a measured memory
budget and canceled seeks. The current backward-seeking API supplies replay
infrastructure, not authorization to add live rewind.

Acceptance for any future restore includes equality with an uninterrupted run;
restoring carried and delivered pollen; occupied and pending-close gates; rain
phase boundaries; waiting release order; placed/recovered tools and peak counts;
completion and failure flags; and independence of abandoned future commands.
Repeat these checks across supported rules versions. No live restore is claimed
to ship in this change.

## Verification and remaining acceptance

Core tests cover forward/backward seeking for versions 1–5, input isolation,
inclusive command boundaries, malformed recordings and unchanged live attempts.
All recorded campaign solutions still reproduce exact final state. Worker/hook
tests cover initialization, request coalescing, stale-frame exclusion,
cancellation, unavailable workers, post failures and replay errors.

The browser flow passed on desktop Chromium, Firefox and WebKit, mobile Chromium
and mobile WebKit. It records a failed attempt, seeks to its end with the keyboard,
returns to the current tick, compares after changing the guide, checks pause,
rescues all six live bees and clears the recording on level navigation. Final
repository gate results belong in IMPLEMENTATION_PROGRESS.md.

Human review must still establish whether the G outlines, endpoint message and
timeline are understandable, including touch, zoom and a screen reader. No
automated result is a substitute for that review.
