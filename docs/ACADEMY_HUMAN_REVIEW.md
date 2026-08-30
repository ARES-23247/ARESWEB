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

## Published middle-school expansion and pending refreshes

The four hardware-neutral middle-school lessons below are published. Their
canonical files remain the source for reviewed future refreshes; changing a
file does not change the public lesson until the editorial workflow and a
guarded production migration are separately approved.

| Lesson | Path | Canonical source file |
| --- | --- | --- |
| Use Rates and Units to Describe Motion | Math for Robotics | [`01-rates-units-motion.md`](../content/learning/middle-school-stem/01-rates-units-motion.md) |
| Read a Telemetry Graph Like a Scientist | Math for Robotics | [`02-read-telemetry-graph.md`](../content/learning/middle-school-stem/02-read-telemetry-graph.md) |
| Decide Whether Camera Evidence Is Trustworthy | AI & ML Foundations | [`03-camera-evidence.md`](../content/learning/middle-school-stem/03-camera-evidence.md) |
| Measure, Test, and Improve a Design | Applied STEM in the Outdoors | [`04-measure-test-improve.md`](../content/learning/middle-school-stem/04-measure-test-improve.md) |

The current cycle deepens the camera-evidence and measure/test lessons from
short introductions into the complete eleven-section instructional contract.
Review the camera lesson's observation-versus-explanation language, privacy-safe
photo exercise, capture-time boundary, ordered rejections, and visible reasons.
The Vision Evidence Rejection Lab is code-derived but does not process images,
solve AprilTags, run the estimator, or locate a robot.

Review the shade experiment's independent and response variables, baseline,
measurement method, competing conditions, repeatability, and revision record.
The Evidence Level Scenarios interaction is only a conceptual sorter. It does
not observe the experiment, verify a measurement, or prove a cause. Both pages
pin their ARES examples to commit
`f3de343ac79a62de0a2592d793da84fd82407718`; their new guarded-refresh entries
use hashes read from the current public bodies.

## Robotics curriculum expansion awaiting review

This branch adds thirty-eight new robotics drafts and deepens selected existing lessons.
The files remain local review sources. They are not staged, published, or live.

