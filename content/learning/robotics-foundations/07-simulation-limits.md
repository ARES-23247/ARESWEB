# Simulation is not hardware validation

Simulation can verify state transitions, control flow, coordinate behavior, generated assets, and many failure paths. Desktop mocks can verify SDK-independent contracts. Neither proves a physical robot is safe to enable.

Simulation does not prove:

- motor port mapping or inversion;
- encoder direction and scale;
- camera mounting, focus, exposure, or field placement;
- wiring, CAN IDs, current limits, or neutral modes;
- mechanism clearances, pinch hazards, or emergency-stop access;
- that starter dimensions and tuning match a built robot.

## Evidence ladder

1. Unit test the reducer/controller behavior.
2. Verify and build the generated project.
3. Exercise the real OpMode in local simulation.
4. Review the hardware descriptor and safety plan with a mentor.
5. Test disabled or on blocks with restrained hold-to-run diagnostics.
6. Record physical direction, limits, calibration, and stop-state evidence.

Move to the next boundary only when the previous evidence is recorded. A successful simulation is not permission to enable a physical robot.
