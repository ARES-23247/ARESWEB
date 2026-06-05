"use client";

import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, RefreshCw, Info, HelpCircle, Compass, Download } from "lucide-react";

type Point = { x: number; y: number };

// Cubic Hermite Spline (Catmull-Rom) calculation
function getSplinePoint(pts: Point[], t: number): Point {
  const p0 = pts[0];
  const p1 = pts[1];
  const p2 = pts[2];
  const p3 = pts[3];

  const t2 = t * t;
  const t3 = t2 * t;

  const q0 = -0.5 * t3 + t2 - 0.5 * t;
  const q1 = 1.5 * t3 - 2.5 * t2 + 1.0;
  const q2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
  const q3 = 0.5 * t3 - 0.5 * t2;

  const x = p0.x * q0 + p1.x * q1 + p2.x * q2 + p3.x * q3;
  const y = p0.y * q0 + p1.y * q1 + p2.y * q2 + p3.y * q3;

  return { x, y };
}

// Generate dense path points for rendering
function generatePath(points: Point[]): Point[] {
  if (points.length < 4) return [];
  const path: Point[] = [];
  const pts = [points[0], ...points, points[points.length - 1]];

  for (let i = 1; i < pts.length - 2; i++) {
    for (let t = 0; t <= 1; t += 0.02) {
      path.push(getSplinePoint([pts[i - 1], pts[i], pts[i + 1], pts[i + 2]], t));
    }
  }
  return path;
}