| Lesson | Path | Safety scope | Canonical source file |
| --- | --- | --- | --- |
| Read and Change Small Kotlin Programs | Programming with ARES | None | [`01-kotlin-basics.md`](../content/learning/programming/01-kotlin-basics.md) |
| Author a Code-First or Hybrid Subsystem | Programming with ARES | Physical robot | [`05-code-first-subsystem.md`](../content/learning/programming/05-code-first-subsystem.md) |
| Build Safe Task Sequences in ARESLib | Programming with ARES | Simulation only | [`07-safe-task-sequences.md`](../content/learning/programming/07-safe-task-sequences.md) |
| Test Robot Logic Across Mocks and Simulation | Programming with ARES | Physical robot | [`08-tests-parity.md`](../content/learning/programming/08-tests-parity.md) |
| Measure, Sketch, and Record a Design | Mechanical Design & Fabrication | None | [`00-measurement-design-notebook.md`](../content/learning/mechanical-design/00-measurement-design-notebook.md) |
| Choose and Use Common Robot Tools | Mechanical Design & Fabrication | Physical robot | [`01-tool-evidence.md`](../content/learning/mechanical-design/01-tool-evidence.md) |
| Fasteners, Threads, and Keeping Parts Together | Mechanical Design & Fabrication | Physical robot | [`02-fastener-evidence.md`](../content/learning/mechanical-design/02-fastener-evidence.md) |
| Frames, Bracing, and Load Paths | Mechanical Design & Fabrication | Physical robot | [`03-load-path-evidence.md`](../content/learning/mechanical-design/03-load-path-evidence.md) |
| Gears, Sprockets, Belts, Speed, and Torque | Mechanical Design & Fabrication | None | [`01-gears-sprockets-belts.md`](../content/learning/mechanical-design/01-gears-sprockets-belts.md) |
| Compare Mecanum, Differential, and Swerve Drivetrains | Mechanical Design & Fabrication | Physical robot | [`02-compare-drivetrains.md`](../content/learning/mechanical-design/02-compare-drivetrains.md) |
| Build Motion with Arms, Elevators, Intakes, and Linkages | Mechanical Design & Fabrication | Physical robot | [`03-mechanism-motion.md`](../content/learning/mechanical-design/03-mechanism-motion.md) |
| From a CAD Model to a Buildable Part | Mechanical Design & Fabrication | Physical robot | [`04-cad-fabrication.md`](../content/learning/mechanical-design/04-cad-fabrication.md) |
| Voltage, Current, Power, and Energy | Electrical Systems & Diagnostics | None | [`01-voltage-current-power.md`](../content/learning/electrical-systems/01-voltage-current-power.md) |
| Batteries, Breakers, Fuses, and Brownouts | Electrical Systems & Diagnostics | Physical robot | [`02-battery-protection.md`](../content/learning/electrical-systems/02-battery-protection.md) |
| Wire, Connectors, Polarity, and Strain Relief | Electrical Systems & Diagnostics | Physical robot | [`03-wiring-connectors.md`](../content/learning/electrical-systems/03-wiring-connectors.md) |
| Choose Motors, Gearmotors, and Servos | Electrical Systems & Diagnostics | Physical robot | [`04-motors-servos.md`](../content/learning/electrical-systems/04-motors-servos.md) |
| Choose and Read Robot Sensors | Electrical Systems & Diagnostics | Physical robot | [`02-choose-read-sensors.md`](../content/learning/electrical-systems/02-choose-read-sensors.md) |
| USB, I2C, CAN, Addresses, and Device Identity | Electrical Systems & Diagnostics | Physical robot | [`03-buses-addresses.md`](../content/learning/electrical-systems/03-buses-addresses.md) |
| Map Hardware and Diagnose a Dead Device | Electrical Systems & Diagnostics | Physical robot | [`07-hardware-map-diagnostics.md`](../content/learning/electrical-systems/07-hardware-map-diagnostics.md) |
| Compare Logs and Replay a Failure | Testing, Debugging & Commissioning | None | [`02-logs-replay.md`](../content/learning/testing-debugging/02-logs-replay.md) |
| Build a Fault Tree and Isolate a Cause | Testing, Debugging & Commissioning | Physical robot | [`03-fault-tree.md`](../content/learning/testing-debugging/03-fault-tree.md) |
| Run SysId and a Bounded Tuning Experiment | Testing, Debugging & Commissioning | Physical robot | [`05-sysid-tuning.md`](../content/learning/testing-debugging/05-sysid-tuning.md) |
| Read Hardware Once and Write Safe Outputs | Programming with ARES | Physical robot | [`04-cached-io.md`](../content/learning/programming/04-cached-io.md) |
| Run a Drive-Team Match Cycle | Competition Operations | Physical robot | [`01-match-cycle.md`](../content/learning/competition-operations/01-match-cycle.md) |
| Collect Useful Scouting Evidence | Competition Operations | None | [`02-scouting-evidence.md`](../content/learning/competition-operations/02-scouting-evidence.md) |
| Turn Evidence into Match Strategy | Competition Operations | None | [`03-strategy-tradeoffs.md`](../content/learning/competition-operations/03-strategy-tradeoffs.md) |
| Review, Repair, and Record after a Match | Competition Operations | Physical robot | [`04-post-match-triage.md`](../content/learning/competition-operations/04-post-match-triage.md) |
| Capstone 1: Model and Test a Simulated Mechanism | Robotics Capstones | Simulation only | [`01-simulated-mechanism.md`](../content/learning/robotics-capstones/01-simulated-mechanism.md) |
| Capstone 2: Build a Complete ARES Subsystem | Robotics Capstones | Physical robot | [`02-complete-subsystem.md`](../content/learning/robotics-capstones/02-complete-subsystem.md) |
| Capstone 3: Complete a Simulated Autonomous Mission | Robotics Capstones | Simulation only | [`03-simulated-autonomous-mission.md`](../content/learning/robotics-capstones/03-simulated-autonomous-mission.md) |
| Capstone 4: Commission a Physical Robot Feature | Robotics Capstones | Physical robot | [`04-physical-feature-commissioning.md`](../content/learning/robotics-capstones/04-physical-feature-commissioning.md) |
| Capstone 5: Present Competition-Readiness Evidence | Robotics Capstones | Physical robot | [`05-competition-readiness-evidence.md`](../content/learning/robotics-capstones/05-competition-readiness-evidence.md) |
| Predict Motion with Feedforward | Controls, Localization & Autonomous | Simulation only | [`02-feedforward-response.md`](../content/learning/controls/02-feedforward-response.md) |
| Tune Feedback with Evidence | Controls, Localization & Autonomous | Simulation only | [`03-pid-evidence.md`](../content/learning/controls/03-pid-evidence.md) |
| Plan Smooth Motion with Limits | Controls, Localization & Autonomous | Simulation only | [`04-motion-profiles.md`](../content/learning/controls/04-motion-profiles.md) |
| Estimate Motion with Odometry | Controls, Localization & Autonomous | Physical robot | [`05-odometry-calibration.md`](../content/learning/controls/05-odometry-calibration.md) |
| Combine Measurements without Hiding Uncertainty | Controls, Localization & Autonomous | Simulation only | [`06-sensor-fusion.md`](../content/learning/controls/06-sensor-fusion.md) |
| Use AprilTags and Reject Bad Vision Measurements | Controls, Localization & Autonomous | Physical robot | [`07-vision-rejection.md`](../content/learning/controls/07-vision-rejection.md) |

