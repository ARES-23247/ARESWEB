# Start an FTC project without inherited robot assumptions

ARES Robotics Studio creates the FTC Starter as a complete standalone repository. Its canonical
source is maintained in the ARES Robotics monorepo and exported as a public mirror, but a generated
team project does not depend on a monorepo checkout. It begins with four mecanum motors, one Control
Hub IMU, and empty mechanism and routine catalogs.

## Project setup

1. Create or open the starter in ARES Robotics Studio.
2. Set team, season, and robot name in Project Identity.
3. Keep Standard FTC SDK for initial bring-up unless the team deliberately reviews another runtime policy.
4. Review `fl`, `fr`, `rl`, `rr`, and `imu` in Drivebase Builder.
5. Create or import a reviewed season field instead of inventing tag positions.

Project schema 4 requires an explicit authoring model: `GUI_OWNED`, `CODE_FIRST`, or `HYBRID`.
Studio-created beginner projects normally use `GUI_OWNED`, where canonical `.ares` documents define
robot behavior. Code-first projects declare their user-owned registrations; Studio does not
reverse-engineer arbitrary Kotlin. Hybrid projects keep drivetrain and routines in `.ares` while
selected mechanisms remain registered Kotlin.

Gradle emits generated source and tests under build-generated directories; do not hand-edit those
outputs. Schemas 1-3 and the retired split `.ares-robot.json` identity are unsupported. The
starter's dimensions and tuning are conservative simulation defaults, not measurements from a
physical robot.

## Checkpoint

Identify one canonical input document, one generated output, and one lifecycle adapter. Explain which can be edited and which must be regenerated.
