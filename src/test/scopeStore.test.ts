import { describe, it, expect, beforeEach } from "vitest";
import { useScopeStore, TelemetryData, TelemetryFrame } from "../app/dashboard/scope/store/scopeStore";

describe("useScopeStore", () => {
  const mockTelemetryData: TelemetryData = {
    runId: "run_test_1",
    opModeName: "TeleOpTest",
    timestamps: [0, 50, 100, 150, 200],
    coords: [
      { x: 0, y: 0, heading: 0 },
      { x: 1, y: 1, heading: 0.1 },
      { x: 2, y: 2, heading: 0.2 },
      { x: 3, y: 3, heading: 0.3 },
      { x: 4, y: 4, heading: 0.4 },
    ],
    channels: {
      "Robot/BatteryVoltage": [12.8, 12.7, 12.6, 12.5, 12.4],
      "Robot/LoopTime": [20, 21, 22, 23, 24],
    },
    maxTimeMs: 200,
  };

  beforeEach(() => {
    useScopeStore.setState({
      isPlaying: false,
      currentTimeMs: 0,
      playbackSpeed: 1.0,
      telemetryData: null,
      comparisonTelemetryData: null,
      plannedPath: null,
      consoleLogs: null,
      selectedKeys: ["Robot/BatteryVoltage", "Robot/LoopTime"],
      driveMode: "mecanum",
      isStreaming: false,
      streamSource: null,
      connectionStatus: "disconnected",
    });
  });

  it("should initialize with default states", () => {
    const state = useScopeStore.getState();
    expect(state.isPlaying).toBe(false);
    expect(state.currentTimeMs).toBe(0);
    expect(state.playbackSpeed).toBe(1.0);
    expect(state.telemetryData).toBeNull();
  });

  it("should toggle playing state", () => {
    useScopeStore.getState().setPlaying(true);
    expect(useScopeStore.getState().isPlaying).toBe(true);
  });

  it("should set and limit current time correctly", () => {
    useScopeStore.getState().setTelemetryData(mockTelemetryData);
    
    useScopeStore.getState().setCurrentTimeMs(100);
    expect(useScopeStore.getState().currentTimeMs).toBe(100);

    // Limit to maxTimeMs
    useScopeStore.getState().setCurrentTimeMs(500);
    expect(useScopeStore.getState().currentTimeMs).toBe(200);
    expect(useScopeStore.getState().isPlaying).toBe(false);

    // Limit to 0
    useScopeStore.getState().setCurrentTimeMs(-50);
    expect(useScopeStore.getState().currentTimeMs).toBe(0);
  });

  it("should support toggling selected keys", () => {
    useScopeStore.getState().toggleSelectedKey("Robot/LoopTime");
    expect(useScopeStore.getState().selectedKeys).toEqual(["Robot/BatteryVoltage"]);

    useScopeStore.getState().toggleSelectedKey("Robot/LoopTime");
    expect(useScopeStore.getState().selectedKeys).toEqual(["Robot/BatteryVoltage", "Robot/LoopTime"]);
  });

  it("should binary search and extract current frame details correctly", () => {
    useScopeStore.getState().setTelemetryData(mockTelemetryData);
    useScopeStore.getState().setCurrentTimeMs(120); // Closest lower or equal is index 2 (100ms)

    const frame = useScopeStore.getState().getCurrentFrame();
    expect(frame).not.toBeNull();
    expect(frame?.timestamp).toBe(100);
    expect(frame?.x).toBe(2);
    expect(frame?.values["Robot/BatteryVoltage"]).toBe(12.6);
  });

  it("should add live frames to stream and roll buffer size", () => {
    useScopeStore.getState().setStreaming(true);
    
    const initialFrame: TelemetryFrame = {
      timestamp: 1000,
      x: 5,
      y: 5,
      heading: 0.5,
      values: { "Robot/BatteryVoltage": 12.0 },
    };

    useScopeStore.getState().addLiveFrame(initialFrame);
    
    let state = useScopeStore.getState();
    expect(state.telemetryData).not.toBeNull();
    expect(state.telemetryData?.timestamps).toContain(1000);
    expect(state.currentTimeMs).toBe(0);

    const secondFrame: TelemetryFrame = {
      timestamp: 1050,
      x: 6,
      y: 6,
      heading: 0.6,
      values: { "Robot/BatteryVoltage": 11.9 },
    };

    useScopeStore.getState().addLiveFrame(secondFrame);
    state = useScopeStore.getState();
    expect(state.currentTimeMs).toBe(50);
  });
});