The review must also cover the upgraded coordinate, Redux, simulation-evidence,
and full-contract telemetry lessons, plus every approved interaction named in
the generated registry. The telemetry reference now begins the testing path
after the simulation-evidence lesson. Review its control/telemetry/log/import
boundaries, fixed voltage/distance/missing-sample cases, observation-versus-
explanation activity, privacy guidance, native controls, data table, and
deterministic reset. Confirm that the lesson data is invented and cannot prove
a real signal, timing behavior, network load, controller response, or failure
cause. The
Control Response Lab is intentionally reused in the existing telemetry-reading
lesson as an optional graph exercise. Review that embed for age fit and verify
that its conceptual-model warning remains visible in both lesson contexts.
The existing `ftc-starter-first-autonomous` tutorial is also upgraded in place;
it is not an eleventh new draft. Review its Autonomous Path Clearance Lab and
Motion Profile Lab together with the real Studio, project-verification, Local
Simulator, and student-led physical-test boundaries. Review the new typed
RoutineDocument, task-tree compilation, resource-conflict, and bounded-wait
explanations against ARES 11.1.0 and Studio 2.0.3. Confirm that neither web model
is described as project, robot, or physical-clearance validation.
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
The task-sequence lesson now follows season composition. Review its group
completion rules, finite waits, resource ownership, preemption, cancellation,
and failure cleanup against the pinned `RobotSequence`, `TaskExecutor`, and
`TaskResources` source. Its reused Superstructure State Coordination Lab is an
invented guard-order model, not an ARES task-tree runner or hardware test.
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
The new mechanism lesson and existing gear lesson share the Mechanism Motion
Explorer. Review its arm-angle, elevator-travel, and roller-surface calculations;
finite-value and positive-ratio guards; unit-bearing results; native controls;
live result; narrow layout; and deterministic reset. Confirm that the ideal
model cannot choose hardware, solve linkage geometry, inspect clearance,
command a robot, or prove safe motion. The authentic team mechanism-image
request remains open.
The new CAD/fabrication lesson and existing measurement lesson share the
Tolerance Stack Lab. Review its nominal sum, one-direction worst-case range,
required-range decision, invalid-value handling, unit-bearing native inputs,
live result, narrow layout, and deterministic reset. Confirm that the model
does not check hole position, angles, fit class, material, process capability,
load, or a real part. The paired authentic team CAD and fabricated-part media
request remains open.
The new battery-protection lesson and existing voltage/current lesson share the
Brownout State Sandbox. Review its healthy, warning, and critical transitions;
linear warning scale; hysteresis recovery; invalid-value fail-closed behavior;
native controls; live result; narrow layout; and deterministic reset. Confirm
that its ARES example profile is not presented as current league rules, a
component rating, a battery model, a current estimate, a protection-device
choice, or physical proof. The official FTC/FRC electrical-rule request stays
open.
The new wiring lesson and existing hardware-map diagnostic share the Wiring
Plan Diagnostic Lab. Review its ordered isolation, identity, polarity,
connector, routing/strain-relief, and protection-source checks; native
checkboxes; first-missing feedback; narrow layout; and deterministic reset.
Confirm that its self-reported boxes do not inspect wiring, read a diagram,
verify a source, identify a connector, choose a rating, energize a circuit, or
prove correct wiring. The authentic team wiring-photo request remains open.
The new actuator lesson and existing mechanism lesson share the Motor and Servo
Evidence Sorter. Review its continuous-speed, bounded-angle, and multi-turn
position paths; ordered source, feedback, homing, limit, and safe-neutral
checks; native controls; live result; narrow layout; and deterministic reset.
Confirm that its self-reported choices do not read requirements, verify a data
sheet, calculate load or electrical limits, choose a product, command hardware,
or approve physical operation. Approved manufacturer specifications remain an
open source request.
The new scouting lesson and existing drive-team lesson share the Scouting
Evidence Quality Lab. Review its ordered source, observation, context, sample,
missing-data, and privacy checks; native controls; first-missing feedback;
narrow layout; and deterministic reset. Confirm that self-reported boxes do
not watch a match, read a log, verify a source, count events, remove personal
data, compare or rank robots, judge people, or create strategy. The current
team scouting process and approved non-PII examples remain open for review.
The new strategy lesson and scouting extension share the Strategy Tradeoff
Lab. Review the visible zero-to-three ratings and weights, weighted scores,
Plan A, Plan B, and tie outcomes, invalid-weight state, native controls,
mobile table overflow, live result, and deterministic reset. Confirm that the
matrix cannot read data, model current game rules or teams, predict a match,
optimize a plan, or make a decision. The team strategy process remains open
for review, and the ARES Match Strategy screen is correctly named as a
sample-only developer preview rather than a source of real evidence.
The new post-match lesson and existing fault-tree extension share the
Post-Match Triage Lab. Review its ordered safe-state, symptom, source,
inspection-boundary, owner/stop, next-test, and return-status checks; native
controls; first-missing result; narrow layout; and deterministic reset. Confirm
that self-reported boxes cannot inspect or disable a robot, preserve a log,
diagnose damage, assign a person, approve repair, authorize motion, or return a
robot to play. The current authentic team checklist remains an open request.
The new common-tools lesson and existing CAD/fabrication extension share the
Tool Task Evidence Lab. Review all five task categories, the ordered exact-tool,
task/material, approved-instructions, work-area/workholding,
training/protection, and isolation/stop checks; native controls; first-missing
result; narrow layout; and deterministic reset. Confirm that the lab only
organizes a paper review: it cannot identify a tool, inspect its condition,
choose protection, verify training, secure work, authorize operation, or teach
tool-specific operation. Official tool guidance and authentic team photos
remain open source requests.
The new fastener lesson contains the Fastener Joint Evidence Lab, and the tool
and CAD lessons now link into that lesson where a joint decision begins.
Review all four joint-purpose paths; the ordered job, exact-parts,
standard-source, mating-interface, load/clearance, retention/tightening-source,
and inspection/service checks; native controls; first-missing result; narrow
layout; and deterministic reset. Confirm that the lab cannot inspect a joint,
identify threads, verify compatibility, calculate strength or clamping force,
choose hardware, set torque, detect loosening, supervise assembly, or approve
physical use. Manufacturer fastener references remain an open request.
The new structure lesson and existing drivetrain extension share the Load Path
Evidence Explorer. Review its front-contact, arm-payload, side-mechanism, and
hanging-support routes; ordered input, transfer-member, joint, reaction,
direction-change, open-point, and later-test checks; semantic ordered path;
native controls; first-missing result; narrow-screen reflow; and deterministic
reset. Confirm that it cannot calculate force, stress, stiffness, bending,
buckling, impact, fatigue, safety factor, joint capacity, traction, or
stability; inspect a robot; choose material or geometry; authorize loading; or
prove a structure safe. Authentic team structure images remain an open request.
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
The first two capstones share the Capstone Evidence Board. Review its ordered
requirement, design, implementation, test, fault, safety, and limitation
sections; first-missing action; native checks; live result; and deterministic
reset. Confirm that each box is self-reported and cannot inspect source, run
tests, review work, approve publication, authorize operation, or prove a claim.
The simulated autonomous capstone reuses the Autonomous Path Clearance Lab,
Motion Profile Lab, and Capstone Evidence Board. Review the full-footprint and
obstacle checks, conservative motion limits, typed-action and resource steps,
Blue and Red cases, blocked case, neutral result, and packet limits. Confirm
that previews, generation, and Local Sim are never called deployment, physical
clearance, or competition-readiness evidence.
The physical-feature capstone reuses the Commissioning Boundary Checklist and
Capstone Evidence Board. Review the source and inventory identity, current
simulation and configuration evidence, restrained setup, smallest output,
stop readiness, unexpected-result rule, authentic student record, privacy
boundary, and stale-evidence behavior. Confirm that the open physical-evidence
request cannot be fulfilled by either checklist or simulation output.
The competition-readiness capstone reuses the Capstone Evidence Board and adds
a draft team rubric. Review narrow claims, exact source and inventory identity,
evidence levels, stop and fallback results, stale evidence, pit and operations
handoffs, privacy, go/limited-go/no-go decisions, and next actions. Students and
the team own robot-process review; only website publication uses the editorial
Lead Coach gate. Authentic evidence from each claimed boundary remains required.
Missing authentic media and
official event sources stay blocked in
[`curriculum-source-requests.json`](../content/learning/curriculum-source-requests.json).

