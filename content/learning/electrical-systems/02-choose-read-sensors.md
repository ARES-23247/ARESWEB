# Choose and read robot sensors

## Purpose and prerequisites

A sensor turns a physical condition into data. A number by itself is not enough evidence. Robot
code also needs to know what the number means, where it came from, and whether it is safe to use.

This lesson compares two current ARES source paths and one design pattern:

1. a raw sensor value,
2. a hand-authored subsystem snapshot that your team designs on purpose, and
3. a generated subsystem adapter and snapshot with explicit health evidence.

These are not three steps in one runtime pipe. ARES 12 no longer includes the old background
`FtcDistanceSensor` wrapper. Hand-authored code must own its snapshot fields and update them once
per robot loop. Generated subsystem code reads the FTC SDK sensor through its own `refresh` path.

Complete [Voltage, Current, Power, and Energy](/academy/electrical-voltage-current-power?path=electrical-systems-diagnostics)
and [Read Hardware Once and Write Safe Outputs](/academy/programming-io-caching?path=programming-with-ares)
first. No powered robot is required for the source and model work.

By the end, you will be able to explain what each path proves, choose a sensor for one robot
question, and plan a student-led physical check.

This lesson matches ARES 15.0.1 and Studio 5.0.2. Its source links point to one reviewed commit in
the ARES Robotics monorepo.

## The important correction: two source paths and one design pattern

Current ARESLib does not attach a timestamp and health report to every raw sensor property. Those
fields appear at a higher subsystem layer. Keep the layers separate.

| Layer | Current ARES example | What it provides | What is still missing |
| --- | --- | --- | --- |
| Raw interface | `DistanceSensorIO.distanceMeters` | One value in meters; `NaN` or positive infinity may mean offline or out of range | Age, setup health, useful range, and physical accuracy |
| Hand-authored snapshot pattern | Team subsystem IO and immutable state | Whatever cached value, validity, time, and setup fields the team deliberately implements and tests | Proof that the design was implemented correctly and works on the robot |
| Generated adapter and snapshot | Generated FTC IO and subsystem state | One SDK read per refresh, finite/range checks, `feedbackValid`, `feedbackTimestampMs`, and `configurationHealthy` | Physical placement, wiring, surface effects, and proof on the actual robot |

A finite cached number is useful, but it is not automatically fresh. A snapshot can support a
freshness decision only when its code records a sample time and compares that time with an allowed
age.

Hand-authored code does not receive generated snapshot fields merely because it implements
`DistanceSensorIO`. Generated code creates those fields and its own FTC read path. Neither path
should poll hardware from an ordinary property getter.

## Vocabulary

- **Sensor:** a device that measures a physical condition.
- **Signal:** a value and its meaning.
- **Sample:** one sensor observation.
- **Cache:** stored data that can be read without polling the device again.
- **Validity:** whether the required checks accepted a sample.
- **Freshness:** whether an accepted sample is recent enough for its job.
- **Configuration health:** whether required device setup succeeded.
- **Range:** the values a device or software contract accepts for one use.
- **Sentinel value:** a special value, such as `NaN`, that marks missing or failed evidence.
- **Topology:** the stable record of a device, parent controller, port, bus, and identity.

## Read the current source contract

The current `DistanceSensorIO` interface is intentionally small. It exposes one property:
`distanceMeters`. Its comment says the value is measured in meters. It may return `NaN` or positive
infinity when the target is out of range or the sensor is offline.

That contract does **not** expose `lastUpdatedMs`, `connected`, or `configured`. Code that needs
those facts must own them at another boundary.

ARES 12 removed the earlier background-thread distance wrapper. Do not copy a lesson, snippet, or
diagram that tells you to instantiate `FtcDistanceSensor`. For hand-authored subsystem code, read
the SDK device once in the subsystem's owned refresh step, then serve cached fields to the rest of
the loop. If the team needs freshness or setup evidence, add and test those fields explicitly.

