# Map FTC controls through Redux

The starter TeleOp lifecycle adapter is intentionally small. The checked-in controller binding document owns periodic driver behavior and maps inputs to explicit actions.

## Guided exercise

1. Open TeleOp Controls in ARES Analytics.
2. Choose one drive-assist action, such as an explicit Enable, Disable, or Toggle binding.
3. Map it to an unused simulated button.
4. Regenerate and run project verification.
5. Launch Local Simulator, select the generated TeleOp, send INIT and START, then arm local control.
6. Press the binding once and observe the resulting state/telemetry. Release all input.
7. Stop the OpMode.

The binding should dispatch an action; it should not write a motor directly. If the action is rejected because required pose feedback is stale or invalid, preserve that fail-closed behavior rather than bypassing it for a demo.
