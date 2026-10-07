# Read and test a small Kotlin function

## Purpose and prerequisites

ARES robot projects use Kotlin for shared logic and team code. You do not need to memorize the
language before making a useful change. In this lesson, you will read one current ARES function,
predict its result, and check that prediction with a focused unit test.

Complete [The ARES Software Workspace](/academy/ares-workspace-map?path=programming-with-ares)
first. Use a branch or temporary copy for edits. This lesson does not need a powered robot.

The source example is `InputMath.applyDeadband`. A deadband turns tiny joystick values into zero so
small stick drift does not become a drive request. The function works only with numbers. It does not
read a gamepad, change robot state, or command a motor.

## Vocabulary

- **Value:** data with a name, such as `result`.
- **`val`:** a name that cannot be assigned a different value later.
- **Type:** the kind of data a value holds. Kotlin's `Double` type stores decimal numbers.
- **Function:** named code that accepts inputs and returns a result.
- **Parameter:** a named input in a function definition.
- **Argument:** a value supplied when the function is called.
- **Expression:** code that produces a value.
- **Branch:** one possible path through a decision.
- **Test:** code that checks an expected result.
- **Tolerance:** a small allowed difference when comparing decimal results.

## Read the current function

Here is the current ARES function. The comments describe each branch.

```kotlin
fun applyDeadband(value: Double, deadband: Double): Double {
    // invalid input, or inside the quiet area
    if (!validAxis(value) || !validDeadband(deadband) || abs(value) <= deadband) return 0.0
    // rescale the remaining travel and keep the sign
    return sign(value) * ((abs(value) - deadband) / (1.0 - deadband))
}
```

The function has two parameters. Both use `Double`. The `: Double` after the closing parenthesis is
the return type.

The `if` line checks its three tests from left to right. If any test is true, the function returns
`0.0` right away. Only when all three are false does the last line run.

`validAxis` accepts a finite joystick value from -1.0 through 1.0. `validDeadband` accepts a finite
deadband from 0.0 up to, but not including, 1.0. The function returns zero for input outside that
contract. It does not clamp a bad value into range.

## Worked example

Read this call:

```kotlin
val result = InputMath.applyDeadband(value = 0.55, deadband = 0.10)
```

`value` and `deadband` are parameter names. `0.55` and `0.10` are arguments in this call.
`val result` stores the returned value. The name `result` cannot be assigned again later.

Trace the function one expression at a time:

1. `0.55` is finite and between -1.0 and 1.0, so `!validAxis(0.55)` is false.
2. `0.10` is finite and at least 0.0 but below 1.0, so `!validDeadband(0.10)` is false.
3. `abs(0.55) <= 0.10` is false, so the early `return 0.0` does not run.
4. `sign(0.55)` is positive 1.
5. The last line becomes `1 × ((0.55 - 0.10) / (1.0 - 0.10))`.
6. That is `0.45 / 0.90`, so the result is `0.50`.

The function does more than cut away the quiet area. It rescales the remaining stick travel. That
is why an input of 1.0 can still produce 1.0 after a 0.10 deadband.

Now try `value = -0.55`. The sign is negative 1, so the result is `-0.50`. The current unit test
checks both cases.

## Visual model

```mermaid
%% aria: The applyDeadband function receives a joystick value and deadband. An invalid value or deadband returns zero. Values inside the quiet area also return zero. Other values have the deadband removed from their size, are divided by the remaining range, and get their sign back.
flowchart TD
    A["value and deadband arguments"] --> B{"invalid value or deadband?"}
    B -->|yes| Z["return 0"]
    B -->|no| C{"absolute value at or below deadband?"}
    C -->|yes| Z
    C -->|no| E["subtract deadband from absolute value"]
    E --> F["divide by remaining range"]
    F --> R["return scaled value with original sign"]
```

This diagram shows software decisions. It does not show a gamepad read, Redux action, controller,
adapter, motor command, or physical motion.

## Hands-on activity

Use the code-derived tracer below. It models the valid input contract of the current function.

<kotlinexpressionlab />

1. Select **Inside deadband test**. Predict the branch and result before reading the trace.
2. Confirm that `0.04` with a `0.05` deadband returns zero.
3. Select **Positive rescale test**. Write the substitution before reading the intermediate values.
4. Confirm that `0.55` with a `0.10` deadband returns `0.50`.
5. Select **Negative rescale test**. Explain which sign changes and which values stay the same.
6. Select **Full positive input**. Explain why the result is still 1.0.
7. Enter another valid pair. Keep the joystick value from -1.0 through 1.0 and the deadband below
   1.0.

