# Compose an FTC season robot that fails safe

This tutorial reads the checked-in `AresRobot` composition root from the ARES 11 monorepo source
line. It is a source-reading exercise. Complete the trace in simulation; do not infer that a
physical mechanism is safe merely because its generated constructor or simulator path succeeds.

## Generated systems and construction safety

The generated subsystem and superstructure registries install Robot Builder descriptors through
normal subsystem lifecycle plumbing. If either registry fails during construction, the composition
root closes the already-created shared robot services and rethrows the failure. The object cannot
return as a partly initialized robot.

Lightbot's two indicator lights and Prism are owned by canonical `.aressubsystem` descriptors. Their
individual `requiredAtStartup` policy lives in those descriptors and generated registries, not in a
parallel hand-written optional-mechanism list. A missing optional device is not evidence that its
commands or physical installation are safe.

Before autonomous targets or AprilTags are accepted, the composition root loads and validates the
checked-in FTC field contract. A missing or invalid field installs an empty tag map and keeps manual
drive available; it does not silently fall back to unrelated tag geometry.

## Trace one frame

Follow `update` in order:

1. Reject a robot instance that already has a latched shared or season failure.
2. Run the shared base update, which refreshes registered I/O and computes the frame's power protection.
3. Read every registered generated subsystem's cached sensor state.
4. Write registered subsystem outputs using the same frame's power scale.
5. Publish low-rate Driver Station telemetry.

If any step throws, the code latches that failure, attempts both subsystem and platform safing, and
rethrows. A later loop cannot silently resume normal writes; recovery requires a newly constructed
OpMode robot instance.

## Review exercise

Draw the canonical field load, generated registry installation, normal update sequence, and
exception sequence. For each generated subsystem, locate the descriptor field that decides startup
policy and safe output. Have a teammate confirm each arrow against the pinned source before treating
the diagram as reviewed.

This exercise verifies architectural reasoning, not wiring, current limits, calibration, emergency-stop access, or physical robot behavior.
