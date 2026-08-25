# Telemetry and local log retrieval

ARES robots remain offline-first. Live NT4 telemetry is served on port `5810`; completed logs are available through the local HTTP service on port `5002`. A laptop may later synchronize data, but robot code does not need internet credentials.

## Simulator exercise

1. Start a local simulation and a TeleOp.
2. Observe `Drive/Pose_X`, `Drive/Pose_Y`, and `Drive/Pose_Heading`. Heading is radians and counter-clockwise-positive.
3. Stop the OpMode cleanly so the logger can drain and close the active file.
4. Open `http://127.0.0.1:5002/api/logs` on the same machine.
5. Download one completed `.csv` or `.csv.gz` file through `/api/download?file=<name>`.
6. Verify the copied file before deleting any robot-side log.

Do not expose port `5002` to the public internet. The service is designed for a trusted local network. Active and quarantined files are intentionally excluded from normal downloads.
