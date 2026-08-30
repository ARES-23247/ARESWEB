# Read hardware once and write safe outputs

## Purpose and prerequisites

Robot code repeats the same loop many times each second. If a getter secretly reads a device in the
middle of that loop, two controllers may see samples from different times. If code sends the same
output again and again, it may add needless work to the device bus.

In this lesson, you will separate two ideas:

1. input adapters refresh sensor values at a named loop boundary; and
2. the current FTC `CachedDcMotorEx` wrapper skips some repeated output writes.

Those ideas support the same loop, but they are not the same cache. You will trace the real motor
wrapper and its focused test instead of treating every getter as a hardware-free read.

Complete [Follow a Robot Request from Input to Output](/academy/robot-input-to-output?path=programming-with-ares)
and [State, Actions, and Reducers](/academy/redux-state-actions-reducers?path=programming-with-ares).
You can complete this software lab without a powered robot.

## Vocabulary

- **Delegate:** the FTC SDK motor object wrapped by `CachedDcMotorEx`.
- **Cache:** stored data that can be reused instead of asking the device again.
- **Sentinel:** a private marker that means no command has been accepted yet.
- **Requested output:** the power value assigned by the caller.
- **Accepted command:** a request saved by the wrapper and sent to the delegate.
- **Redundant write:** a request close enough to the last accepted command that the wrapper skips it.
- **Epsilon:** the smallest absolute change that causes a normal write.
- **Hard stop:** a changed zero command that must reach the delegate once.
- **SDK-free contract:** an interface that does not import FTC, FRC, or vendor classes.
- **Physical evidence:** an observation from the real wired robot, kept separate from software tests.

## Start with the robot loop

The current ARES architecture gives the loop this order:

1. refresh hardware inputs once;
2. dispatch observations and actions;
3. run reducers to produce immutable state;
4. calculate controller and safety outputs;
5. write outputs; and
6. publish telemetry and logs.

## Visual model

```mermaid
%% aria: The robot loop refreshes input adapters, dispatches observations, reduces immutable state, calculates checked output, writes through an output adapter, and then publishes telemetry and logs.
flowchart LR
    A["Refresh input adapters"] --> B["Dispatch observations"]
    B --> C["Reduce immutable state"]
    C --> D["Controller and safety"]
    D --> E["Write output adapters"]
    E --> F["Telemetry and logs"]
```

An input adapter should store its sample during refresh. Its later getters should return that stored
sample. The motor wrapper in this lesson has a different job: it remembers the last output command.
Do not use it as proof that every sensor getter in a robot is cached correctly.

## Read the current motor wrapper

The current source starts with a private sentinel:

```kotlin
private var lastPower = -10.0
```

Motor power normally uses the range -1.0 through 1.0. The value -10.0 means **no accepted command
yet**. The wrapper never sends -10.0 to the motor.

The getter has two states:

```kotlin
get() = if (lastPower != -10.0) lastPower else delegate.power
```

- Before the first accepted command, a read asks the delegate for its power.
- After the first accepted command, a read returns `lastPower` without reading the delegate.

This means two reads before the first write can cause two delegate reads. The focused source test
performs one early read and confirms its count. Do not claim that this wrapper makes every read
hardware-free from construction time.

The setter checks a hard stop before a normal change:

```kotlin
set(value) {
    if (value == 0.0 && lastPower != 0.0) {
        delegate.power = 0.0
        lastPower = 0.0
    } else if (abs(value - lastPower) >= epsilon) {
        delegate.power = value
        lastPower = value
    }
}
```

The order matters. A changed zero request writes once even when its change is smaller than epsilon.
A repeated zero is skipped because `lastPower` is already zero.

The wrapper does not clamp power or validate epsilon. Its documentation leaves range and validation
work to callers and the FTC SDK. An output cache is not a safety controller.

## Worked example

The current `CachedHardwareContractTest` uses a counting delegate. It starts with hardware power
0.25 and epsilon 0.05. Trace the operations in order:

| Step | Operation | Delegate reads | Delegate writes | Cached power | Why |
| ---: | --- | ---: | ---: | ---: | --- |
| 1 | read power | 1 | 0 | not set | no command has been accepted |
| 2 | write 0.40 | 1 | 1 | 0.40 | first valid command is far from the sentinel |
| 3 | write 0.44 | 1 | 1 | 0.40 | change 0.04 is below epsilon 0.05 |
| 4 | read power | 1 | 1 | 0.40 | getter returns the accepted command |
| 5 | write 0.00 | 1 | 2 | 0.00 | changed zero is a hard stop |
| 6 | write 0.00 | 1 | 2 | 0.00 | repeated zero is skipped |
| 7 | write -0.10 | 1 | 3 | -0.10 | change is large enough |

The test proves the wrapper's delegate calls for this sequence. It does not measure REV bus timing,
motor voltage, current draw, shaft motion, or a mechanism stop.

## Hands-on activity

Open the pinned `CachedHardware.kt` and `CachedHardwareContractTest.kt` files. Then use the
code-derived tracer below.

<loopcachelab />