The generated distance-sensor scaffold declares a distance measurement in meters with a default
accepted range from 0 through 10 meters. Its FTC adapter reads the SDK `DistanceSensor` when
`refresh` runs. It requires a finite, in-range result before committing the cached snapshot. It then
sets `feedbackValid` and records `feedbackTimestampMs` with `RobotClock`.

When the subsystem copies the IO snapshot into immutable state, it also compares the snapshot age
with the subsystem feedback timeout. A failed or old snapshot remains visible as invalid state.

## Visual model

```mermaid
%% aria: The physical sensor can feed a small raw distance interface, a hand-authored subsystem snapshot, or a generated subsystem adapter. Hand-authored code must deliberately add validity, time, and setup health. Generated code reads once during refresh and stores those fields. A control rule uses a snapshot only when all required evidence passes. Physical testing remains separate.
flowchart LR
  A["Physical sensor"] --> B["DistanceSensorIO"]
  A --> C["Hand-authored refresh and snapshot"]
  A --> D["Generated FTC adapter refresh"]
  C --> F["Owned cached fields"]
  D --> E["Finite and range checks"]
  E --> F
  F --> G{"Valid, fresh, and configured?"}
  G -- Yes --> H["Use bounded result"]
  G -- No --> I["Block and report reason"]
  J["Student physical check"] -. separate evidence .-> A
```

The dashed path matters. A source review or simulation cannot prove that a real beam, surface, wire,
mount, or target behaves as expected.

## Worked example

Suppose a distance sensor shows `0.75`.

At the raw interface, you know only that the reported value is 0.75 meters. It is finite, so it is
not one of the documented offline or out-of-range sentinels. You still do not know its age.

For a hand-authored snapshot, assume the team stores the value, validity, sample time, and setup
health. Those facts support a software decision only after the implementation and tests show that
one refresh owns them. Writing the field names on a plan does not make the runtime behavior true.

On the separate generated adapter path, assume the snapshot contains these facts:

- distance: `0.75 m`,
- feedback valid: `true`,
- snapshot age: `20 ms`,
- maximum age: `100 ms`, and
- configuration healthy: `true`.

That snapshot has enough represented evidence for the lesson's software rule. If the age changes to
`120 ms`, the numeric distance does not change, but the snapshot becomes stale and must be blocked.

If the value becomes `NaN`, the generated read rejects it before committing a new valid snapshot.
If configuration health is false, a finite value still does not permit control.

## Hands-on activity

Work with a partner if possible. One student predicts each result. The other changes the model and
records the reason. Swap roles halfway through.

1. Choose one robot question, such as “Is a game piece within intake range?”
2. State the physical condition that must be measured.
3. Compare a beam break, distance sensor, color sensor, and camera for that one question.
4. Choose the simplest signal that can answer it.
5. Record the value type and unit.
6. Record the stable device name, controller, port or bus, and required/optional policy.
7. Open the lab and select **Raw distance interface**.
8. Enter `0.75 m`. Explain why it is a value-only result.
9. Try a blank or non-number field. Record why it is blocked.
10. Select **Hand-authored snapshot plan**. Explain which fields your code would need to own and
    which tests would prove they change together.
11. Select **Generated snapshot**.
12. Test a healthy `0.75 m` sample at age `20 ms` with a `100 ms` limit.
13. Make the snapshot stale.
14. Restore the age, then turn off configuration health.
15. Restore configuration, then mark the refresh as failed.
16. Try `-0.1 m` and `10.1 m`. Compare the result with the generated 0–10 m scaffold.
17. Write the safe control response for each blocked result.
18. List the physical facts the model cannot test.

<sensorsignallab />

Do not replace failed required evidence with zero. Zero might be a real distance. A failure must stay
distinguishable from a valid zero reading.

## Source walk and hardware-free checks

Use the pinned source links for this lesson. From the current ARES Robotics monorepo root, locate
the same boundaries with:

```powershell
rg -n "distanceMeters|feedbackValid|feedbackTimestampMs|configurationHealthy" `
  ARESLib-Kotlin/core/src/main ARESLib-Kotlin/codegen/src/main
