# Start an FTC project without inherited robot assumptions

The FTC Starter is intentionally separate from Team 23247's season robot. It begins with four mecanum motors, one Control Hub IMU, and empty mechanism and routine catalogs.

## Project setup

1. Open the starter in ARES Analytics.
2. Set team, season, and robot name in Project Identity.
3. Keep Standard FTC SDK for initial bring-up unless the team deliberately reviews another runtime policy.
4. Review `fl`, `fr`, `rl`, `rr`, and `imu` in Drivebase Builder.
5. Create or import a reviewed season field instead of inventing tag positions.

Canonical `.ares` documents define the robot. Gradle emits generated source under `TeamCode/build/generated/ares`; do not hand-edit those outputs. The starter's dimensions and tuning are conservative simulation defaults, not measurements from a physical robot.

## Checkpoint

Identify one canonical input document, one generated output, and one lifecycle adapter. Explain which can be edited and which must be regenerated.