1. Reset the tracer. Confirm that the cache says **No accepted command**.
2. Select **Read power** twice. Each read reaches the delegate because the sentinel is still active.
3. Reset and select **Read power** once to match the source test.
4. Enter 0.40 and select **Write request**. Confirm one delegate write.
5. Enter 0.44 and write again. Predict the result before reading the event message.
6. Select **Read power**. Confirm that the delegate read count does not increase.
7. Enter 0.00 and write twice. Explain why only the first zero reaches the delegate.
8. Enter -0.10 and write. Confirm the final write count is three.
9. Compare your trace with the table and focused Kotlin test.

The tracer copies the current wrapper's sentinel, getter, and setter decisions for documented motor
power and epsilon values. It does not execute Kotlin or connect to an FTC device.

## Walk the source and run the test.

Use these commands from the ARES monorepo root. They locate the wrapper and its test.

```powershell
rg -n "class CachedDcMotorEx|lastPower|override var power" `
  ARESLib-Kotlin/ftc-hardware/src/main/kotlin/com/areslib/ftc/hardware/CachedHardware.kt

rg -n "motor suppresses|delegate.readCount|delegate.writeCount" `
  ARESLib-Kotlin/ftc-hardware/src/test/kotlin/com/areslib/ftc/hardware/CachedHardwareContractTest.kt
```

Run only the focused contract test from `ARESLib-Kotlin`.

```powershell
Set-Location ARESLib-Kotlin
.\gradlew.bat :ftc-hardware:test `
  --tests "com.areslib.ftc.hardware.CachedHardwareContractTest"
```

Save the repository commit, exact command, pass or fail result, and test name. A passing result is
software evidence for the wrapper at that commit.

## Connect the wrapper to `MotorIO`

The shared `MotorIO` interface is SDK-free. Its `safe()` function requests zero power:

```kotlin
override fun safe() {
    power = 0.0
}
```

That contract expresses the safe request. The platform adapter and wrapper must carry it to the
device boundary. The cached wrapper's hard-stop branch prevents a changed zero request from being
lost as a small redundant write. A repeated zero can then be skipped.

This still does not prove a physical motor stopped. Wiring, device health, controller state, load,
and mechanism motion remain physical facts.

## Checkpoints

- Can you explain what -10.0 means without calling it a motor command?
- Which reads reach the delegate before the first accepted command?
- Why does 0.44 get skipped after an accepted 0.40 when epsilon is 0.05?
- Why does the setter check changed zero before the normal epsilon rule?
- What safety and validation work does this wrapper not own?
- What does the focused test prove, and what physical facts remain unknown?

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Early getter still reads the device | The sentinel remains active until the first accepted command. |
| Small request does not reach the delegate | Compare its absolute change with epsilon and the last accepted command. |
| Displayed power differs from a skipped request | The getter returns the last accepted command, not the skipped request. |
| First zero does not look special | Compare zero with the sentinel; it enters the hard-stop branch first. |
| Repeated zero is skipped | The delegate already received zero and `lastPower` is zero. |
| Invalid power seems accepted by the model | Use the documented range. The source wrapper does not perform full validation. |
| Mock test passes but robot differs | Check wiring, polarity, SDK setup, load, device health, and actual mechanism motion. |
| Telemetry changes control timing | Keep reporting work outside the control and output-write path. |

## Evidence artifact

Create an operation table with these columns:

- operation number;
- read or write request;
- sentinel active or accepted command;
- absolute change when a normal write is checked;
- delegate read count;
- delegate write count; and
- reason for the result.

Fill it using the seven source-test steps. Add your focused Gradle result and the pinned source
commit. End with two separate claims:

1. what the software test shows about delegate calls; and
2. what a restrained physical check would still need to observe.

Students may review the source, run the test, and verify robot functionality through the team's
normal safety process. Start disabled, clear the mechanism, use a bounded hold-to-run request, and
keep stop control ready. Website posts use the separate Lead Coach review flow.

## Short assessment

1. What state does the -10.0 sentinel represent?
2. When does the getter read the FTC delegate?
3. What is the difference between a requested command and an accepted command?
4. Why is a changed zero checked before the epsilon rule?
5. Does `CachedDcMotorEx` clamp power or validate epsilon?
6. What does `MotorIO.safe()` request?
7. Why is a passing unit test not proof of physical motion?

## Extension challenge

Read the `CachedServo` source and its focused test in the same files. Compare it with the motor
wrapper. The servo also uses a sentinel and epsilon, but it has no special hard-stop branch.

Build a two-column trace for the first command, a small repeated command, a larger command, and a
getter after initialization. State which behavior is shared and which is motor-only. Do not invent a
servo safety rule that the current source does not contain.

## Related and next

Continue to [Author a Code-First or Hybrid Subsystem](/academy/programming-code-subsystem?path=programming-with-ares)
to place I/O behind a subsystem controller. Then study
[Test Robot Logic Across Mocks and Simulation](/academy/programming-tests-parity?path=programming-with-ares)
before making a parity claim. Keep source, test, simulation, and physical evidence separate.
