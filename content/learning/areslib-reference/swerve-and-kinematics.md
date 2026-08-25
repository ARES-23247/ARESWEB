# Drivebase, swerve, and kinematics contracts

A drivebase owns physical topology, geometry, localization, driver and trajectory control, safety, simulation, and calibration. Its canonical `.aresdrivetrain` document is not an ordinary subsystem descriptor.

Supported topologies include FTC mecanum, CTRE FRC swerve, differential, and an explicit advanced-custom form. Components and modules use immutable UIDs independent of display or hardware names. Swerve modules associate drive motor, steer motor, absolute encoder, and physical X/Y position.

Physical geometry, ratios, device identity, inversion, topology, and current-limit capability belong in the canonical descriptor. Tunable control values belong in reviewed typed profiles. Local experiment overlays do not redefine the robot's hardware.

All hardware reads are cached. Configuration health and fresh feedback gate output; disabled output is neutral; output faults latch; recovery requires a confirmed neutral write. The simulator consumes the same canonical geometry and selected tuning profile as the physical adapter.

Calibration evidence names affected parameter UIDs and records an immutable project-relative source plus hash. A value is not calibrated merely because it compiles or exists in a local overlay.
