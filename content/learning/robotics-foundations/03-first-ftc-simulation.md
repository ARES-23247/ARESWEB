# Run your first FTC simulation

## Before launch

Use a clean FTC Starter project. Review Project Identity and the four required drive motors (`fl`, `fr`, `rl`, `rr`) plus the Control Hub IMU (`imu`). These names and the starter tuning profile are declarations for generation and simulation, not measurements from your robot.

Run the normal released-artifact verification from the project root:

```powershell
.\gradlew.bat generateAresProject verifyAresProject :TeamCode:testDebugUnitTest :simulator:test :TeamCode:assembleDebug
```

## Start in the required order

1. Open the standalone project in ARES Robotics Studio.
2. Select Local Simulator and verify the connection uses `127.0.0.1` or another loopback name.
3. Use the monitor-shaped **Launch Simulator** control and keep the terminal drawer visible while
   the project builds. Port `5810` being online only proves that an NT4 server is listening.
4. Wait for both the green **Local Sim** target indicator and Studio's connected status.
5. Select the generated TeleOp, send INIT, then START, and explicitly arm local control.
6. Apply a brief input and release it. Confirm the true simulated pose or another expected live
   telemetry value changes and then settles.
7. Stop the OpMode and the managed simulator cleanly before closing Studio.

## Evidence to record

Record the selected OpMode, successful INIT and START messages, armed state, connection state, and
before/after simulated pose. A successful build, listening port, changing button, chart, or
transmitted frame alone is not evidence that the simulated robot moved.
