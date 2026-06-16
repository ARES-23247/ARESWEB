import { create } from "zustand";

export interface TelemetryFrame {
  timestamp: number;
  x: number;
  y: number;
  heading: number;
  values: Record<string, number>;
}

export interface TelemetryData {
  runId: string;
  opModeName: string;
  timestamps: number[];
  coords: { x: number; y: number; heading: number }[];
  channels: Record<string, number[]>;
  maxTimeMs: number;
}

export interface PlannedPathPoint {
  x: number;
  y: number;
  heading: number;
}

export interface ConsoleLogEntry {
  timestamp: number; // in ms
  level: "INFO" | "WARN" | "ERROR";
  message: string;
}

export interface FieldObstacle {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FieldElementType {
  id: string;
  name: string;
  shape: "box" | "cylinder" | "sphere";
  width: number;
  height: number;
  depth: number;
  diameter?: number;
  color: string;
  massKg: number;
  movable: boolean;
}

export interface FieldElementInstance {
  id: string;
  elementTypeId: string;
  x: number;
  y: number;
  rotation: number;
}

interface ScopeState {
  isPlaying: boolean;
  currentTimeMs: number;
  playbackSpeed: number;
  telemetryData: TelemetryData | null;
  comparisonTelemetryData: TelemetryData | null;
  plannedPath: PlannedPathPoint[] | null;
  consoleLogs: ConsoleLogEntry[] | null;
  selectedKeys: string[];
  driveMode: "mecanum" | "swerve";
  fieldObstacles: FieldObstacle[] | null;
  fieldElements: FieldElementInstance[] | null;
  fieldElementTypes: FieldElementType[] | null;
  fieldCadUrl: string | null;
  fieldBgImageUrl: string | null;
  
  // Streaming States
  isStreaming: boolean;
  streamSource: "local" | "cloud" | null;
  connectionStatus: "disconnected" | "connecting" | "connected";
  
