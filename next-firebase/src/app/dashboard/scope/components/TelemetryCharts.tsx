"use client";

import React, { useRef, useEffect, useState } from "react";
import { useScopeStore } from "../store/scopeStore";

export default function TelemetryCharts() {
  const { telemetryData, currentTimeMs, setCurrentTimeMs, selectedKeys, toggleSelectedKey } = useScopeStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);

  const availableSignals = [
    { key: "battery", label: "Battery Voltage (V)", color: "#F59E0B" },
    { key: "loopTime", label: "Loop Cycle Time (ms)", color: "#06B6D4" },
    { key: "slideCurrent", label: "Linear Slide Current (A)", color: "#EF4444" },
    { key: "intakeCurrent", label: "Intake Current (A)", color: "#A855F7" }
  ];

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !telemetryData) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI retina screens
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
    selectedKeys.forEach((sigKey) => {
      const signalConfig = availableSignals.find((s) => s.key === sigKey);
      if (!signalConfig) return;

      let dataPoints: number[] = [];
      let minVal = 0;
      let maxVal = 20;

      if (sigKey === "battery") {
        dataPoints = telemetryData.battery;
        minVal = 9.5;
        maxVal = 13.5;
      } else if (sigKey === "loopTime") {
        dataPoints = telemetryData.loopTime;
        minVal = 0;
        maxVal = 50;
      } else if (sigKey === "slideCurrent") {
        dataPoints = telemetryData.slides.current;
        minVal = 0;
        maxVal = 30;
      } else if (sigKey === "intakeCurrent") {
        dataPoints = telemetryData.intake.current;
        minVal = 0;
        maxVal = 10;
      }

      if (dataPoints.length < 2) return;

      ctx.beginPath();
      ctx.strokeStyle = signalConfig.color;
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
    const playheadRatio = currentTimeMs / telemetryData.maxTimeMs;
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
    if (hoveredTime !== null) {
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
        
        {/* Signal Selectors */}
        <div className="flex flex-wrap gap-2">
          {availableSignals.map((sig) => {
            const isSelected = selectedKeys.includes(sig.key);
            return (
              <button
                key={sig.key}
                onClick={() => toggleSelectedKey(sig.key)}
                className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  isSelected
                    ? "text-white bg-white/10 border-white/20"
                    : "text-marble/40 border-white/5 hover:border-white/10 hover:text-marble/65"
                }`}
                style={{
                  borderLeft: isSelected ? `3px solid ${sig.color}` : undefined
                }}
              >
                {sig.label.split(" ")[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Canvas Graph */}
      <div className="relative w-full h-[180px] bg-black/60 rounded-xl overflow-hidden shadow-inner border border-white/5">
        <canvas
          ref={canvasRef}
          onMouseDown={handleGraphInteraction}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="absolute inset-0 w-full h-full cursor-col-resize"
          style={{ display: "block" }}
        />
      </div>

      <div className="flex justify-between items-center text-[9px] font-mono text-marble/35">
        <span>Click / Drag anywhere on chart coordinates to scrub telemetry timeline</span>
        {hoveredTime !== null && (
          <span className="text-ares-gold">
            Hover Playhead: <strong>{((hoveredTime) / 1000).toFixed(2)}s</strong>
          </span>
        )}
      </div>
    </div>
  );
}
