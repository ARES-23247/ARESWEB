"use client";

import React, { useEffect, useState, useRef } from "react";
import { authenticatedFetch } from "@/lib/api";
import { useScopeStore, TelemetryData } from "./store/scopeStore";
import WebGLReplayCanvas from "./components/WebGLReplayCanvas";
import TelemetryCharts from "./components/TelemetryCharts";
import StateInspector from "./components/StateInspector";
import HealthDiagnostics from "./components/HealthDiagnostics";
import SyncRobotLogsModal from "./components/SyncRobotLogsModal";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, query, orderBy } from "firebase/firestore";
import { 
  X, 
  Maximize2, 
  Copy, 
  Trash2, 
  Edit3, 
  Layout, 
  Save, 
  Download, 
  Upload, 
  RotateCcw,
  RefreshCw,
  FolderOpen
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import VariablesTuner from "./components/VariablesTuner";

// Custom Hooks
import { useNT4Client } from "./hooks/useNT4Client";
import { 
  useScopeLayout, 
  LayoutItem, 
  ChartConfig, 
  DashboardPreset,
  migrateLayoutCoordinates 
} from "./hooks/useScopeLayout";

export { migrateLayoutCoordinates };
export type { LayoutItem, ChartConfig, DashboardPreset };

// Subcomponents
import ScopeHeader from "./components/ScopeHeader";
import LocalSimulatorPanel from "./components/LocalSimulatorPanel";
import ConsoleLogsWidget from "./components/ConsoleLogsWidget";
import LiveStreamModal from "./components/LiveStreamModal";
import SavePresetModal from "./components/SavePresetModal";
import TimelineDeck from "./components/TimelineDeck";

export default function ScopeDashboard() {
  const { 
    isPlaying, 
    currentTimeMs, 
    playbackSpeed, 
    telemetryData, 
    comparisonTelemetryData,
    consoleLogs,
    isStreaming,
    connectionStatus,
    setPlaying, 
    setCurrentTimeMs, 
    setPlaybackSpeed, 
    setTelemetryData,
    setComparisonTelemetryData,
    setConsoleLogs,
    setPlannedPath,
    setFieldObstacles,
    setFieldElements,
    setFieldElementTypes,
    setFieldCadUrl,
    setFieldBgImageUrl
  } = useScopeStore();

  // Custom Hooks
  const {
    ipAddress,
    setIpAddress,
    showLiveModal,
    setShowLiveModal,
    handleConnectLive,
    handleDisconnectLive,
    handlePublishValue
  } = useNT4Client();

  const {
    isEditMode,
    setIsEditMode,
    gridContainerRef,
    dashboardLayout,
    setDashboardLayout,
    chartConfigs,
    setChartConfigs,
    tuningConstants,
    setTuningConstants,
    cloudPresets,
    activePresetId,
    setActivePresetId,
    showSavePresetModal,
    setShowSavePresetModal,
    newPresetName,
    setNewPresetName,
    isSharedToggle,
    setIsSharedToggle,
    savingPreset,
    isMobile,
    editingCardId,
    setEditingCardId,
    editingTitleText,
    setEditingTitleText,
    handleAddWidget,
    handleDuplicateChart,
    handleDeleteWidget,
    handleAddToGroup,
    handleRemoveFromGroup,
    handleStartRename,
    handleSaveRename,
    handleExportLayout,
    handleImportLayout,
    handleResetLayout,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleSavePreset,
    handleLoadPreset,
    handleDeletePresetFromCloud,
    handleToggleFullscreen
  } = useScopeLayout();

  const [selectedRunId, setSelectedRunId] = useState("run_2026_championship_finals");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [searchParams] = useSearchParams();

  // Robot Log Sync States
  const [showSyncModal, setShowSyncModal] = useState(false);
  
  // Video Sync States
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Local Simulator Launcher States
  const [showSimDrawer, setShowSimDrawer] = useState(false);
  const [simState, setSimState] = useState<'idle' | 'building' | 'running'>('idle');

  // Field Obstacle Configuration States
  const [fieldConfigs, setFieldConfigs] = useState<{ id: string; name: string; obstacles: any[]; elements?: any[]; elementTypes?: any[]; cadUrl?: string; bgImageUrl?: string }[]>([]);
  const [selectedFieldConfigId, setSelectedFieldConfigId] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Listen to url param ?sim=true to open drawer
  useEffect(() => {
    if (searchParams.get("sim") === "true") {
      setShowSimDrawer(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchFieldConfigs = async () => {
      try {
        const q = query(collection(db, "field_configs"), orderBy("updatedAt", "desc"));
        const querySnapshot = await getDocs(q);
        const configs: any[] = [];
        querySnapshot.forEach((docSnap) => {
          configs.push({ id: docSnap.id, ...docSnap.data() });
        });
        setFieldConfigs(configs);
        
        // Auto-select the first one if available
        if (configs.length > 0) {
          setSelectedFieldConfigId(configs[0].id);
          setFieldObstacles(configs[0].obstacles || []);
          setFieldElements(configs[0].elements || []);
          setFieldElementTypes(configs[0].elementTypes || []);
          setFieldCadUrl(configs[0].cadUrl || null);
          setFieldBgImageUrl(configs[0].bgImageUrl || null);
        } else {
          setFieldObstacles(null);
          setFieldElements(null);
          setFieldElementTypes(null);
          setFieldCadUrl(null);
          setFieldBgImageUrl(null);
        }
      } catch (err) {
        console.error("Failed to fetch field configurations:", err);
      }
    };
    fetchFieldConfigs();
  }, [setFieldObstacles, setFieldElements, setFieldElementTypes, setFieldCadUrl, setFieldBgImageUrl]);

  const handleFieldConfigChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const configId = e.target.value;
    setSelectedFieldConfigId(configId);
    if (!configId) {
      setFieldObstacles(null);
      setFieldElements(null);
      setFieldElementTypes(null);
      setFieldCadUrl(null);
      setFieldBgImageUrl(null);
      return;
    }
    const config = fieldConfigs.find((c) => c.id === configId);
    if (config) {
      setFieldObstacles(config.obstacles || []);
      setFieldElements(config.elements || []);
      setFieldElementTypes(config.elementTypes || []);
      setFieldCadUrl(config.cadUrl || null);
      setFieldBgImageUrl(config.bgImageUrl || null);
    } else {
      setFieldObstacles(null);
      setFieldElements(null);
      setFieldElementTypes(null);
      setFieldCadUrl(null);
      setFieldBgImageUrl(null);
    }
  };

  // Fetch telemetry log (BigQuery / Local Fallback)
  const fetchTelemetryRun = async (runId: string) => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/analytics/telemetry-log?runId=${runId}`);
      const data = await res.json();
      if (data && data.timestamps) {
        setTelemetryData(data as TelemetryData);
      }
    } catch (err) {
      console.error("Failed to fetch telemetry run:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("logId")) {
        return; // Skip loading default telemetry if loading from URL parameter
      }
    }
    if (!isStreaming) {
      fetchTelemetryRun(selectedRunId);
    }
  }, [selectedRunId, isStreaming]);

  // Drag and drop local CSV log parser
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      parseLocalLogFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseLocalLogFile(e.target.files[0]);
    }
  };

  // Standalone CSV parser that updates the scope store telemetry data
  const parseCSVText = (text: string, fileName: string) => {
    // Simple CSV parser
    const lines = text.split("\n").filter((l) => l.trim() !== "");
    if (lines.length < 2) throw new Error("Invalid CSV format.");

    const headers = lines[0].split(",").map((h) => h.trim());
    const timestamps: number[] = [];
    const coords: { x: number; y: number; heading: number }[] = [];
    const channels: Record<string, number[]> = {};
    
    headers.forEach((h) => {
      channels[h] = [];
    });

    const findColIndex = (names: string[]) => {
      return headers.findIndex((h) => 
        names.some((n) => h.toLowerCase() === n.toLowerCase() || h.toLowerCase().includes(n.toLowerCase()))
      );
    };

    const xIdx = findColIndex(["drive/pose_x", "drive/odom_x", "posex", "x", "estimatedpose[0]", "robotpose[0]"]);
    const yIdx = findColIndex(["drive/pose_y", "drive/odom_y", "posey", "y", "estimatedpose[1]", "robotpose[1]"]);
    const headingIdx = findColIndex(["drive/drive_heading", "drive/pose_heading", "drive/odom_heading", "heading", "poseheading", "estimatedpose[2]", "robotpose[2]"]);
    const timeIdx = findColIndex(["timestampms", "timestamp", "time", "ms"]);

    // Process line rows
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      if (cols.length < headers.length) continue;

      const colsNum = cols.map((c) => parseFloat(c.trim()) || 0);

      const t = timeIdx !== -1 ? colsNum[timeIdx] : (i - 1) * 20;
      timestamps.push(t);
      
      let x = xIdx !== -1 ? colsNum[xIdx] : 0.0;
      let y = yIdx !== -1 ? colsNum[yIdx] : 0.0;
      let heading = headingIdx !== -1 ? colsNum[headingIdx] : 0.0;

      // Ensure coordinates are in center-origin meters.
      // If they look like bottom-left inches (large values), convert to center-origin meters:
      if (Math.abs(x) > 5.0 || Math.abs(y) > 5.0) {
        const tempX = x;
        x = (y - 72) / 39.3701;
        y = -(tempX - 72) / 39.3701;
        heading = heading - Math.PI / 2;
      }

      coords.push({ x, y, heading });

      headers.forEach((h, idx) => {
        channels[h].push(colsNum[idx]);
      });
    }

    const customTelemetry: TelemetryData = {
      runId: fileName.substring(0, 15),
      opModeName: "ARESImportedCloudLog",
      timestamps: timestamps,
      coords: coords,
      channels: channels,
      maxTimeMs: timestamps.length > 0 ? timestamps[timestamps.length - 1] - timestamps[0] : 0
    };

    setTelemetryData(customTelemetry);
    console.log(`[CSV Parser] Parsed and loaded file: ${fileName}`);
  };

  // Local log parsing engine (Zero UI block)
  const parseLocalLogFile = (file: File) => {
    handleDisconnectLive();
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Empty file data.");
        parseCSVText(text, file.name);
      } catch (err: any) {
        alert("Failed to parse log file: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  // Parser for synchronised console log statements
  const parseConsoleLogFile = (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Empty file data.");

        const lines = text.split("\n").filter((l) => l.trim() !== "");
        const parsedEntries: any[] = [];

        lines.forEach((line, idx) => {
          let timestamp = idx * 100; // default incremental fallback (ms)
          let level: "INFO" | "WARN" | "ERROR" = "INFO";
          let message = line;

          // Deduce level
          if (line.includes("[WARN]") || line.toLowerCase().includes("warn")) {
            level = "WARN";
          } else if (line.includes("[ERROR]") || line.toLowerCase().includes("error") || line.toLowerCase().includes("fail")) {
            level = "ERROR";
          }

          // Extract bracketed or colon timestamps: e.g. [1.25s], [1250ms], 1250:
          const bracketMatch = line.match(/\[(\d+(?:\.\d+)?)(s|ms)?\]/);
          const colonMatch = line.match(/^(\d+(?:\.\d+)?)(s|ms)?:/);
          
          if (bracketMatch) {
            const val = parseFloat(bracketMatch[1]);
            const unit = bracketMatch[2] || "ms";
            timestamp = unit === "s" ? val * 1000 : val;
            message = line.replace(bracketMatch[0], "").trim();
          } else if (colonMatch) {
            const val = parseFloat(colonMatch[1]);
            const unit = colonMatch[2] || "ms";
            timestamp = unit === "s" ? val * 1000 : val;
            message = line.replace(colonMatch[0], "").trim();
          }

          // Strip level brackets from the visual message string
          message = message.replace(/\[(INFO|WARN|ERROR)\]/i, "").replace(/\s+/g, " ").trim();

          parsedEntries.push({ timestamp, level, message });
        });

        // Ensure chronological sorting
        parsedEntries.sort((a, b) => a.timestamp - b.timestamp);

        setConsoleLogs(parsedEntries);
        console.log(`[Console Log Parser] Loaded ${parsedEntries.length} entries: ${file.name}`);
      } catch (err: any) {
        alert("Failed to parse console log file: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleConsoleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseConsoleLogFile(e.target.files[0]);
    }
  };

  // Parser for second telemetry run (comparison overlay)
  const parseComparisonLogFile = (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Empty file data.");

        const lines = text.split("\n").filter((l) => l.trim() !== "");
        if (lines.length < 2) throw new Error("Invalid CSV format.");

        const headers = lines[0].split(",").map((h) => h.trim());
        const timestamps: number[] = [];
        const coords: { x: number; y: number; heading: number }[] = [];
        const channels: Record<string, number[]> = {};
        
        headers.forEach((h) => {
          channels[h] = [];
        });

        const findColIndex = (names: string[]) => {
          return headers.findIndex((h) => 
            names.some((n) => h.toLowerCase() === n.toLowerCase() || h.toLowerCase().includes(n.toLowerCase()))
          );
        };

        const xIdx = findColIndex(["drive/pose_x", "drive/odom_x", "posex", "x", "estimatedpose[0]", "robotpose[0]"]);
        const yIdx = findColIndex(["drive/pose_y", "drive/odom_y", "posey", "y", "estimatedpose[1]", "robotpose[1]"]);
        const headingIdx = findColIndex(["drive/drive_heading", "drive/pose_heading", "drive/odom_heading", "heading", "poseheading", "estimatedpose[2]", "robotpose[2]"]);
        const timeIdx = findColIndex(["timestampms", "timestamp", "time", "ms"]);

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",");
          if (cols.length < headers.length) continue;

          const colsNum = cols.map((c) => parseFloat(c.trim()) || 0);

          const t = timeIdx !== -1 ? colsNum[timeIdx] : (i - 1) * 20;
          timestamps.push(t);
          
          let x = xIdx !== -1 ? colsNum[xIdx] : 0.0;
          let y = yIdx !== -1 ? colsNum[yIdx] : 0.0;
          let heading = headingIdx !== -1 ? colsNum[headingIdx] : 0.0;

          if (Math.abs(x) > 5.0 || Math.abs(y) > 5.0) {
            const tempX = x;
            x = (y - 72) / 39.3701;
            y = -(tempX - 72) / 39.3701;
            heading = heading - Math.PI / 2;
          }

          coords.push({ x, y, heading });

          headers.forEach((h, idx) => {
            channels[h].push(colsNum[idx]);
          });
        }

        const customTelemetry: TelemetryData = {
          runId: file.name.substring(0, 15),
          opModeName: "ARESComparisonLog",
          timestamps: timestamps,
          coords: coords,
          channels: channels,
          maxTimeMs: timestamps.length > 0 ? timestamps[timestamps.length - 1] - timestamps[0] : 0
        };

        setComparisonTelemetryData(customTelemetry);
        console.log(`[Comparison Parser] Parsed and loaded comparison: ${file.name}`);
      } catch (err: any) {
        alert("Failed to parse comparison log: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleComparisonInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseComparisonLogFile(e.target.files[0]);
    }
  };

  // Helper to generate dense points along the Bezier curves from saved waypoints
  const generatePlannedPathFromWaypoints = (wps: any[]) => {
    const parsedWaypoints = wps.map((wp: any) => {
      // Convert AresPlanner inches to EKF meters
      const anchor = {
        x: (wp.anchor.y * 0.0254) - 1.8288,
        y: 1.8288 - (wp.anchor.x * 0.0254)
      };
      
      const prevControl = wp.prevControl 
        ? { x: (wp.prevControl.y * 0.0254) - 1.8288, y: 1.8288 - (wp.prevControl.x * 0.0254) }
        : anchor;
        
      const nextControl = wp.nextControl
        ? { x: (wp.nextControl.y * 0.0254) - 1.8288, y: 1.8288 - (wp.nextControl.x * 0.0254) }
        : anchor;
        
      return { anchor, prevControl, nextControl };
    });

    if (parsedWaypoints.length === 0) return [];

    const densePoints: { x: number; y: number; heading: number }[] = [];
    
    let initialHeading = 0;
    if (parsedWaypoints.length > 1) {
      const wp1 = parsedWaypoints[0];
      const wp2 = parsedWaypoints[1];
      const p0 = wp1.anchor;
      const p1 = wp1.nextControl;
      const dx = 3 * (p1.x - p0.x);
      const dy = 3 * (p1.y - p0.y);
      initialHeading = Math.atan2(dy, dx);
    }
    
    densePoints.push({
      x: parsedWaypoints[0].anchor.x,
      y: parsedWaypoints[0].anchor.y,
      heading: initialHeading
    });

    const numSamples = 20;
    for (let i = 0; i < parsedWaypoints.length - 1; i++) {
      const wp1 = parsedWaypoints[i];
      const wp2 = parsedWaypoints[i + 1];
      
      const p0 = wp1.anchor;
      const p1 = wp1.nextControl;
      const p2 = wp2.prevControl;
      const p3 = wp2.anchor;

      for (let step = 1; step <= numSamples; step++) {
        const t = step / numSamples;
        const omt = 1 - t;
        const omt2 = omt * omt;
        const omt3 = omt2 * omt;
        const t2 = t * t;
        const t3 = t2 * t;

        const x = omt3 * p0.x + 3 * omt2 * t * p1.x + 3 * omt * t2 * p2.x + t3 * p3.x;
        const y = omt3 * p0.y + 3 * omt2 * t * p1.y + 3 * omt * t2 * p2.y + t3 * p3.y;

        const dx = 3 * omt2 * (p1.x - p0.x) + 6 * omt * t * (p2.x - p1.x) + 3 * t2 * (p3.x - p2.x);
        const dy = 3 * omt2 * (p1.y - p0.y) + 6 * omt * t * (p2.y - p1.y) + 3 * t2 * (p3.y - p2.y);
        const heading = Math.atan2(dy, dx);

        densePoints.push({ x, y, heading });
      }
    }
    return densePoints;
  };

  // Effect to load cloud telemetry log if logId search parameter is set
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const logId = params.get("logId");
    if (!logId) return;

    const loadCloudLog = async () => {
      handleDisconnectLive();
      setLoading(true);
      try {
        const docRef = doc(db, "aresplanner_log_data", logId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          throw new Error("Telemetry log content not found in the cloud.");
        }

        const data = docSnap.data();
        if (!data || !data.csvData) {
          throw new Error("Telemetry log is empty or invalid.");
        }

        // Fetch the corresponding metadata to get the actual file name and path version
        const metaRef = doc(db, "aresplanner_logs", logId);
        const metaSnap = await getDoc(metaRef);
        const metaData = metaSnap.exists() ? metaSnap.data() : null;
        const name = metaData?.name || "cloud_telemetry.csv";

        parseCSVText(data.csvData, name);

        // Load the frozen planned path version from the log metadata
        if (metaData?.pathState?.waypoints) {
          const densePoints = generatePlannedPathFromWaypoints(metaData.pathState.waypoints);
          setPlannedPath(densePoints);
          console.log(`[Path Versioning] Loaded frozen path version from log metadata for replay.`);
        }
      } catch (err: any) {
        console.error("Failed to load cloud log:", err);
        alert("Failed to load cloud log: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    loadCloudLog();
  }, [db]);

  const handlePathInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseLocalPathFile(e.target.files[0]);
    }
  };

  const parseLocalPathFile = (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Empty file data.");

        const root = JSON.parse(text);
        if (!root.waypoints || !Array.isArray(root.waypoints)) {
          throw new Error("Invalid PathPlanner file: missing waypoints array.");
        }

        const parsedWaypoints = root.waypoints.map((wp: any) => {
          const anchor = {
            x: (wp.anchor?.y ?? 0) - 1.8288,
            y: 1.8288 - (wp.anchor?.x ?? 0)
          };
          
          const prevControl = wp.prevControl 
            ? { x: wp.prevControl.y - 1.8288, y: 1.8288 - wp.prevControl.x }
            : anchor;
            
          const nextControl = wp.nextControl
            ? { x: wp.nextControl.y - 1.8288, y: 1.8288 - wp.nextControl.x }
            : anchor;
            
          return { anchor, prevControl, nextControl };
        });

        if (parsedWaypoints.length === 0) {
          throw new Error("No waypoints found in path.");
        }

        const densePoints: { x: number; y: number; heading: number }[] = [];
        
        let initialHeading = 0;
        if (parsedWaypoints.length > 1) {
          const wp1 = parsedWaypoints[0];
          const wp2 = parsedWaypoints[1];
          const p0 = wp1.anchor;
          const p1 = wp1.nextControl;
          const dx = 3 * (p1.x - p0.x);
          const dy = 3 * (p1.y - p0.y);
          initialHeading = Math.atan2(dy, dx);
        }
        
        densePoints.push({
          x: parsedWaypoints[0].anchor.x,
          y: parsedWaypoints[0].anchor.y,
          heading: initialHeading
        });

        const numSamples = 20;
        for (let i = 0; i < parsedWaypoints.length - 1; i++) {
          const wp1 = parsedWaypoints[i];
          const wp2 = parsedWaypoints[i + 1];
          
          const p0 = wp1.anchor;
          const p1 = wp1.nextControl;
          const p2 = wp2.prevControl;
          const p3 = wp2.anchor;

          for (let step = 1; step <= numSamples; step++) {
            const t = step / numSamples;
            const omt = 1 - t;
            const omt2 = omt * omt;
            const omt3 = omt2 * omt;
            const t2 = t * t;
            const t3 = t2 * t;

            const x = omt3 * p0.x + 3 * omt2 * t * p1.x + 3 * omt * t2 * p2.x + t3 * p3.x;
            const y = omt3 * p0.y + 3 * omt2 * t * p1.y + 3 * omt * t2 * p2.y + t3 * p3.y;

            const dx = 3 * omt2 * (p1.x - p0.x) + 6 * omt * t * (p2.x - p1.x) + 3 * t2 * (p3.x - p2.x);
            const dy = 3 * omt2 * (p1.y - p0.y) + 6 * omt * t * (p2.y - p1.y) + 3 * t2 * (p3.y - p2.y);
            const heading = Math.atan2(dy, dx);

            densePoints.push({ x, y, heading });
          }
        }

        setPlannedPath(densePoints);
        console.log(`[Path Parser] Parsed and loaded planned path: ${file.name}`);
      } catch (err: any) {
        alert("Failed to parse PathPlanner file: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  // High-performance 60 FPS animation/playback loop
  useEffect(() => {
    if (!isPlaying || !telemetryData || isStreaming) return;

    let lastTime = performance.now();
    let animationFrameId: number;

    const loop = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;

      // Advance playhead proportional to elapsed real-world time and playback speed
      setCurrentTimeMs(currentTimeMs + delta * playbackSpeed);
      
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, currentTimeMs, playbackSpeed, telemetryData, isStreaming]);

  // Sync video playback speed to master playbackSpeed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, videoUrl]);

  // Sync play/pause states of video to master isPlaying
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying, videoUrl]);

  // Sync video current time to master currentTimeMs
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const timeSec = currentTimeMs / 1000;
    // Only update if difference is > 0.15 seconds to avoid sync fighting / jitter
    if (Math.abs(video.currentTime - timeSec) > 0.15) {
      video.currentTime = timeSec;
    }
  }, [currentTimeMs, videoUrl]);

  return (
    <div className="space-y-8">
      
      {/* Header Deck */}
      <ScopeHeader
        isStreaming={isStreaming}
        connectionStatus={connectionStatus}
        simState={simState}
        fieldConfigs={fieldConfigs}
        selectedFieldConfigId={selectedFieldConfigId}
        handleFieldConfigChange={handleFieldConfigChange}
        selectedRunId={selectedRunId}
        setSelectedRunId={setSelectedRunId}
        setShowLiveModal={setShowLiveModal}
        setShowSimDrawer={setShowSimDrawer}
        setShowSyncModal={setShowSyncModal}
        handleDisconnectLive={handleDisconnectLive}
        comparisonTelemetryData={comparisonTelemetryData}
        setComparisonTelemetryData={setComparisonTelemetryData}
        consoleLogs={consoleLogs}
        setConsoleLogs={setConsoleLogs}
        setVideoUrl={setVideoUrl}
        handleFileInput={handleFileInput}
        handleComparisonInput={handleComparisonInput}
        handleConsoleInput={handleConsoleInput}
        handlePathInput={handlePathInput}
      />

      {/* Loading overlay spinner */}
      {loading && (
        <div className="glass-card border border-white/10 bg-black/45 p-8 rounded-2xl flex flex-col items-center justify-center gap-4 py-16 animate-pulse">
          <RefreshCw size={32} className="text-ares-gold animate-spin" />
          <p className="text-xs font-black uppercase text-marble/55 tracking-widest font-heading">
            Syncing Telemetry Channels...
          </p>
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          {/* Workspace Customizer & Presets Toolbar */}
          <div className="glass-card p-4 border border-white/10 bg-neutral-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center bg-black/55 border border-white/10 px-3 py-2 rounded-xl text-xs gap-2">
                <Layout size={14} className="text-ares-gold" />
                <span className="text-marble/55 uppercase font-bold text-[10px] tracking-wider">Workspace:</span>
                <select
                  value={activePresetId}
                  onChange={(e) => {
                    if (e.target.value === "default") {
                      handleResetLayout();
                    } else if (e.target.value) {
                      handleLoadPreset(e.target.value);
                    }
                  }}
                  className="bg-transparent text-white focus:outline-none font-bold uppercase cursor-pointer text-xs"
                >
                  <option value="" className="bg-neutral-900 text-marble/40">Select Preset...</option>
                  <option value="default" className="bg-neutral-900 text-white font-bold">Standard Layout</option>
                  
                  {cloudPresets.filter(p => !p.isShared).length > 0 && (
                    <optgroup label="My Presets" className="bg-neutral-900 text-ares-gold font-bold">
                      {cloudPresets.filter(p => !p.isShared).map(p => (
                        <option key={p.id} value={p.id} className="text-white">
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {cloudPresets.filter(p => p.isShared).length > 0 && (
                    <optgroup label="Team Presets" className="bg-neutral-900 text-ares-cyan font-bold">
                      {cloudPresets.filter(p => p.isShared).map(p => (
                        <option key={p.id} value={p.id} className="text-white">
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {activePresetId && activePresetId !== "default" && (
                <button
                  onClick={(e) => {
                    const activePreset = cloudPresets.find(p => p.id === activePresetId);
                    if (activePreset) handleDeletePresetFromCloud(activePreset, e);
                  }}
                  className="p-2 bg-ares-red/10 hover:bg-ares-red/20 text-ares-red border border-ares-red/20 rounded-xl hover:text-ares-red-light transition-all cursor-pointer"
                  title="Delete current preset from cloud"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isEditMode ? (
                <>
                  {isEditMode && (
                    <div className="flex items-center bg-black/55 border border-white/10 px-3 py-2 rounded-xl text-xs gap-2">
                      <span className="text-[10px] uppercase font-black tracking-widest text-marble/55 font-heading">Add Widget:</span>
                      <select
                        value=""
                        onChange={(e) => {
                          const val = e.target.value as any;
                          if (val) {
                            handleAddWidget(val);
                          }
                        }}
                        className="bg-transparent text-white focus:outline-none font-bold uppercase cursor-pointer text-[10px]"
                      >
                        <option value="" className="bg-neutral-900 text-marble/40">Choose...</option>
                        <option value="visualizer" className="bg-neutral-900 text-white">3D Field Visualizer</option>
                        <option value="diagnostics" className="bg-neutral-900 text-white">Health & Diagnostics</option>
                        <option value="inspector" className="bg-neutral-900 text-white">State Inspector</option>
                        <option value="logs" className="bg-neutral-900 text-white">System Console Logs</option>
                        <option value="charts" className="bg-neutral-900 text-white">Telemetry Chart</option>
                        <option value="tuner" className="bg-neutral-900 text-white">Variables Tuner</option>
                        <option value="group" className="bg-neutral-900 text-white">Widget Tab Group</option>
                      </select>
                    </div>
                  )}

                  <button
                    onClick={handleResetLayout}
                    className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/5 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-1.5 transition-all duration-300 font-bold"
                  >
                    <RotateCcw size={12} /> Reset to Default
                  </button>

                  <button
                    onClick={handleExportLayout}
                    className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/5 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-1.5 transition-all duration-300 font-bold"
                  >
                    <Download size={12} /> Export Layout
                  </button>

                  <button
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = ".json";
                      input.onchange = (e) => handleImportLayout(e as any);
                      input.click();
                    }}
                    className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/5 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-1.5 transition-all duration-300 font-bold"
                  >
                    <Upload size={12} /> Import Layout
                  </button>

                  <button
                    onClick={() => setShowSavePresetModal(true)}
                    className="px-4 py-2 bg-ares-gold text-black hover:bg-ares-gold-soft text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-1.5 transition-all duration-300 font-bold"
                  >
                    <Save size={12} /> Save Preset
                  </button>

                  <button
                    onClick={() => setIsEditMode(false)}
                    className="px-4 py-2 bg-ares-success/15 text-ares-success border border-ares-success/20 hover:bg-ares-success/25 hover:border-ares-success/30 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-1.5 transition-all duration-300 font-bold"
                  >
                    Done
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditMode(true)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/5 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-1.5 transition-all duration-300 font-bold"
                >
                  <Layout size={12} /> Customize Layout
                </button>
              )}
            </div>
          </div>

          {/* Dynamic Grid Layout Playground */}
          <div 
            ref={gridContainerRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={`transition-all duration-300 relative ${
              isMobile 
                ? "flex flex-col gap-6" 
                : "grid grid-cols-12 auto-rows-[110px] gap-6"
            } ${
              isEditMode && !isMobile
                ? "bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:calc(100%/12)_110px] rounded-2xl border border-white/5 p-4 min-h-[700px]"
                : ""
            }`}
          >
            {dashboardLayout
              .filter((item) => item.visible && !dashboardLayout.some(other => other.type === "group" && other.childrenIds?.includes(item.id)))
              .map((item) => {
                const cardStyle = isMobile
                  ? {}
                  : {
                      gridColumnStart: (item.x ?? 0) + 1,
                      gridColumnEnd: (item.x ?? 0) + 1 + (item.w ?? 4),
                      gridRowStart: item.y ?? 1,
                      gridRowEnd: (item.y ?? 1) + (item.h ?? 3),
                    };

                return (
                  <div
                    key={item.id}
                    id={`workspace-card-${item.id}`}
                    style={cardStyle}
                    className={`transition-all duration-300 relative flex flex-col group bg-obsidian-light rounded-2xl border overflow-hidden ${
                      isEditMode 
                        ? "border-ares-gold/40 border-dashed hover:border-ares-gold" 
                        : "border-white/10"
                    } ${isMobile ? "min-h-[350px]" : ""}`}
                  >
                    {/* Hover Fullscreen button when NOT in edit mode */}
                    {!isEditMode && (
                      <button
                        onClick={() => handleToggleFullscreen(item.id)}
                        className="absolute top-4 right-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-1.5 rounded-lg bg-black/60 border border-white/10 text-marble/60 hover:text-white cursor-pointer"
                        title="Maximize panel to fullscreen"
                      >
                        <Maximize2 size={12} />
                      </button>
                    )}

                    {/* Card Header inside Edit Mode */}
                    {isEditMode && (
                      <div className="flex items-center justify-between px-4 py-2 bg-black/50 border-b border-white/5 select-none text-[10px] uppercase font-bold text-marble/60 font-sans z-10 shrink-0">
                        <div className="flex items-center gap-2">
                          <div 
                            onPointerDown={(e) => handlePointerDown(e, item.id, "move")}
                            className="cursor-move text-ares-gold font-bold text-sm select-none" 
                            title="Drag to move panel"
                          >
                            ☰
                          </div>
                          {editingCardId === item.id ? (
                            <input
                              type="text"
                              value={editingTitleText}
                              onChange={(e) => setEditingTitleText(e.target.value)}
                              onBlur={() => handleSaveRename(item.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveRename(item.id);
                                if (e.key === "Escape") setEditingCardId(null);
                              }}
                              autoFocus
                              className="bg-black/60 border border-white/20 text-white rounded px-2 py-0.5 text-[10px] font-bold uppercase focus:outline-none focus:border-ares-gold font-mono"
                            />
                          ) : (
                            <span 
                              onDoubleClick={() => handleStartRename(item.id, item.title)}
                              className="font-heading text-white cursor-pointer hover:text-ares-gold flex items-center gap-1.5 font-bold"
                              title="Double click to rename card"
                            >
                              {item.title}
                              <Edit3 size={8} className="text-marble/40" />
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleFullscreen(item.id)}
                            className="text-marble/45 hover:text-white transition-colors cursor-pointer"
                            title="Fullscreen zoom"
                          >
                            <Maximize2 size={10} />
                          </button>

                          {item.type === "charts" && (
                            <button
                              onClick={() => handleDuplicateChart(item.id)}
                              className="text-marble/45 hover:text-white transition-colors cursor-pointer"
                              title="Duplicate chart"
                            >
                              <Copy size={10} />
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteWidget(item.id)}
                            className="text-ares-red hover:text-ares-red-light transition-colors cursor-pointer"
                            title="Delete panel"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Resize Handle for Edit Mode */}
                    {isEditMode && !isMobile && (
                      <div
                        onPointerDown={(e) => handlePointerDown(e, item.id, "resize")}
                        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end text-marble/35 hover:text-ares-gold transition-colors select-none z-30 font-sans"
                        title="Drag to resize panel"
                      >
                        ◢
                      </div>
                    )}

                    {/* Card Body containing actual component */}
                    <div className="flex-grow overflow-hidden relative">
                      {item.type === "visualizer" && (
                        <div className={`flex flex-col gap-4 h-full ${videoUrl ? "overflow-y-auto" : "overflow-hidden"}`}>
                          <div className="flex-grow h-full w-full min-h-[200px]">
                            <WebGLReplayCanvas />
                          </div>
                          {videoUrl && (
                            <div className="glass-card p-4 border border-white/10 flex flex-col gap-3 relative shrink-0">
                              <button
                                onClick={() => setVideoUrl(null)}
                                className="absolute top-2 right-2 text-marble/40 hover:text-white cursor-pointer transition-colors"
                                title="Close video player"
                              >
                                <X size={14} />
                              </button>
                              <h3 className="text-[10px] font-black uppercase text-white tracking-widest font-heading border-b border-white/5 pb-2 flex items-center gap-1.5">
                                🎥 Synchronized Match Video
                              </h3>
                              <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-white/5 shadow-inner">
                                <video
                                  ref={videoRef}
                                  src={videoUrl}
                                  className="w-full h-full object-contain"
                                  controls={false}
                                  muted
                                  playsInline
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {item.type === "diagnostics" && <HealthDiagnostics />}
                      
                      {item.type === "inspector" && <StateInspector />}
                      
                      {item.type === "logs" && <ConsoleLogsWidget showTitle={true} />}
                      
                      {item.type === "charts" && (
                        <TelemetryCharts 
                          chartId={item.id}
                          selectedKeys={chartConfigs.find(c => c.id === item.id)?.selectedKeys || []}
                          onToggleKey={(key) => {
                            setChartConfigs(chartConfigs.map(c => {
                              if (c.id === item.id) {
                                const isSelected = c.selectedKeys.includes(key);
                                const nextKeys = isSelected
                                  ? c.selectedKeys.filter(k => k !== key)
                                  : [...c.selectedKeys, key];
                                return { ...c, selectedKeys: nextKeys };
                              }
                              return c;
                            }));
                          }}
                        />
                      )}

                      {item.type === "tuner" && (
                        <VariablesTuner
                          isStreaming={isStreaming}
                          onPublishValue={handlePublishValue}
                          savedConstants={tuningConstants}
                          onConstantsChange={(consts) => setTuningConstants(consts)}
                        />
                      )}

                      {item.type === "group" && (
                        <div className="flex flex-col h-full bg-obsidian-light p-4">
                          {/* Tabs list inside group */}
                          <div className="flex flex-wrap items-center gap-1.5 border-b border-white/5 pb-2 mb-2.5 shrink-0">
                            {(item.childrenIds || []).map(childId => {
                              const child = dashboardLayout.find(l => l.id === childId);
                              if (!child) return null;
                              const isActive = item.activeTabId === childId;
                              return (
                                <div 
                                  key={childId}
                                  className={`flex items-center gap-1 px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-lg transition-all border cursor-pointer font-heading ${
                                    isActive
                                      ? "bg-ares-gold/15 border-ares-gold/25 text-ares-gold"
                                      : "bg-transparent border-transparent text-marble/55 hover:text-white"
                                  }`}
                                  onClick={() => {
                                    setDashboardLayout(prev => prev.map(l => 
                                      l.id === item.id ? { ...l, activeTabId: childId } : l
                                    ));
                                  }}
                                >
                                  <span>{child.title}</span>
                                  {isEditMode && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveFromGroup(item.id, childId);
                                      }}
                                      className="text-marble/35 hover:text-ares-red ml-1.5 transition-colors cursor-pointer"
                                      title="Remove from group"
                                    >
                                      <X size={8} />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                            
                            {/* Group editing: Add child dropdown */}
                            {isEditMode && (
                              <select
                                value=""
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val) {
                                    handleAddToGroup(item.id, val);
                                  }
                                }}
                                className="bg-black/60 border border-white/10 rounded px-1.5 py-0.5 text-[8px] text-marble/70 focus:outline-none font-bold cursor-pointer ml-auto font-heading"
                              >
                                <option value="">+ Add to Group</option>
                                {dashboardLayout
                                  .filter(l => l.id !== item.id && l.visible && !dashboardLayout.some(other => other.type === "group" && other.childrenIds?.includes(l.id)))
                                  .map(l => (
                                    <option key={l.id} value={l.id} className="bg-neutral-900 text-white">{l.title}</option>
                                  ))
                                }
                              </select>
                            )}
                          </div>

                          {/* Group tab content viewer */}
                          <div className="flex-grow overflow-hidden relative">
                            {(() => {
                              const activeChild = dashboardLayout.find(l => l.id === item.activeTabId);
                              if (!activeChild) {
                                  return (
                                    <div className="flex items-center justify-center h-full text-marble/30 text-[10px] font-heading uppercase tracking-widest text-center">
                                      No widgets in group. Add one above.
                                    </div>
                                  );
                              }
                              
                              return (
                                <div className="h-full w-full overflow-hidden">
                                  {activeChild.type === "visualizer" && (
                                    <div className={`flex flex-col gap-4 h-full ${videoUrl ? "overflow-y-auto" : "overflow-hidden"}`}>
                                      <div className="flex-grow h-full w-full min-h-[200px]">
                                        <WebGLReplayCanvas />
                                      </div>
                                      {videoUrl && (
                                        <div className="glass-card p-4 border border-white/10 flex flex-col gap-3 relative shrink-0">
                                          <button
                                            onClick={() => setVideoUrl(null)}
                                            className="absolute top-2 right-2 text-marble/40 hover:text-white cursor-pointer transition-colors"
                                          >
                                            <X size={14} />
                                          </button>
                                          <h3 className="text-[10px] font-black uppercase text-white tracking-widest font-heading border-b border-white/5 pb-2">
                                            🎥 Synchronized Match Video
                                          </h3>
                                          <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-white/5 shadow-inner">
                                            <video
                                              ref={videoRef}
                                              src={videoUrl}
                                              className="w-full h-full object-contain"
                                              controls={false}
                                              muted
                                              playsInline
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {activeChild.type === "diagnostics" && <HealthDiagnostics />}
                                  
                                  {activeChild.type === "inspector" && <StateInspector />}
                                  
                                  {activeChild.type === "logs" && <ConsoleLogsWidget showTitle={false} />}
                                  
                                  {activeChild.type === "charts" && (
                                    <TelemetryCharts 
                                      chartId={activeChild.id}
                                      selectedKeys={chartConfigs.find(c => c.id === activeChild.id)?.selectedKeys || []}
                                      onToggleKey={(key) => {
                                        setChartConfigs(chartConfigs.map(c => {
                                          if (c.id === activeChild.id) {
                                            const isSelected = c.selectedKeys.includes(key);
                                            const nextKeys = isSelected
                                              ? c.selectedKeys.filter(k => k !== key)
                                              : [...c.selectedKeys, key];
                                            return { ...c, selectedKeys: nextKeys };
                                          }
                                          return c;
                                        }));
                                      }}
                                    />
                                  )}

                                  {activeChild.type === "tuner" && (
                                    <VariablesTuner
                                      isStreaming={isStreaming}
                                      onPublishValue={handlePublishValue}
                                      savedConstants={tuningConstants}
                                      onConstantsChange={(consts) => setTuningConstants(consts)}
                                    />
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* ─── MASTER SCRUBBING TIMELINE TIMELINE DECK ─── */}
          <TimelineDeck />

          {/* Drag and Drop Drop-Zone overlay */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`fixed inset-0 z-50 flex items-center justify-center bg-black/85 transition-all duration-300 ${
              dragActive ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
          >
            <div className="glass-card border border-ares-gold/30 bg-ares-gold/5 p-10 max-w-md rounded-3xl text-center flex flex-col items-center gap-4 animate-pulse">
              <FolderOpen size={48} className="text-ares-gold" />
              <h3 className="font-extrabold text-white text-lg tracking-tight uppercase font-heading">
                Drop Telemetry Log Here
              </h3>
              <p className="text-marble/65 text-xs font-medium leading-relaxed">
                Release your robot CSV or TXT log file to instantly parse channels and start playback replay!
              </p>
            </div>
          </div>

        </div>
      )}

      {/* Live Stream connection Modal */}
      <LiveStreamModal
        isOpen={showLiveModal}
        onClose={() => setShowLiveModal(false)}
        ipAddress={ipAddress}
        setIpAddress={setIpAddress}
        handleConnectLive={handleConnectLive}
      />

      <SyncRobotLogsModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        ipAddress={ipAddress}
        setIpAddress={setIpAddress}
      />

      {/* Save presets cloud Modal */}
      <SavePresetModal
        isOpen={showSavePresetModal}
        onClose={() => setShowSavePresetModal(false)}
        newPresetName={newPresetName}
        setNewPresetName={setNewPresetName}
        isSharedToggle={isSharedToggle}
        setIsSharedToggle={setIsSharedToggle}
        savingPreset={savingPreset}
        handleSavePreset={handleSavePreset}
      />

      {/* Local Simulator drawer Controls */}
      <LocalSimulatorPanel
        isOpen={showSimDrawer}
        onClose={() => setShowSimDrawer(false)}
        selectedFieldConfigId={selectedFieldConfigId}
        handleFieldConfigChange={handleFieldConfigChange}
        fieldConfigs={fieldConfigs}
        simState={simState}
        setSimState={setSimState}
        handleConnectLive={handleConnectLive}
      />

    </div>
  );
}
