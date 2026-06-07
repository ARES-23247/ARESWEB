"use client";

import React, { useEffect, useState, useRef } from "react";
import { authenticatedFetch } from "@/lib/api";
import { useScopeStore, TelemetryData } from "./store/scopeStore";
import { NT4Client } from "./store/nt4Client";
import { useFocusTrap } from "@/lib/useFocusTrap";
import WebGLReplayCanvas from "./components/WebGLReplayCanvas";
import TelemetryCharts from "./components/TelemetryCharts";
import StateInspector from "./components/StateInspector";
import HealthDiagnostics from "./components/HealthDiagnostics";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, query, orderBy } from "firebase/firestore";
import { 
  Play, 
  Pause, 
  FastForward, 
  FolderOpen, 
  Activity, 
  Database,
  Sparkles,
  RefreshCw,
  Cpu,
  Compass,
  Wifi,
  WifiOff,
  X,
  Eye,
  Sliders,
  Terminal
} from "lucide-react";

export default function ScopeDashboard() {
  const { 
    isPlaying, 
    currentTimeMs, 
    playbackSpeed, 
    telemetryData, 
    comparisonTelemetryData,
    consoleLogs,
    isStreaming,
    streamSource,
    connectionStatus,
    setPlaying, 
    setCurrentTimeMs, 
    setPlaybackSpeed, 
    setTelemetryData,
    setComparisonTelemetryData,
    setConsoleLogs,
    setPlannedPath,
    setStreaming,
    setStreamSource,
    setConnectionStatus,
    addLiveFrame,
    setFieldObstacles
  } = useScopeStore();

  const [selectedRunId, setSelectedRunId] = useState("run_2026_championship_finals");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [ipAddress, setIpAddress] = useState("192.168.43.1");
  const [showLiveModal, setShowLiveModal] = useState(false);
  const liveModalRef = useFocusTrap(showLiveModal, () => setShowLiveModal(false));
  
  // Video Sync States
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Field Obstacle Configuration States
  const [fieldConfigs, setFieldConfigs] = useState<{ id: string; name: string; obstacles: any[] }[]>([]);
  const [selectedFieldConfigId, setSelectedFieldConfigId] = useState<string>("");

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
        } else {
          setFieldObstacles(null);
        }
      } catch (err) {
        console.error("Failed to fetch field configurations:", err);
      }
    };
    fetchFieldConfigs();
  }, [setFieldObstacles]);

  const handleFieldConfigChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const configId = e.target.value;
    setSelectedFieldConfigId(configId);
    if (!configId) {
      setFieldObstacles(null);
      return;
    }
    const config = fieldConfigs.find((c) => c.id === configId);
    if (config) {
      setFieldObstacles(config.obstacles || []);
    } else {
      setFieldObstacles(null);
    }
  };

  // Console Log UI States
  const [logFilter, setLogFilter] = useState("");
  const [logLevelFilter, setLogLevelFilter] = useState<"ALL" | "INFO" | "WARN" | "ERROR">("ALL");
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const activeLogs = consoleLogs
    ? consoleLogs.filter((log) => log.timestamp <= currentTimeMs)
    : [];

  const filteredLogs = activeLogs.filter((log) => {
    const matchesLevel = logLevelFilter === "ALL" || log.level === logLevelFilter;
    const matchesSearch = log.message.toLowerCase().includes(logFilter.toLowerCase()) || 
                          log.level.toLowerCase().includes(logFilter.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  // Auto scroll effect
  useEffect(() => {
    if (autoScrollLogs && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [activeLogs.length, autoScrollLogs]);
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pathInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const comparisonInputRef = useRef<HTMLInputElement | null>(null);
  const consoleInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ntClientRef = useRef<NT4Client | null>(null);

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

  // Securely close any active live connections on unmount
  useEffect(() => {
    return () => {
      if (ntClientRef.current) {
        ntClientRef.current.disconnect();
      }
    };
  }, []);

  const handleConnectLive = () => {
    if (ntClientRef.current) {
      ntClientRef.current.disconnect();
    }

    setStreaming(true);
    setStreamSource("local");
    setTelemetryData(null); // Clear static log logs
    setPlaying(false);

    const client = new NT4Client(
      ipAddress,
      (frame) => {
        addLiveFrame(frame);
      },
      (status) => {
        setConnectionStatus(status);
        if (status === "disconnected") {
          setStreaming(false);
        }
      }
    );

    ntClientRef.current = client;
    client.connect();
    setShowLiveModal(false);
  };

  const handleDisconnectLive = () => {
    if (ntClientRef.current) {
      ntClientRef.current.disconnect();
      ntClientRef.current = null;
    }
    setStreaming(false);
    setStreamSource(null);
    setConnectionStatus("disconnected");
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

  // Format time (ms -> "M:SS.S")
  const formatTime = (ms: number) => {
    const totalSecs = ms / 1000;
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toFixed(1).padStart(4, "0")}`;
  };

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

  return (
    <div className="space-y-8">
      
      {/* Header Deck */}
      <header className="border-b border-white/5 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
            <Cpu size={12} className="animate-pulse" /> Diagnostic Tools
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter font-heading">
            ARES-Scope Replay
          </h1>
          <p className="text-marble/70 text-xs md:text-sm mt-1.5 font-medium max-w-xl">
            High-performance browser-based AdvantageScope clone. Stream live telemetry, analyze motor binding, and review Vertex AI scouting roadmaps.
          </p>
        </div>

        {/* Database & File Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Connection Status Badge */}
          {isStreaming && (
            <div className={`flex items-center gap-2 border px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider ${
              connectionStatus === "connected"
                ? "bg-ares-success/10 text-ares-success border-ares-success/20"
                : connectionStatus === "connecting"
                ? "bg-ares-gold/10 text-ares-gold border-ares-gold/20"
                : "bg-white/5 text-marble/50 border-white/5"
            }`}>
              {connectionStatus === "connected" && (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ares-success opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-ares-success"></span>
                  </span>
                  <span>Connected</span>
                </>
              )}
              {connectionStatus === "connecting" && (
                <>
                  <RefreshCw size={12} className="animate-spin text-ares-gold" />
                  <span>Connecting</span>
                </>
              )}
              {connectionStatus === "disconnected" && (
                <>
                  <WifiOff size={12} className="text-marble/40" />
                  <span>Disconnected</span>
                </>
              )}
            </div>
          )}

          {/* Live Stream Button */}
          {isStreaming ? (
            <button
              onClick={handleDisconnectLive}
              className="px-4 py-2.5 bg-ares-red/15 hover:bg-ares-red/25 text-ares-red-light border border-ares-red/20 hover:border-ares-red/30 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md font-bold focus:ring-2 focus:ring-ares-cyan focus:outline-none"
            >
              <WifiOff size={12} /> Disconnect
            </button>
          ) : (
            <button
              onClick={() => setShowLiveModal(true)}
              className="px-4 py-2.5 bg-ares-gold/10 hover:bg-ares-gold/20 text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md font-bold"
            >
              <Wifi size={12} /> Go Live
            </button>
          )}

          {/* Field Layout Selector */}
          <div className="flex items-center bg-black/50 border border-white/5 px-3 py-2 rounded-xl text-xs gap-2">
            <Sliders size={14} className="text-ares-gold" />
            <select
              value={selectedFieldConfigId}
              onChange={handleFieldConfigChange}
              className="bg-transparent text-white focus:outline-none font-bold uppercase cursor-pointer"
            >
              {fieldConfigs.length === 0 ? (
                <option value="" className="bg-neutral-900 text-white">No Obstacles</option>
              ) : (
                <>
                  <option value="" className="bg-neutral-900 text-white">Clear Obstacles</option>
                  {fieldConfigs.map((c) => (
                    <option key={c.id} value={c.id} className="bg-neutral-900 text-white">
                      {c.name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Active Run Selector */}
          <div className="flex items-center bg-black/50 border border-white/5 px-3 py-2 rounded-xl text-xs gap-2">
            <Database size={14} className="text-ares-gold" />
            <select
              value={selectedRunId}
              onChange={(e) => setSelectedRunId(e.target.value)}
              className="bg-transparent text-white focus:outline-none font-bold uppercase cursor-pointer"
            >
              <option value="run_2026_championship_finals" className="bg-neutral-900 text-white">Championship Finals</option>
              <option value="run_2026_qualifiers_3" className="bg-neutral-900 text-white">Qualifier Run #3</option>
              <option value="run_2026_practice_slippage" className="bg-neutral-900 text-white">Practice Slippage Run</option>
            </select>
          </div>

          {/* Local Log Upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md"
          >
            <FolderOpen size={12} /> Local Log
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInput}
            accept=".csv,.txt"
            className="hidden"
          />

          {/* Comparison Log Upload */}
          <button
            onClick={() => comparisonTelemetryData ? setComparisonTelemetryData(null) : comparisonInputRef.current?.click()}
            className={`px-4 py-2.5 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md focus:ring-2 focus:ring-ares-cyan focus:outline-none ${
              comparisonTelemetryData 
                ? "bg-ares-red/15 text-ares-red-light border border-ares-red/25 hover:bg-ares-red/25" 
                : "bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10"
            }`}
            title={comparisonTelemetryData ? "Clear comparison log" : "Upload comparison CSV log"}
          >
            {comparisonTelemetryData ? (
              <>
                <X size={12} /> Comparison Active
              </>
            ) : (
              <>
                <Activity size={12} /> Compare Log
              </>
            )}
          </button>
          <input
            type="file"
            ref={comparisonInputRef}
            onChange={handleComparisonInput}
            accept=".csv,.txt"
            className="hidden"
          />

          {/* Console Log Upload */}
          <button
            onClick={() => consoleLogs ? setConsoleLogs(null) : consoleInputRef.current?.click()}
            className={`px-4 py-2.5 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md ${
              consoleLogs 
                ? "bg-ares-gold/15 text-ares-gold border border-ares-gold/25 hover:bg-ares-gold/25" 
                : "bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10"
            }`}
            title={consoleLogs ? "Clear console log" : "Upload system console text log"}
          >
            {consoleLogs ? (
              <>
                <X size={12} /> Clear Console
              </>
            ) : (
              <>
                <Sliders size={12} /> System Console
              </>
            )}
          </button>
          <input
            type="file"
            ref={consoleInputRef}
            onChange={handleConsoleInput}
            accept=".txt,.log"
            className="hidden"
          />

          {/* Planned Path Upload */}
          <button
            onClick={() => pathInputRef.current?.click()}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md"
          >
            <Compass size={12} /> Planned Path
          </button>
          <input
            type="file"
            ref={pathInputRef}
            onChange={handlePathInput}
            accept=".path,.json"
            className="hidden"
          />

          {/* Match Video Upload */}
          <button
            onClick={() => videoInputRef.current?.click()}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md"
          >
            <Eye size={12} /> Match Video
          </button>
          <input
            type="file"
            ref={videoInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                const url = URL.createObjectURL(e.target.files[0]);
                setVideoUrl(url);
              }
            }}
            accept="video/*"
            className="hidden"
          />
        </div>
      </header>

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
          
          {/* Main Visualizer split: 3D map left, state tree / health checks right */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* Left Column: Top-down Field view & Match Video */}
            <div className="lg:col-span-1 flex flex-col gap-6 h-full">
              <WebGLReplayCanvas />
              {videoUrl && (
                <div className="glass-card p-6 border border-white/10 flex flex-col gap-4 relative">
                  <button
                    onClick={() => setVideoUrl(null)}
                    className="absolute top-4 right-4 text-marble/40 hover:text-white cursor-pointer transition-colors"
                    title="Close video player"
                  >
                    <X size={16} />
                  </button>
                  <h3 className="text-sm font-black uppercase text-white tracking-widest font-heading border-b border-white/5 pb-3 flex items-center gap-2">
                    🎥 Synchronized Match Video
                  </h3>
                  <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-white/5 shadow-inner">
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      className="w-full h-full object-contain"
                      controls={false}
                      muted
                      playsInline
                    />
                  </div>
                  <div className="text-[9px] font-mono text-marble/35 text-center leading-relaxed">
                    Video playback rate and playhead synchronized to telemetry timeline.
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Dynamic diagnostics / alerts */}
            <div className="lg:col-span-2 h-full">
              <HealthDiagnostics />
            </div>
          </div>

          {/* Canvas Plot View & collapsers split */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col gap-6">
              <TelemetryCharts />
              
              {/* Playhead-Synchronized System Console Logs */}
              <div className="glass-card p-6 border border-white/10 flex flex-col gap-4 relative">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                  <h3 className="text-sm font-heading font-black uppercase text-white tracking-widest flex items-center gap-2">
                    <Terminal size={14} className="text-ares-gold" />
                    System Console Logs
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      placeholder="Filter logs..."
                      value={logFilter}
                      onChange={(e) => setLogFilter(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-[10px] text-white focus:outline-none focus:border-ares-gold font-mono placeholder:text-marble/35 focus:ring-2 focus:ring-ares-cyan"
                      aria-label="Filter logs"
                    />
                    <select
                      value={logLevelFilter}
                      onChange={(e) => setLogLevelFilter(e.target.value as any)}
                      className="bg-black/45 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none focus:border-ares-gold font-bold uppercase cursor-pointer focus:ring-2 focus:ring-ares-cyan"
                    >
                      <option value="ALL" className="bg-neutral-900 text-marble/60">ALL LEVELS</option>
                      <option value="INFO" className="bg-neutral-900 text-white">INFO</option>
                      <option value="WARN" className="bg-neutral-900 text-ares-gold">WARN</option>
                      <option value="ERROR" className="bg-neutral-900 text-ares-red-light">ERROR</option>
                    </select>
                    <label className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-marble/55 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoScrollLogs}
                        onChange={(e) => setAutoScrollLogs(e.target.checked)}
                        className="accent-ares-gold cursor-pointer rounded border-white/10"
                      />
                      Auto-scroll
                    </label>
                  </div>
                </div>

                <div 
                  ref={logContainerRef}
                  className="h-64 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1 bg-black/30 p-4 rounded-xl border border-white/5 scrollbar-thin scrollbar-thumb-white/5"
                >
                  {filteredLogs.length === 0 ? (
                    <div className="text-marble/35 text-center py-16 uppercase tracking-widest text-xs font-bold font-heading">
                      {consoleLogs ? "No matching log entries." : "No console logs loaded. Upload a text log above."}
                    </div>
                  ) : (
                    filteredLogs.map((entry, idx) => {
                      let levelColor = "text-marble/70";
                      let levelBg = "bg-transparent";
                      if (entry.level === "WARN") {
                        levelColor = "text-ares-gold";
                        levelBg = "bg-ares-gold/5 border border-ares-gold/10";
                      } else if (entry.level === "ERROR") {
                        levelColor = "text-ares-red-light";
                        levelBg = "bg-ares-red/5 border border-ares-red/10";
                      }
                      return (
                        <div key={idx} className={`flex items-start gap-2 p-1.5 rounded hover:bg-white/5 transition-colors ${levelBg}`}>
                          <span className="text-marble/35 shrink-0 select-none">[{formatTime(entry.timestamp)}]</span>
                          <span className={`px-1 py-0.5 rounded text-[8px] font-extrabold uppercase shrink-0 tracking-wider ${
                            entry.level === "ERROR" ? "bg-ares-red/20 text-ares-red-light" :
                            entry.level === "WARN" ? "bg-ares-gold/20 text-ares-gold" :
                            "bg-white/10 text-marble/60"
                          }`}>{entry.level}</span>
                          <span className={`break-all ${levelColor}`}>{entry.message}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            <div className="lg:col-span-1 flex flex-col gap-6">
              <StateInspector />
            </div>
          </div>

          {/* ─── MASTER SCRUBBING TIMELINE TIMELINE DECK ─── */}
          {telemetryData && (
            <div className="glass-card p-6 border border-white/10 bg-neutral-950/65 flex flex-col gap-4 sticky bottom-4 z-40 shadow-2xl">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                
                {/* Play controls */}
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => setPlaying(!isPlaying)}
                    className="w-10 h-10 rounded-full bg-ares-gold hover:bg-ares-gold-soft text-black flex items-center justify-center cursor-pointer transition-all duration-300 shadow-md transform hover:scale-105 shrink-0"
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                  </button>

                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-ares-gold tracking-widest leading-none">
                      Timeline playhead
                    </span>
                    <span className="text-xs text-white font-mono font-bold mt-1">
                      {formatTime(currentTimeMs)} / <span className="text-marble/35">{formatTime(telemetryData.maxTimeMs)}</span>
                    </span>
                  </div>
                </div>

                {/* Scrubber slider */}
                <input
                  type="range"
                  min="0"
                  max={telemetryData.maxTimeMs}
                  value={currentTimeMs}
                  onChange={(e) => setCurrentTimeMs(parseInt(e.target.value))}
                  className="flex-grow w-full accent-ares-gold bg-white/5 h-1.5 rounded-lg appearance-none cursor-pointer border border-white/5 outline-none"
                />

                {/* Speed buttons */}
                <div className="flex items-center bg-black/45 border border-white/5 p-1 rounded-xl gap-1 shrink-0">
                  {([0.5, 1.0, 1.5, 2.0] as const).map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`px-3 py-1 rounded-lg text-[9px] font-black tracking-wider uppercase transition-all duration-300 cursor-pointer ${
                        playbackSpeed === speed
                          ? "bg-ares-gold text-black font-extrabold"
                          : "text-marble/45 hover:text-white"
                      }`}
                    >
                      {speed.toFixed(1)}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

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

      {showLiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md transition-all duration-300">
          <div ref={liveModalRef} tabIndex={-1} className="glass-card border border-white/10 bg-neutral-950 p-6 max-w-sm w-full rounded-2xl flex flex-col gap-5 shadow-2xl relative focus:outline-none">
            <button
              onClick={() => setShowLiveModal(false)}
              className="absolute top-4 right-4 text-marble/40 hover:text-white cursor-pointer transition-colors"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-ares-gold/10 border border-ares-gold/20 flex items-center justify-center text-ares-gold">
                <Wifi size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-md tracking-tight uppercase font-heading">
                  Connect Live Stream
                </h3>
                <p className="text-marble/55 text-[10px] font-bold uppercase tracking-wider">
                  NetworkTables v4 WebSocket
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="robotIpInput" className="text-[10px] uppercase font-black tracking-widest text-ares-gold">
                Robot IP Address / Host
              </label>
              <input
                id="robotIpInput"
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="192.168.43.1"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-ares-gold transition-colors focus:ring-2 focus:ring-ares-cyan"
              />
              <p className="text-[10px] text-marble/40 mt-1 leading-normal">
                Default for FTC Wi-Fi Direct: <code className="text-ares-gold">192.168.43.1</code>. Control Hub / ADB: <code className="text-ares-gold">localhost</code> or <code className="text-ares-gold">192.168.43.1</code>.
              </p>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setShowLiveModal(false)}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/5 text-[10px] uppercase font-black tracking-widest rounded-xl transition-all duration-300 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleConnectLive}
                className="flex-1 py-3 bg-ares-gold text-black hover:bg-ares-gold-soft text-[10px] uppercase font-black tracking-widest rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 font-bold"
              >
                <Wifi size={12} className="stroke-[3]" /> Connect
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
