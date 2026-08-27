# Academy and ARESLib human review packet

## Purpose and boundary

This packet records the human checkpoint used before the ARES Academy
curriculum, corrected ARESLib references, and existing-lesson cross-links were
published. The original eleven lessons, four replacements, fifteen cross-links,
and the later three current-robot tutorials have all completed review and
bounded production migration. The packet remains the review checklist for
future content changes.

Opening a preview or source file does not publish it. Do not use the editor's
Save control merely to record a review; any edit changes the staged precondition
and intentionally causes the publication dry run to stop.

## Review checklist

For every item being approved, confirm:

- the title, description, prerequisites, objectives, level, and estimated time
  match the lesson;
- technical statements match the pinned source and do not promise hardware
  behavior that was only simulated;
- physical-robot work clearly requires disabled setup, supervision, and staged
  commissioning where applicable;
- language and exercises are suitable for the intended student audience;
- links, headings, tables, lists, code, and instructions are understandable by
  keyboard and on a narrow screen;
- no student identity, private team data, credentials, unpublished hardware
  details, or fabricated accomplishments appear; and
- the proposed subject and learning-path placement are useful and accurate.

Record exceptions by slug. Approval may cover a subset; unapproved items remain
unchanged and non-public.

## Eleven published Academy lessons

These exact records were reviewed and published under batch
`academy-publish-20260825-01`, digest
`36d5c8dc260f04ca5b880d41975bbe0b9ff4c46b76f7c618dbcbcd3738f1d515`,
and the public reviewer label `Lead Coach`. The protected links remain useful
for future edits, which return changed content to pending review.

