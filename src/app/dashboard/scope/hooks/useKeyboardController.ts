import { useEffect, useRef } from "react";
import { TelemetryFrame, FieldObstacle } from "../store/scopeStore";
import { NT4Client } from "../store/nt4Client";

/**
 * Handles simulator control using keyboard commands.
 * Captures movement input and relays status to the Daemon/Robot via NetworkTables.
 */
export function useKeyboardController(
  ntClient: NT4Client | null,
  currentFrame: TelemetryFrame | null,
  fieldObstacles: FieldObstacle[] | null
) {
  const pressedKeys = useRef<Set<string>>(new Set());
  const currentFrameRef = useRef(currentFrame);
  const heartbeatCounter = useRef(0);

  useEffect(() => {
    currentFrameRef.current = currentFrame;
  }, [currentFrame]);

  useEffect(() => {
    if (!ntClient) return;

    const publishKeyboardSpeeds = () => {
      const MAX_LINEAR_SPEED = 4.0;
      const MAX_ANGULAR_SPEED = 4.0;

      let vx = 0;
      let vy = 0;
      let omega = 0;

      if (pressedKeys.current.has("w")) vx += MAX_LINEAR_SPEED;
      if (pressedKeys.current.has("s")) vx -= MAX_LINEAR_SPEED;
      if (pressedKeys.current.has("a")) vy += MAX_LINEAR_SPEED;
      if (pressedKeys.current.has("d")) vy -= MAX_LINEAR_SPEED;
      if (pressedKeys.current.has("q")) omega += MAX_ANGULAR_SPEED;
      if (pressedKeys.current.has("e")) omega -= MAX_ANGULAR_SPEED;

      ntClient.publishPersistent("ARES/Input/vx", vx, "double");
      ntClient.publishPersistent("ARES/Input/vy", vy, "double");
      ntClient.publishPersistent("ARES/Input/omega", omega, "double");
    };

    const handleWebKeyDown = (e: KeyboardEvent) => {
      const isTyping = document.activeElement && (
        document.activeElement.tagName === "INPUT" ||
        document.activeElement.tagName === "TEXTAREA" ||
        document.activeElement.getAttribute("contenteditable") === "true"
      );
      if (isTyping) return;

      const key = e.key.toLowerCase();

      if (["w", "s", "a", "d", "q", "e"].includes(key)) {
        if (pressedKeys.current.has(key)) return;
        pressedKeys.current.add(key);
        e.preventDefault();
        publishKeyboardSpeeds();
        return;
      }

      const getVal = (topic: string, def: boolean) => {
        const frame = currentFrameRef.current;
        if (!frame || !frame.values) return def;
        const val = frame.values[topic];
        return val !== undefined ? val === 1 : def;
      };

      if (e.key === " ") {
        const currentTeleop = getVal("AdvantageKit/RealOutputs/Drive/TeleopMode", true);
        ntClient.publishPersistent("ARES/Input/isTeleopMode", !currentTeleop, "boolean");
        e.preventDefault();
      } else if (key === "c") {
        const currentFC = getVal("AdvantageKit/RealOutputs/Drive/FieldCentric", false);
        ntClient.publishPersistent("ARES/Input/isFieldCentric", !currentFC, "boolean");
        e.preventDefault();
      } else if (key === "r") {
        const currentRed = getVal("AdvantageKit/RealOutputs/Drive/RedAlliance", false);
        ntClient.publishPersistent("ARES/Input/isRedAlliance", !currentRed, "boolean");
        e.preventDefault();
      } else if (e.key === "Shift") {
        const currentIntake = getVal("AdvantageKit/RealOutputs/Superstructure/IntakeActive", false);
        ntClient.publishPersistent("ARES/Input/isIntaking", !currentIntake, "boolean");
        e.preventDefault();
      } else if (key === "f") {
        const currentFlywheel = getVal("AdvantageKit/RealOutputs/Superstructure/FlywheelActive", false);
        ntClient.publishPersistent("ARES/Input/isFlywheelOn", !currentFlywheel, "boolean");
        e.preventDefault();
      } else if (e.key === "Enter") {
        ntClient.publishPersistent("ARES/Input/isTransferring", true, "boolean");
        e.preventDefault();
      }
    };

    const handleWebKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (["w", "s", "a", "d", "q", "e"].includes(key)) {
        pressedKeys.current.delete(key);
        publishKeyboardSpeeds();
      } else if (e.key === "Enter") {
        ntClient.publishPersistent("ARES/Input/isTransferring", false, "boolean");
      }
    };

    const handleWindowBlur = () => {
      if (pressedKeys.current.size > 0) {
        pressedKeys.current.clear();
        publishKeyboardSpeeds();
      }
      ntClient.publishPersistent("ARES/Input/isTransferring", false, "boolean");
    };

    window.addEventListener("keydown", handleWebKeyDown);
    window.addEventListener("keyup", handleWebKeyUp);
    window.addEventListener("blur", handleWindowBlur);

    const interval = setInterval(() => {
      publishKeyboardSpeeds();
      heartbeatCounter.current = (heartbeatCounter.current + 1) % 1000000;
      ntClient.publishPersistent("ARES/Input/heartbeat", heartbeatCounter.current, "int");
    }, 100);

    return () => {
      window.removeEventListener("keydown", handleWebKeyDown);
      window.removeEventListener("keyup", handleWebKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
      clearInterval(interval);
    };
  }, [ntClient]);

  useEffect(() => {
    if (!ntClient) return;
    const obstaclesJson = JSON.stringify({ obstacles: fieldObstacles || [] });
    ntClient.publishPersistent("ARES/Input/obstacles", obstaclesJson, "string");
  }, [ntClient, fieldObstacles]);
}
export default useKeyboardController;
