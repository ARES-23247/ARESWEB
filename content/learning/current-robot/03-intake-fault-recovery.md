# Design an FTC intake boundary that recovers neutral first

This source tutorial examines `FtcIntakeIO` at commit `631682a`. The class is the cached hardware boundary for the current robot's intake roller. Read and test the logic without energizing a robot. Any bench test requires an experienced mentor, a restrained mechanism, removed game pieces, accessible emergency stop, and a reviewed current limit.

## Observations are cached and qualified

`refresh` performs the velocity and current reads. Getters expose the cached values so consumers in one robot frame use the same observation. A failed or non-finite read stores a safe numeric fallback of zero and separately marks the reading invalid. This distinction matters: “could not measure” is not evidence that velocity or current was actually zero.

The roller is the only intake branch represented by this adapter, so its valid current is also the adapter's aggregate current. The absent pivot branch must not make a real roller observation disappear from the power budget.

## Outputs normalize voltage and fail closed

A finite requested voltage is divided by a credible cached battery voltage and clamped to motor power `[-1, 1]`. Invalid requested voltage becomes zero. An invalid or implausibly low supply reading falls back to the documented nominal voltage rather than allowing a division failure.

If a nonzero hardware write fails, the adapter latches an output fault, forgets its last confirmed command, and attempts zero. While faulted, later nonzero requests remain blocked. Only a distinct zero command that successfully reaches the hub clears the latch. A failed stop remains a fault because the physical output is unconfirmed.

## Failure-table exercise

Create a table for these cases: valid motion write, failed motion write, repeated motion while faulted, successful later zero, failed zero, failed velocity read, and failed current read. For each case, record the requested value, confirmed hardware state, validity flag, fault latch, and next permitted action.

Use unit tests or a fake motor boundary for this exercise. Passing the table does not validate wiring, mechanical restraint, battery condition, hub communication, current limits, or real stall thresholds.
