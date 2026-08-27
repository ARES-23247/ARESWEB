# State, actions, and reducers

`RobotState` is the current root snapshot. `RobotAction` describes a transition. `Store.dispatch` serializes that transition through the root and season reducers.

The pinned ARES 11 onboarding test demonstrates that heading target and drive mode are separate actions:

```kotlin
val withTarget = rootReducer(
    RobotState(),
    RobotAction.SetHeadingLockTarget(Math.PI / 2.0)
)
val holding = rootReducer(
    withTarget,
    RobotAction.SetDriveMode(DriveMode.HEADING_HOLD)
)
```

Run the pinned ARES 11 onboarding test from the monorepo's `ARESLib-Kotlin` directory:

```powershell
.\gradlew.bat :core:test --tests "com.areslib.student.StudentOnboardingTest"
```

## Review questions

1. Which state field changes after each action?
2. Why is the heading target not a motor voltage?
3. What would become nondeterministic if a reducer read an encoder or wall clock?
4. Where should a season-specific mechanism action be reduced?

Do not use store listeners as a second robot control loop.
