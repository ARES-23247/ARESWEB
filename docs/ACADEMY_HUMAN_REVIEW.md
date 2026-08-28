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
- physical-robot work clearly requires a disabled setup, the team's student-led
  safety procedure, staged commissioning, and an accessible emergency stop;
- language and exercises are suitable for the intended student audience;
- links, headings, tables, lists, code, and instructions are understandable by
  keyboard and on a narrow screen;
- each interaction serves a named learning objective, has a visible fidelity
  limit and deterministic reset, exposes its result to assistive technology,
  and remains usable with keyboard, touch, reduced motion, and narrow screens;
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

These links identify the current season-code review set. The first release and
the later monorepo replacement have separate migration audit records; do not
reuse an old approval digest after changing any lesson.

| Lesson | Safety scope | Public lesson | Canonical source file |
| --- | --- | --- | --- |
| Compose an FTC Season Robot That Fails Safe | Simulation only | [Open lesson](https://aresfirst.org/academy/ftc-season-composition-and-safe-lifecycle) | [`01-season-composition.md`](../content/learning/current-robot/01-season-composition.md) |
| Shape FTC Driver Input Without Losing the Frame | Simulation only | [Open lesson](https://aresfirst.org/academy/ftc-driver-input-shaping-and-frames) | [`02-driver-input-frames.md`](../content/learning/current-robot/02-driver-input-frames.md) |
| Author GUI-Owned FTC Indicator Lights | Physical robot | [Open lesson](https://aresfirst.org/academy/ftc-gui-owned-indicator-lights) | [`03-gui-owned-indicator-lights.md`](../content/learning/current-robot/03-gui-owned-indicator-lights.md) |

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
`robot-coordinate-contracts` lesson.

## Middle-school expansion awaiting review

The current proposal refreshes the 18 source-pinned robotics lessons with grade
6-8 language and described Mermaid diagrams. It also stages four new,
hardware-neutral lessons. None of these proposal files are live until the
website editorial workflow and production migration are separately approved.

| Lesson | Path | Canonical source file |
| --- | --- | --- |
| Use Rates and Units to Describe Motion | Math for Robotics | [`01-rates-units-motion.md`](../content/learning/middle-school-stem/01-rates-units-motion.md) |
| Read a Telemetry Graph Like a Scientist | Math for Robotics | [`02-read-telemetry-graph.md`](../content/learning/middle-school-stem/02-read-telemetry-graph.md) |
| Decide Whether Camera Evidence Is Trustworthy | AI & ML Foundations | [`03-camera-evidence.md`](../content/learning/middle-school-stem/03-camera-evidence.md) |
| Measure, Test, and Improve a Design | Applied STEM in the Outdoors | [`04-measure-test-improve.md`](../content/learning/middle-school-stem/04-measure-test-improve.md) |

## Robotics curriculum expansion awaiting review

This branch adds eleven new robotics drafts and deepens selected existing lessons.
The files remain local review sources. They are not staged, published, or live.

| Lesson | Path | Safety scope | Canonical source file |
| --- | --- | --- | --- |
| Gears, Sprockets, Belts, Speed, and Torque | Mechanical Design & Fabrication | None | [`01-gears-sprockets-belts.md`](../content/learning/mechanical-design/01-gears-sprockets-belts.md) |
| Voltage, Current, Power, and Energy | Electrical Systems & Diagnostics | None | [`01-voltage-current-power.md`](../content/learning/electrical-systems/01-voltage-current-power.md) |
| Read Hardware Once and Write Safe Outputs | Programming with ARES | Physical robot | [`04-cached-io.md`](../content/learning/programming/04-cached-io.md) |
| Run a Drive-Team Match Cycle | Competition Operations | Physical robot | [`01-match-cycle.md`](../content/learning/competition-operations/01-match-cycle.md) |
| Capstone 1: Model and Test a Simulated Mechanism | Robotics Capstones | Simulation only | [`01-simulated-mechanism.md`](../content/learning/robotics-capstones/01-simulated-mechanism.md) |
| Predict Motion with Feedforward | Controls, Localization & Autonomous | Simulation only | [`02-feedforward-response.md`](../content/learning/controls/02-feedforward-response.md) |
| Tune Feedback with Evidence | Controls, Localization & Autonomous | Simulation only | [`03-pid-evidence.md`](../content/learning/controls/03-pid-evidence.md) |
| Plan Smooth Motion with Limits | Controls, Localization & Autonomous | Simulation only | [`04-motion-profiles.md`](../content/learning/controls/04-motion-profiles.md) |
| Estimate Motion with Odometry | Controls, Localization & Autonomous | Physical robot | [`05-odometry-calibration.md`](../content/learning/controls/05-odometry-calibration.md) |
| Combine Measurements without Hiding Uncertainty | Controls, Localization & Autonomous | Simulation only | [`06-sensor-fusion.md`](../content/learning/controls/06-sensor-fusion.md) |
| Use AprilTags and Reject Bad Vision Measurements | Controls, Localization & Autonomous | Physical robot | [`07-vision-rejection.md`](../content/learning/controls/07-vision-rejection.md) |

The review must also cover the upgraded coordinate, Redux, and
simulation-evidence lessons, the telemetry interaction added to the ARESLib
reference, and every approved interaction named in the generated registry. The
Control Response Lab is intentionally reused in the existing telemetry-reading
lesson as an optional graph exercise. Review that embed for age fit and verify
that its conceptual-model warning remains visible in both lesson contexts.
The existing `ftc-starter-first-autonomous` tutorial is also upgraded in place;
it is not an eleventh new draft. Review its Autonomous Path Clearance Lab and
Motion Profile Lab together with the real Studio, project-verification, Local
Simulator, and student-led physical-test boundaries. Confirm that neither web
model is described as project, robot, or physical-clearance validation.
The existing `robot-input-to-output` tutorial is upgraded in place as well.
Review its Robot Input-to-Output Flow Tracer for keyboard order, touch targets,
live step announcements, narrow-screen reflow, and the visible statement that
the trace does not inspect code, run the scheduler, or command hardware.
The existing `ftc-gui-owned-indicator-lights` tutorial now fills the planned
GUI-owned subsystem lesson. Review its descriptor preview for independent
targets, safe-off reset, stable slider names, text-equivalent results, and the
clear separation between concept, generated tests, simulation, and hardware.
Missing authentic media and
official event sources stay blocked in
[`curriculum-source-requests.json`](../content/learning/curriculum-source-requests.json).

The current reviewed source authority is ARES 11.1.0 / Studio 2.0.1 at commit
`65351a27`. Existing 11.0.0 source links remain immutable historical pins until
their individual lesson review is complete; a release-number change alone does
not authorize silently replacing those references.

## Recording future decisions

The grade 6-8 refresh uses the approval-gated `refresh-published` phase for the
18 existing lessons. Review the rendered lesson, its diagram alternative, and
its pinned `ARES-Robotics` sources. The runner verifies the recorded hash of the
old live body before it can update anything, so a lesson edited since this plan
was prepared blocks instead of being overwritten. The four new STEM lessons use
the separate `stage-drafts` and `publish-drafts` phases.

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
