# Read hardware once and write safe outputs

## Purpose and prerequisites

Robot code runs the same loop many times each second. Surprise device reads can mix sensor samples
from different times. Repeated device writes can waste bus work. In this lesson, you will trace the
ARES cached-I/O boundary and test one simplified output-cache decision.

Complete [Follow a Robot Request from Input to Output](/academy/robot-input-to-output?path=programming-with-ares)
and [State, Actions, and Reducers](/academy/redux-state-actions-reducers?path=programming-with-ares).
You can complete the source and concept work without a powered robot.

## Vocabulary

- **Robot loop:** the repeated sequence that reads, calculates, writes, and reports.
- **Refresh:** the named point where an adapter updates cached inputs.
- **Cached input:** a stored sensor sample shared during one loop.
- **Requested output:** the checked command a controller asks an adapter to apply.
- **Redundant write:** an output write that repeats nearly the same command.
- **Epsilon:** the smallest change that causes a cached wrapper to write again.
- **Hard stop:** an explicit zero command that must reach the output boundary.
- **Adapter:** platform code that connects the shared contract to an SDK device or mock.

## Worked example

Assume the last motor command was 0.400. A controller requests 0.410. If the output cache uses an
epsilon of 0.020, the absolute change is 0.010. The concept decision skips that small repeated write.

Now assume the controller requests zero. The cached FTC motor wrapper gives a zero command special
treatment when the previous command was not zero. It writes the hard stop once. A later repeated
zero may be skipped because the stop is already the cached command.

This cache does not make an unsafe request safe. The controller and safety boundary still own
range, health, and mechanism rules. The FTC SDK also keeps its normal validation duties.

## Visual model

```mermaid
%% aria: Each robot loop refreshes inputs once, updates state, calculates checked outputs, writes through adapters, and then publishes telemetry.
flowchart LR
  A["Refresh inputs once"] --> B["Dispatch observations"]
  B --> C["Reduce next state"]
  C --> D["Controller and safety"]
  D --> E["Cached output decision"]
  E --> F["Device or mock write"]
  F --> G["Telemetry and logs"]
```

Every controller in one loop should see the same cached sensor sample. A getter should not hide a
new bus read. This makes the loop easier to test and keeps timing ownership visible.

## Hands-on activity

1. Open the pinned ARES architecture document.
2. Write the six robot-loop stages in order.
3. Find one SDK-free I/O contract, such as `MotorIO`.
4. Identify its safe-output behavior.
5. Find one physical FTC adapter or cached wrapper.
6. Mark where a device read may happen.
7. Mark which getters return cached values.
8. Find the output write and any redundant-write threshold.
9. Find a mock or unit test that uses the same contract.
10. Record what happens when an output is zero, non-finite, stale, or unhealthy.

Use the concept lab below to compare the previous command, next request, and threshold. Try a small
change, a large change, a sign change, and a hard stop.

<loopcachelab />

The lab models one output comparison. It does not run the robot loop or read a device. Use the pinned
source and automated tests for ARES behavior.

## Checkpoints

- Are sensor reads owned by one named refresh boundary?
- Do getters return cached samples during the loop?
- Does state update before controllers calculate outputs?
- Can an explicit zero reach the adapter after a nonzero command?
- Are range, health, and safe-state checks separate from write deduplication?

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Two controllers see different samples | Look for a hidden device read outside refresh. |
| Motor does not receive a changed command | Compare the absolute change with epsilon. |
| Stop appears delayed | Trace the zero request through safety, cache, and adapter. |
| Getter causes timing spikes | Check whether it delegates to hardware after initialization. |
| Mock passes but robot differs | Compare the physical adapter and mock against the same contract. |
| Telemetry changes robot behavior | Remove control work from the reporting path. |

## Evidence artifact

Create a loop-boundary table. Include refresh, observation, reducer, controller, safety, output write,
and telemetry. Add the owning source path for each row. For one cached output, record the previous
command, requested command, epsilon, decision, and reason.

Add one automated test result that covers a changed command and a hard stop. Label it as source and
test evidence. It does not prove physical bus timing, device response, current draw, or motion.

Students may verify a physical output through the team's normal safety procedure. Start disabled,
use a bounded hold-to-run command, and keep an emergency stop within reach. Website posts use a
separate Lead Coach editorial workflow.

## Short assessment

1. Why should a sensor getter avoid a surprise bus read?
2. What problem does an output epsilon reduce?
3. Why does a hard stop need special attention?
4. What safety work is not owned by the output cache?
5. What evidence separates a mock contract from physical device behavior?

## Extension challenge

Write a unit test table for five output pairs. Include no change, a small change, a large change, a
sign change, and a hard stop. Predict each write decision before running the test. If the real
contract differs from the concept lab, record the source-backed difference instead of changing the
evidence.

## Related and next

Continue to GUI-owned or code-first subsystem authoring. A subsystem should own its cached inputs,
checked outputs, safe state, mock, and tests. Study parity testing before claiming that a physical
adapter and simulator mock behave the same.