The current reviewed source authority is ARES 11.1.0 / Studio 2.0.3 at commit
`f3de343a`. Existing 11.0.0, 11.1.0/2.0.1, and 11.1.0/2.0.2 source links remain immutable historical pins until
their individual lesson review is complete; a release-number change alone does
not authorize silently replacing those references.

### Current-source drift review

The 2026-08-30 source-drift audit compared all 142 pinned source paths with
ARES-Robotics commit `f3de343a`. Of those references, 136 still point to content
that is byte-for-byte current. Six references had changed and were reviewed
against their current files rather than being advanced by version number alone.

The refreshed existing lessons cover rates and time units, robot-local odometry
and capture time, logger health and canonical pose topics, physical validation
and cached hardware reads, and the drive-team local-log handoff. The published
rates, graph, coordinate, simulation-limit, and telemetry lessons have guarded
refresh entries based on the current live bodies. `competition-drive-team`
remains a draft, so it is intentionally absent from the published refresh plan.
No production document was changed by this source review.

## Continuous cycle: existing ARESLib reference depth

This cycle improves three already-published references instead of adding lesson
count: `areslib-fundamentals`, `swerve-and-kinematics`, and
`autonomous-and-vision`. Review each rendered page at narrow and wide widths.
Confirm that it uses all eleven instructional sections, stays clear for a
middle-school reader, and keeps source facts separate from student evidence.

