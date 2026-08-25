# Academy and ARESLib human review packet

## Purpose and boundary

This packet is the final human checkpoint before the staged ARES Academy
curriculum, corrected ARESLib references, or existing-lesson cross-links can be
published. The engineering checks, source hashes, backup, emulator migration,
and production staging have already completed. A coach or mentor must still
judge instructional clarity, age suitability, safety wording, and whether the
proposed organization fits the team.

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

## Eleven staged Academy drafts

These exact records are private `draft` documents with
`approvalStatus: pending_approval`. Sign in as a coach, mentor, or administrator
before opening the protected links.

| Lesson | Subject | Safety scope | Protected review link | Canonical source file |
| --- | --- | --- | --- | --- |
| The ARES Software Workspace | Robotics & Engineering | None | [Review staged draft](https://aresfirst.org/dashboard/academy?edit=ares-workspace-map) | [`01-ares-workspace.md`](../content/learning/robotics-foundations/01-ares-workspace.md) |
| From Driver Input to Motor Output | Robotics & Engineering | Simulation only | [Review staged draft](https://aresfirst.org/dashboard/academy?edit=robot-input-to-output) | [`02-input-to-output.md`](../content/learning/robotics-foundations/02-input-to-output.md) |
| Run Your First FTC Simulation | Robotics & Engineering | Simulation only | [Review staged draft](https://aresfirst.org/dashboard/academy?edit=run-first-ftc-simulation) | [`03-first-ftc-simulation.md`](../content/learning/robotics-foundations/03-first-ftc-simulation.md) |
| Robot Coordinates Without Guesswork | Mathematics & Data | Simulation only | [Review staged draft](https://aresfirst.org/dashboard/academy?edit=robot-coordinate-contracts) | [`04-coordinate-contracts.md`](../content/learning/robotics-foundations/04-coordinate-contracts.md) |
| State, Actions, and Reducers | Robotics & Engineering | None | [Review staged draft](https://aresfirst.org/dashboard/academy?edit=redux-state-actions-reducers) | [`05-redux-basics.md`](../content/learning/robotics-foundations/05-redux-basics.md) |
| Telemetry and Local Log Retrieval | Mathematics & Data | Simulation only | [Review staged draft](https://aresfirst.org/dashboard/academy?edit=telemetry-and-local-logs) | [`06-telemetry-and-logs.md`](../content/learning/robotics-foundations/06-telemetry-and-logs.md) |
| Simulation Is Not Hardware Validation | Physics & Applied Science | Physical robot | [Review staged draft](https://aresfirst.org/dashboard/academy?edit=simulation-is-not-hardware-validation) | [`07-simulation-limits.md`](../content/learning/robotics-foundations/07-simulation-limits.md) |
| Start an FTC Project Without Inherited Robot Assumptions | Robotics & Engineering | Simulation only | [Review staged draft](https://aresfirst.org/dashboard/academy?edit=ftc-starter-project-identity) | [`01-project-identity.md`](../content/learning/ftc-starter/01-project-identity.md) |
| Map FTC Controls Through Redux | Robotics & Engineering | Simulation only | [Review staged draft](https://aresfirst.org/dashboard/academy?edit=ftc-starter-controller-bindings) | [`02-controller-bindings.md`](../content/learning/ftc-starter/02-controller-bindings.md) |
| Add and Verify an FTC Starter Autonomous Routine | Robotics & Engineering | Simulation only | [Review staged draft](https://aresfirst.org/dashboard/academy?edit=ftc-starter-first-autonomous) | [`03-first-autonomous.md`](../content/learning/ftc-starter/03-first-autonomous.md) |
| Commission an FTC Starter Robot Safely | Physics & Applied Science | Physical robot | [Review staged draft](https://aresfirst.org/dashboard/academy?edit=ftc-starter-physical-commissioning) | [`04-physical-commissioning.md`](../content/learning/ftc-starter/04-physical-commissioning.md) |

## Four ARESLib replacements

These files are not staged over the live pages. Approval authorizes the bounded
migration runner to preserve each URL while replacing its inaccurate body and
metadata with the reviewed source below.

| Preserved URL | Reviewed replacement source | Reason |
| --- | --- | --- |
| [`/docs/areslib-fundamentals`](https://aresfirst.org/docs/areslib-fundamentals) | [`areslib-fundamentals.md`](../content/learning/areslib-reference/areslib-fundamentals.md) | Replace the obsolete command/subsystem description with current Redux, module, and loop ownership. |
| [`/docs/autonomous-and-vision`](https://aresfirst.org/docs/autonomous-and-vision) | [`autonomous-and-vision.md`](../content/learning/areslib-reference/autonomous-and-vision.md) | Correct PathPlanner ownership and delayed/rejected vision-measurement boundaries. |
| [`/docs/telemetry-and-control`](https://aresfirst.org/docs/telemetry-and-control) | [`telemetry-and-control.md`](../content/learning/areslib-reference/telemetry-and-control.md) | Replace inaccurate AdvantageKit, AdvantageScope, and USB-log claims with the current NT4 and local-log contracts. |
| [`/docs/swerve-and-kinematics`](https://aresfirst.org/docs/swerve-and-kinematics) | [`swerve-and-kinematics.md`](../content/learning/areslib-reference/swerve-and-kinematics.md) | Separate general drivebase, calibration, feedback, and safety contracts from season-specific behavior. |

## Fifteen metadata-only cross-links

The proposal preserves every existing lesson body and URL. It adds only the
subject and ordered path memberships defined in
[`existing-content-path-plan.json`](../content/learning/existing-content-path-plan.json).

- Math for Robotics: `linear-equations` (1), `trig-basics` (2),
  `trig-inverse` (3), `trig-robotics` (4), `sat-stats` (6), and
  `sat-graphs` (7).
- Applied STEM in the Outdoors: `climbing-fall-factor` (1),
  `climbing-center-of-mass` (2), `climbing-anchor-angles` (3),
  `climbing-capstan-friction` (4), `climbing-finger-biomechanics` (5),
  `cycling-gear-ratios` (6), `skiing-carving-forces` (7),
  `kayaking-hydrodynamics` (8), and `hiking-grade-energy` (9).

The missing Math for Robotics order 5 is intentionally reserved for the staged
`robot-coordinate-contracts` lesson. No Computing & AI item is invented; that
path remains visibly in preparation.

## Recording the decision

After completing the review, send or record a statement with a real public
reviewer label, date, and the three generated review digests. For a full
approval:

> Coach/mentor review completed. Approved by **[public reviewer label]** on
> **[YYYY-MM-DD]**: publish all 11 staged drafts, replace all four ARESLib
> pages, and apply all 15 cross-links. Reviewed digests: **publish-drafts
> [digest]**, **replacements [digest]**, and **cross-links [digest]**.

For partial approval, list approved or rejected slugs in each group. The
operator will create separate approval manifests for `publish-drafts`,
`replacements`, and `cross-links`, dry-run all three phases, and show any
precondition mismatch before requesting the final production-write confirmation.
Each manifest is bound to the exact reviewed scope; changing content or metadata
after review invalidates its digest.
