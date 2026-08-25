# Robot coordinates without guesswork

ARES uses meters, seconds, radians, and counter-clockwise-positive rotation. Zero heading faces field `+X`; `+pi/2` faces field `+Y`.

Robot-local odometry uses `deltaX` for forward, `deltaY` for left, and `deltaHeadingRad` for counter-clockwise rotation. The estimator rotates that local motion into the field frame. Do not pre-rotate it.

## Simulator exercise

1. Start at a known simulated pose.
2. Move forward without rotating. Note the local and field displacement.
3. Rotate approximately counter-clockwise by `pi/2`.
4. Move forward again. Explain why the same robot-local direction now changes a different field axis.
5. Compare true pose and estimated pose. Do not replace one with the other when they disagree.

## Boundary reminders

- Pinpoint heading polarity is corrected once in its hardware adapter.
- Limelight target-space yaw uses a different axis convention from field heading.
- Analytics applies a field-to-screen transform only for drawing.
- Alliance mirroring happens at one explicit boundary.

Never add a second sign flip because one screenshot looks reversed.
