# ARESLib architecture and ownership

ARESLib owns reusable robotics behavior. FTC and FRC season repositories provide concrete hardware bindings, game-specific state/actions/reducers, and mode orchestration. ARES Analytics consumes telemetry and logs but is not called directly by robot code.

## Modules

- `core`: Redux, geometry, kinematics, estimation, controls, pathing, sequencer, SDK-free hardware contracts, telemetry, logging, and deterministic utilities.
- `ftc-hardware`: FTC adapters, cached device wrappers, FTC vision, and robot bases.
- `frc-hardware`: WPILib/vendor adapters, FRC robot bases, telemetry, and power management.
- `ftc-mocks`: the subset of FTC/Android APIs required for desktop tests and simulation.
- `simulator`: FTC OpMode lifecycle, deterministic time, Dyn4j physics, virtual Driver Station, NT4, and local logs.

## Robot loop

Refresh hardware once, dispatch observations, reduce immutable state, compute safe controller outputs from cached inputs, write outputs, then publish telemetry. Reducers never perform device, network, file, or clock side effects.

Season reducers compose around `rootReducer`; they do not replace it. Shared contracts belong in ARESLib, while one-game mechanisms and field behavior remain in the season repository.