The fundamentals page adds the Robot Flow Tracer and an ownership-map activity.
Confirm that the tracer is described as a fixed concept model. It must not claim
to inspect a repository, run Redux, compile code, or command hardware.

The drivebase page adds the Drivetrain Choice Lab and a measured-geometry
activity. Confirm that topology and tuning stay separate, stable module identity
crosses every layer, and a simulation result is never called physical proof.
Student-led restrained checks must keep the team's robot-safety procedure.

The autonomous page adds the Autonomous Path Clearance Lab beside the existing
Vision Uncertainty Lab. Confirm that both have visible fidelity statements.
They must not claim to read team routines, check a real field, calibrate a
camera, run an estimator, compile code, or validate a physical robot.

All three references pin their reviewed facts to ARES Robotics commit
`1c92c61c2faaca2a630e525a76e41d4f7657815c`. Remote validation must recompute
the listed Git blob hashes and confirm the ARES 11.1.0 / Studio 2.0.2 version
identity before review. The existing `refresh-published` entries retain hashes
of the live short versions, so any later editorial change blocks migration
instead of being overwritten.

## Continuous cycle: existing beginner lesson depth

This cycle improves five already-published beginner lessons rather than adding
more titles: `ares-workspace-map`, `run-first-ftc-simulation`,
`telemetry-and-local-logs`, `ftc-starter-project-identity`, and
`ftc-starter-controller-bindings`. Each former short page now uses the full
eleven-section instructional contract with a worked example, described visual,
student activity, checkpoints, troubleshooting, evidence artifact, assessment,
extension, and next-step links.