The tracer uses decimal numbers like Kotlin `Double`, but it does not compile or execute Kotlin.

## Walk the source and tests

From the ARES monorepo root, find the function and its focused tests:

```powershell
rg -n "fun applyDeadband" `
  ARESLib-Kotlin/core/src/main/kotlin/com/areslib/math/InputMath.kt

rg -n "deadband correctly|deadband rescales" `
  ARESLib-Kotlin/core/src/test/kotlin/com/areslib/math/InputMathTest.kt
```

Open `InputMathTest.kt`. Read one assertion:

```kotlin
assertEquals(0.5, InputMath.applyDeadband(0.55, 0.1), 0.001)
```

The first argument is the expected result. The second argument is the function result. The third is
the tolerance. Decimal math may contain tiny representation differences, so the test accepts a
difference no larger than 0.001.

Run only this test class:

```powershell
Set-Location ARESLib-Kotlin
.\gradlew.bat :core:test --tests "com.areslib.math.InputMathTest"
```

A passing result proves that the checked source passed these software cases. It does not prove that
a gamepad is centered, a control mapping is correct, or a robot is safe to drive.

## Checkpoints

- Can you name the two parameters and their types?
- Can you separate a parameter from an argument?
- Can you identify the first true test in the `if` line for a given call?
- Can you substitute arguments into the rescale expression?
- Can you explain why the unit test uses a tolerance?
- Can you state what the function and test do not verify?

## Troubleshooting

| Symptom                     | Check                                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------- |
| Name is unresolved          | Check spelling, imports, and the value's scope.                                       |
| Type mismatch appears       | Confirm that both arguments are `Double`, such as `0.1` instead of a text value.      |
| Result is zero              | Check whether the input is out of range or at or below the deadband in absolute size. |
| Negative result looks wrong | Trace `sign(value)` and keep the parentheses around the rescale part.                 |
| Decimal assertion fails     | Check the expected value and tolerance before changing production math.               |
| Build uses the wrong module | Run the task from `ARESLib-Kotlin` with the `:core:test` task.                        |
| Many files changed          | Stop and inspect generated or formatting changes before committing.                   |

Do not remove the input checks merely because callers usually pass valid values. Boundary guards
should be changed only with a source-backed reason and new tests.

## Evidence artifact

Create a four-row trace table using these current test cases:

| Call                         | First matching branch | Substitution | Predicted result | Test result |
| ---------------------------- | --------------------- | ------------ | ---------------- | ----------- |
| `applyDeadband(0.04, 0.05)`  |                       |              |                  |             |
| `applyDeadband(0.55, 0.10)`  |                       |              |                  |             |
| `applyDeadband(-0.55, 0.10)` |                       |              |                  |             |
| `applyDeadband(1.0, 0.10)`   |                       |              |                  |             |

Record the exact focused command, ARES revision, and pass or fail result. Add one sentence that
separates this software evidence from a physical joystick or robot check.

Students can review this evidence and verify robot behavior through the team's normal safety
process. Lead Coach approval is only part of publishing a website post; it is not required to run
this software test or verify robot functionality.

## Short assessment

1. What is the difference between a parameter and an argument?
2. What does `val` prevent for the name `result` in the worked example?
3. Which branch handles an input whose absolute value is at or below the deadband?
4. Why does the active range divide by `1.0 - deadband`?
5. What does the `0.001` assertion argument mean?
6. Does a passing `InputMathTest` prove that a physical robot moved correctly?

A strong answer names the branch, shows the substitution, includes units or normalized ranges, and
keeps software evidence separate from physical evidence.

## Extension challenge

Read `InputMath.applyCurve` in the same source file. For valid input, it returns
`sign(value) * curveMagnitude(abs(value), exponent)`. With an exponent of 2.0, `curveMagnitude`
multiplies the size by itself.

Predict the results for `0.5` and `-0.5` with an exponent of 2.0. Then find the two matching
assertions in `InputMathTest`. Explain how the function preserves sign while changing magnitude.

As a larger challenge, write a pure Kotlin function with the same valid input contract as
`applyDeadband`. Add tests for positive, negative, inside-deadband, boundary, and full-scale values.
Do not add hardware reads, files, networks, clocks, or global state to the function.

## Related and next

Continue to [Follow a Robot Request from Input to Output](/academy/robot-input-to-output?path=programming-with-ares).
Then use [State, Actions, and Reducers](/academy/redux-state-actions-reducers?path=programming-with-ares)
to trace typed actions and immutable state. Later lessons add cached I/O and subsystem ownership.
