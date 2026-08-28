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
| Coordinate Subsystems and Fail Safe | Physical robot | [Open lesson](https://aresfirst.org/academy/ftc-season-composition-and-safe-lifecycle) | [`01-season-composition.md`](../content/learning/current-robot/01-season-composition.md) |
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

This branch adds twenty-two new robotics drafts and deepens selected existing lessons.
The files remain local review sources. They are not staged, published, or live.

| Lesson | Path | Safety scope | Canonical source file |
| --- | --- | --- | --- |
| Read and Change Small Kotlin Programs | Programming with ARES | None | [`01-kotlin-basics.md`](../content/learning/programming/01-kotlin-basics.md) |
| Author a Code-First or Hybrid Subsystem | Programming with ARES | Physical robot | [`05-code-first-subsystem.md`](../content/learning/programming/05-code-first-subsystem.md) |
| Test Robot Logic Across Mocks and Simulation | Programming with ARES | Physical robot | [`08-tests-parity.md`](../content/learning/programming/08-tests-parity.md) |
| Measure, Sketch, and Record a Design | Mechanical Design & Fabrication | None | [`00-measurement-design-notebook.md`](../content/learning/mechanical-design/00-measurement-design-notebook.md) |
| Gears, Sprockets, Belts, Speed, and Torque | Mechanical Design & Fabrication | None | [`01-gears-sprockets-belts.md`](../content/learning/mechanical-design/01-gears-sprockets-belts.md) |
| Compare Mecanum, Differential, and Swerve Drivetrains | Mechanical Design & Fabrication | Physical robot | [`02-compare-drivetrains.md`](../content/learning/mechanical-design/02-compare-drivetrains.md) |
| Voltage, Current, Power, and Energy | Electrical Systems & Diagnostics | None | [`01-voltage-current-power.md`](../content/learning/electrical-systems/01-voltage-current-power.md) |
| Choose and Read Robot Sensors | Electrical Systems & Diagnostics | Physical robot | [`02-choose-read-sensors.md`](../content/learning/electrical-systems/02-choose-read-sensors.md) |
| USB, I2C, CAN, Addresses, and Device Identity | Electrical Systems & Diagnostics | Physical robot | [`03-buses-addresses.md`](../content/learning/electrical-systems/03-buses-addresses.md) |
| Map Hardware and Diagnose a Dead Device | Electrical Systems & Diagnostics | Physical robot | [`07-hardware-map-diagnostics.md`](../content/learning/electrical-systems/07-hardware-map-diagnostics.md) |
| Compare Logs and Replay a Failure | Testing, Debugging & Commissioning | None | [`02-logs-replay.md`](../content/learning/testing-debugging/02-logs-replay.md) |
| Build a Fault Tree and Isolate a Cause | Testing, Debugging & Commissioning | Physical robot | [`03-fault-tree.md`](../content/learning/testing-debugging/03-fault-tree.md) |
| Run SysId and a Bounded Tuning Experiment | Testing, Debugging & Commissioning | Physical robot | [`05-sysid-tuning.md`](../content/learning/testing-debugging/05-sysid-tuning.md) |
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
The new Kotlin lesson begins the Programming with ARES path, followed by the
upgraded input-to-output and Redux tutorials. Review its fixed expression lab
for native number-input behavior, deterministic reset, arithmetic order, and
the visible warning that it neither compiles Kotlin nor runs robot code.
The code-first subsystem lesson follows the existing GUI-owned indicator-light
tutorial rather than replacing it. Review the ownership lab's generated,
hybrid, and hand-authored starting paths; its native controls and table; and
its warning that two questions cannot inspect source, identify hazards, or
approve physical operation.
The existing season-composition tutorial now fills the planned superstructure
lesson. Review its ordered disabled and health fallbacks, transient posture,
measured guard, complete preset, deterministic steps, and physical-test
boundary. Confirm that the invented three-posture model is not presented as the
real ARES runtime or as proof of physical clearance.
The parity lesson closes the current Programming with ARES path. Review all
four evidence classifications, native selects, deterministic reset, and the
rule that shared compile success is weaker than matching runtime behavior.
Confirm that platform-adapter and mock tests are never labeled as physical
robot evidence.
The drivetrain comparison leads into the existing advanced swerve reference.
Review its four source-backed ARES starting points, native design-evidence
checks, comparison table, mobile overflow behavior, and warning that lesson
marks do not select or validate physical hardware.
The sensor lesson deliberately uses one distance-signal interaction instead of
pretending to model every device type. Review its finite-value, identity,
health, age, and range gates; native controls; visible blocked reasons; reset;
and separation between a cached software sample and real physical sensing.
The bus-and-address lesson follows that sensor page and compares only two
invented connection records. Review its connection-type, normalized bus or
parent, and numeric address gates; native controls; visible conflict reason;
deterministic reset; and checklist. Confirm that “no duplicate” is never
presented as project scanning, device discovery, valid vendor or league ranges,
correct wiring, or proof of physical identity.
The existing FTC physical-commissioning tutorial now contains the planned
Commissioning Boundary Checklist instead of creating a second FTC-specific
page. Review the ordered code, simulation, configuration, stop-readiness, and
restrained-setup gates; the unexpected-result override; deterministic reset;
and the visible statement that self-reported boxes cannot authorize motion or
prove physical behavior. Confirm that students can run and document the team's
robot-safety procedure without language requiring mentor approval; website
publication remains the separate Lead Coach approval boundary.
The beginner camera lesson, ARES vision reference, and advanced controls lesson
now share the Vision Evidence Rejection Lab. Review all six named gates,
ordered first-failure reporting, native checkboxes, deterministic reset, and
the visible rejection reason. Confirm that the switches are not presented as
image processing, AprilTag solving, ambiguity or innovation calculation,
latency modeling, estimator execution, or proof of field position.
The existing FTC driver-input tutorial now contains the Driver Input Curve Lab
and a full middle-school instructional contract. Review its finite-value and
clamp rules, `0.05` deadband rescale, positive exponent and fallback, fixed
`0.6`/`0.4` smoothing step, alliance/frame selection, native controls, and
deterministic reset. Confirm that the one-axis calculation is not presented as
a timed loop, complete gamepad adapter, drivetrain simulation, or physical
driving validation.
The new mechanical measurement lesson intentionally uses a described diagram
and an open authentic-media request. Review its datum, repeatability,
measured-versus-calculated labels, revision trace, privacy note, and
student-repeat activity. Confirm that it does not fabricate a team photo,
select a tool or tolerance without evidence, or treat a value from another
robot as a measurement of the current robot.
The hardware-map diagnostic follows the missing electrical lessons at its
final planned path position; sensor and bus pages were renumbered to preserve
room for those future source-gated lessons. Review the ordered inventory, name,
connection, startup-health, cached-input, and output-write checks; native
controls; first-failure result; and deterministic reset. Confirm that all boxes
are self-reported and that a passing software sequence is not called a root
cause, wiring check, physical operation, or proof that the device works.
The log-comparison lesson follows the existing telemetry reference and
simulation-limits lesson. Review its source identity and digest checks,
baseline reason, timestamp-versus-shared-event alignment, unit-bearing signal
choices, two-hypothesis evidence report, native controls, live table, and
deterministic reset. Confirm that the fixed sample runs are not presented as
imported team logs and that the lab does not infer a cause, prove a fault, or
replace review in Studio or another real log tool.
The fault-tree lesson and existing hardware-map diagnostic share the Fault Tree
Isolation Lab. Review its request, output-write, motion, and current evidence
order; competing open branches; smallest safe next test; native controls; live
result; and deterministic reset. Confirm that its invented selections do not
read robot state, inspect power or wiring, move a mechanism, authorize output,
identify a root cause, or prove a repair.
The bounded SysId and tuning lesson and existing PID lesson share the
One-Change Tuning Experiment Lab. Review its prior threshold, intended
direction, exactly-one-change gate, improved/regressed/inconclusive result,
native controls, live result, and deterministic reset. Confirm that the fixed
numbers are not presented as SysId data and that the lab cannot apply a
parameter, control a simulator or robot, certify safety, or promote a profile.
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