| Lesson | Subject | Safety scope | Protected review link | Canonical source file |
| --- | --- | --- | --- | --- |
| The ARES Software Workspace | Robotics & Engineering | None | [Edit or review lesson](https://aresfirst.org/dashboard/academy?edit=ares-workspace-map) | [`01-ares-workspace.md`](../content/learning/robotics-foundations/01-ares-workspace.md) |
| From Driver Input to Motor Output | Robotics & Engineering | Simulation only | [Edit or review lesson](https://aresfirst.org/dashboard/academy?edit=robot-input-to-output) | [`02-input-to-output.md`](../content/learning/robotics-foundations/02-input-to-output.md) |
| Run Your First FTC Simulation | Robotics & Engineering | Simulation only | [Edit or review lesson](https://aresfirst.org/dashboard/academy?edit=run-first-ftc-simulation) | [`03-first-ftc-simulation.md`](../content/learning/robotics-foundations/03-first-ftc-simulation.md) |
| Robot Coordinates Without Guesswork | Mathematics & Data | Simulation only | [Edit or review lesson](https://aresfirst.org/dashboard/academy?edit=robot-coordinate-contracts) | [`04-coordinate-contracts.md`](../content/learning/robotics-foundations/04-coordinate-contracts.md) |
| State, Actions, and Reducers | Robotics & Engineering | None | [Edit or review lesson](https://aresfirst.org/dashboard/academy?edit=redux-state-actions-reducers) | [`05-redux-basics.md`](../content/learning/robotics-foundations/05-redux-basics.md) |
| Telemetry and Local Log Retrieval | Mathematics & Data | Simulation only | [Edit or review lesson](https://aresfirst.org/dashboard/academy?edit=telemetry-and-local-logs) | [`06-telemetry-and-logs.md`](../content/learning/robotics-foundations/06-telemetry-and-logs.md) |
| Simulation Is Not Hardware Validation | Physics & Applied Science | Physical robot | [Edit or review lesson](https://aresfirst.org/dashboard/academy?edit=simulation-is-not-hardware-validation) | [`07-simulation-limits.md`](../content/learning/robotics-foundations/07-simulation-limits.md) |
| Start an FTC Project Without Inherited Robot Assumptions | Robotics & Engineering | Simulation only | [Edit or review lesson](https://aresfirst.org/dashboard/academy?edit=ftc-starter-project-identity) | [`01-project-identity.md`](../content/learning/ftc-starter/01-project-identity.md) |
| Map FTC Controls Through Redux | Robotics & Engineering | Simulation only | [Edit or review lesson](https://aresfirst.org/dashboard/academy?edit=ftc-starter-controller-bindings) | [`02-controller-bindings.md`](../content/learning/ftc-starter/02-controller-bindings.md) |
| Add and Verify an FTC Starter Autonomous Routine | Robotics & Engineering | Simulation only | [Edit or review lesson](https://aresfirst.org/dashboard/academy?edit=ftc-starter-first-autonomous) | [`03-first-autonomous.md`](../content/learning/ftc-starter/03-first-autonomous.md) |
| Commission an FTC Starter Robot Safely | Physics & Applied Science | Physical robot | [Edit or review lesson](https://aresfirst.org/dashboard/academy?edit=ftc-starter-physical-commissioning) | [`04-physical-commissioning.md`](../content/learning/ftc-starter/04-physical-commissioning.md) |

## Three current-robot tutorials

These lessons were reviewed and published on 2026-08-25 EDT under batch
`academy-phase3-prod-publish-20260826-01`, digest
`c4d912d91cf442de36084ad278ae25900f44a54fb62939b38eafa3f391c700c4`,
and the public reviewer label `Lead Coach`.

| Lesson | Safety scope | Public lesson | Canonical source file |
| --- | --- | --- | --- |
| Compose an FTC Season Robot That Fails Safe | Simulation only | [Open lesson](https://aresfirst.org/academy/ftc-season-composition-and-safe-lifecycle) | [`01-season-composition.md`](../content/learning/current-robot/01-season-composition.md) |
| Shape Driver Input Without Mixing Coordinate Frames | Simulation only | [Open lesson](https://aresfirst.org/academy/ftc-driver-input-shaping-and-frames) | [`02-driver-input-frames.md`](../content/learning/current-robot/02-driver-input-frames.md) |
| Make Intake I/O Fail Neutral Before Recovery | Physical robot | [Open lesson](https://aresfirst.org/academy/ftc-intake-io-fault-recovery) | [`03-intake-fault-recovery.md`](../content/learning/current-robot/03-intake-fault-recovery.md) |

## Four applied ARESLib replacements

The bounded migration preserved each public URL while replacing its inaccurate
body and metadata with the reviewed source below. The completed batch is
`academy-replacements-20260825-01`, with digest
`f7b481a6d6ae2a27115e76ef60b9950230ac18bab84fad25a8a92d14d61754fa`.

| Preserved URL | Reviewed replacement source | Reason |
| --- | --- | --- |
| [`/docs/areslib-fundamentals`](https://aresfirst.org/docs/areslib-fundamentals) | [`areslib-fundamentals.md`](../content/learning/areslib-reference/areslib-fundamentals.md) | Replace the obsolete command/subsystem description with current Redux, module, and loop ownership. |
| [`/docs/autonomous-and-vision`](https://aresfirst.org/docs/autonomous-and-vision) | [`autonomous-and-vision.md`](../content/learning/areslib-reference/autonomous-and-vision.md) | Correct PathPlanner ownership and delayed/rejected vision-measurement boundaries. |
| [`/docs/telemetry-and-control`](https://aresfirst.org/docs/telemetry-and-control) | [`telemetry-and-control.md`](../content/learning/areslib-reference/telemetry-and-control.md) | Replace inaccurate AdvantageKit, AdvantageScope, and USB-log claims with the current NT4 and local-log contracts. |
| [`/docs/swerve-and-kinematics`](https://aresfirst.org/docs/swerve-and-kinematics) | [`swerve-and-kinematics.md`](../content/learning/areslib-reference/swerve-and-kinematics.md) | Separate general drivebase, calibration, feedback, and safety contracts from season-specific behavior. |

## Fifteen applied metadata-only cross-links

The completed migration preserved every existing lesson body and URL. It added
only the subject and ordered path memberships defined in
[`existing-content-path-plan.json`](../content/learning/existing-content-path-plan.json).
The completed batch is `academy-cross-links-20260825-01`, with digest
`d832e7f9adcf3b9819701ec6f52546e5d3b133cf4c91b0a23cf35b16f0daccf3`.

- Math for Robotics: `linear-equations` (1), `trig-basics` (2),
  `trig-inverse` (3), `trig-robotics` (4), `sat-stats` (6), and
  `sat-graphs` (7).
- Applied STEM in the Outdoors: `climbing-fall-factor` (1),
  `climbing-center-of-mass` (2), `climbing-anchor-angles` (3),
  `climbing-capstan-friction` (4), `climbing-finger-biomechanics` (5),
  `cycling-gear-ratios` (6), `skiing-carving-forces` (7),
  `kayaking-hydrodynamics` (8), and `hiking-grade-energy` (9).

The missing Math for Robotics order 5 is intentionally filled by the published
`robot-coordinate-contracts` lesson. No Computing & AI item is invented; that
path remains visibly in preparation.

## Recording future decisions

The ARES 11 / Studio 2 monorepo refresh uses the approval-gated
`refresh-published` phase for existing lessons. Review the rendered lesson and
its pinned `ARES-Robotics` sources. The runner verifies the recorded hash of the
old live body before it can update anything, so a lesson edited since this plan
was prepared blocks instead of being overwritten. The obsolete intake lesson
is archived separately, and the GUI-owned indicator-light lesson is staged as
a new draft with its own review.

For future content changes, record a statement with a real public reviewer
label, date, and the generated review digests. For a full approval:

> Coach/mentor review completed. Approved by **[public reviewer label]** on
> **[YYYY-MM-DD]**: publish all approved pending drafts, apply the reviewed
> ARESLib replacements, and apply the reviewed cross-links. Reviewed digests:
> **publish-drafts
> [digest]**, **replacements [digest]**, and **cross-links [digest]**.

For partial approval, list approved or rejected slugs in each group. The
operator will create separate approval manifests for `publish-drafts`,
`replacements`, and `cross-links`, dry-run all three phases, and show any
precondition mismatch before requesting the final production-write confirmation.
Each manifest is bound to the exact reviewed scope; changing content or metadata
after review invalidates its digest.
