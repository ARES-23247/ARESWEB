# The ARES software workspace

ARES uses one source monorepo with several deliberately isolated Gradle builds. The shared Git
history makes cross-component changes reviewable, but Android/FTC, WPILib/FRC, the published
library, starters, simulators, and ARES Robotics Studio keep their own build and runtime boundaries.

| Monorepo directory | Responsibility |
| --- | --- |
| `ARESLib-Kotlin/` | Project schema/model/compiler, Redux and controls, hardware contracts, code generation, telemetry, logging, and deterministic simulation foundations |
| `ARES-FTC/` | Team 23247's GUI-authored Lightbot reference robot, FTC lifecycle and adapters, and FTC simulator product |
| `ARES-FRC/` | FRC lifecycle and adapters plus the distinct WPILib/HAL simulator product |
| `ARES-Analytics/` | ARES Robotics Studio, local analytics, telemetry/replay, optional cloud services, and gateway |
| `ARES-FTC-Starter/` and `ARES-FRC-Starter/` | Canonical sources for generated public starter mirrors; they contain no Team 23247 season calibration |
| `templates/` | Monorepo-owned generated runtime templates, not editable robot source |
| `build-logic/` and `release/` | Shared dependency, version, artifact-integrity, and release policy |

## Follow the project flow

```text
.ares documents
  -> project-schema
  -> RobotProjectSnapshot / EffectiveRobotProject
  -> typed project compiler IR
  -> generated source, safety tests, and verification manifest
  -> FTC or FRC runtime
  -> simulator or physical adapter
```

Studio uses one application-scoped `ProjectSession` and the same effective project assembler for
save, generation, verification, simulation, and deployment authorization. Generated mechanical
source belongs in Gradle generated-source directories; do not hand-edit it.

## Decide where a change belongs

Ask whether more than one robot should reuse the behavior. Shared geometry, control, logging, and
SDK-free I/O contracts belong in `ARESLib-Kotlin/`. A mechanism tied to one robot belongs in its
league project. Desktop workflows belong in `ARES-Analytics/`. A starter change begins in its
canonical monorepo source or template and is exported to the public mirror; the mirror is not the
source of truth.

## Checkpoint

For each proposed change, name its owning directory, Gradle build, and one consumer that must be
retested. Do not copy a shared fix into multiple league directories merely to avoid changing the
library.
