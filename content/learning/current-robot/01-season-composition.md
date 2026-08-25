# Compose an FTC season robot that fails safe

This tutorial reads the checked-in `AresRobot` composition root at commit `631682a`. It is a source-reading exercise. Complete the trace in simulation; do not infer that a physical mechanism is safe merely because its constructor or simulator path succeeds.

## Required and optional systems

The generated subsystem and superstructure registries are required. If either registry fails during construction, the composition root closes the already-created shared robot services and rethrows the failure. The object cannot return as a partly initialized required robot.

The current intake, flywheel, indicator lights, and Prism device are treated as optional season mechanisms. Their initialization failures are reported through telemetry while drivetrain use remains available. “Optional” here describes startup policy, not whether a mechanism can be operated without a safety review.

## Trace one frame

Follow `update` in order:

1. Reject a robot instance that already has a latched shared or season failure.
2. Run the shared base update, which refreshes registered I/O and computes the frame's power protection.
3. Consume the refreshed season sensor cache.
4. Disable intake intent if the subsystem reports a stall.
5. Write season outputs using the same frame's power scale.
6. Publish low-rate Driver Station telemetry.

If any step throws, the code latches that failure, clears season intent, attempts both subsystem and platform safing, and rethrows. A later loop cannot silently resume normal writes; recovery requires a newly constructed OpMode robot instance.

## Review exercise

Draw two columns labeled “required” and “optional.” Place each registered subsystem in the correct column using only constructor behavior as evidence. Then draw the normal update sequence and exception sequence. Have a teammate confirm each arrow against the pinned source before treating the diagram as reviewed.

This exercise verifies architectural reasoning, not wiring, current limits, calibration, emergency-stop access, or physical robot behavior.