Review the workspace lesson's current monorepo ownership map and Subsystem
Ownership Lab. Confirm that the lab is only a conceptual sorter and does not
claim to inspect the repository. Confirm that FTC and FRC keep separate builds,
lifecycles, adapters, and simulators even though their source shares one Git
history.

Review the first-simulation lesson's explicit build, process, connection,
OpMode, armed-control, movement-evidence, and stop boundaries. The
Commissioning Boundary Checklist is a self-reported concept model. It does not
launch Studio, run a build, send controls, inspect hardware, or authorize
motion. Confirm that Live Robot remains outside the activity.

Review the telemetry lesson's NT4 `5810` and local-log HTTP `5002` paths,
offline-first boundary, completed-file rule, topic units, and public-network
warning. The Telemetry Graph Lab uses fixed conceptual data. It does not
connect to NT4, read a team log, diagnose a cause, or prove robot behavior.

Review the project-identity lesson's staged creation, canonical `.ares`
documents, generated output, lifecycle adapter, provenance, and intentionally
empty mechanism and routine catalogs. The Hardware Topology Diagnostic cannot
inspect a project, discover a device, validate wiring, or remove the
simulation-first boundary.

Review the controller-binding lesson's input, generated binding, action,
reducer, state, controller, cached output, and adapter trace. The Redux State
Tracer does not read a real binding, execute a reducer, command a simulator, or
validate physical input or output. Confirm that rejected safety conditions are
kept as evidence instead of bypassed.

All five lessons pin reviewed facts to ARES Robotics commit
`1c92c61c2faaca2a630e525a76e41d4f7657815c` and the ARES 11.1.0 / Studio 2.0.2
release identity. Their existing `refresh-published` entries keep hashes of the
current live short bodies. Review and guarded migration are still required;
this source change alone does not publish or overwrite curriculum data.

## Continuous cycle: existing testing and parity lesson

This cycle improves the existing `programming-tests-parity` lesson and its Adapter Parity Evidence
Lab. Review the source-backed test ladder from configuration and compilation through unit tests,
desktop simulation, and restrained physical checks. Confirm that each stage states both what its
evidence can support and what remains unknown.

The lesson now gives the current ARES-FTC unit and simulator task names, records the generated
verification categories, and explains the FTC lifecycle parity test without calling it motor or
hardware proof. The interaction remains a conceptual planning form: it does not run Gradle, inspect
test output, inject a fault, connect to a robot, or prove physical behavior. Verify native keyboard
and touch operation, narrow-screen reflow, visible focus, live result announcements, deterministic
reset, and reduced-motion behavior.