```

Run focused library checks without a robot:

```powershell
Set-Location ARESLib-Kotlin
.\gradlew.bat :codegen:test --tests "com.areslib.codegen.SubsystemKotlinGeneratorTest"
```

Passing these checks proves only the tested software behavior. It does not prove a physical sensor,
wiring path, mount, or target.

## Evidence artifact

Create a sensor decision card with three sections.

### 1. Device choice

Record the robot question, sensor kind, stable identity, connection, value type, unit, and useful
physical range. Explain why a simpler sensor would or would not answer the question.

### 2. Software snapshot

Record the refresh owner, accepted numeric range, validity rule, timestamp owner, maximum age,
configuration rule, and blocked behavior. Mark whether the code is generated or hand-authored.

### 3. Physical check

Record target material, distance, angle, lighting, wiring, placement, robot state, and observed
result. Keep actuators disabled while viewing raw sensor values. Use the team's normal safety
process before moving any mechanism.

Students may verify the sensor and robot behavior. Website publishing is a separate editorial task
and uses the Lead Coach review flow.

## Checkpoints

- Can you name the evidence path you are using?
- Are you treating hand-authored and generated snapshots as separate paths?
- Does the sensor answer the actual robot question?
- Are value and unit explicit?
- Is the read cached instead of hidden inside a getter?
- Does the snapshot keep validity separate from freshness?
- Is configuration health separate from the numeric value?
- Does missing required evidence block instead of inventing data?
- Are software, simulation, and physical results recorded in separate columns?

## Troubleshooting

| Symptom                                         | Check                                                                                                     |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Finite number is treated as automatically fresh | Find the timestamp owner. The raw distance contract does not expose one.                                    |
| Offline sensor appears as a real distance       | Reject `NaN`, infinity, and failed snapshot validity.                                                     |
| Old value survives after a read problem         | Keep the prior value for diagnosis, but set validity false and do not use it for control.                 |
| Two parts of a loop see different values        | Remove hidden device reads and use one owned snapshot.                                                    |
| A lesson mentions `FtcDistanceSensor`             | Remove the stale ARES 11 wrapper guidance and trace the ARES 12 refresh owner instead.             |
| Generated range rejects a real device value     | Review the descriptor range against the sensor datasheet and actual task. Do not simply remove the check. |
| Wrong device answers on a shared bus            | Check stable identity, address, bus, and parent controller.                                               |
| Color changes with room light                   | Record lighting, surface, range, and a physical calibration test.                                         |
| Distance jumps at an edge                       | Keep raw evidence visible and test filtering as a separate step.                                          |
| Mock always looks healthy                       | Add failed refresh, stale age, bad configuration, and out-of-range cases.                                 |

## Short assessment

1. What does `DistanceSensorIO.distanceMeters` prove?
2. What evidence does the raw interface not provide?
3. Why does a cached value not automatically have a known age?
4. Which generated fields support a freshness decision?
5. Why are validity and configuration health separate?
6. What should happen when a required generated snapshot is stale?
7. Which facts still require a student physical check?
8. Why should you not draw hand-authored and generated snapshots as one pipeline?

## Extension challenge

Design a hand-authored snapshot for one beam break or distance sensor. Include a cached value,
`feedbackValid`, `feedbackTimestampMs`, `configurationHealthy`, and a maximum age. Write six cases:
healthy, read failed, stale, disconnected, out of range, and wrong identity.

Then design a two-sensor check for one real robot question. Keep each sensor's failure reason
separate. Do not collapse both devices into one “good” flag that hides missing evidence.

## Related and next

Continue to [USB, I2C, CAN, Addresses, and Device Identity](/academy/electrical-buses-addresses?path=electrical-systems-diagnostics)
to study connection identity. Then use [Map Hardware and Diagnose a Dead Device](/academy/electrical-hardware-map-diagnostics?path=electrical-systems-diagnostics)
to trace a failure without guessing. Use the vision lessons only when the robot question truly needs
camera data.
