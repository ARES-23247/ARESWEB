"use client";

import React, { useRef, useEffect, useState } from "react";
import { useScopeStore } from "../store/scopeStore";
import { Plus, X } from "lucide-react";

export default function TelemetryCharts() {
  const { telemetryData, currentTimeMs, setCurrentTimeMs, selectedKeys, toggleSelectedKey } = useScopeStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);

  // Dynamic color helper
  const getSignalColor = (key: string, index: number) => {
    const predefinedColors: Record<string, string> = {
      "Robot/BatteryVoltage": "#F59E0B",     // Gold
      "Robot/LoopTime": "#06B6D4",           // Cyan
      "Drive/MotorPower_FL": "#EF4444",      // Red
      "Drive/MotorPower_FR": "#A855F7",      // Purple
      "Drive/MotorPower_BL": "#3B82F6",      // Blue
      "Drive/MotorPower_BR": "#10B981",      // Emerald
      "Superstructure/Elevator_Height": "#E11D48", // Rose
      "Drive/MotorCurrent_FL": "#F43F5E"     // Pink
    };
    if (predefinedColors[key]) return predefinedColors[key];
    
    // Golden ratio angle spacing to generate distinct HSL colors
    const hue = (index * 137.5) % 360;
    return `hsl(${hue}, 85%, 60%)`;
  };

  // Get available keys in the channels
  const allAvailableKeys = telemetryData ? Object.keys(telemetryData.channels) : [];
  const unselectedKeys = allAvailableKeys.filter((k) => !selectedKeys.includes(k));

  // Handle graph click/scrub
  const handleGraphInteraction = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !telemetryData) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    // Grid bounds calculation
    const paddingLeft = 50;
    const paddingRight = 20;
    const gridWidth = rect.width - paddingLeft - paddingRight;

    if (x >= paddingLeft && x <= rect.width - paddingRight) {
      const clickRatio = (x - paddingLeft) / gridWidth;
      const clickedTimeMs = Math.round(clickRatio * telemetryData.maxTimeMs);
      setCurrentTimeMs(clickedTimeMs);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !telemetryData) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const paddingLeft = 50;
    const paddingRight = 20;
    const gridWidth = rect.width - paddingLeft - paddingRight;

    if (x >= paddingLeft && x <= rect.width - paddingRight) {
      const ratio = (x - paddingLeft) / gridWidth;
      setHoveredTime(Math.round(ratio * telemetryData.maxTimeMs));
    } else {
      setHoveredTime(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredTime(null);
  };

  const handleCanvasKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!telemetryData || !telemetryData.maxTimeMs) return;

    let step = 100;
    if (e.shiftKey) step = 1000;
    if (e.altKey) step = 10;

    if (e.key === "ArrowLeft") {
      const newTime = Math.max(0, currentTimeMs - step);
      setCurrentTimeMs(newTime);
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      const newTime = Math.min(telemetryData.maxTimeMs, currentTimeMs + step);
      setCurrentTimeMs(newTime);
      e.preventDefault();
    } else if (e.key === "Home") {
      setCurrentTimeMs(0);
      e.preventDefault();
    } else if (e.key === "End") {
      setCurrentTimeMs(telemetryData.maxTimeMs);
      e.preventDefault();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !telemetryData) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI screens
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear background
    ctx.fillStyle = "#0A0A0A";
    ctx.fillRect(0, 0, width, height);

    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;

    const gridWidth = width - paddingLeft - paddingRight;
    const gridHeight = height - paddingTop - paddingBottom;

    // Draw Grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    
    // Vertical grid lines (Time scales)
    const timeIntervals = 5;
    for (let k = 0; k <= timeIntervals; k++) {
      const ratio = k / timeIntervals;
      const x = paddingLeft + ratio * gridWidth;
      ctx.beginPath();
      ctx.moveTo(x, paddingTop);
      ctx.lineTo(x, height - paddingBottom);
      ctx.stroke();

      // Draw time labels (e.g. "0.0s")
      const timeSec = ((ratio * telemetryData.maxTimeMs) / 1000).toFixed(1);
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${timeSec}s`, x, height - 10);
    }

    // Horizontal grid lines (value metrics)
    const valueIntervals = 4;
    for (let j = 0; j <= valueIntervals; j++) {
      const y = paddingTop + (j / valueIntervals) * gridHeight;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(width - paddingRight, y);
      ctx.stroke();
    }

    // Plot selected signals
    selectedKeys.forEach((sigKey, idx) => {
      const dataPoints = telemetryData.channels[sigKey];
      if (!dataPoints || dataPoints.length < 2) return;

      const color = getSignalColor(sigKey, idx);

      // Compute min/max dynamically
      let minVal = Math.min(...dataPoints);
      let maxVal = Math.max(...dataPoints);
      const range = maxVal - minVal;
      const padding = range === 0 ? 1.0 : range * 0.1;
      minVal -= padding;
      maxVal += padding;

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.lineJoin = "round";

      for (let i = 0; i < dataPoints.length; i++) {
        const tRatio = i / (dataPoints.length - 1);
        const x = paddingLeft + tRatio * gridWidth;
        
        const val = dataPoints[i];
        const valRatio = (val - minVal) / (maxVal - minVal);
        const y = height - paddingBottom - Math.max(0, Math.min(1, valRatio)) * gridHeight;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    });

    // Draw active scrubbing playhead (Green indicator)
    const playheadRatio = telemetryData.maxTimeMs > 0 ? currentTimeMs / telemetryData.maxTimeMs : 0;
    const playheadX = paddingLeft + playheadRatio * gridWidth;

    ctx.strokeStyle = "#10B981"; // neon green
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(playheadX, paddingTop);
    ctx.lineTo(playheadX, height - paddingBottom);
    ctx.stroke();

    // Glowing head dot
    ctx.fillStyle = "#10B981";
    ctx.beginPath();
    ctx.arc(playheadX, paddingTop, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw hover cursor (dashed white indicator)
    if (hoveredTime !== null && telemetryData.maxTimeMs > 0) {
      const hoverRatio = hoveredTime / telemetryData.maxTimeMs;
      const hoverX = paddingLeft + hoverRatio * gridWidth;

      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hoverX, paddingTop);
      ctx.lineTo(hoverX, height - paddingBottom);
      ctx.stroke();
      ctx.setLineDash([]); // clear dash settings
    }
  }, [telemetryData, currentTimeMs, selectedKeys, hoveredTime]);

  if (!telemetryData) {
    return (
      <div className="glass-card border border-white/5 bg-black/45 h-[220px] rounded-2xl flex items-center justify-center">
        <p className="text-marble/45 text-xs font-semibold uppercase tracking-wider">No Telemetry Stream Loaded</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 border border-white/10 flex flex-col gap-4">
      {/* Chart Headers */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-3">
        <h3 className="text-sm font-black uppercase text-white tracking-widest font-heading">
          📈 High-Frequency Signal Viewer
        </h3>
        
        {/* Dynamic Signal Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {selectedKeys.map((sigKey, idx) => (
            <button
              key={sigKey}
              onClick={() => toggleSelectedKey(sigKey)}
              className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 text-[9px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-all duration-300 cursor-pointer"
              style={{
                borderLeft: `3px solid ${getSignalColor(sigKey, idx)}`
              }}
              title="Click to remove from plot"
            >
              <span>{sigKey.includes("/") ? sigKey.split("/").pop() : sigKey}</span>
              <X size={8} className="text-marble/40 hover:text-white" />
            </button>
          ))}

          {/* Add Channel Dropdown */}
          {unselectedKeys.length > 0 && (
            <div className="relative flex items-center bg-black/50 border border-white/5 px-2.5 py-1 rounded-lg text-[9px] gap-1 transition-all">
              <Plus size={10} className="text-ares-gold" />
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    toggleSelectedKey(e.target.value);
                  }
                }}
                className="bg-transparent text-marble/60 hover:text-white focus:outline-none font-bold uppercase cursor-pointer"
              >
                <option value="" className="bg-neutral-900 text-marble/40">Add Signal...</option>
                {unselectedKeys.map((k) => (
                  <option key={k} value={k} className="bg-neutral-900 text-white">
                    {k}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Canvas Graph */}
      <div className="relative w-full h-[180px] bg-black/60 rounded-xl overflow-hidden shadow-inner border border-white/5">
        <canvas
          ref={canvasRef}
          onMouseDown={handleGraphInteraction}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onKeyDown={handleCanvasKeyDown}
          tabIndex={0}
          role="img"
          aria-label="Interactive telemetry timeline graph. Use Left/Right Arrow keys to scrub through time, and Home/End to jump to start/end."
          className="absolute inset-0 w-full h-full cursor-col-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold"
          style={{ display: "block" }}
        />
      </div>

      <div className="flex justify-between items-center text-[9px] font-mono text-marble/35">
        <span>Click / Drag anywhere on chart coordinates to scrub telemetry timeline</span>
        {hoveredTime !== null && (
          <span className="text-ares-gold font-bold">
            Hover Playhead: <strong>{((hoveredTime) / 1000).toFixed(2)}s</strong>
          </span>
        )}
      </div>
    </div>
  );
}