All five lesson sources are pinned to ARES Robotics commit `f3de343a` and the ARES 11.1.0 / Studio
2.0.3 identity. Remote verification must recompute each blob hash. This local curriculum edit does
not publish or overwrite the live lesson.

## Continuous cycle: existing vision lesson depth

This cycle improves the existing `controls-vision` lesson and its Vision Evidence Rejection Lab.
It does not add a replacement title. Review the capture-time worked example, the two-layer ARES
filter explanation, the plain-language rejection table, the expanded evidence activity, and the
privacy-aware stationary and slow-motion test plans.

The interaction now keeps later failed checks visible while preserving the ordered first reason. It
also compares capture-time and receipt-time residuals with a simple straight-line model. Confirm
native keyboard and touch controls, narrow-screen reflow, visible focus, live result announcements,
deterministic reset, and readable labels. The interaction does not process an image, solve a tag
pose, calculate covariance or Mahalanobis distance, run the ARES estimator, connect to a camera, or
prove a physical field pose.

The three reviewed lesson sources are pinned to ARES Robotics commit `f3de343a` and the ARES 11.1.0
/ Studio 2.0.3 identity. Their Git blobs are unchanged from the earlier reviewed revision. A
repository-wide comparison on 2026-08-30 also found all 126 historical catalog source paths present
and byte-for-byte unchanged at this release. Remote verification must still recompute each listed
hash. This local curriculum change does not stage, publish, or overwrite production data.

## Continuous cycle: existing sensor-fusion lesson depth

This cycle improves the existing `controls-sensor-fusion` lesson and its Sensor Fusion Uncertainty
Lab. It does not add a replacement title. Review the grade 6-8 explanation of signed residuals,
inverse-variance influence, process noise `Q`, measurement noise `R`, delayed updates, innovation
tests, and estimator ownership. Confirm that the lesson separates a strong uncertainty claim from
verified accuracy and keeps independent surveyed truth outside the fusion calculation.

The interaction now displays each accepted source's influence, a signed residual, and error from an
independent truth value. It keeps rejected vision evidence in the table and gives it zero influence.
Confirm native keyboard and touch controls, narrow-screen reflow, visible focus, live result
announcements, deterministic reset, and readable table overflow. Changing independent truth must
change only the displayed error, never the fused result.

The interaction is an invented one-dimensional weighted average. It does not run the ARES EKF,
calculate matrix covariance or normalized innovation squared, replay pose history, inspect a camera,
or prove a physical robot pose. The two reviewed lesson sources are pinned to ARES Robotics commit
`f3de343a` and the ARES 11.1.0 / Studio 2.0.3 identity. Their Git blobs are unchanged from the earlier
reviewed revision. Remote verification must still recompute each listed hash. This local curriculum
change does not stage, publish, or overwrite production data.

## Continuous cycle: existing motion-profile lesson depth

This cycle improves the existing `controls-motion-profiles` lesson and its Motion Profile Lab. It
does not add a replacement title. Review the grade 6-8 cruise-boundary calculation, phase and unit
explanations, planned-versus-measured evidence activity, and description of the current ARES
profile's reverse-motion, nonzero boundary-speed, and fail-closed behavior.

The interaction now exposes the exact rest-to-rest cruise boundary, speed-up time, and signed
acceleration in its text table. Confirm native keyboard and touch controls, narrow-screen reflow,
visible focus, live result announcements, deterministic reset, and horizontal table overflow.
At the exact boundary, the lesson must report a triangular profile with zero cruise time. Above the
boundary, it must report a trapezoidal profile with positive cruise time.

The interaction plans only positive, one-dimensional, rest-to-rest motion. It does not run the ARES
profile class, model reverse motion or nonzero start and goal speeds, control a mechanism, read a
sensor, predict tracking error, or prove physical limits. The two reviewed sources are pinned to
ARES Robotics commit `f3de343a` and the ARES 11.1.0 / Studio 2.0.3 identity. Their local files still
hash to the listed reviewed Git blobs. Remote verification must recompute those hashes. This local
curriculum change does not stage, publish, or overwrite production data.

