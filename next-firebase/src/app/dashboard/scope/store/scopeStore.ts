import { create } from "zustand";

export interface TelemetryFrame {
  timestamp: number;
  x: number;
  y: number;
  heading: number;
  battery: number;
  loopTime: number;
  motors: {
    lf: number;
    rf: number;
    lr: number;
    rr: number;
  };
  slides: {
    height: number;
    current: number;
  };
  intake: {
    current: number;
  };
}

export interface TelemetryData {
  runId: string;
  opModeName: string;
  timestamps: number[];
  coords: { x: number; y: number; heading: number }[];
  battery: number[];
  loopTime: number[];
  motors: {
    lf: number[];
    rf: number[];
    lr: number[];
    rr: number[];
  };
  slides: {
    height: number[];
    current: number[];
  };
  intake: {
    current: number[];
  };
  maxTimeMs: number;
}

export interface PlannedPathPoint {
  x: number;
  y: number;
  heading: number;
}

interface ScopeState {
  isPlaying: boolean;
  currentTimeMs: number;
  playbackSpeed: number;
  telemetryData: TelemetryData | null;
  plannedPath: PlannedPathPoint[] | null;
  selectedKeys: string[];
  
  // Streaming States
  isStreaming: boolean;
  streamSource: "local" | "cloud" | null;
  connectionStatus: "disconnected" | "connecting" | "connected";
  
  // Actions
  setPlaying: (isPlaying: boolean) => void;
  setCurrentTimeMs: (time: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setTelemetryData: (data: TelemetryData | null) => void;
  setPlannedPath: (path: PlannedPathPoint[] | null) => void;
  setSelectedKeys: (keys: string[]) => void;
  toggleSelectedKey: (key: string) => void;
  
  setStreaming: (isStreaming: boolean) => void;
  setStreamSource: (source: "local" | "cloud" | null) => void;
  setConnectionStatus: (status: "disconnected" | "connecting" | "connected") => void;
  addLiveFrame: (frame: TelemetryFrame) => void;

  getCurrentFrame: () => TelemetryFrame | null;
}

export const useScopeStore = create<ScopeState>((set, get) => ({
  isPlaying: false,
  currentTimeMs: 0,
  playbackSpeed: 1.0,
  telemetryData: null,
  plannedPath: null,
  selectedKeys: ["battery", "loopTime"],
  
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
  setTelemetryData: (telemetryData) => set({ 
    telemetryData, 
    currentTimeMs: 0, 
    isPlaying: false 
  }),
  setPlannedPath: (plannedPath) => set({ plannedPath }),
  setSelectedKeys: (selectedKeys) => set({ selectedKeys }),
  toggleSelectedKey: (key) => set((state) => {
    const isSelected = state.selectedKeys.includes(key);
    const nextKeys = isSelected
      ? state.selectedKeys.filter((k) => k !== key)
      : [...state.selectedKeys, key];
    return { selectedKeys: nextKeys };
  }),
  
  setStreaming: (isStreaming) => set({ isStreaming }),
  setStreamSource: (streamSource) => set({ streamSource }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  addLiveFrame: (frame) => set((state) => {
    const currentData = state.telemetryData || {
      runId: "live",
      opModeName: "Live Stream",
      timestamps: [],
      coords: [],
      battery: [],
      loopTime: [],
      motors: { lf: [], rf: [], lr: [], rr: [] },
      slides: { height: [], current: [] },
      intake: { current: [] },
      maxTimeMs: 0
    };

    const maxBufferSize = 300; // ~6 seconds rolling buffer at 50Hz
    
    const nextTimestamps = [...currentData.timestamps, frame.timestamp];
    const nextCoords = [...currentData.coords, { x: frame.x, y: frame.y, heading: frame.heading }];
    const nextBattery = [...currentData.battery, frame.battery];
    const nextLoopTime = [...currentData.loopTime, frame.loopTime];
    
    const nextMotors = {
      lf: [...currentData.motors.lf, frame.motors.lf],
      rf: [...currentData.motors.rf, frame.motors.rf],
      lr: [...currentData.motors.lr, frame.motors.lr],
      rr: [...currentData.motors.rr, frame.motors.rr],
    };

    const nextSlides = {
      height: [...currentData.slides.height, frame.slides.height],
      current: [...currentData.slides.current, frame.slides.current],
    };

    const nextIntake = {
      current: [...currentData.intake.current, frame.intake.current],
    };

    if (nextTimestamps.length > maxBufferSize) {
      nextTimestamps.shift();
      nextCoords.shift();
      nextBattery.shift();
      nextLoopTime.shift();
      nextMotors.lf.shift();
      nextMotors.rf.shift();
      nextMotors.lr.shift();
      nextMotors.rr.shift();
      nextSlides.height.shift();
      nextSlides.current.shift();
      nextIntake.current.shift();
    }

    const updatedData = {
      ...currentData,
      timestamps: nextTimestamps,
      coords: nextCoords,
      battery: nextBattery,
      loopTime: nextLoopTime,
      motors: nextMotors,
      slides: nextSlides,
      intake: nextIntake,
      maxTimeMs: nextTimestamps[nextTimestamps.length - 1] - nextTimestamps[0]
    };

    return {
      telemetryData: updatedData,
      currentTimeMs: updatedData.maxTimeMs
    };
  }),
  
  getCurrentFrame: () => {
    const { telemetryData, currentTimeMs } = get();
    if (!telemetryData || telemetryData.timestamps.length === 0) return null;

    // Find closest index using binary search
    const times = telemetryData.timestamps;
    let low = 0;
    let high = times.length - 1;
    let index = 0;

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

    // Safeguard index boundaries
    index = Math.max(0, Math.min(times.length - 1, index));

    return {
      timestamp: times[index],
      x: telemetryData.coords[index]?.x ?? 0,
      y: telemetryData.coords[index]?.y ?? 0,
      heading: telemetryData.coords[index]?.heading ?? 0,
      battery: telemetryData.battery[index] ?? 12.0,
      loopTime: telemetryData.loopTime[index] ?? 10.0,
      motors: {
        lf: telemetryData.motors.lf[index] ?? 0,
        rf: telemetryData.motors.rf[index] ?? 0,
        lr: telemetryData.motors.lr[index] ?? 0,
        rr: telemetryData.motors.rr[index] ?? 0,
      },
      slides: {
        height: telemetryData.slides.height[index] ?? 0,
        current: telemetryData.slides.current[index] ?? 0,
      },
      intake: {
        current: telemetryData.intake.current[index] ?? 0,
      }
    };
  }
}));
