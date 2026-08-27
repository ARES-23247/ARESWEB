# Add and verify an FTC Starter autonomous routine

The untouched starter autonomous adapter safely reports blocked because its canonical routine
catalog is empty. Add a real `.aresroutine` through ARES Robotics Studio rather than placing season
logic in the lifecycle adapter. Studio and Gradle compile the same canonical document into typed
routine IR, generated source, safety tests, and a verification manifest.

## Guided exercise

1. Import or create the reviewed season field and AprilTag map.
2. Create a short `.aresroutine` with a stationary start and one bounded movement.
3. Validate finite waypoints, declared task/resource keys, constraints, field boundaries, and endpoint continuity.
4. Inspect the generated ownership plan, regenerate the project, and run `verifyAresProject` plus simulator tests.
5. Start the generated autonomous OpMode in local simulation.
6. Compare the planned path, simulated truth, and estimated pose. Record disagreements instead of hiding them.
7. Confirm the drivetrain stops if routine loading or execution fails.

Alliance mirroring must occur once. The dashboard's canvas transform is for rendering only and must never be written back into path coordinates.
