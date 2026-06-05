"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { 
  Play, Pause, RefreshCw, Info, HelpCircle, Compass, 
  Download, Maximize2, Minimize2, Plus, Trash2, Save, 
  FolderOpen, Settings, Wifi, Copy, Check, ShieldCheck 
} from "lucide-react";

// Waypoint using cubic Bezier formatting
export type Waypoint = {
  anchor: { x: number; y: number };       // in inches (0 to 144)
  prevControl: { x: number; y: number } | null;  // in inches (0 to 144)
  nextControl: { x: number; y: number } | null;  // in inches (0 to 144)
};

// Event Marker / Action trigger along path
export type EventMarker = {
  id: string;
  name: string;
  progress: number; // 0.0 to 1.0
  actions: string[];
};

interface AresPlannerProps {
  initialPathData?: {
    name: string;
    season: string;
    waypoints: Waypoint[];
    markers: EventMarker[];
  };
  cloudPaths?: Array<{
    id: string;
    name: string;
    season: string;
    waypoints: Waypoint[];
    markers: EventMarker[];
    updatedAt: any;
  }>;
  onSaveToCloud?: (name: string, season: string, waypoints: Waypoint[], markers: EventMarker[]) => Promise<void>;
  onLoadPath?: (pathId: string) => void;
  isSavingCloud?: boolean;
}

// Cubic Bezier evaluation
// B(t) = (1-t)^3*P0 + 3*(1-t)^2*t*P1 + 3*(1-t)*t^2*P2 + t^3*P3
function getBezierPoint(p0: {x: number, y: number}, p1: {x: number, y: number}, p2: {x: number, y: number}, p3: {x: number, y: number}, t: number) {
  const t1 = 1 - t;
  const t1Sq = t1 * t1;
  const t1Cb = t1Sq * t1;
  const tSq = t * t;
  const tCb = tSq * t;

  return {
    x: t1Cb * p0.x + 3 * t1Sq * t * p1.x + 3 * t1 * tSq * p2.x + tCb * p3.x,
    y: t1Cb * p0.y + 3 * t1Sq * t * p1.y + 3 * t1 * tSq * p2.y + tCb * p3.y
  };
}

// Generate dense points along the Bezier path
function generateBezierPath(waypoints: Waypoint[]): {x: number, y: number}[] {
  if (waypoints.length < 2) return [];
  const points: {x: number, y: number}[] = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const w0 = waypoints[i];
    const w1 = waypoints[i + 1];

    const p0 = w0.anchor;
    const p1 = w0.nextControl || w0.anchor;
    const p2 = w1.prevControl || w1.anchor;
    const p3 = w1.anchor;

    // Subdivide each segment into 40 segments for smooth rendering
    for (let step = 0; step <= 40; step++) {
      const t = step / 40;
      // Avoid duplicate points at segment boundaries
      if (step === 0 && i > 0) continue;
      points.push(getBezierPoint(p0, p1, p2, p3, t));
    }
  }

  return points;
}

