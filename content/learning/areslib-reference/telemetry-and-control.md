# Telemetry, control state, and offline logs

ARES robot and simulator processes serve live NT4 telemetry on port `5810` and completed logs
through the local HTTP API on port `5002`. Robot code never needs cloud credentials; ARES Robotics
Studio performs optional laptop-to-cloud synchronization.

Canonical pose topics include `Drive/Odom_X`, `Drive/Odom_Y`, `Drive/Odom_Heading`, `Drive/Pose_X`, `Drive/Pose_Y`, `Drive/Pose_Heading`, and `ARES/EstimatedPose`. Positions are meters and headings are counter-clockwise-positive radians. Topic names are normalized without a leading slash.

Simulator driving uses the leased atomic `ARES/Input/driveFrame` contract. Do not replace it with retired scalar input topics or weaken its neutral-session handshake.

The local log API lists and downloads completed `.csv` and `.csv.gz` files. Active and quarantined files remain hidden. The API is intended for a trusted local network and must not be exposed to the public internet.

Logging uses a bounded asynchronous queue so storage cannot block the robot loop. Monitor accepted, written, dropped, queue-depth, rotation, and retention diagnostics rather than assuming a file's existence proves complete data.
