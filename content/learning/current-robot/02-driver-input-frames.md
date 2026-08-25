# Shape FTC driver input without losing the frame

The current `AresDriveController` separates normalized driver intent from direct hardware access. This guided lab uses the controller pinned at commit `631682a` and can be completed with calculation and simulation.

## The shaping pipeline

For each axis, the controller first replaces non-finite input with zero and clamps finite input to `[-1, 1]`. Magnitudes below `0.05` become zero. The remaining range is rescaled so the deadband edge maps to zero and full stick still maps to one. Finally, the signed magnitude is raised to the configured positive exponent, or to the fallback exponent `3.0`.

The shaped value enters an exponential moving average:

```text
new smoothed value = 0.6 × previous value + 0.4 × shaped value
```

Because the coefficient is applied once per loop, its real-time response depends on loop frequency.

## Coordinate and alliance contracts

The gamepad adapter maps negative FTC left-stick Y to field X, negative left-stick X to field Y, and negative right-stick X to counter-clockwise-positive rotation. In field-relative mode, the blue-alliance driver perspective negates both translation axes. Rotation is never alliance-mirrored. Robot-relative mode does not apply alliance mirroring.

## Calculation and simulator check

1. Starting with a previous value of zero, calculate the first smoothed X command for stick inputs `0.03`, `0.50`, and `1.00` using exponent `3.0`.
2. Predict the field-relative X and Y commands after switching from red to blue alliance. Keep the rotation prediction unchanged.
3. Predict the same switch in robot-relative mode.
4. In simulation, use telemetry or a debugger to compare those signs and trends. Small numeric differences can reflect loop timing; a frame or sign disagreement means the contract needs investigation.

Do not transfer this simulation result directly to physical driving. Motor mapping, inversion, localization heading, Driver Station behavior, and emergency-stop access require separate supervised validation.