  // Actions
  setPlaying: (isPlaying: boolean) => void;
  setCurrentTimeMs: (time: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setTelemetryData: (data: TelemetryData | null) => void;
  setComparisonTelemetryData: (data: TelemetryData | null) => void;
  setPlannedPath: (path: PlannedPathPoint[] | null) => void;
  setConsoleLogs: (logs: ConsoleLogEntry[] | null) => void;
  setFieldObstacles: (obstacles: FieldObstacle[] | null) => void;
  setFieldElements: (elements: FieldElementInstance[] | null) => void;
  setFieldElementTypes: (types: FieldElementType[] | null) => void;
  setFieldCadUrl: (url: string | null) => void;
  setFieldBgImageUrl: (url: string | null) => void;
  setSelectedKeys: (keys: string[]) => void;
  toggleSelectedKey: (key: string) => void;
  setDriveMode: (mode: "mecanum" | "swerve") => void;
  
  setStreaming: (isStreaming: boolean) => void;
  setStreamSource: (source: "local" | "cloud" | null) => void;
  setConnectionStatus: (status: "disconnected" | "connecting" | "connected") => void;
  addLiveFrame: (frame: TelemetryFrame) => void;

  getCurrentFrame: () => TelemetryFrame | null;
  getCurrentComparisonFrame: () => TelemetryFrame | null;
}

export const useScopeStore = create<ScopeState>((set, get) => ({
  isPlaying: false,
  currentTimeMs: 0,
  playbackSpeed: 1.0,
  telemetryData: null,
  comparisonTelemetryData: null,
  plannedPath: null,
  consoleLogs: null,
  selectedKeys: ["Robot/BatteryVoltage", "Robot/LoopTime"],
  driveMode: "mecanum",
  fieldObstacles: null,
  fieldElements: null,
  fieldElementTypes: null,
  fieldCadUrl: null,
  fieldBgImageUrl: null,
  
  isStreaming: false,
  streamSource: null,
  connectionStatus: "disconnected",

  setPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTimeMs: (currentTimeMs) => {
    const { telemetryData } = get();
    if (telemetryData && currentTimeMs > telemetryData.maxTimeMs) {
      set({ currentTimeMs: telemetryData.maxTimeMs, isPlaying: false });
    } else if (currentTimeMs < 0) {
      set({ currentTimeMs: 0 });
    } else {
      set({ currentTimeMs });
    }
  },
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setTelemetryData: (telemetryData) => {
    if (telemetryData && !telemetryData.channels) {
      const legacy = telemetryData as any;
      telemetryData.channels = {
        "Robot/BatteryVoltage": legacy.battery || [],
        "Robot/LoopTime": legacy.loopTime || [],
        "Drive/MotorPower_FL": legacy.motors?.lf || [],
        "Drive/MotorPower_FR": legacy.motors?.rf || [],
        "Drive/MotorPower_BL": legacy.motors?.lr || [],
        "Drive/MotorPower_BR": legacy.motors?.rr || [],
        "Superstructure/Elevator_Height": legacy.slides?.height || [],
        "Drive/MotorCurrent_FL": legacy.slides?.current || [],
        "Drive/IntakeCurrent": legacy.intake?.current || [],
      };
    }
    set({ 
      telemetryData, 
      currentTimeMs: 0, 
      isPlaying: false 
    });
  },
  setComparisonTelemetryData: (comparisonTelemetryData) => {
    if (comparisonTelemetryData && !comparisonTelemetryData.channels) {
      const legacy = comparisonTelemetryData as any;
      comparisonTelemetryData.channels = {
        "Robot/BatteryVoltage": legacy.battery || [],
        "Robot/LoopTime": legacy.loopTime || [],
        "Drive/MotorPower_FL": legacy.motors?.lf || [],
        "Drive/MotorPower_FR": legacy.motors?.rf || [],
        "Drive/MotorPower_BL": legacy.motors?.lr || [],
        "Drive/MotorPower_BR": legacy.motors?.rr || [],
        "Superstructure/Elevator_Height": legacy.slides?.height || [],
        "Drive/MotorCurrent_FL": legacy.slides?.current || [],
        "Drive/IntakeCurrent": legacy.intake?.current || [],
      };
    }
    set({ comparisonTelemetryData });
  },
  setConsoleLogs: (consoleLogs) => set({ consoleLogs }),
  setPlannedPath: (plannedPath) => set({ plannedPath }),
  setFieldObstacles: (fieldObstacles) => set({ fieldObstacles }),
  setFieldElements: (fieldElements) => set({ fieldElements }),
  setFieldElementTypes: (fieldElementTypes) => set({ fieldElementTypes }),
  setFieldCadUrl: (fieldCadUrl) => set({ fieldCadUrl }),
  setFieldBgImageUrl: (fieldBgImageUrl) => set({ fieldBgImageUrl }),
  setSelectedKeys: (selectedKeys) => set({ selectedKeys }),
  toggleSelectedKey: (key) => set((state) => {
    const isSelected = state.selectedKeys.includes(key);
    const nextKeys = isSelected
      ? state.selectedKeys.filter((k) => k !== key)
      : [...state.selectedKeys, key];
    return { selectedKeys: nextKeys };
  }),
  setDriveMode: (driveMode) => set({ driveMode }),
  
  setStreaming: (isStreaming) => set({ isStreaming }),
  setStreamSource: (streamSource) => set({ streamSource }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  addLiveFrame: (frame) => set((state) => {
    const currentData = state.telemetryData || {
      runId: "live",
      opModeName: "Live Stream",
      timestamps: [],
      coords: [],
      channels: {},
      maxTimeMs: 0
    };

    const maxBufferSize = 300; // ~6 seconds rolling buffer at 50Hz
    
    const nextTimestamps = [...currentData.timestamps, frame.timestamp];
    const nextCoords = [...currentData.coords, { x: frame.x, y: frame.y, heading: frame.heading }];
    
    // Create new channels copy
    const nextChannels = { ...currentData.channels };
    
    // Ensure all existing channels are padded to the new frame index
    Object.keys(nextChannels).forEach((key) => {
      const lastVal = nextChannels[key][nextChannels[key].length - 1] ?? 0;
      nextChannels[key] = [...nextChannels[key], frame.values[key] ?? lastVal];
    });

    // Add any newly announced channels in the frame values
    Object.keys(frame.values).forEach((key) => {
      if (!nextChannels[key]) {
        const padding = Array(nextTimestamps.length - 1).fill(0);
        nextChannels[key] = [...padding, frame.values[key]];
      }
    });

    if (nextTimestamps.length > maxBufferSize) {
      nextTimestamps.shift();
      nextCoords.shift();
      Object.keys(nextChannels).forEach((key) => {
        nextChannels[key].shift();
      });
    }

    const updatedData = {
      ...currentData,
      timestamps: nextTimestamps,
      coords: nextCoords,
      channels: nextChannels,
      maxTimeMs: nextTimestamps[nextTimestamps.length - 1] - nextTimestamps[0]
    };

    return {
      telemetryData: updatedData,
      currentTimeMs: updatedData.maxTimeMs
    };
  }),
  
  getCurrentFrame: () => {
    const { telemetryData, currentTimeMs, isStreaming } = get();
    if (!telemetryData || telemetryData.timestamps.length === 0) return null;

    let index = 0;
    if (isStreaming) {
      index = telemetryData.timestamps.length - 1;
    } else {
      // Find closest index using binary search
      const times = telemetryData.timestamps;
      let low = 0;
      let high = times.length - 1;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (times[mid] === currentTimeMs) {
          index = mid;
          break;
        }
        if (times[mid] < currentTimeMs) {
          index = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
    }

    // Safeguard index boundaries
    index = Math.max(0, Math.min(telemetryData.timestamps.length - 1, index));

    const values: Record<string, number> = {};
    Object.keys(telemetryData.channels).forEach((key) => {
      values[key] = telemetryData.channels[key][index] ?? 0;
    });

    return {
      timestamp: telemetryData.timestamps[index],
      x: telemetryData.coords[index]?.x ?? 0,
      y: telemetryData.coords[index]?.y ?? 0,
      heading: telemetryData.coords[index]?.heading ?? 0,
      values
    };
  },
  
  getCurrentComparisonFrame: () => {
    const { comparisonTelemetryData, currentTimeMs, isStreaming } = get();
    if (!comparisonTelemetryData || comparisonTelemetryData.timestamps.length === 0) return null;

    let index = 0;
    if (isStreaming) {
      index = comparisonTelemetryData.timestamps.length - 1;
    } else {
      // Find closest index using binary search
      const times = comparisonTelemetryData.timestamps;
      let low = 0;
      let high = times.length - 1;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (times[mid] === currentTimeMs) {
          index = mid;
          break;
        }
        if (times[mid] < currentTimeMs) {
          index = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
    }

    index = Math.max(0, Math.min(comparisonTelemetryData.timestamps.length - 1, index));

    const values: Record<string, number> = {};
    Object.keys(comparisonTelemetryData.channels).forEach((key) => {
      values[key] = comparisonTelemetryData.channels[key][index] ?? 0;
    });

    return {
      timestamp: comparisonTelemetryData.timestamps[index],
      x: comparisonTelemetryData.coords[index]?.x ?? 0,
      y: comparisonTelemetryData.coords[index]?.y ?? 0,
      heading: comparisonTelemetryData.coords[index]?.heading ?? 0,
      values
    };
  }
}));
