# From driver input to motor output

The normal ARES flow is:

```text
gamepad or autonomous intent
  -> controller binding or season facade
  -> RobotAction
  -> Store.dispatch
  -> rootReducer plus season reducer
  -> immutable RobotState
  -> subsystem controller
  -> cached IO contract
  -> FTC/FRC hardware adapter or simulator
  -> telemetry and logs
```

An action describes an event or requested transition. It is not a direct motor command. Reducers calculate the next state and must not read devices, write files, call network services, or use a wall clock.

Each robot loop refreshes inputs once, dispatches observations, reduces state, computes safe outputs, writes outputs, and then publishes telemetry. Cached inputs keep every controller in one loop working from the same sensor sample.

## Trace exercise

Choose one drive binding in a starter project. Record the binding, dispatched action, state field, controller, IO method, and telemetry topic. If any step cannot be identified, stop at that boundary and inspect the generated project rather than guessing.

This exercise can be completed with source and simulation. It does not prove motor wiring, inversion, encoder direction, or current limits on a physical robot.
