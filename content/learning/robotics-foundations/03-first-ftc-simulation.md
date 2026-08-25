# Run your first FTC simulation

## Before launch

Use a clean FTC Starter project. Review Project Identity and the four required drive motors (`fl`, `fr`, `rl`, `rr`) plus the Control Hub IMU (`imu`). These names and the starter tuning profile are declarations for generation and simulation, not measurements from your robot.

Run the normal released-artifact verification from the project root:

```powershell
.\gradlew.bat generateAresProject verifyAresProject :TeamCode:testDebugUnitTest :simulator:test :TeamCode:assembleDebug
```

## Start in the required order

1. Open the project in ARES Analytics.
2. Select Local Simulator and verify the connection uses `127.0.0.1` or another loopback name.
3. Launch the simulator. Port `5810` being online only proves that the NT4 server is listening.
4. Select the generated TeleOp.
5. Send INIT, then START.
6. Explicitly arm local control.
7. Apply a brief input and release it. Confirm the true simulated pose changes and then settles.
8. Stop the OpMode before closing the simulator.

## Evidence to record

Record the selected OpMode, successful INIT and START messages, armed state, and before/after simulated pose. A changing button, chart, or transmitted frame alone is not evidence that the simulated robot moved.