export default function AresPlanner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeWaypoint, setActiveWaypoint] = useState<number | null>(null);

  const waypointsRef = useRef<Point[]>([
    { x: 100, y: 320 },
    { x: 250, y: 120 },
    { x: 500, y: 280 },
    { x: 700, y: 80 }
  ]);

  const robotRef = useRef({ x: 100, y: 320, progress: 0, heading: 0 });
  const isPlayingRef = useRef(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 400;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        width = parent.clientWidth;
        canvas.width = width;
        canvas.height = height;
      }
    };
    window.addEventListener("resize", resize);
    resize();

    let animationFrameId: number;
    let path = generatePath(waypointsRef.current);

    const getMousePos = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
      };
    };

    let draggedIdx: number | null = null;

    const handleStart = (e: any) => {
      const pos = getMousePos(e);
      const clickedIdx = waypointsRef.current.findIndex(
        (p) => Math.hypot(p.x - pos.x, p.y - pos.y) < 24
      );
      if (clickedIdx !== -1) {
        draggedIdx = clickedIdx;
        setActiveWaypoint(clickedIdx);
        setIsPlaying(false);
      }
    };

    const handleMove = (e: any) => {
      if (draggedIdx === null) return;
      const pos = getMousePos(e);
      waypointsRef.current[draggedIdx] = {
        x: Math.max(20, Math.min(width - 20, pos.x)),
        y: Math.max(20, Math.min(height - 20, pos.y))
      };
      path = generatePath(waypointsRef.current);
    };

    const handleEnd = () => {
      draggedIdx = null;
      setActiveWaypoint(null);
    };

    canvas.addEventListener("mousedown", handleStart);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);

    canvas.addEventListener("touchstart", handleStart, { passive: true });
    window.addEventListener("touchmove", handleMove, { passive: true });
    window.addEventListener("touchend", handleEnd);

    function drawFieldBackground() {
      // Draw Grid
      ctx!.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx!.lineWidth = 1;
      const gridSize = 40;
      for (let i = 0; i < width; i += gridSize) {
        ctx!.beginPath();
        ctx!.moveTo(i, 0);
        ctx!.lineTo(i, height);
        ctx!.stroke();
      }
      for (let i = 0; i < height; i += gridSize) {
        ctx!.beginPath();
        ctx!.moveTo(0, i);
        ctx!.lineTo(width, i);
        ctx!.stroke();
      }

      // Draw perimeter borders
      ctx!.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx!.lineWidth = 2;
      ctx!.strokeRect(0, 0, width, height);
    }

    function loop() {
      if (isPlayingRef.current && path.length > 0) {
        const r = robotRef.current;
        r.progress += 0.003; // Smooth speed
        if (r.progress >= 1.0) {
          r.progress = 0;
          setIsPlaying(false);
        } else {
          const idx = Math.floor(r.progress * (path.length - 1));
          const nextIdx = Math.min(idx + 1, path.length - 1);
          const p1 = path[idx];
          const p2 = path[nextIdx];

          r.x = p1.x;
          r.y = p1.y;

          if (idx !== nextIdx) {
            r.heading = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          }
        }
      } else if (!isPlayingRef.current) {
        robotRef.current.progress = 0;
        if (path.length > 0) {
          robotRef.current.x = path[0].x;
          robotRef.current.y = path[0].y;
          const p1 = path[0];
          const p2 = path[1] || p1;
          robotRef.current.heading = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        }
      }

      ctx!.clearRect(0, 0, width, height);
      drawFieldBackground();

      // Draw spline path line
      if (path.length > 0) {
        ctx!.beginPath();
        ctx!.strokeStyle = "rgba(255, 184, 28, 0.5)"; // ARES Gold
        ctx!.lineWidth = 3.5;
        ctx!.setLineDash([6, 6]);
        ctx!.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
          ctx!.lineTo(path[i].x, path[i].y);
        }
        ctx!.stroke();
        ctx!.setLineDash([]);
      }

      // Draw waypoints (control points)
      waypointsRef.current.forEach((p, idx) => {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, 9, 0, Math.PI * 2);
        
        // Highlight active point
        if (draggedIdx === idx) {
          ctx!.fillStyle = "rgba(192, 0, 0, 0.9)"; // ARES Red active
        } else {
          ctx!.fillStyle = idx === 0 || idx === waypointsRef.current.length - 1 
            ? "rgba(192, 0, 0, 0.85)" // Start/End ARES Red
            : "rgba(0, 162, 232, 0.85)"; // Mid points cyan
        }
        
        ctx!.fill();
        ctx!.strokeStyle = "#ffffff";
        ctx!.lineWidth = 2;
        ctx!.stroke();

        // Draw index numbers
        ctx!.fillStyle = "#ffffff";
        ctx!.font = "bold 9px sans-serif";
        ctx!.textAlign = "center";
        ctx!.textBaseline = "middle";
        ctx!.fillText(String(idx + 1), p.x, p.y);
      });

      // Draw robot heading square
      const rbW = 32;
      const rbH = 32;
      const rx = robotRef.current.x;
      const ry = robotRef.current.y;
      const rh = robotRef.current.heading;

      ctx!.save();
      ctx!.translate(rx, ry);
      ctx!.rotate(rh);

      // Chassis outline
      ctx!.fillStyle = "rgba(15, 15, 15, 0.85)";
      ctx!.strokeStyle = "#FFB81C"; // ARES Gold
      ctx!.lineWidth = 2.5;
      ctx!.fillRect(-rbW / 2, -rbH / 2, rbW, rbH);
      ctx!.strokeRect(-rbW / 2, -rbH / 2, rbW, rbH);

      // Direction pointer arrow
      ctx!.strokeStyle = "#C00000"; // ARES Red
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.moveTo(0, 0);
      ctx!.lineTo(18, 0);
      ctx!.stroke();

      ctx!.restore();

      animationFrameId = requestAnimationFrame(loop);
    }

    setTimeout(() => {
      resize();
      loop();
    }, 100);

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousedown", handleStart);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      canvas.removeEventListener("touchstart", handleStart);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleReset = () => {
    waypointsRef.current = [
      { x: 100, y: 320 },
      { x: 250, y: 120 },
      { x: 500, y: 280 },
      { x: 700, y: 80 }
    ];
    setIsPlaying(false);
  };

  const handleExportJSON = () => {
    // Convert canvas coords (0-800) to standard metric coordinates (meters) matching FTC / FRC field dimensions
    const M_TO_IN = 39.3701;
    const waypoints = waypointsRef.current.map((wp) => ({
      anchor: { x: (wp.x / M_TO_IN).toFixed(3), y: ((400 - wp.y) / M_TO_IN).toFixed(3) },
      prevControl: null,
      nextControl: null
    }));

    const output = {
      waypoints: waypoints,
      velocityOverride: null,
      accelerationOverride: null,
      isReversed: false,
      name: "ARES_Spline_Export"
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(output, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "ares_path.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="glass-card hero-card flex flex-col gap-6 p-6 sm:p-8 text-marble border border-white/10 max-w-3xl mx-auto w-full">
      {/* Canvas Area */}
      <div className="w-full flex flex-col items-center gap-4 bg-black/40 p-4 rounded-xl border border-white/5 relative">
        <div className="w-full flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className="font-heading font-black text-ares-gold uppercase tracking-wider text-sm sm:text-base">
              ARES Trajectory Editor
            </span>
            <div className="group relative">
              <Info size={14} className="text-marble/40 hover:text-ares-gold cursor-help" />
              <div className="absolute left-0 bottom-6 hidden group-hover:block bg-obsidian border border-white/10 p-3 rounded shadow-xl text-xs w-64 z-10 leading-relaxed text-marble/90">
                Drag the waypoints (circles 1-4) to shape the trajectory. Press "Follow Spline" to watch the robot navigate. Press "Export Path" to generate a coordinate JSON file compatible with PathPlanner/ARESLib readers!
              </div>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="p-1 text-xs font-bold text-ares-red/80 hover:text-white flex items-center gap-1 transition-all hover:bg-ares-red/10 px-2.5 py-1 rounded"
          >
            <RefreshCw size={12} /> RESET
          </button>
        </div>

        {/* Canvas box */}
        <div className="relative bg-black/60 p-3 rounded-lg border border-white/10 shadow-2xl max-w-full w-full">
          <canvas
            ref={canvasRef}
            className="w-full h-[400px] block cursor-crosshair select-none touch-none"
            role="img"
            aria-label="Interactive ARESPlanner Canvas"
          />
        </div>

        <p className="text-[10px] text-marble/30 uppercase tracking-widest font-mono select-none">
          ARESLib Autonomous Trajectory Planner
        </p>
      </div>

      {/* Control Buttons bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-black/20 p-4 rounded-xl border border-white/5">
        <div className="flex items-center gap-2">
          <Compass size={14} className="text-ares-gold" />
          <span className="text-[10px] uppercase font-bold text-marble/60 tracking-wider">
            Spline Generation Mode
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJSON}
            className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 text-xs font-bold rounded transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Download size={12} /> Export Path
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-5 py-2 text-xs font-bold rounded uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              isPlaying
                ? "bg-white/10 text-white hover:bg-white/20 border border-white/20"
                : "bg-ares-red hover:bg-ares-red-dark text-white shadow-md transform hover:-translate-y-0.5"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause size={12} /> Stop
              </>
            ) : (
              <>
                <Play size={12} /> Follow Spline
              </>
            )}
          </button>
        </div>
      </div>

      {/* Math Breakdown Card */}
      <div className="bg-black/20 border border-white/5 rounded-xl p-5 shadow-lg">
        <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold mb-3 flex items-center gap-2">
          <HelpCircle size={14} /> Spline Geometry (Catmull-Rom)
        </h3>

        <div className="text-xs sm:text-sm font-sans leading-relaxed text-marble/75 space-y-4">
          <p>
            Autonomous pathing relies on cubic curves. By passing waypoints through Catmull-Rom equations, we guarantee velocity and acceleration continuity ($C^2$ smoothness).
          </p>

          <div className="border-l-2 border-ares-gold pl-4 space-y-2">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">Hermite Spline Matrix Formulation</h4>
            <p className="text-marble/70">
              For parameter $t \in [0, 1]$ and waypoints $P_0, P_1, P_2, P_3$:
            </p>
            <div className="font-mono bg-black/40 p-3 rounded text-center text-xs text-white border border-white/5 space-y-1 leading-relaxed">
              <div>q(t) = 0.5 · [ (2·P_1) + (-P_0 + P_2)·t + (2·P_0 - 5·P_1 + 4·P_2 - P_3)·t² + (-P_0 + 3·P_1 - 3·P_2 + P_3)·t³ ]</div>
            </div>
            <p className="text-marble/70 mt-2">
              This guarantees that the curve passes exactly through control points $P_1$ and $P_2$, with tangent vectors matching adjacent spans.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