export default function AresPlanner({
  initialPathData,
  cloudPaths = [],
  onSaveToCloud,
  onLoadPath,
  isSavingCloud = false
}: AresPlannerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State variables
  const [pathName, setPathName] = useState("ARES_Auto_Path");
  const [season, setSeason] = useState("decode");
  const [originMode, setOriginMode] = useState<"center" | "corner">("corner");
  const [unitMode, setUnitMode] = useState<"inches" | "meters">("inches");
  const [isZenMode, setIsZenMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Selected elements for config panels
  const [selectedWaypointIdx, setSelectedWaypointIdx] = useState<number | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [isAddingMarker, setIsAddingMarker] = useState(false);
  
  // Custom uploaded background
  const [customBgImage, setCustomBgImage] = useState<HTMLImageElement | null>(null);
  const [customBgName, setCustomBgName] = useState<string>("");

  // Pre-loaded DECODE background images
  const [decodeDarkImage, setDecodeDarkImage] = useState<HTMLImageElement | null>(null);
  const [decodeLightImage, setDecodeLightImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const darkImg = new Image();
      darkImg.onload = () => setDecodeDarkImage(darkImg);
      darkImg.src = "/fields/decode.webp";

      const lightImg = new Image();
      lightImg.onload = () => setDecodeLightImage(lightImg);
      lightImg.src = "/fields/decode-light.webp";
    }
  }, []);

  // Robot Upload configs
  const [robotIp, setRobotIp] = useState("192.168.43.1");
  const [syncStatus, setSyncStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [syncLog, setSyncLog] = useState("");
  const [copiedCmd, setCopiedCmd] = useState(false);

  // Core data arrays
  const [waypoints, setWaypoints] = useState<Waypoint[]>([
    { anchor: { x: 24, y: 120 }, prevControl: null, nextControl: { x: 48, y: 100 } },
    { anchor: { x: 72, y: 72 }, prevControl: { x: 60, y: 84 }, nextControl: { x: 84, y: 60 } },
    { anchor: { x: 120, y: 24 }, prevControl: { x: 100, y: 36 }, nextControl: null }
  ]);

  const [markers, setMarkers] = useState<EventMarker[]>([
    { id: "1", name: "Intake Down", progress: 0.15, actions: ["LowerIntake", "StartRoller"] },
    { id: "2", name: "Outtake Score", progress: 0.85, actions: ["RaiseSlide", "OpenClaw"] }
  ]);

  // Handle loading initial data
  useEffect(() => {
    if (initialPathData) {
      if (initialPathData.name) setPathName(initialPathData.name);
      if (initialPathData.season) setSeason(initialPathData.season);
      if (initialPathData.waypoints) setWaypoints(initialPathData.waypoints);
      if (initialPathData.markers) setMarkers(initialPathData.markers);
    }
  }, [initialPathData]);

  // Spline values reference for rendering loops
  const waypointsRef = useRef<Waypoint[]>(waypoints);
  const markersRef = useRef<EventMarker[]>(markers);
  const pathRef = useRef<{x: number, y: number}[]>([]);
  const robotRef = useRef({ progress: 0, x: 24, y: 120, heading: 0 });
  const isPlayingRef = useRef(isPlaying);
  const dragInfo = useRef<{ type: "anchor" | "prev" | "next"; index: number } | null>(null);

  // Keep references updated
  useEffect(() => { waypointsRef.current = waypoints; }, [waypoints]);
  useEffect(() => { markersRef.current = markers; }, [markers]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // Compute actual spline points
  useEffect(() => {
    pathRef.current = generateBezierPath(waypoints);
  }, [waypoints]);

  // Resize handler
  const [canvasDim, setCanvasDim] = useState(500);
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      const size = Math.min(parent.clientWidth, 600);
      setCanvasDim(size);
      canvas.width = size;
      canvas.height = size;
    }
  }, []);

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    setTimeout(handleResize, 100);
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize, isZenMode]);

  // Pointer position helper (translates client coordinates to 0-144 field inches)
  const getFieldPosFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    
    // Scale client pixels to 0-144 inches
    const x = (clientX / canvas.width) * 144;
    const y = 144 - (clientY / canvas.height) * 144;
    return { x: Math.max(0, Math.min(144, x)), y: Math.max(0, Math.min(144, y)) };
  };

  // Drag handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pos = getFieldPosFromEvent(e);
    const scale = canvasDim / 144;

    // If in "Adding Marker" mode, insert marker at closest path point
    if (isAddingMarker && pathRef.current.length > 0) {
      let minDist = Infinity;
      let minIdx = 0;
      pathRef.current.forEach((pt, idx) => {
        const d = Math.hypot(pt.x - pos.x, pt.y - pos.y);
        if (d < minDist) {
          minDist = d;
          minIdx = idx;
        }
      });

      if (minDist < 15) { // Threshold to match path
        const progress = minIdx / (pathRef.current.length - 1);
        const newMarker: EventMarker = {
          id: String(Date.now()),
          name: `Action @ ${Math.round(progress * 100)}%`,
          progress,
          actions: ["CustomAction"]
        };
        setMarkers([...markers, newMarker]);
        setSelectedMarkerId(newMarker.id);
        setSelectedWaypointIdx(null);
      }
      setIsAddingMarker(false);
      return;
    }

    // Check hit on Waypoints/handles
    const hitRadius = 8; // in inches
    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      
      // Check Anchor
      if (Math.hypot(wp.anchor.x - pos.x, wp.anchor.y - pos.y) < hitRadius) {
        dragInfo.current = { type: "anchor", index: i };
        setSelectedWaypointIdx(i);
        setSelectedMarkerId(null);
        setIsPlaying(false);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      
      // Check Next Control handle
      if (wp.nextControl && Math.hypot(wp.nextControl.x - pos.x, wp.nextControl.y - pos.y) < hitRadius) {
        dragInfo.current = { type: "next", index: i };
        setSelectedWaypointIdx(i);
        setSelectedMarkerId(null);
        setIsPlaying(false);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }

      // Check Prev Control handle
      if (wp.prevControl && Math.hypot(wp.prevControl.x - pos.x, wp.prevControl.y - pos.y) < hitRadius) {
        dragInfo.current = { type: "prev", index: i };
        setSelectedWaypointIdx(i);
        setSelectedMarkerId(null);
        setIsPlaying(false);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    // Check hit on Event Markers
    if (pathRef.current.length > 0) {
      for (let i = 0; i < markers.length; i++) {
        const m = markers[i];
        const idx = Math.floor(m.progress * (pathRef.current.length - 1));
        const mPos = pathRef.current[idx];
        if (mPos && Math.hypot(mPos.x - pos.x, mPos.y - pos.y) < hitRadius) {
          setSelectedMarkerId(m.id);
          setSelectedWaypointIdx(null);
          setIsPlaying(false);
          return;
        }
      }
    }

    // Clicked empty space
    setSelectedWaypointIdx(null);
    setSelectedMarkerId(null);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragInfo.current) return;
    const pos = getFieldPosFromEvent(e);
    const { type, index } = dragInfo.current;
    
    setWaypoints((prev) => {
      const nextWps = [...prev];
      const wp = { ...nextWps[index] };

      if (type === "anchor") {
        const dx = pos.x - wp.anchor.x;
        const dy = pos.y - wp.anchor.y;
        
        // Move anchor and shift control points together
        wp.anchor = pos;
        if (wp.prevControl) {
          wp.prevControl = { x: wp.prevControl.x + dx, y: wp.prevControl.y + dy };
        }
        if (wp.nextControl) {
          wp.nextControl = { x: wp.nextControl.x + dx, y: wp.nextControl.y + dy };
        }
      } else if (type === "next") {
        wp.nextControl = pos;
        
        // Mirror to prevControl for C1 continuity
        if (wp.prevControl) {
          const dx = pos.x - wp.anchor.x;
          const dy = pos.y - wp.anchor.y;
          wp.prevControl = { x: wp.anchor.x - dx, y: wp.anchor.y - dy };
        }
      } else if (type === "prev") {
        wp.prevControl = pos;
        
        // Mirror to nextControl for C1 continuity
        if (wp.nextControl) {
          const dx = pos.x - wp.anchor.x;
          const dy = pos.y - wp.anchor.y;
          wp.nextControl = { x: wp.anchor.x - dx, y: wp.anchor.y - dy };
        }
      }

      nextWps[index] = wp;
      return nextWps;
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragInfo.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      dragInfo.current = null;
    }
  };

  // Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrameId: number;

    const drawField = () => {
      const w = canvas.width;
      const h = canvas.height;
      const scale = w / 144;

      ctx.clearRect(0, 0, w, h);

      // Draw custom background or season draw routines
      const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
      const decodeBg = isDark ? decodeDarkImage : decodeLightImage;

      if (season === "custom" && customBgImage) {
        ctx.drawImage(customBgImage, 0, 0, w, h);
      } else if (season === "decode" && decodeBg) {
        ctx.drawImage(decodeBg, 0, 0, w, h);
      } else {
        // Draw standard tiles (6x6 grid of 24" squares)
        ctx.fillStyle = "#161618";
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
        ctx.lineWidth = 1.5;
        const tileSize = 24 * scale;
        for (let i = 0; i <= 6; i++) {
          ctx.beginPath();
          ctx.moveTo(i * tileSize, 0);
          ctx.lineTo(i * tileSize, h);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(0, i * tileSize);
          ctx.lineTo(w, i * tileSize);
          ctx.stroke();
        }

        // Season Specific Renderings
        if (season === "decode") {
          // 1. Base Zones (Tape-marked alliance parking zones)
          // Red Base Zone (Bottom-Left)
          ctx.strokeStyle = "rgba(192, 0, 0, 0.7)";
          ctx.lineWidth = 3;
          ctx.strokeRect(0, h - 24 * scale, 24 * scale, 24 * scale);
          ctx.fillStyle = "rgba(192, 0, 0, 0.08)";
          ctx.fillRect(0, h - 24 * scale, 24 * scale, 24 * scale);
          ctx.fillStyle = "rgba(192, 0, 0, 0.8)";
          ctx.font = "bold 8px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("RED BASE", 12 * scale, h - 10 * scale);

          // Blue Base Zone (Top-Right)
          ctx.strokeStyle = "rgba(0, 136, 255, 0.7)";
          ctx.lineWidth = 3;
          ctx.strokeRect(w - 24 * scale, 0, 24 * scale, 24 * scale);
          ctx.fillStyle = "rgba(0, 136, 255, 0.08)";
          ctx.fillRect(w - 24 * scale, 0, 24 * scale, 24 * scale);
          ctx.fillStyle = "rgba(0, 136, 255, 0.8)";
          ctx.font = "bold 8px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("BLUE BASE", w - 12 * scale, 15 * scale);

          // 2. Ramps (Tall Red/Blue ramp goals for scoring Artifacts)
          // Red Ramp (Center-Left centered at x=36, y=72)
          const rRampX = 36 * scale - 12 * scale;
          const rRampY = h - 72 * scale - 12 * scale;
          const rRampSize = 24 * scale;
          const redGrad = ctx.createLinearGradient(rRampX, rRampY, rRampX + rRampSize, rRampY);
          redGrad.addColorStop(0, "rgba(192, 0, 0, 0.4)");
          redGrad.addColorStop(1, "rgba(255, 51, 68, 0.85)");
          ctx.fillStyle = redGrad;
          ctx.fillRect(rRampX, rRampY, rRampSize, rRampSize);
          ctx.strokeStyle = "rgba(255, 51, 68, 0.7)";
          ctx.lineWidth = 2;
          ctx.strokeRect(rRampX, rRampY, rRampSize, rRampSize);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
          ctx.lineWidth = 1.5;
          for (let offset = 4 * scale; offset < rRampSize; offset += 6 * scale) {
            ctx.beginPath();
            ctx.moveTo(rRampX + offset - 2 * scale, rRampY + 6 * scale);
            ctx.lineTo(rRampX + offset, rRampY + 12 * scale);
            ctx.lineTo(rRampX + offset - 2 * scale, rRampY + 18 * scale);
            ctx.stroke();
          }
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("RED RAMP", rRampX + rRampSize / 2, rRampY + 14 * scale);

          // Blue Ramp (Center-Right centered at x=108, y=72)
          const bRampX = 108 * scale - 12 * scale;
          const bRampY = h - 72 * scale - 12 * scale;
          const bRampSize = 24 * scale;
          const blueGrad = ctx.createLinearGradient(bRampX + bRampSize, bRampY, bRampX, bRampY);
          blueGrad.addColorStop(0, "rgba(0, 88, 192, 0.4)");
          blueGrad.addColorStop(1, "rgba(0, 136, 255, 0.85)");
          ctx.fillStyle = blueGrad;
          ctx.fillRect(bRampX, bRampY, bRampSize, bRampSize);
          ctx.strokeStyle = "rgba(0, 136, 255, 0.7)";
          ctx.lineWidth = 2;
          ctx.strokeRect(bRampX, bRampY, bRampSize, bRampSize);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
          ctx.lineWidth = 1.5;
          for (let offset = 4 * scale; offset < bRampSize; offset += 6 * scale) {
            ctx.beginPath();
            ctx.moveTo(bRampX + offset + 2 * scale, bRampY + 6 * scale);
            ctx.lineTo(bRampX + offset, bRampY + 12 * scale);
            ctx.lineTo(bRampX + offset + 2 * scale, bRampY + 18 * scale);
            ctx.stroke();
          }
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("BLUE RAMP", bRampX + bRampSize / 2, bRampY + 14 * scale);

          // 3. Gates (Mechanical structures to release Artifacts)
          // Top Gate (Centered at x=72, y=138, width 24", depth 12")
          const tGateX = 72 * scale - 12 * scale;
          const tGateY = 0;
          const tGateW = 24 * scale;
          const tGateH = 12 * scale;
          ctx.fillStyle = "rgba(45, 45, 50, 0.75)";
          ctx.fillRect(tGateX, tGateY, tGateW, tGateH);
          ctx.strokeStyle = "rgba(255, 184, 28, 0.5)"; // ARES Gold
          ctx.lineWidth = 1.5;
          ctx.strokeRect(tGateX, tGateY, tGateW, tGateH);
          ctx.beginPath();
          ctx.moveTo(tGateX, tGateY); ctx.lineTo(tGateX + tGateW / 2, tGateY + tGateH);
          ctx.moveTo(tGateX + tGateW / 2, tGateY); ctx.lineTo(tGateX, tGateY + tGateH);
          ctx.moveTo(tGateX + tGateW / 2, tGateY); ctx.lineTo(tGateX + tGateW, tGateY + tGateH);
          ctx.moveTo(tGateX + tGateW, tGateY); ctx.lineTo(tGateX + tGateW / 2, tGateY + tGateH);
          ctx.stroke();
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 8px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("GATE 1", tGateX + tGateW / 2, tGateY + 8 * scale);

          // Bottom Gate (Centered at x=72, y=6, width 24", depth 12")
          const bGateX = 72 * scale - 12 * scale;
          const bGateY = h - 12 * scale;
          const bGateW = 24 * scale;
          const bGateH = 12 * scale;
          ctx.fillStyle = "rgba(45, 45, 50, 0.75)";
          ctx.fillRect(bGateX, bGateY, bGateW, bGateH);
          ctx.strokeStyle = "rgba(255, 184, 28, 0.5)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bGateX, bGateY, bGateW, bGateH);
          ctx.beginPath();
          ctx.moveTo(bGateX, bGateY); ctx.lineTo(bGateX + bGateW / 2, bGateY + bGateH);
          ctx.moveTo(bGateX + bGateW / 2, bGateY); ctx.lineTo(bGateX, bGateY + bGateH);
          ctx.moveTo(bGateX + bGateW / 2, bGateY); ctx.lineTo(bGateX + bGateW, bGateY + bGateH);
          ctx.moveTo(bGateX + bGateW, bGateY); ctx.lineTo(bGateX + bGateW / 2, bGateY + bGateH);
          ctx.stroke();
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 8px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("GATE 2", bGateX + bGateW / 2, bGateY + 8 * scale);
        } else if (season === "into_the_deep") {
          // Submersible (Center 24" square)
          ctx.strokeStyle = "#FFB81C"; // ARES Gold
          ctx.lineWidth = 3;
          ctx.strokeRect(w / 2 - tileSize / 2, h / 2 - tileSize / 2, tileSize, tileSize);
          ctx.fillStyle = "rgba(255, 184, 28, 0.05)";
          ctx.fillRect(w / 2 - tileSize / 2, h / 2 - tileSize / 2, tileSize, tileSize);
          
          // Ascent bars lines
          ctx.strokeStyle = "rgba(255, 184, 28, 0.4)";
          ctx.beginPath();
          ctx.moveTo(w / 2 - tileSize / 2, h / 2);
          ctx.lineTo(w / 2 + tileSize / 2, h / 2);
          ctx.stroke();

          // Observation Zones (Corners bottom-left & top-right)
          ctx.strokeStyle = "rgba(0, 162, 232, 0.5)"; // Blue
          ctx.strokeRect(0, h - tileSize, tileSize, tileSize);
          ctx.fillStyle = "rgba(0, 162, 232, 0.04)";
          ctx.fillRect(0, h - tileSize, tileSize, tileSize);

          ctx.strokeStyle = "rgba(192, 0, 0, 0.5)"; // Red
          ctx.strokeRect(w - tileSize, 0, tileSize, tileSize);
          ctx.fillStyle = "rgba(192, 0, 0, 0.04)";
          ctx.fillRect(w - tileSize, 0, tileSize, tileSize);
        } else if (season === "centerstage") {
          // Backdrops (Blue left-mid, Red right-mid)
          ctx.strokeStyle = "rgba(0, 162, 232, 0.5)";
          ctx.strokeRect(2 * scale, h / 2 - 12 * scale, 10 * scale, 24 * scale);
          
          ctx.strokeStyle = "rgba(192, 0, 0, 0.5)";
          ctx.strokeRect(w - 12 * scale, h / 2 - 12 * scale, 10 * scale, 24 * scale);

          // Center Stage Truss Bars
          ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(w / 2 - 24 * scale, h / 2);
          ctx.lineTo(w / 2 + 24 * scale, h / 2);
          ctx.stroke();
        } else if (season === "powerplay") {
          // Junction grid (5x5 poles layout)
          ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
          const offsets = [24, 48, 72, 96, 120];
          offsets.forEach((ox) => {
            offsets.forEach((oy) => {
              ctx.beginPath();
              ctx.arc(ox * scale, oy * scale, 3, 0, Math.PI * 2);
              ctx.fill();
            });
          });
        }
      }

      // Draw perimeter boundary
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, w, h);
    };

    const drawPathAndHandles = () => {
      const w = canvas.width;
      const h = canvas.height;
      const scale = w / 144;
      const pts = pathRef.current;

      // Draw Spline Line
      if (pts.length > 0) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 184, 28, 0.85)"; // ARES Gold
        ctx.lineWidth = 3.5;
        ctx.moveTo(pts[0].x * scale, h - pts[0].y * scale);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x * scale, h - pts[i].y * scale);
        }
        ctx.stroke();
      }

      // Draw Control handle lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 1.2;
      waypointsRef.current.forEach((wp) => {
        const ax = wp.anchor.x * scale;
        const ay = h - wp.anchor.y * scale;

        if (wp.nextControl) {
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(wp.nextControl.x * scale, h - wp.nextControl.y * scale);
          ctx.stroke();
        }
        if (wp.prevControl) {
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(wp.prevControl.x * scale, h - wp.prevControl.y * scale);
          ctx.stroke();
        }
      });

      // Draw control points nodes (handles)
      waypointsRef.current.forEach((wp, idx) => {
        const ax = wp.anchor.x * scale;
        const ay = h - wp.anchor.y * scale;

        // Anchor node (glowing red circle)
        ctx.beginPath();
        ctx.arc(ax, ay, 6, 0, Math.PI * 2);
        ctx.fillStyle = selectedWaypointIdx === idx ? "#C00000" : "rgba(192, 0, 0, 0.85)";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Label index
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(idx + 1), ax, ay);

        // Next Control node (cyan handle)
        if (wp.nextControl) {
          const cx = wp.nextControl.x * scale;
          const cy = h - wp.nextControl.y * scale;
          ctx.beginPath();
          ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = "#00A2E8";
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.stroke();
        }

        // Prev Control node (cyan handle)
        if (wp.prevControl) {
          const cx = wp.prevControl.x * scale;
          const cy = h - wp.prevControl.y * scale;
          ctx.beginPath();
          ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = "#00A2E8";
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.stroke();
        }
      });

      // Draw Event Markers nodes (yellow diamonds along path)
      markersRef.current.forEach((m) => {
        if (pts.length === 0) return;
        const ptIdx = Math.floor(m.progress * (pts.length - 1));
        const pos = pts[ptIdx];
        if (!pos) return;
        const mx = pos.x * scale;
        const my = h - pos.y * scale;

        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(Math.PI / 4); // Rotate square to make a diamond
        
        ctx.fillStyle = selectedMarkerId === m.id ? "#FFD700" : "#FFB81C"; // ARES Gold / Highlighted Yellow
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1.5;
        ctx.fillRect(-5.5, -5.5, 11, 11);
        ctx.strokeRect(-5.5, -5.5, 11, 11);
        
        ctx.restore();
      });
    };

    const drawRobot = () => {
      const w = canvas.width;
      const h = canvas.height;
      const scale = w / 144;
      const pts = pathRef.current;

      if (isPlayingRef.current && pts.length > 0) {
        const r = robotRef.current;
        r.progress += 0.003;
        if (r.progress >= 1.0) {
          r.progress = 0;
          setIsPlaying(false);
        } else {
          const idx = Math.floor(r.progress * (pts.length - 1));
          const nextIdx = Math.min(idx + 1, pts.length - 1);
          const p1 = pts[idx];
          const p2 = pts[nextIdx];

          r.x = p1.x;
          r.y = p1.y;
          if (idx !== nextIdx) {
            r.heading = Math.atan2(p2.y - p1.y, p2.x - p1.x);
          }
        }
      } else if (!isPlayingRef.current && pts.length > 0) {
        robotRef.current.progress = 0;
        robotRef.current.x = pts[0].x;
        robotRef.current.y = pts[0].y;
        const p1 = pts[0];
        const p2 = pts[1] || p1;
        robotRef.current.heading = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      }

      if (pts.length === 0) return;

      const rx = robotRef.current.x * scale;
      const ry = h - robotRef.current.y * scale;
      const rh = robotRef.current.heading;
      const rbSize = 18 * scale; // 18-inch robot dimensions standard limit

      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(-rh); // Canvas Y coordinates inverted, invert heading angle rotation

      // Chassis body
      ctx.fillStyle = "rgba(10, 10, 10, 0.75)";
      ctx.strokeStyle = "#FFB81C"; // ARES Gold
      ctx.lineWidth = 2.5;
      ctx.fillRect(-rbSize / 2, -rbSize / 2, rbSize, rbSize);
      ctx.strokeRect(-rbSize / 2, -rbSize / 2, rbSize, rbSize);

      // Direction Pointer
      ctx.strokeStyle = "#C00000";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(rbSize / 2 + 5, 0);
      ctx.stroke();

      ctx.restore();
    };

    const loop = () => {
      drawField();
      drawPathAndHandles();
      drawRobot();
      animFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [canvasDim, season, customBgImage, selectedWaypointIdx, selectedMarkerId, decodeDarkImage, decodeLightImage]);

  // Handle waypoint deletions
  const handleDeleteWaypoint = (idx: number) => {
    if (waypoints.length <= 2) return; // Keep minimum 2 points
    const nextWps = waypoints.filter((_, i) => i !== idx);
    
    // Repair controls constraints
    if (idx === 0) {
      nextWps[0].prevControl = null;
    } else if (idx === waypoints.length - 1) {
      nextWps[nextWps.length - 1].nextControl = null;
    }

    setWaypoints(nextWps);
    setSelectedWaypointIdx(null);
  };

  // Add waypoint to path end
  const handleAddWaypoint = () => {
    const lastWp = waypoints[waypoints.length - 1];
    
    // Position offset from last waypoint
    const newAnchor = { x: Math.min(136, lastWp.anchor.x + 24), y: Math.max(8, lastWp.anchor.y - 24) };
    const prevControl = { x: lastWp.anchor.x + 12, y: lastWp.anchor.y - 12 };
    
    // Set next control on the old last waypoint
    const nextWps = waypoints.map((wp, idx) => {
      if (idx === waypoints.length - 1) {
        return { ...wp, nextControl: { x: wp.anchor.x + 12, y: wp.anchor.y - 12 } };
      }
      return wp;
    });

    const newWp: Waypoint = {
      anchor: newAnchor,
      prevControl: prevControl,
      nextControl: null
    };

    setWaypoints([...nextWps, newWp]);
    setSelectedWaypointIdx(nextWps.length);
  };

  // Add marker
  const handleTriggerAddMarker = () => {
    setIsAddingMarker(true);
    setSelectedMarkerId(null);
    setSelectedWaypointIdx(null);
  };

  // Delete marker
  const handleDeleteMarker = (id: string) => {
    setMarkers(markers.filter((m) => m.id !== id));
    setSelectedMarkerId(null);
  };

  // Update marker parameters
  const handleUpdateMarker = (id: string, updates: Partial<EventMarker>) => {
    setMarkers(markers.map((m) => m.id === id ? { ...m, ...updates } : m));
  };

  // Unit transformation helpers
  const getCoordinatesDisplay = (x: number, y: number) => {
    let dispX = x;
    let dispY = y;
    
    if (originMode === "center") {
      dispX = x - 72;
      dispY = y - 72;
    }

    if (unitMode === "meters") {
      dispX = dispX * 0.0254;
      dispY = dispY * 0.0254;
    }

    const unitStr = unitMode === "inches" ? "in" : "m";
    return `X: ${dispX.toFixed(1)}${unitStr}, Y: ${dispY.toFixed(1)}${unitStr}`;
  };

  // JSON Exporter
  const handleExportJSON = () => {
    const output = {
      waypoints: waypoints.map((w) => ({
        anchor: { x: parseFloat(w.anchor.x.toFixed(2)), y: parseFloat(w.anchor.y.toFixed(2)) },
        prevControl: w.prevControl ? { x: parseFloat(w.prevControl.x.toFixed(2)), y: parseFloat(w.prevControl.y.toFixed(2)) } : null,
        nextControl: w.nextControl ? { x: parseFloat(w.nextControl.x.toFixed(2)), y: parseFloat(w.nextControl.y.toFixed(2)) } : null
      })),
      eventMarkers: markers.map((m) => ({
        name: m.name,
        waypointRelativePos: parseFloat((m.progress * (waypoints.length - 1)).toFixed(3)),
        command: {
          type: "named",
          name: m.actions[0] || m.name
        }
      })),
      markers: markers.map((m) => ({
        id: m.id,
        name: m.name,
        progress: parseFloat(m.progress.toFixed(3)),
        actions: m.actions
      })),
      season,
      name: pathName
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(output, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${pathName.toLowerCase().replace(/\s+/g, "_")}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Upload file custom background
  const handleCustomBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setCustomBgImage(img);
          setSeason("custom");
          setCustomBgName(file.name);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Robot Sync - HTTP POST to OnBot Java endpoint
  const handleSyncToRobot = async () => {
    setSyncStatus("uploading");
    setSyncLog(`Initiating HTTP connection to Robot Controller Program & Manage server...\nTarget URL: http://${robotIp}:8080/\n\n`);

    const pathData = {
      name: pathName,
      season,
      waypoints: waypoints.map((w) => ({
        anchor: { x: parseFloat(w.anchor.x.toFixed(2)), y: parseFloat(w.anchor.y.toFixed(2)) },
        prevControl: w.prevControl ? { x: parseFloat(w.prevControl.x.toFixed(2)), y: parseFloat(w.prevControl.y.toFixed(2)) } : null,
        nextControl: w.nextControl ? { x: parseFloat(w.nextControl.x.toFixed(2)), y: parseFloat(w.nextControl.y.toFixed(2)) } : null
      })),
      eventMarkers: markers.map((m) => ({
        name: m.name,
        waypointRelativePos: parseFloat((m.progress * (waypoints.length - 1)).toFixed(3)),
        command: {
          type: "named",
          name: m.actions[0] || m.name
        }
      })),
      markers: markers.map((m) => ({
        id: m.id,
        name: m.name,
        progress: parseFloat(m.progress.toFixed(3)),
        actions: m.actions
      }))
    };

    try {
      // Endpoint typically used by OnBotJava file save POSTs
      // If we save it as a JSON config file directly in the src folder
      const targetUrl = `http://${robotIp}:8080/onbotjava/save?file=src/org/firstinspires/ftc/teamcode/${pathName}.json`;
      
      setSyncLog((prev) => prev + `Sending POST request payload to:\n${targetUrl}\n\n`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

      const response = await fetch(targetUrl, {
        method: "POST",
        mode: "cors",
        headers: {
          "Content-Type": "text/plain" // OnBot Java accepts text/plain source payloads
        },
        body: JSON.stringify(pathData, null, 2),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setSyncStatus("success");
        setSyncLog((prev) => prev + `SUCCESS: Path successfully saved to Control Hub!\nFile located at: /FIRST/java/src/org/firstinspires/ftc/teamcode/${pathName}.json\n\nYou can now load this file in your OpMode using your JSON path parser!`);
      } else {
        throw new Error(`Server returned HTTP status ${response.status}: ${response.statusText}`);
      }
    } catch (err: any) {
      setSyncStatus("error");
      let errorMsg = err.message || err;
      if (err.name === "AbortError") {
        errorMsg = "Connection timed out. Ensure your PC is connected to the Robot's Wi-Fi network.";
      }
      
      setSyncLog((prev) => prev + `ERROR: Upload failed.\nDetail: ${errorMsg}\n\n` + 
        `⚠️ TECHNICAL NOTE (Mixed Content & CORS):\n` +
        `Modern browsers block HTTPS websites (like aresfirst-portal.web.app) from calling local HTTP addresses (like http://${robotIp}:8080). ` +
        `If this failed, you can run the portal locally, or use the copyable ADB Command line below to push the file wirelessly!`);
    }
  };

  const adbPushCmd = `adb connect ${robotIp}:5555 && adb push ${pathName.toLowerCase().replace(/\s+/g, "_")}.json /sdcard/FIRST/${pathName}.json`;

  const copyAdbCmd = () => {
    navigator.clipboard.writeText(adbPushCmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div 
      ref={containerRef}
      className={`w-full flex flex-col gap-6 p-4 rounded-xl border border-white/10 ${
        isZenMode 
          ? "fixed inset-0 z-modal bg-obsidian p-6 overflow-y-auto" 
          : "glass-card max-w-5xl mx-auto"
      }`}
    >
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <Compass className="text-ares-gold w-8 h-8 shrink-0 animate-spin" style={{ animationDuration: '15s' }} />
          <div>
            <input 
              type="text" 
              value={pathName}
              onChange={(e) => setPathName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              className="bg-transparent text-white font-heading font-black text-lg uppercase tracking-wider border-b border-white/10 focus:border-ares-gold focus:outline-none w-48"
              title="Name of the path file"
            />
            <p className="text-[10px] text-marble/40 font-mono mt-1">FTC Cubic Bezier Spline Editor</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Origin Mode Toggle */}
          <button
            onClick={() => setOriginMode(originMode === "corner" ? "center" : "corner")}
            className="px-2.5 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-white font-bold rounded border border-white/10 cursor-pointer uppercase tracking-wider"
          >
            Origin: {originMode === "corner" ? "Corner (0,0)" : "Center (0,0)"}
          </button>

          {/* Unit Toggle */}
          <button
            onClick={() => setUnitMode(unitMode === "inches" ? "meters" : "inches")}
            className="px-2.5 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-white font-bold rounded border border-white/10 cursor-pointer uppercase tracking-wider"
          >
            Units: {unitMode === "inches" ? "Inches" : "Meters"}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsZenMode(!isZenMode)}
            className="px-2.5 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-white font-bold rounded border border-white/10 cursor-pointer uppercase tracking-wider flex items-center gap-1.5"
          >
            {isZenMode ? (
              <>
                <Minimize2 size={12} /> Standard View
              </>
            ) : (
              <>
                <Maximize2 size={12} /> Fullscreen
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Workspace split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Visual canvas board (7 cols) */}
        <div className="lg:col-span-7 flex flex-col items-center gap-3 w-full">
          <div className="relative bg-black/60 p-2.5 rounded-xl border border-white/10 shadow-2xl max-w-full w-full flex justify-center">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="block cursor-crosshair select-none touch-none max-w-full rounded"
              style={{ width: `${canvasDim}px`, height: `${canvasDim}px` }}
            />
            {/* Overlay Cursor coordinates tracking */}
            <div className="absolute bottom-4 left-4 bg-obsidian/90 border border-white/10 px-2.5 py-1.5 rounded text-[10px] font-mono text-white select-none shadow">
              <span className="text-marble/40 uppercase">Robot Pos: </span>
              {getCoordinatesDisplay(robotRef.current.x, robotRef.current.y)}
            </div>
            {isAddingMarker && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center text-center p-6 rounded cursor-pointer pointer-events-none">
                <div className="bg-ares-gold text-obsidian text-xs font-black uppercase py-2.5 px-4 rounded border border-white/20 shadow-xl animate-pulse">
                  Click on the spline path to insert action marker
                </div>
              </div>
            )}
          </div>
          <p className="text-[10px] text-marble/30 uppercase tracking-widest font-mono text-center">
            ARES Autonomous Path Workspace // Standard 144" x 144" Field Scaling
          </p>
        </div>

        {/* RIGHT COLUMN: Controls and configurations (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4 w-full">
          
          {/* Card 1: Map & Paths selector */}
          <div className="bg-black/20 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
            <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold flex items-center gap-1.5">
              <Settings size={14} /> Field Settings
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-mono uppercase text-marble/50">Field Season</label>
                <select
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  className="w-full bg-obsidian border border-white/10 rounded px-2 py-1.5 text-xs text-white uppercase font-bold focus:outline-none"
                >
                  <option value="decode">DECODE (25/26)</option>
                  <option value="into_the_deep">Into The Deep (24/25)</option>
                  <option value="centerstage">Centerstage (23/24)</option>
                  <option value="powerplay">Powerplay (22/23)</option>
                  <option value="blank_grid">Generic Grid (Blank)</option>
                  {customBgName && <option value="custom">Uploaded: {customBgName}</option>}
                </select>
              </div>

              <div>
                <label className="text-[9px] font-mono uppercase text-marble/50">Upload Custom Image</label>
                <label className="w-full bg-white/5 border border-white/10 border-dashed rounded px-2.5 py-1.5 text-xs text-marble hover:text-white hover:bg-white/10 flex items-center justify-center font-bold cursor-pointer transition-all">
                  <Plus size={12} className="mr-1.5 text-ares-cyan" /> Upload Field
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCustomBgUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Card 2: Interactive Configurator */}
          <div className="bg-black/20 border border-white/5 rounded-xl p-4 min-h-[160px]">
            
            {/* If Waypoint Node is Selected */}
            {selectedWaypointIdx !== null && (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-xs font-black uppercase text-ares-red tracking-wider">
                    Waypoint #{selectedWaypointIdx + 1} Configuration
                  </span>
                  <button
                    onClick={() => handleDeleteWaypoint(selectedWaypointIdx)}
                    disabled={waypoints.length <= 2}
                    className="p-1 text-marble/40 hover:text-ares-danger hover:bg-ares-red/10 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Delete waypoint"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <span className="text-[9px] text-marble/50 uppercase block">Anchor Position</span>
                    <div className="mt-1 bg-obsidian/60 border border-white/5 p-2 rounded text-white flex flex-col gap-1">
                      <span>X: {waypoints[selectedWaypointIdx].anchor.x.toFixed(1)} in</span>
                      <span>Y: {waypoints[selectedWaypointIdx].anchor.y.toFixed(1)} in</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-[9px] text-marble/50 uppercase block">Heading Tangents</span>
                    <div className="mt-1 bg-obsidian/60 border border-white/5 p-2 rounded text-marble/70 flex flex-col gap-1">
                      <span>Prev: {waypoints[selectedWaypointIdx].prevControl ? "Connected" : "Start Node"}</span>
                      <span>Next: {waypoints[selectedWaypointIdx].nextControl ? "Connected" : "End Node"}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* If Event Marker is Selected */}
            {selectedMarkerId !== null && (
              <div className="flex flex-col gap-3">
                {(() => {
                  const marker = markers.find((m) => m.id === selectedMarkerId);
                  if (!marker) return null;
                  return (
                    <>
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-xs font-black uppercase text-ares-gold tracking-wider">
                          Event Action Marker
                        </span>
                        <button
                          onClick={() => handleDeleteMarker(selectedMarkerId)}
                          className="p-1 text-marble/40 hover:text-ares-danger hover:bg-ares-red/10 rounded cursor-pointer"
                          title="Delete marker"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div>
                          <label className="text-[9px] font-mono uppercase text-marble/50">Marker Name</label>
                          <input
                            type="text"
                            value={marker.name}
                            onChange={(e) => handleUpdateMarker(selectedMarkerId, { name: e.target.value })}
                            className="w-full bg-obsidian border border-white/10 rounded px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-ares-gold mt-1"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] font-mono uppercase text-marble/50 flex justify-between">
                            <span>Path Progress</span>
                            <span className="font-bold text-white">{Math.round(marker.progress * 100)}%</span>
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={Math.round(marker.progress * 100)}
                            onChange={(e) => handleUpdateMarker(selectedMarkerId, { progress: parseInt(e.target.value) / 100 })}
                            className="w-full accent-ares-gold cursor-ew-resize bg-black/40 h-1 rounded mt-1.5"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] font-mono uppercase text-marble/50">Actions Queue</label>
                          <div className="flex flex-wrap gap-1 mt-1 bg-obsidian/40 border border-white/5 p-2 rounded min-h-[40px]">
                            {marker.actions.map((act, aIdx) => (
                              <span
                                key={aIdx}
                                className="bg-ares-gold/10 text-ares-gold text-[9px] font-mono font-bold px-2 py-0.5 rounded border border-ares-gold/20 flex items-center gap-1 select-none"
                              >
                                {act}
                                <span
                                  onClick={() => handleUpdateMarker(selectedMarkerId, { actions: marker.actions.filter((_, idx) => idx !== aIdx) })}
                                  className="text-white hover:text-ares-red cursor-pointer font-sans font-black ml-1 text-[8px]"
                                >
                                  ×
                                </span>
                              </span>
                            ))}
                            {marker.actions.length === 0 && (
                              <span className="text-[10px] text-marble/35 font-mono italic">No actions registered.</span>
                            )}
                          </div>

                          <div className="flex gap-2 mt-2">
                            <input
                              type="text"
                              id="actionInput"
                              placeholder="ActionName (e.g. LiftUp)"
                              className="flex-grow bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] text-white focus:outline-none"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const target = e.currentTarget;
                                  if (target.value.trim()) {
                                    handleUpdateMarker(selectedMarkerId, { actions: [...marker.actions, target.value.trim()] });
                                    target.value = "";
                                  }
                                }
                              }}
                            />
                            <button
                              onClick={() => {
                                const input = document.getElementById("actionInput") as HTMLInputElement;
                                if (input && input.value.trim()) {
                                  handleUpdateMarker(selectedMarkerId, { actions: [...marker.actions, input.value.trim()] });
                                  input.value = "";
                                }
                              }}
                              className="px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] text-white font-bold cursor-pointer"
                            >
                              Add
                            </button>
                          </div>

                          <div className="mt-2.5">
                            <label className="text-[8px] font-mono uppercase text-marble/40 block mb-1">Suggested Hooks:</label>
                            <div className="flex flex-wrap gap-1">
                              {["IntakeOn", "IntakeOff", "FlywheelOn", "FlywheelOff", "IntakeDeploy", "FeederShoot", "Shoot", "Stop"].map((suggestedAct) => {
                                const isAdded = marker.actions.includes(suggestedAct);
                                return (
                                  <button
                                    key={suggestedAct}
                                    type="button"
                                    disabled={isAdded}
                                    onClick={() => {
                                      handleUpdateMarker(selectedMarkerId, { actions: [...marker.actions, suggestedAct] });
                                    }}
                                    className={`text-[8px] font-mono px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                                      isAdded 
                                        ? "bg-white/5 border-white/5 text-marble/30 cursor-not-allowed" 
                                        : "bg-white/5 border-white/10 hover:border-ares-gold/45 text-marble/75 hover:text-ares-gold"
                                    }`}
                                  >
                                    +{suggestedAct}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Default State: Path Config Overview */}
            {selectedWaypointIdx === null && selectedMarkerId === null && (
              <div className="flex flex-col gap-3">
                <span className="text-xs font-black uppercase text-marble/55 tracking-wider border-b border-white/5 pb-2 block">
                  Trajectory Overview
                </span>

                <div className="flex flex-col gap-2.5 text-xs">
                  <div className="flex justify-between font-mono">
                    <span className="text-marble/50">Total Waypoints:</span>
                    <span className="font-bold text-white">{waypoints.length} nodes</span>
                  </div>

                  <div className="flex justify-between font-mono">
                    <span className="text-marble/50">Actions/Event Markers:</span>
                    <span className="font-bold text-white">{markers.length} markers</span>
                  </div>

                  <div className="h-px bg-white/5 my-1" />

                  {/* Actions buttons */}
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      onClick={handleAddWaypoint}
                      className="py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus size={12} className="text-ares-cyan" /> Add Waypoint
                    </button>

                    <button
                      onClick={handleTriggerAddMarker}
                      className="py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus size={12} className="text-ares-gold" /> Add Action
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card 3: Cloud Sync / Saving */}
          {onSaveToCloud && (
            <div className="bg-black/20 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
              <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-cyan flex items-center gap-1.5">
                <FolderOpen size={14} /> Cloud Workspace
              </h3>

              <div className="flex gap-2">
                <button
                  onClick={() => onSaveToCloud(pathName, season, waypoints, markers)}
                  disabled={isSavingCloud}
                  className="flex-grow py-2 bg-ares-cyan hover:bg-ares-cyan/90 text-obsidian rounded text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                >
                  <Save size={12} /> {isSavingCloud ? "Saving..." : "Save Path to Cloud"}
                </button>
              </div>

              {cloudPaths.length > 0 && onLoadPath && (
                <div>
                  <label className="text-[9px] font-mono uppercase text-marble/50 block mb-1">Load Cloud Path</label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) onLoadPath(e.target.value);
                    }}
                    defaultValue=""
                    className="w-full bg-obsidian border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="" disabled>-- Select Saved Path --</option>
                    {cloudPaths.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.season.toUpperCase().replace(/_/g, " ")})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Card 4: Local Robot Sync panel */}
          <div className="bg-black/20 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
            <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-red flex items-center gap-1.5">
              <Wifi size={14} /> Connected Robot Sync
            </h3>

            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <div className="flex-grow">
                  <label className="text-[9px] font-mono uppercase text-marble/50 block mb-1">Robot IP Address</label>
                  <input
                    type="text"
                    value={robotIp}
                    onChange={(e) => setRobotIp(e.target.value)}
                    placeholder="192.168.43.1"
                    className="w-full bg-obsidian border border-white/10 rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-ares-red"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleSyncToRobot}
                    disabled={syncStatus === "uploading"}
                    className="px-4 py-2.5 bg-ares-red hover:bg-ares-red-dark text-white rounded text-xs font-black uppercase tracking-wider cursor-pointer shadow disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Sync JSON
                  </button>
                </div>
              </div>

              {/* Sync Log output terminal */}
              {syncStatus !== "idle" && (
                <div className="bg-black/80 p-2.5 rounded border border-white/5 font-mono text-[9px] leading-relaxed text-marble/80 max-h-[110px] overflow-y-auto whitespace-pre-wrap select-text">
                  {syncLog}
                </div>
              )}

              {/* Copyable ADB instruction command line */}
              <div className="bg-black/40 border border-white/5 p-2 rounded flex flex-col gap-1 mt-1">
                <span className="text-[9px] font-mono uppercase text-marble/40">ADB Wireless Push Command:</span>
                <div className="flex items-center justify-between gap-2 bg-obsidian/75 p-1 px-2 rounded font-mono text-[9px] text-ares-gold overflow-x-auto select-all whitespace-nowrap">
                  <span>{adbPushCmd}</span>
                  <button
                    onClick={copyAdbCmd}
                    className="p-1 text-marble/50 hover:text-white shrink-0 cursor-pointer"
                    title="Copy ADB command"
                  >
                    {copiedCmd ? <Check size={10} className="text-ares-cyan" /> : <Copy size={10} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Control Buttons bottom bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-black/20 p-4 rounded-xl border border-white/5 mt-2">
        <div className="flex items-center gap-2">
          <Play size={14} className="text-ares-gold" />
          <span className="text-[10px] uppercase font-bold text-marble/60 tracking-wider">
            Trajectory Spline Simulator
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
                <Pause size={12} /> Stop Sim
              </>
            ) : (
              <>
                <Play size={12} /> Run Follower
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
