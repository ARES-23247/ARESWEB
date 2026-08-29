# Test robot logic across mocks and simulation

## Purpose and prerequisites

A mock is useful only when it follows the same important rules as the platform adapter. A matching
interface is not enough. In this lesson, you will compare safe behavior across two adapters and
label exactly what each result proves.

Complete [Coordinate Subsystems and Fail Safe](/academy/ftc-season-composition-and-safe-lifecycle?path=programming-with-ares)
and [Simulation Is Not Hardware Validation](/academy/simulation-is-not-hardware-validation?path=testing-debugging-commissioning).
You should also know the subsystem's I/O contract and safe neutral.

## Vocabulary

- **Mock:** a test adapter with controlled inputs and outputs.
- **Platform adapter:** code that connects the shared I/O contract to an FTC or FRC SDK.
- **Behavioral parity:** matching observable rules for the same input and expected result.
- **Contract test:** one test design run against more than one implementation.
- **Fault injection:** a controlled test that makes an input or write fail.
- **Deterministic clock:** test time advanced by the test instead of the wall clock.
- **Evidence level:** the narrow claim a result can support.
- **Mismatch:** a useful result showing that two boundaries behave differently.

## Worked example

The contract says that bad feedback must block motion. A platform-adapter test receives an invalid
sample and records a neutral output. The simulated adapter receives the same invalid sample and also
records neutral. Both tests support one narrow claim: these test boundaries follow the same invalid
feedback rule.

They do not prove that a sensor wire is correct. They do not prove that the motor stopped. A real
device may have the wrong polarity, a loose connector, a bad limit, or a mechanical load that the
mock does not model.

Now suppose the mock accepts a nonzero command after a failed write, but the platform adapter stays
latched. That mismatch should fail the parity check. Do not weaken the hardware rule to make the
mock pass. Fix the mock or the shared contract, then repeat the same case.

## Visual model

```mermaid
%% aria: One shared test case sends the same input, units, clock, and expected safe result to a platform adapter and a simulated adapter. Their observed results are compared, while physical behavior remains a separate evidence gate.
flowchart LR
  A["Shared contract case"] --> B["Platform adapter test"]
  A --> C["Simulated adapter test"]
  B --> D["Compare observed rules"]
  C --> D
  D --> E["Bounded parity finding"]
  E -. separate gate .-> F["Physical robot observation"]
```

Parity is strongest when the input, units, clock, expected result, and assertions stay the same.

## Hands-on activity

1. Open the pinned subsystem verification contract.
2. List its evidence categories and the claim each one supports.
3. Find the generated hardware/simulation parity check.
4. Open the shared simulation device contract.
5. Record its health states, cached sample, write result, neutral action, and close action.
6. Open the pinned FTC generated-subsystem parity test.
7. Mark which lifecycle calls and values it checks.
8. Choose one subsystem and write a contract-test table.
9. Include safe startup, invalid feedback, bounded output, failed write, neutral recovery, and close.
10. Compare one platform-adapter result and one simulated-adapter result in the lab below.

<parityevidencelab />

Use the same case on both sides. Record a mismatch as evidence, not as an empty or passing result.

## Checkpoints

- Do both adapters implement the same I/O contract and units?
- Does each test use the same clock and input values?
- Can both sides model bad, old, and missing feedback?
- Can both sides expose rejected writes and safe neutral attempts?
- Are stop and close safe when called more than once?
- Is the final claim limited to the boundary that was tested?

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Mock passes every case too easily | Add stale data, write faults, bad health, and failed neutral. |
| Platform test uses real wall time | Inject `RobotClock` or a controlled test clock. |
| Same number has different meaning | Check units, sign, range, and frame on both sides. |
| Compile passes but behavior differs | Add shared runtime assertions; interface parity is not behavior parity. |
| Physical robot differs from both tests | Check wiring, polarity, sensor setup, load, friction, and travel. |
| Mismatch is hidden as “not tested” | Preserve the failed result and investigate its cause. |
| Cleanup fails on the second call | Make close and neutral cleanup safe and repeatable. |

## Evidence artifact

Create a parity matrix. Each row should name the input, clock state, expected safe result,
platform-adapter result, simulated-adapter result, and classification. Link the exact test command
and result. Keep a failed row in the matrix until a new test shows the fix.

Add a claim ledger. Separate configuration validation, compilation, generated behavior tests,
platform integration tests, simulator runs, and physical observations. A green check in one column
must not fill a stronger column by itself.

Students may run physical checks through the team's normal safety process. Start disabled. Use low
output, clear the mechanism, and keep a stop control ready. Test one rule at a time and record the
actual result. Do not turn an expected result into a physical claim before the test occurs.

## Short assessment

1. Why is a shared interface weaker than behavioral parity?
2. What must stay the same across a contract-test pair?
3. What should happen when both adapters violate the expected result?
4. Why is an adapter mismatch useful evidence?
5. What physical facts remain unknown after both adapter tests pass?

## Extension challenge

Add one fault case to an existing mock without changing production behavior. Use a controlled clock
and a stable expected result. Run the same contract against the platform test boundary. If the two
results differ, write a small cause tree and the next focused test. Do not change safety limits just
to force agreement.

## Related and next

Return to [Read Hardware Once and Write Safe Outputs](/academy/programming-io-caching?path=programming-with-ares)
for the cached boundary under test. Continue to testing, logs, commissioning, and capstone work. Use
physical evidence only when a student has completed and recorded the real check.
