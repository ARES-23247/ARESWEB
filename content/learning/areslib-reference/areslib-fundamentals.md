# ARESLib architecture and ownership

`ARESLib-Kotlin/` owns reusable robotics behavior inside the ARES Robotics source monorepo. FTC and
FRC keep distinct lifecycle, device-adapter, deployment, and simulator products. ARES Robotics
Studio consumes the shared project model plus robot telemetry/log contracts, but robot code never
calls Studio or its cloud services.

## Modules

- `project-schema`: canonical codecs, schema versions, stable IDs, and target selections.
- `project-model`: raw `RobotProjectSnapshot`, derived `EffectiveRobotProject`, validation, and queries.
- `project-compiler`: typed intermediate representation, artifact ownership, hashes, and verification manifest.
- `codegen`: deterministic Kotlin, registry, manifest, and safety-test rendering.
- `core`: Redux, geometry, kinematics, estimation, controls, pathing, sequencer, SDK-free hardware contracts, telemetry, logging, generated scheduling, and deterministic utilities.
- `ftc-hardware`: FTC adapters, cached device wrappers, FTC vision, and robot bases.
- `frc-runtime`: vendor-neutral generated FRC controls and scheduling contracts.
- `frc-hardware`: WPILib/vendor adapters, FRC robot bases, telemetry, and power management.
- `ftc-mocks`: the subset of FTC/Android APIs required for desktop tests and simulation.
- `simulation-foundation`: platform-neutral simulator selection and shared deterministic contracts.
- `simulator` and its runtime modules: FTC OpMode lifecycle, deterministic time, Dyn4j physics, virtual Driver Station, NT4, local logs, and native runtime packaging.

Canonical `.ares` documents flow through schema, model, compiler IR, and deterministic code
generation before a league runtime sees them. Generated mechanical source and tests belong in
generated-source directories. User-owned extension points must be explicit; regeneration must not
silently overwrite them.

## Robot loop

Refresh hardware once, dispatch observations, reduce immutable state, compute safe controller outputs from cached inputs, write outputs, then publish telemetry. Reducers never perform device, network, file, or clock side effects.

League reducers compose around `rootReducer`; they do not replace it. Shared contracts belong in
ARESLib, while one-robot mechanisms and field behavior remain in the FTC or FRC component. The
single source repository does not erase these ownership boundaries.