## Continuous cycle: existing odometry lesson depth

This cycle improves the existing `controls-odometry` lesson and its Odometry Calibration and
Source Lab. It does not add a replacement title. Review the grade 6-8 explanations of signed X/Y
residuals, independent surveyed truth, four field directions, repeated calibration routes, sample
health, immediate FTC failover, five-consecutive-sample recovery, and source rebasing.

The interaction now supports field positive X, positive Y, negative X, and negative Y routes. It
shows surveyed and estimated coordinates, signed residuals, and total endpoint error in both visual
and complete text-result forms. A second keyboard and touch workflow traces one bad primary sample, held
fallback recovery, a bad-sample count reset, and the fifth-sample return to Pinpoint. Confirm
narrow-screen reflow, visible focus, live result announcements, deterministic reset, readable table
overflow, and no dependence on pointer-only gestures.

The endpoint model applies exact scale and heading errors to straight routes. The source trace copies
only the ARES FTC selector state rules. It does not run the ARES pose estimator, integrate drivetrain
wheels, inspect a physical sensor, model noise or slip, or prove robot accuracy. It also does not
calculate the fused pose used to rebase either source during a handoff.

The reviewed web references are pinned to ARES Robotics commit `f3de343a` and the ARES 11.1.0 /
Studio 2.0.3 identity. That snapshot contains the same Pinpoint health states, immediate failover,
five-sample recovery, and pose-continuity handoff described by the lesson. The current local ARES
checkout was also inspected at commit `3d10f63a`; its relevant source files are clean, and the same
runtime behavior remains present even though `FtcBaseRobot.kt` has a newer Git blob. Remote catalog
verification must recompute all four pinned source hashes. This local curriculum change does not
stage, publish, or overwrite production data.

## Continuous cycle: existing subsystem-authoring lesson depth

This cycle improves the existing `programming-code-subsystem` lesson and its Subsystem Ownership
Decision Lab. It does not add a replacement title. Review the new comparison of the current
`DECLARATIVE_GENERATED`, `GENERATED_STARTER`, and `HAND_AUTHORED` implementation kinds with their
required `GENERATED_DO_NOT_EDIT`, `GENERATED_STARTER`, and `USER_OWNED` source ownership. Confirm
that hand-authored registration names real modules, project-relative source files, runtime classes,
simulation support, and catalog actions instead of claiming ARES can infer Kotlin ownership.

Review the lesson's preview and replacement flow. A generated starter may be added when missing. A
changed generated starter requires a current structured diff and the exact hash-bound confirmation
token. User-owned or unknown source remains protected. Generated do-not-edit output stays under
Gradle generated directories and is recreated from the canonical `.aressubsystem` document.

The interaction now offers all three implementation paths and a five-part evidence checklist. It
keeps missing units, cached-input rules, neutral recovery, simulation parity, and evidence-layer
planning visible. Confirm native radio and checkbox controls, keyboard focus, 44-pixel targets,
narrow-screen reflow, live result announcements, and deterministic reset.

The lab is a conceptual planning form. It does not inspect Kotlin or a descriptor, validate schema
11, identify hazards, create files, run tests, connect to a simulator, command hardware, or prove a
subsystem safe. Its completed state means only that five planning boxes are checked. Students retain
authority to perform the team's physical verification process. Website posts use the separate Lead
Coach editorial workflow.

The four reviewed sources are pinned to ARES Robotics commit `f3de343a` and the ARES 11.1.0 /
Studio 2.0.3 identity. The local ARES worktree remains on the older `3d10f63a` development branch,
so the current reviewed release files were read directly from the fetched immutable commit rather
than by changing or cleaning that dirty worktree. Remote catalog verification must recompute all
four Git blob hashes. This local curriculum change does not stage, publish, or overwrite production
data.

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
