# Add and verify an FTC Starter autonomous routine

The untouched starter autonomous adapter safely reports blocked because its routine catalog is empty. Add a real routine through the canonical authoring tools rather than placing season logic in the lifecycle adapter.

## Guided exercise

1. Import or create the reviewed season field and AprilTag map.
2. Create a short routine with a stationary start and one bounded movement.
3. Validate finite waypoints, constraints, field boundaries, and endpoint continuity.
4. Regenerate the project and run `verifyAresProject` plus simulator tests.
5. Start the generated autonomous OpMode in local simulation.
6. Compare the planned path, simulated truth, and estimated pose. Record disagreements instead of hiding them.
7. Confirm the drivetrain stops if routine loading or execution fails.

Alliance mirroring must occur once. The dashboard's canvas transform is for rendering only and must never be written back into path coordinates.
