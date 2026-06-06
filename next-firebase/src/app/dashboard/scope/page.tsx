"use client";

import React, { useEffect, useState, useRef } from "react";
import { useScopeStore, TelemetryData } from "./store/scopeStore";
import { NT4Client } from "./store/nt4Client";
import WebGLReplayCanvas from "./components/WebGLReplayCanvas";
import TelemetryCharts from "./components/TelemetryCharts";
import StateInspector from "./components/StateInspector";
import HealthDiagnostics from "./components/HealthDiagnostics";
import OnshapeSyncCard from "./components/OnshapeSyncCard";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
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
  Eye
} from "lucide-react";

export default function ScopeDashboard() {
  const { 
    isPlaying, 
    currentTimeMs, 
    playbackSpeed, 
    telemetryData, 
    isStreaming,
    streamSource,
    connectionStatus,
    setPlaying, 
    setCurrentTimeMs, 
    setPlaybackSpeed, 
    setTelemetryData,
    setPlannedPath,
    setStreaming,
    setStreamSource,
    setConnectionStatus,
    addLiveFrame
  } = useScopeStore();

  const [selectedRunId, setSelectedRunId] = useState("run_2026_championship_finals");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [ipAddress, setIpAddress] = useState("192.168.43.1");
  const [showLiveModal, setShowLiveModal] = useState(false);
  
  // Video Sync States
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pathInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
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
      const res = await fetch(`/api/analytics/telemetry-log?runId=${runId}`);
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
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : connectionStatus === "connecting"
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "bg-white/5 text-marble/50 border-white/5"
            }`}>
              {connectionStatus === "connected" && (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Connected</span>
                </>
              )}
              {connectionStatus === "connecting" && (
                <>
                  <RefreshCw size={12} className="animate-spin text-amber-400" />
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
              className="px-4 py-2.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20 hover:border-red-500/30 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md font-bold"
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
            <div className="lg:col-span-2">
              <TelemetryCharts />
            </div>
            <div className="lg:col-span-1 flex flex-col gap-6">
              <OnshapeSyncCard />
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
          <div className="glass-card border border-white/10 bg-neutral-950 p-6 max-w-sm w-full rounded-2xl flex flex-col gap-5 shadow-2xl relative">
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
              <label className="text-[10px] uppercase font-black tracking-widest text-ares-gold">
                Robot IP Address / Host
              </label>
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="192.168.43.1"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-ares-gold transition-colors"
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
