"use client";

import React, { useRef, useEffect } from "react";
import { useScopeStore } from "../store/scopeStore";
import { Move, Compass } from "lucide-react";

export default function WebGLReplayCanvas() {
  const { telemetryData, currentTimeMs, getCurrentFrame } = useScopeStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const currentFrame = getCurrentFrame();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set high DPI sizing
    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(canvas.parentElement?.clientWidth || 360, 420);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const width = size;
    const height = size;

    // Field is 144x144 inches (12ft x 12ft)
    const fieldSizeInches = 144.0;
    const padding = 15;
    const mapSize = width - padding * 2;
    
    // Scale coordinate transformer (Inches -> Pixels)
    const scale = mapSize / fieldSizeInches;

    const toPxX = (inchX: number) => padding + inchX * scale;
    // Invert Y axis so (0,0) starts at bottom-left corner of the field
    const toPxY = (inchY: number) => height - padding - inchY * scale;

    // Clear background
    ctx.fillStyle = "#0D0D0D";
    ctx.fillRect(0, 0, width, height);

    // ─── DRAW FIELD TILES (6x6 Grid, each tile is 24x24 inches) ───
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
      const offset = i * 24;
      // Vertical gridline
      ctx.beginPath();
      ctx.moveTo(toPxX(offset), toPxY(0));
      ctx.lineTo(toPxX(offset), toPxY(144));
      ctx.stroke();

      // Horizontal gridline
      ctx.beginPath();
      ctx.moveTo(toPxX(0), toPxY(offset));
      ctx.lineTo(toPxX(144), toPxY(offset));
      ctx.stroke();
    }

    // Draw field outer perimeter wall
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.rect(toPxX(0), toPxY(144), mapSize, mapSize);
    ctx.stroke();

    // ─── DRAW GAME CONTEXT ELEMENTS ───
    // Red Basket Corner (Top-Left area, near 0, 144)
    ctx.fillStyle = "rgba(239, 68, 68, 0.1)";
    ctx.beginPath();
    ctx.arc(toPxX(0), toPxY(144), 20 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Blue Basket Corner (Bottom-Right area, near 144, 0)
    ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
    ctx.beginPath();
    ctx.arc(toPxX(144), toPxY(0), 20 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Red Substation (Bottom-Left zone)
    ctx.fillStyle = "rgba(239, 68, 68, 0.08)";
    ctx.fillRect(toPxX(0), toPxY(24), 24 * scale, 24 * scale);
    ctx.strokeStyle = "rgba(239, 68, 68, 0.2)";
    ctx.strokeRect(toPxX(0), toPxY(24), 24 * scale, 24 * scale);

    // Blue Substation (Top-Right zone)
    ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
    ctx.fillRect(toPxX(120), toPxY(144), 24 * scale, 24 * scale);
    ctx.strokeStyle = "rgba(59, 130, 246, 0.2)";
    ctx.strokeRect(toPxX(120), toPxY(144), 24 * scale, 24 * scale);

    // ─── DRAW HISTORICAL PATH TRAIL (GLOWING ODOMETRY LINES) ───
    if (telemetryData && telemetryData.timestamps.length > 0) {
      // Find current play frame index
      const times = telemetryData.timestamps;
      let currentIndex = 0;
      for (let i = 0; i < times.length; i++) {
        if (times[i] <= currentTimeMs) {
          currentIndex = i;
        } else {
          break;
        }
      }

      if (currentIndex > 0) {
        ctx.strokeStyle = "rgba(245, 158, 11, 0.6)"; // glowing gold
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i <= currentIndex; i++) {
          const pt = telemetryData.coords[i];
          if (!pt) continue;
          const pxX = toPxX(pt.x);
          const pxY = toPxY(pt.y);
          if (i === 0) {
            ctx.moveTo(pxX, pxY);
          } else {
            ctx.lineTo(pxX, pxY);
          }
        }
        ctx.stroke();
      }
    }

    // ─── DRAW ROBOT POSE (Perfect 18x18" square yellow outline + direction indicator) ───
    if (currentFrame) {
      const rx = currentFrame.x;
      const ry = currentFrame.y;
      const rHeading = currentFrame.heading;

      const pxX = toPxX(rx);
      const pxY = toPxY(ry);

      // Robot dimensions in pixels (FTC legal limit: 18x18 inches)
      const robotSizePx = 18.0 * scale;

      ctx.save();
      ctx.translate(pxX, pxY);
      ctx.rotate(-rHeading); // Canvas coordinates are clockwise, telemetry headings are counter-clockwise radians

      // Fill robot chassis body
      ctx.fillStyle = "rgba(245, 158, 11, 0.25)"; // translucent ARES Gold
      ctx.beginPath();
      ctx.rect(-robotSizePx / 2, -robotSizePx / 2, robotSizePx, robotSizePx);
      ctx.fill();

      // Border robot boundary
      ctx.strokeStyle = "#F59E0B"; // solid ARES Gold
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw Mecanum wheel representations
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      const wheelW = 4 * scale;
      const wheelH = 8 * scale;
      
      // LF Wheel
      ctx.fillRect(-robotSizePx/2, -robotSizePx/2 - wheelW, wheelH, wheelW);
      // RF Wheel
      ctx.fillRect(robotSizePx/2 - wheelH, -robotSizePx/2 - wheelW, wheelH, wheelW);
      // LR Wheel
      ctx.fillRect(-robotSizePx/2, robotSizePx/2, wheelH, wheelW);
      // RR Wheel
      ctx.fillRect(robotSizePx/2 - wheelH, robotSizePx/2, wheelH, wheelW);

      // Draw Front Heading Arrow
      ctx.strokeStyle = "#EF4444"; // red front indicator
      ctx.fillStyle = "#EF4444";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      // Arrow shaft
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -robotSizePx * 0.7);
      ctx.stroke();
      
      // Arrow head
      ctx.beginPath();
      ctx.moveTo(0, -robotSizePx * 0.7);
      ctx.lineTo(-4 * scale, -robotSizePx * 0.5);
      ctx.lineTo(4 * scale, -robotSizePx * 0.5);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // Robot center pin point
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(pxX, pxY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [telemetryData, currentTimeMs, currentFrame]);

  return (
    <div className="glass-card p-6 border border-white/10 flex flex-col items-center gap-5 justify-between h-full">
      {/* HUD metrics */}
      <div className="w-full border-b border-white/5 pb-3">
        <h3 className="text-sm font-black uppercase text-white tracking-widest font-heading mb-3">
          🗺️ Odometry Field View
        </h3>
        
        {/* Dynamic Coordinate Panels */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-black/45 border border-white/5 p-2 rounded-xl text-center">
            <span className="text-[8px] uppercase font-bold text-marble/40 tracking-wider flex items-center justify-center gap-1">
              <Move size={8} /> Coord X
            </span>
            <p className="text-sm font-black font-heading text-white mt-0.5">
              {currentFrame ? `${currentFrame.x.toFixed(1)}"` : `0.0"`}
            </p>
          </div>
          <div className="bg-black/45 border border-white/5 p-2 rounded-xl text-center">
            <span className="text-[8px] uppercase font-bold text-marble/40 tracking-wider flex items-center justify-center gap-1">
              <Move size={8} /> Coord Y
            </span>
            <p className="text-sm font-black font-heading text-white mt-0.5">
              {currentFrame ? `${currentFrame.y.toFixed(1)}"` : `0.0"`}
            </p>
          </div>
          <div className="bg-black/45 border border-white/5 p-2 rounded-xl text-center">
            <span className="text-[8px] uppercase font-bold text-marble/40 tracking-wider flex items-center justify-center gap-1">
              <Compass size={8} /> Heading
            </span>
            <p className="text-sm font-black font-heading text-ares-gold mt-0.5">
              {currentFrame ? `${Math.round((currentFrame.heading * 180) / Math.PI)}°` : `0°`}
            </p>
          </div>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div className="relative aspect-square w-full max-w-[360px] bg-black/85 rounded-2xl border border-white/5 overflow-hidden flex items-center justify-center shadow-inner">
        <canvas ref={canvasRef} style={{ display: "block" }} />
      </div>

      <div className="text-[9px] font-mono text-marble/35 text-center leading-relaxed">
        Autonomous Start starting at X=12", Y=12". <br />
        Field scale: 12ft x 12ft standard game arena.
      </div>
    </div>
  );
}
