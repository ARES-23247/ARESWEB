"use client";

import React, { useEffect, useState, useRef } from "react";
import { useScopeStore, TelemetryData } from "./store/scopeStore";
import WebGLReplayCanvas from "./components/WebGLReplayCanvas";
import TelemetryCharts from "./components/TelemetryCharts";
import StateInspector from "./components/StateInspector";
import HealthDiagnostics from "./components/HealthDiagnostics";
import OnshapeSyncCard from "./components/OnshapeSyncCard";
import { 
  Play, 
  Pause, 
  FastForward, 
  FolderOpen, 
  Activity, 
  Database,
  Sparkles,
  RefreshCw,
  Cpu
} from "lucide-react";

export default function ScopeDashboard() {
  const { 
    isPlaying, 
    currentTimeMs, 
    playbackSpeed, 
    telemetryData, 
    setPlaying, 
    setCurrentTimeMs, 
    setPlaybackSpeed, 
    setTelemetryData 
  } = useScopeStore();

  const [selectedRunId, setSelectedRunId] = useState("run_2026_championship_finals");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // High-performance 60 FPS animation/playback loop
  useEffect(() => {
    if (!isPlaying || !telemetryData) return;

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
  }, [isPlaying, currentTimeMs, playbackSpeed, telemetryData]);

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
    fetchTelemetryRun(selectedRunId);
  }, [selectedRunId]);

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

  // Local log parsing engine (Zero UI block)
  const parseLocalLogFile = (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Empty file data.");

        // Simple CSV parser
        const lines = text.split("\n").filter((l) => l.trim() !== "");
        if (lines.length < 2) throw new Error("Invalid CSV format.");

        const headers = lines[0].split(",");
        const timestamps: number[] = [];
        const coords: { x: number; y: number; heading: number }[] = [];
        const battery: number[] = [];
        const loopTime: number[] = [];
        const motors = { lf: [] as number[], rf: [] as number[], lr: [] as number[], rr: [] as number[] };
        const slides = { height: [] as number[], current: [] as number[] };
        const intake = { current: [] as number[] };

        // Process line rows
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",");
          if (cols.length < headers.length) continue;

          const t = parseFloat(cols[0]) || (i - 1) * 50;
          timestamps.push(t);
          coords.push({
            x: parseFloat(cols[1]) || 12.0,
            y: parseFloat(cols[2]) || 12.0,
            heading: parseFloat(cols[3]) || 0.0
          });
          battery.push(parseFloat(cols[4]) || 12.6);
          loopTime.push(parseFloat(cols[5]) || 9.5);
          motors.lf.push(parseFloat(cols[6]) || 1.2);
          motors.rf.push(parseFloat(cols[7]) || 1.2);
          motors.lr.push(parseFloat(cols[8]) || 1.2);
          motors.rr.push(parseFloat(cols[9]) || 1.2);
          slides.height.push(parseFloat(cols[10]) || 0);
          slides.current.push(parseFloat(cols[11]) || 0.4);
          intake.current.push(parseFloat(cols[12]) || 0.2);
        }

        const customTelemetry: TelemetryData = {
          runId: file.name.substring(0, 15),
          opModeName: "ARESImportedLocalLog",
          timestamps: timestamps,
          coords: coords,
          battery: battery,
          loopTime: loopTime,
          motors: motors,
          slides: slides,
          intake: intake,
          maxTimeMs: timestamps[timestamps.length - 1]
        };

        setTelemetryData(customTelemetry);
        console.log(`[Local Parser] Parsed and loaded custom file: ${file.name}`);
      } catch (err: any) {
        alert("Failed to parse log file: " + err.message);
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
            {/* Left Column: Top-down Field view */}
            <div className="lg:col-span-1 h-full">
              <WebGLReplayCanvas />
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

    </div>
  );
}
