"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { 
  Play, Pause, RefreshCw, Info, HelpCircle, Compass, 
  Download, Maximize2, Minimize2, Plus, Trash2, Save, 
  FolderOpen, Settings, Wifi, Copy, Check, ShieldCheck,
  ChevronDown, ChevronUp, Lock, Unlock, Link
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

export type ConstraintZone = {
  id: string;
  name: string;
  x: number;       // Center X in inches (0-144)
  y: number;       // Center Y in inches (0-144)
  width: number;   // Width in inches
  height: number;  // Height in inches
  maxVelocity: number; // in m/s
};

export type RotationTarget = {
  id: string;
  name: string;
  x: number;       // Target face X in inches (0-144)
  y: number;       // Target face Y in inches (0-144)
  waypointIndex: number; // Waypoint index it's linked to (e.g. 0, 1, 2)
};

interface AresPlannerProps {
  initialPathData?: {
    name: string;
    season: string;
    waypoints: Waypoint[];
    markers: EventMarker[];
    constraintZones?: ConstraintZone[];
    rotationTargets?: RotationTarget[];
  };
  cloudPaths?: Array<{
    id: string;
    name: string;
    season: string;
    waypoints: Waypoint[];
    markers: EventMarker[];
    constraintZones?: ConstraintZone[];
    rotationTargets?: RotationTarget[];
    updatedAt: any;
  }>;
  onSaveToCloud?: (
    name: string,
    season: string,
    waypoints: Waypoint[],
    markers: EventMarker[],
    constraintZones?: ConstraintZone[],
    rotationTargets?: RotationTarget[]
  ) => Promise<void>;
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
  const [unitMode, setUnitMode] = useState<"inches" | "meters">("meters");
  const [isZenMode, setIsZenMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Selected elements for config panels
  const [selectedWaypointIdx, setSelectedWaypointIdx] = useState<number | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [selectedRotationTargetId, setSelectedRotationTargetId] = useState<string | null>(null);
  const [selectedConstraintZoneId, setSelectedConstraintZoneId] = useState<string | null>(null);
  const [isAddingMarker, setIsAddingMarker] = useState(false);

  // Sidebar accordion expansion states
  const [isWaypointsExpanded, setIsWaypointsExpanded] = useState(true);
  const [isEventsExpanded, setIsEventsExpanded] = useState(true);
  const [isRotationExpanded, setIsRotationExpanded] = useState(false);
  const [isPointZonesExpanded, setIsPointZonesExpanded] = useState(false);
  const [isStartingStateExpanded, setIsStartingStateExpanded] = useState(false);
  const [isEndStateExpanded, setIsEndStateExpanded] = useState(false);

  // Expanded individual waypoints
  const [expandedWaypoints, setExpandedWaypoints] = useState<Record<number, boolean>>({ 0: true });

  // Lock body scroll when zen mode is active to prevent scroll to footer
  useEffect(() => {
    if (isZenMode) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isZenMode]);
  
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

  const [constraintZones, setConstraintZones] = useState<ConstraintZone[]>([]);
  const [rotationTargets, setRotationTargets] = useState<RotationTarget[]>([]);

  // Handle loading initial data
  useEffect(() => {
    if (initialPathData) {
      if (initialPathData.name) setPathName(initialPathData.name);
      if (initialPathData.season) setSeason(initialPathData.season);
      if (initialPathData.waypoints) setWaypoints(initialPathData.waypoints);
      if (initialPathData.markers) setMarkers(initialPathData.markers);
      if (initialPathData.constraintZones) setConstraintZones(initialPathData.constraintZones);
      else setConstraintZones([]);
      if (initialPathData.rotationTargets) setRotationTargets(initialPathData.rotationTargets);
      else setRotationTargets([]);
    }
  }, [initialPathData]);

  // Spline values reference for rendering loops
  const waypointsRef = useRef<Waypoint[]>(waypoints);
  const markersRef = useRef<EventMarker[]>(markers);
  const constraintZonesRef = useRef<ConstraintZone[]>(constraintZones);
  const rotationTargetsRef = useRef<RotationTarget[]>(rotationTargets);
  const selectedConstraintZoneIdRef = useRef<string | null>(selectedConstraintZoneId);
  const selectedRotationTargetIdRef = useRef<string | null>(selectedRotationTargetId);
  
  const pathRef = useRef<{x: number, y: number}[]>([]);
  const robotRef = useRef({ progress: 0, x: 24, y: 120, heading: 0 });
  const isPlayingRef = useRef(isPlaying);
  const dragInfo = useRef<{ type: "anchor" | "prev" | "next" | "rotationTarget" | "constraintZoneMove" | "constraintZoneResize"; index: number } | null>(null);

  // Keep references updated
  useEffect(() => { waypointsRef.current = waypoints; }, [waypoints]);
  useEffect(() => { markersRef.current = markers; }, [markers]);
  useEffect(() => { constraintZonesRef.current = constraintZones; }, [constraintZones]);
  useEffect(() => { rotationTargetsRef.current = rotationTargets; }, [rotationTargets]);
  useEffect(() => { selectedConstraintZoneIdRef.current = selectedConstraintZoneId; }, [selectedConstraintZoneId]);
  useEffect(() => { selectedRotationTargetIdRef.current = selectedRotationTargetId; }, [selectedRotationTargetId]);
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
          setSelectedRotationTargetId(null);
          setSelectedConstraintZoneId(null);
          setIsPlaying(false);
          return;
        }
      }
    }

    // Check hit on Rotation Targets
    for (let i = 0; i < rotationTargets.length; i++) {
      const rot = rotationTargets[i];
      if (Math.hypot(rot.x - pos.x, rot.y - pos.y) < hitRadius) {
        dragInfo.current = { type: "rotationTarget", index: i };
        setSelectedRotationTargetId(rot.id);
        setSelectedWaypointIdx(null);
        setSelectedMarkerId(null);
        setSelectedConstraintZoneId(null);
        setIsPlaying(false);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    // Check hit on Constraint Zones
    for (let i = 0; i < constraintZones.length; i++) {
      const zone = constraintZones[i];
      const brX = zone.x + zone.width / 2;
      const brY = zone.y - zone.height / 2;
      if (Math.hypot(brX - pos.x, brY - pos.y) < hitRadius) {
        dragInfo.current = { type: "constraintZoneResize", index: i };
        setSelectedConstraintZoneId(zone.id);
        setSelectedWaypointIdx(null);
        setSelectedMarkerId(null);
        setSelectedRotationTargetId(null);
        setIsPlaying(false);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
      if (Math.hypot(zone.x - pos.x, zone.y - pos.y) < hitRadius) {
        dragInfo.current = { type: "constraintZoneMove", index: i };
        setSelectedConstraintZoneId(zone.id);
        setSelectedWaypointIdx(null);
        setSelectedMarkerId(null);
        setSelectedRotationTargetId(null);
        setIsPlaying(false);
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    // Clicked empty space
    setSelectedWaypointIdx(null);
    setSelectedMarkerId(null);
    setSelectedRotationTargetId(null);
    setSelectedConstraintZoneId(null);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragInfo.current) return;
    const pos = getFieldPosFromEvent(e);
    const { type, index } = dragInfo.current;
    
    if (type === "rotationTarget") {
      setRotationTargets((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], x: pos.x, y: pos.y };
        return next;
      });
    } else if (type === "constraintZoneMove") {
      setConstraintZones((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], x: pos.x, y: pos.y };
        return next;
      });
    } else if (type === "constraintZoneResize") {
      setConstraintZones((prev) => {
        const next = [...prev];
        const zone = next[index];
        const halfWidth = Math.max(4, Math.abs(pos.x - zone.x));
        const halfHeight = Math.max(4, Math.abs(pos.y - zone.y));
        next[index] = {
          ...zone,
          width: halfWidth * 2,
          height: halfHeight * 2
        };
        return next;
      });
    } else {
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
    }
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

      // Draw Constraint Zones
      constraintZonesRef.current.forEach((zone) => {
        const cx = zone.x * scale;
        const cy = h - zone.y * scale;
        const zw = zone.width * scale;
        const zh = zone.height * scale;
        const isSelected = selectedConstraintZoneIdRef.current === zone.id;

        ctx.save();
        ctx.fillStyle = isSelected ? "rgba(245, 158, 11, 0.25)" : "rgba(245, 158, 11, 0.12)";
        ctx.fillRect(cx - zw / 2, cy - zh / 2, zw, zh);

        ctx.strokeStyle = isSelected ? "rgba(245, 158, 11, 0.9)" : "rgba(245, 158, 11, 0.55)";
        ctx.lineWidth = isSelected ? 2 : 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(cx - zw / 2, cy - zh / 2, zw, zh);
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#f59e0b";
        ctx.fill();

        if (isSelected) {
          const brX = cx + zw / 2;
          const brY = cy + zh / 2;
          ctx.beginPath();
          ctx.arc(brX, brY, 5, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.fillStyle = "#f59e0b";
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${zone.name} (${zone.maxVelocity.toFixed(1)} m/s)`, cx, cy - zh / 2 - 4);
        ctx.restore();
      });

      // Draw Rotation Targets
      rotationTargetsRef.current.forEach((rot) => {
        const tx = rot.x * scale;
        const ty = h - rot.y * scale;
        const isSelected = selectedRotationTargetIdRef.current === rot.id;

        const wp = waypointsRef.current[rot.waypointIndex];
        if (wp) {
          const ax = wp.anchor.x * scale;
          const ay = h - wp.anchor.y * scale;

          ctx.save();
          ctx.strokeStyle = "rgba(168, 85, 247, 0.55)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.translate(tx, ty);

        ctx.strokeStyle = isSelected ? "#a855f7" : "rgba(168, 85, 247, 0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-14, 0); ctx.lineTo(14, 0);
        ctx.moveTo(0, -14); ctx.lineTo(0, 14);
        ctx.stroke();

        ctx.restore();

        ctx.fillStyle = "#c084fc";
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`Target: ${rot.name}`, tx + 16, ty + 3);
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
      const rbSize = 18 * scale;

      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(-rh);

      ctx.fillStyle = "rgba(10, 10, 10, 0.75)";
      ctx.strokeStyle = "#FFB81C";
      ctx.lineWidth = 2.5;
      ctx.fillRect(-rbSize / 2, -rbSize / 2, rbSize, rbSize);
      ctx.strokeRect(-rbSize / 2, -rbSize / 2, rbSize, rbSize);

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
  }, [canvasDim, season, customBgImage, selectedWaypointIdx, selectedMarkerId, selectedConstraintZoneId, selectedRotationTargetId, decodeDarkImage, decodeLightImage]);

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

  // Actions for Constraint Zones
  const handleAddConstraintZone = () => {
    const newZone: ConstraintZone = {
      id: `zone-${Date.now()}`,
      name: `Speed Zone ${constraintZones.length + 1}`,
      x: 72,
      y: 72,
      width: 24,
      height: 24,
      maxVelocity: 1.5
    };
    setConstraintZones([...constraintZones, newZone]);
    setSelectedConstraintZoneId(newZone.id);
    setSelectedWaypointIdx(null);
    setSelectedMarkerId(null);
    setSelectedRotationTargetId(null);
  };

  const handleUpdateConstraintZone = (id: string, updates: Partial<ConstraintZone>) => {
    setConstraintZones(constraintZones.map((z) => z.id === id ? { ...z, ...updates } : z));
  };

  const handleDeleteConstraintZone = (id: string) => {
    setConstraintZones(constraintZones.filter((z) => z.id !== id));
    if (selectedConstraintZoneId === id) setSelectedConstraintZoneId(null);
  };

  // Actions for Rotation Targets
  const handleAddRotationTarget = () => {
    const linkedWpIdx = selectedWaypointIdx !== null ? selectedWaypointIdx : 0;
    const wp = waypoints[linkedWpIdx];
    const newTarget: RotationTarget = {
      id: `rot-${Date.now()}`,
      name: `Target ${rotationTargets.length + 1}`,
      x: wp ? Math.min(136, wp.anchor.x + 20) : 72,
      y: wp ? Math.min(136, wp.anchor.y + 20) : 72,
      waypointIndex: linkedWpIdx
    };
    setRotationTargets([...rotationTargets, newTarget]);
    setSelectedRotationTargetId(newTarget.id);
    setSelectedWaypointIdx(null);
    setSelectedMarkerId(null);
    setSelectedConstraintZoneId(null);
  };

  const handleUpdateRotationTarget = (id: string, updates: Partial<RotationTarget>) => {
    setRotationTargets(rotationTargets.map((r) => r.id === id ? { ...r, ...updates } : r));
  };

  const handleDeleteRotationTarget = (id: string) => {
    setRotationTargets(rotationTargets.filter((r) => r.id !== id));
    if (selectedRotationTargetId === id) setSelectedRotationTargetId(null);
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
    const precision = unitMode === "meters" ? 2 : 1;
    return `X: ${dispX.toFixed(precision)}${unitStr}, Y: ${dispY.toFixed(precision)}${unitStr}`;
  };

  const getWaypointHeadingDegrees = (idx: number) => {
    const wp = waypoints[idx];
    if (!wp) return 0;
    let dx = 0;
    let dy = 0;
    if (wp.nextControl) {
      dx = wp.nextControl.x - wp.anchor.x;
      dy = wp.nextControl.y - wp.anchor.y;
    } else if (idx < waypoints.length - 1) {
      dx = waypoints[idx + 1].anchor.x - wp.anchor.x;
      dy = waypoints[idx + 1].anchor.y - wp.anchor.y;
    } else if (wp.prevControl) {
      dx = wp.anchor.x - wp.prevControl.x;
      dy = wp.anchor.y - wp.prevControl.y;
    } else if (idx > 0) {
      dx = wp.anchor.x - waypoints[idx - 1].anchor.x;
      dy = wp.anchor.y - waypoints[idx - 1].anchor.y;
    }
    const rad = Math.atan2(dy, dx);
    let deg = rad * (180 / Math.PI);
    if (deg < 0) deg += 360;
    return deg;
  };

  const getControlLength = (idx: number, type: "prev" | "next") => {
    const wp = waypoints[idx];
    if (!wp) return 0;
    const ctrl = type === "prev" ? wp.prevControl : wp.nextControl;
    if (!ctrl) return 0;
    const dx = ctrl.x - wp.anchor.x;
    const dy = ctrl.y - wp.anchor.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return unitMode === "meters" ? dist * 0.0254 : dist;
  };

  const handleUpdateWaypointAnchor = (idx: number, field: "x" | "y", valStr: string) => {
    const val = parseFloat(valStr);
    if (isNaN(val)) return;

    setWaypoints((prev) => {
      const nextWps = [...prev];
      const wp = { ...nextWps[idx] };
      const anchor = { ...wp.anchor };

      const newInternalVal = unitMode === "meters" ? val / 0.0254 : val;
      const oldInternalVal = field === "x" ? anchor.x : anchor.y;
      const delta = newInternalVal - oldInternalVal;

      if (field === "x") {
        anchor.x = newInternalVal;
        wp.anchor = anchor;
        if (wp.prevControl) wp.prevControl = { x: wp.prevControl.x + delta, y: wp.prevControl.y };
        if (wp.nextControl) wp.nextControl = { x: wp.nextControl.x + delta, y: wp.nextControl.y };
      } else {
        anchor.y = newInternalVal;
        wp.anchor = anchor;
        if (wp.prevControl) wp.prevControl = { x: wp.prevControl.x, y: wp.prevControl.y + delta };
        if (wp.nextControl) wp.nextControl = { x: wp.nextControl.x, y: wp.nextControl.y + delta };
      }

      nextWps[idx] = wp;
      return nextWps;
    });
  };

  const handleUpdateControlLength = (idx: number, type: "prev" | "next", newLenStr: string) => {
    const newLen = parseFloat(newLenStr);
    if (isNaN(newLen) || newLen <= 0) return;
    const internalLen = unitMode === "meters" ? newLen / 0.0254 : newLen;

    setWaypoints((prev) => {
      const nextWps = [...prev];
      const wp = { ...nextWps[idx] };
      const ctrl = type === "prev" ? wp.prevControl : wp.nextControl;
      if (!ctrl) return nextWps;

      const dx = ctrl.x - wp.anchor.x;
      const dy = ctrl.y - wp.anchor.y;
      const currentLen = Math.sqrt(dx * dx + dy * dy);
      if (currentLen === 0) return nextWps;

      const scale = internalLen / currentLen;
      const updatedCtrl = {
        x: wp.anchor.x + dx * scale,
        y: wp.anchor.y + dy * scale
      };

      if (type === "prev") {
        wp.prevControl = updatedCtrl;
        if (wp.nextControl) {
          const mDx = updatedCtrl.x - wp.anchor.x;
          const mDy = updatedCtrl.y - wp.anchor.y;
          wp.nextControl = { x: wp.anchor.x - mDx, y: wp.anchor.y - mDy };
        }
      } else {
        wp.nextControl = updatedCtrl;
        if (wp.prevControl) {
          const mDx = updatedCtrl.x - wp.anchor.x;
          const mDy = updatedCtrl.y - wp.anchor.y;
          wp.prevControl = { x: wp.anchor.x - mDx, y: wp.anchor.y - mDy };
        }
      }
      nextWps[idx] = wp;
      return nextWps;
    });
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
      constraintZones: constraintZones.map((z) => ({
        id: z.id,
        name: z.name,
        x: parseFloat(z.x.toFixed(2)),
        y: parseFloat(z.y.toFixed(2)),
        width: parseFloat(z.width.toFixed(2)),
        height: parseFloat(z.height.toFixed(2)),
        maxVelocity: z.maxVelocity
      })),
      rotationTargets: rotationTargets.map((r) => ({
        id: r.id,
        name: r.name,
        x: parseFloat(r.x.toFixed(2)),
        y: parseFloat(r.y.toFixed(2)),
        waypointIndex: r.waypointIndex
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
          ? "fixed inset-0 z-[9999] bg-obsidian p-6 overflow-y-auto" 
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

          {/* Collapsible Accordion Side Panel */}
          <div className="flex flex-col gap-3">
            
            {/* 1. WAYPOINTS ACCORDION */}
            <div className="bg-black/20 border border-white/5 rounded-xl overflow-hidden shadow-lg">
              <div 
                onClick={() => setIsWaypointsExpanded(!isWaypointsExpanded)}
                className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 cursor-pointer border-b border-white/5 transition-all select-none"
              >
                <div className="flex items-center gap-2">
                  {isWaypointsExpanded ? <ChevronUp size={14} className="text-ares-cyan" /> : <ChevronDown size={14} className="text-marble/40" />}
                  <Compass size={14} className="text-ares-cyan" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">Waypoints</span>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="bg-ares-cyan/15 border border-ares-cyan/35 text-ares-cyan text-[9px] font-mono px-2 py-0.5 rounded-full font-bold">
                    {waypoints.length}
                  </span>
                  <button
                    onClick={handleAddWaypoint}
                    className="p-1 hover:bg-white/10 rounded text-marble/60 hover:text-white cursor-pointer"
                    title="Add waypoint"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              {isWaypointsExpanded && (
                <div className="p-3 flex flex-col gap-2 max-h-[360px] overflow-y-auto">
                  {waypoints.map((wp, idx) => {
                    const isExpanded = !!expandedWaypoints[idx];
                    const isSelected = selectedWaypointIdx === idx;
                    const label = idx === 0 ? "Start Point" : idx === waypoints.length - 1 ? "End Point" : `Waypoint ${idx + 1}`;
                    
                    return (
                      <div 
                        key={idx}
                        className={`border rounded-lg overflow-hidden transition-all duration-300 ${
                          isSelected 
                            ? "bg-ares-red/5 border-ares-red/45" 
                            : "bg-obsidian/30 border-white/5 hover:border-white/15"
                        }`}
                      >
                        {/* Waypoint Card Header */}
                        <div 
                          onClick={() => {
                            setSelectedWaypointIdx(idx);
                            setSelectedMarkerId(null);
                            setExpandedWaypoints(prev => ({ ...prev, [idx]: !prev[idx] }));
                          }}
                          className="flex items-center justify-between px-3 py-2 cursor-pointer bg-white/[0.01] hover:bg-white/[0.04] select-none"
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronUp size={11} className="text-marble/60" /> : <ChevronDown size={11} className="text-marble/35" />}
                            <span className="text-xs font-bold text-white/90">{label}</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button className="p-1 hover:bg-white/5 rounded text-marble/40 hover:text-white cursor-pointer">
                              <Lock size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteWaypoint(idx)}
                              disabled={waypoints.length <= 2}
                              className="p-1 hover:bg-ares-red/10 rounded text-marble/30 hover:text-ares-danger disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                              title="Delete waypoint"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Waypoint Card Content */}
                        {isExpanded && (
                          <div className="p-3 border-t border-white/5 bg-black/20 flex flex-col gap-2.5">
                            <div className="grid grid-cols-3 gap-2">
                              {/* X Position */}
                              <div className="flex flex-col gap-1">
                                <label className="text-[8px] font-mono uppercase text-marble/40 block">X Position ({unitMode === "meters" ? "M" : "In"})</label>
                                <input
                                  type="number"
                                  step="0.001"
                                  value={parseFloat((unitMode === "meters" ? wp.anchor.x * 0.0254 : wp.anchor.x).toFixed(3))}
                                  onChange={(e) => handleUpdateWaypointAnchor(idx, "x", e.target.value)}
                                  className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-red"
                                />
                              </div>
                              {/* Y Position */}
                              <div className="flex flex-col gap-1">
                                <label className="text-[8px] font-mono uppercase text-marble/40 block">Y Position ({unitMode === "meters" ? "M" : "In"})</label>
                                <input
                                  type="number"
                                  step="0.001"
                                  value={parseFloat((unitMode === "meters" ? wp.anchor.y * 0.0254 : wp.anchor.y).toFixed(3))}
                                  onChange={(e) => handleUpdateWaypointAnchor(idx, "y", e.target.value)}
                                  className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-red"
                                />
                              </div>
                              {/* Tangent Heading */}
                              <div className="flex flex-col gap-1">
                                <label className="text-[8px] font-mono uppercase text-marble/40 block">Heading (Deg)</label>
                                <input
                                  type="text"
                                  readOnly
                                  value={`${getWaypointHeadingDegrees(idx).toFixed(1)}°`}
                                  className="w-full bg-obsidian/30 border border-white/5 rounded px-2 py-1 text-[11px] font-mono text-marble/40 select-none focus:outline-none cursor-default"
                                />
                              </div>
                            </div>

                            {/* Control Tangent Lengths */}
                            {(wp.prevControl || wp.nextControl) && (
                              <div className="flex flex-col gap-2 border-t border-white/[0.04] pt-2">
                                {wp.prevControl && (
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-mono uppercase text-marble/40 block">Prev Control Length ({unitMode === "meters" ? "M" : "In"})</label>
                                    <input
                                      type="number"
                                      step="0.001"
                                      value={parseFloat(getControlLength(idx, "prev").toFixed(3))}
                                      onChange={(e) => handleUpdateControlLength(idx, "prev", e.target.value)}
                                      className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-red"
                                    />
                                  </div>
                                )}
                                {wp.nextControl && (
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[8px] font-mono uppercase text-marble/40 block">Next Control Length ({unitMode === "meters" ? "M" : "In"})</label>
                                    <input
                                      type="number"
                                      step="0.001"
                                      value={parseFloat(getControlLength(idx, "next").toFixed(3))}
                                      onChange={(e) => handleUpdateControlLength(idx, "next", e.target.value)}
                                      className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-red"
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. EVENT MARKERS ACCORDION */}
            <div className="bg-black/20 border border-white/5 rounded-xl overflow-hidden shadow-lg">
              <div 
                onClick={() => setIsEventsExpanded(!isEventsExpanded)}
                className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 cursor-pointer border-b border-white/5 transition-all select-none"
              >
                <div className="flex items-center gap-2">
                  {isEventsExpanded ? <ChevronUp size={14} className="text-ares-gold" /> : <ChevronDown size={14} className="text-marble/40" />}
                  <Settings size={14} className="text-ares-gold" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">Event Markers</span>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="bg-ares-gold/15 border border-ares-gold/35 text-ares-gold text-[9px] font-mono px-2 py-0.5 rounded-full font-bold">
                    {markers.length}
                  </span>
                  <button
                    onClick={handleTriggerAddMarker}
                    className="p-1 hover:bg-white/10 rounded text-marble/60 hover:text-white cursor-pointer"
                    title="Add event marker"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              {isEventsExpanded && (
                <div className="p-3 flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                  {markers.map((marker) => {
                    const isSelected = selectedMarkerId === marker.id;
                    return (
                      <div 
                        key={marker.id}
                        className={`border rounded-lg overflow-hidden transition-all duration-300 ${
                          isSelected 
                            ? "bg-ares-gold/[0.02] border-ares-gold/45" 
                            : "bg-obsidian/30 border-white/5 hover:border-white/15"
                        }`}
                      >
                        {/* Event Card Header */}
                        <div 
                          onClick={() => {
                            setSelectedMarkerId(marker.id);
                            setSelectedWaypointIdx(null);
                          }}
                          className="flex items-center justify-between px-3 py-2 cursor-pointer bg-white/[0.01] hover:bg-white/[0.04]"
                        >
                          <div className="flex items-center gap-2 flex-grow">
                            <input
                              type="text"
                              value={marker.name}
                              onChange={(e) => handleUpdateMarker(marker.id, { name: e.target.value })}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-transparent text-white font-bold text-xs focus:outline-none border-b border-transparent focus:border-ares-gold py-0.5"
                            />
                            <span className="text-[10px] text-marble/30 font-mono">({Math.round(marker.progress * 100)}%)</span>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMarker(marker.id);
                            }}
                            className="p-1 hover:bg-ares-red/10 rounded text-marble/30 hover:text-ares-danger cursor-pointer"
                            title="Delete marker"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        {/* Event Card Content */}
                        {isSelected && (
                          <div className="p-3 border-t border-white/5 bg-black/20 flex flex-col gap-3 text-xs">
                            {/* Zoned Event Checkbox */}
                            <div className="flex items-center gap-2">
                              <input 
                                type="checkbox" 
                                id={`zoned-${marker.id}`} 
                                className="accent-ares-gold h-3.5 w-3.5 border border-white/20 bg-obsidian rounded cursor-pointer"
                              />
                              <label htmlFor={`zoned-${marker.id}`} className="text-[10px] uppercase font-mono text-marble/50 cursor-pointer select-none">Zoned Event</label>
                            </div>

                            {/* Position slider */}
                            <div className="flex flex-col gap-1.5">
                              <div className="flex justify-between text-[9px] uppercase font-mono text-marble/40">
                                <span>Position</span>
                                <span className="font-bold text-white">{marker.progress.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  step="1"
                                  value={Math.round(marker.progress * 100)}
                                  onChange={(e) => handleUpdateMarker(marker.id, { progress: parseInt(e.target.value) / 100 })}
                                  className="flex-grow accent-ares-gold h-1 rounded-full cursor-ew-resize bg-black/40"
                                />
                                <span className="bg-obsidian border border-white/10 px-2 py-0.5 rounded font-mono text-[10px] text-white">
                                  {marker.progress.toFixed(2)}
                                </span>
                              </div>
                            </div>

                            {/* Actions Queue */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[8px] font-mono uppercase text-marble/40 block">Actions Queue</label>
                              <div className="flex flex-wrap gap-1 bg-obsidian/45 border border-white/5 p-2 rounded min-h-[40px]">
                                {marker.actions.map((act, aIdx) => (
                                  <span
                                    key={aIdx}
                                    className="bg-ares-gold/10 text-ares-gold text-[9px] font-mono font-bold px-2 py-0.5 rounded border border-ares-gold/20 flex items-center gap-1 select-none"
                                  >
                                    {act}
                                    <span
                                      onClick={() => handleUpdateMarker(marker.id, { actions: marker.actions.filter((_, idx) => idx !== aIdx) })}
                                      className="text-white hover:text-ares-red cursor-pointer font-sans font-black ml-1 text-[8px]"
                                    >
                                      ×
                                    </span>
                                  </span>
                                ))}
                                {marker.actions.length === 0 && (
                                  <span className="text-[10px] text-marble/35 font-mono italic">No actions.</span>
                                )}
                              </div>

                              <div className="flex gap-2 mt-1">
                                <input
                                  type="text"
                                  id={`actionInput-${marker.id}`}
                                  placeholder="ActionName (e.g. LiftUp)"
                                  className="flex-grow bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] text-white focus:outline-none"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const target = e.currentTarget;
                                      if (target.value.trim()) {
                                        handleUpdateMarker(marker.id, { actions: [...marker.actions, target.value.trim()] });
                                        target.value = "";
                                      }
                                    }
                                  }}
                                />
                                <button
                                  onClick={() => {
                                    const input = document.getElementById(`actionInput-${marker.id}`) as HTMLInputElement;
                                    if (input && input.value.trim()) {
                                      handleUpdateMarker(marker.id, { actions: [...marker.actions, input.value.trim()] });
                                      input.value = "";
                                    }
                                  }}
                                  className="px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] text-white font-bold cursor-pointer"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {markers.length === 0 && (
                    <p className="text-[10px] font-mono text-marble/30 text-center italic py-2">No event markers configured.</p>
                  )}
                </div>
              )}
            </div>

            {/* 3. ROTATION TARGETS EDITOR */}
            <div className="bg-black/20 border border-white/5 rounded-xl overflow-hidden shadow-lg">
              <div 
                onClick={() => setIsRotationExpanded(!isRotationExpanded)}
                className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 cursor-pointer border-b border-white/5 transition-all select-none"
              >
                <div className="flex items-center gap-2">
                  {isRotationExpanded ? <ChevronUp size={14} className="text-purple-400" /> : <ChevronDown size={14} className="text-marble/40" />}
                  <Compass size={14} className="text-purple-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">Rotation Targets</span>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="bg-purple-500/15 border border-purple-500/35 text-purple-400 text-[9px] font-mono px-2 py-0.5 rounded-full font-bold">
                    {rotationTargets.length}
                  </span>
                  <button
                    onClick={handleAddRotationTarget}
                    className="p-1 hover:bg-white/10 rounded text-marble/60 hover:text-white cursor-pointer"
                    title="Add rotation target"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
              
              {isRotationExpanded && (
                <div className="p-3 flex flex-col gap-2 max-h-[300px] overflow-y-auto bg-black/5">
                  {rotationTargets.map((rot, idx) => {
                    const isSelected = selectedRotationTargetId === rot.id;
                    return (
                      <div 
                        key={rot.id}
                        className={`border rounded-lg overflow-hidden transition-all duration-300 ${
                          isSelected 
                            ? "bg-purple-500/[0.02] border-purple-500/45" 
                            : "bg-obsidian/30 border-white/5 hover:border-white/15"
                        }`}
                      >
                        {/* Target Header */}
                        <div 
                          onClick={() => {
                            setSelectedRotationTargetId(rot.id);
                            setSelectedWaypointIdx(null);
                            setSelectedMarkerId(null);
                            setSelectedConstraintZoneId(null);
                          }}
                          className="flex items-center justify-between px-3 py-2 cursor-pointer bg-white/[0.01] hover:bg-white/[0.04]"
                        >
                          <div className="flex items-center gap-2 flex-grow">
                            <input
                              type="text"
                              value={rot.name}
                              onChange={(e) => handleUpdateRotationTarget(rot.id, { name: e.target.value })}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-transparent text-white font-bold text-xs focus:outline-none border-b border-transparent focus:border-purple-400 py-0.5"
                            />
                            <span className="text-[10px] text-marble/30 font-mono">(WP {rot.waypointIndex + 1})</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRotationTarget(rot.id);
                            }}
                            className="p-1 hover:bg-ares-red/10 rounded text-marble/30 hover:text-ares-danger cursor-pointer"
                            title="Delete target"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        {/* Target Content */}
                        {isSelected && (
                          <div className="p-3 border-t border-white/5 bg-black/20 flex flex-col gap-2.5 text-xs">
                            <div className="grid grid-cols-2 gap-2">
                              {/* Linked Waypoint */}
                              <div className="flex flex-col gap-1 col-span-2">
                                <label className="text-[8px] font-mono uppercase text-marble/40 block">Link to Waypoint</label>
                                <select
                                  value={rot.waypointIndex}
                                  onChange={(e) => handleUpdateRotationTarget(rot.id, { waypointIndex: parseInt(e.target.value) })}
                                  className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none"
                                >
                                  {waypoints.map((_, wIdx) => (
                                    <option key={wIdx} value={wIdx} className="bg-neutral-900">
                                      {wIdx === 0 ? "Start Point" : wIdx === waypoints.length - 1 ? "End Point" : `Waypoint ${wIdx + 1}`}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Target X */}
                              <div className="flex flex-col gap-1">
                                <label className="text-[8px] font-mono uppercase text-marble/40 block">Target X ({unitMode === "meters" ? "M" : "In"})</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={parseFloat((unitMode === "meters" ? rot.x * 0.0254 : rot.x).toFixed(2))}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) {
                                      handleUpdateRotationTarget(rot.id, { x: unitMode === "meters" ? val / 0.0254 : val });
                                    }
                                  }}
                                  className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-purple-400"
                                />
                              </div>

                              {/* Target Y */}
                              <div className="flex flex-col gap-1">
                                <label className="text-[8px] font-mono uppercase text-marble/40 block">Target Y ({unitMode === "meters" ? "M" : "In"})</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={parseFloat((unitMode === "meters" ? rot.y * 0.0254 : rot.y).toFixed(2))}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) {
                                      handleUpdateRotationTarget(rot.id, { y: unitMode === "meters" ? val / 0.0254 : val });
                                    }
                                  }}
                                  className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-purple-400"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {rotationTargets.length === 0 && (
                    <p className="text-[10px] font-mono text-marble/30 text-center italic py-2">No rotation targets defined.</p>
                  )}
                </div>
              )}
            </div>

            {/* 4. CONSTRAINT ZONES EDITOR */}
            <div className="bg-black/20 border border-white/5 rounded-xl overflow-hidden shadow-lg">
              <div 
                onClick={() => setIsPointZonesExpanded(!isPointZonesExpanded)}
                className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 cursor-pointer border-b border-white/5 transition-all select-none"
              >
                <div className="flex items-center gap-2">
                  {isPointZonesExpanded ? <ChevronUp size={14} className="text-amber-500" /> : <ChevronDown size={14} className="text-marble/40" />}
                  <Compass size={14} className="text-amber-500" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">Constraint Zones</span>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="bg-amber-500/15 border border-amber-500/35 text-amber-500 text-[9px] font-mono px-2 py-0.5 rounded-full font-bold">
                    {constraintZones.length}
                  </span>
                  <button
                    onClick={handleAddConstraintZone}
                    className="p-1 hover:bg-white/10 rounded text-marble/60 hover:text-white cursor-pointer"
                    title="Add constraint zone"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
              
              {isPointZonesExpanded && (
                <div className="p-3 flex flex-col gap-2 max-h-[300px] overflow-y-auto bg-black/5">
                  {constraintZones.map((zone, idx) => {
                    const isSelected = selectedConstraintZoneId === zone.id;
                    return (
                      <div 
                        key={zone.id}
                        className={`border rounded-lg overflow-hidden transition-all duration-300 ${
                          isSelected 
                            ? "bg-amber-500/[0.02] border-amber-500/45" 
                            : "bg-obsidian/30 border-white/5 hover:border-white/15"
                        }`}
                      >
                        {/* Zone Header */}
                        <div 
                          onClick={() => {
                            setSelectedConstraintZoneId(zone.id);
                            setSelectedWaypointIdx(null);
                            setSelectedMarkerId(null);
                            setSelectedRotationTargetId(null);
                          }}
                          className="flex items-center justify-between px-3 py-2 cursor-pointer bg-white/[0.01] hover:bg-white/[0.04]"
                        >
                          <div className="flex items-center gap-2 flex-grow">
                            <input
                              type="text"
                              value={zone.name}
                              onChange={(e) => handleUpdateConstraintZone(zone.id, { name: e.target.value })}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-transparent text-white font-bold text-xs focus:outline-none border-b border-transparent focus:border-amber-500 py-0.5"
                            />
                            <span className="text-[10px] text-marble/30 font-mono">({zone.maxVelocity.toFixed(1)} m/s)</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConstraintZone(zone.id);
                            }}
                            className="p-1 hover:bg-ares-red/10 rounded text-marble/30 hover:text-ares-danger cursor-pointer"
                            title="Delete zone"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        {/* Zone Content */}
                        {isSelected && (
                          <div className="p-3 border-t border-white/5 bg-black/20 flex flex-col gap-2.5 text-xs">
                            <div className="grid grid-cols-2 gap-2">
                              {/* Max Velocity */}
                              <div className="flex flex-col gap-1 col-span-2">
                                <label className="text-[8px] font-mono uppercase text-marble/40 block">Max Speed Limit (m/s)</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={zone.maxVelocity}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) {
                                      handleUpdateConstraintZone(zone.id, { maxVelocity: val });
                                    }
                                  }}
                                  className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-amber-500"
                                />
                              </div>

                              {/* Center X */}
                              <div className="flex flex-col gap-1">
                                <label className="text-[8px] font-mono uppercase text-marble/40 block">Center X ({unitMode === "meters" ? "M" : "In"})</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={parseFloat((unitMode === "meters" ? zone.x * 0.0254 : zone.x).toFixed(2))}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) {
                                      handleUpdateConstraintZone(zone.id, { x: unitMode === "meters" ? val / 0.0254 : val });
                                    }
                                  }}
                                  className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-amber-500"
                                />
                              </div>

                              {/* Center Y */}
                              <div className="flex flex-col gap-1">
                                <label className="text-[8px] font-mono uppercase text-marble/40 block">Center Y ({unitMode === "meters" ? "M" : "In"})</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={parseFloat((unitMode === "meters" ? zone.y * 0.0254 : zone.y).toFixed(2))}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) {
                                      handleUpdateConstraintZone(zone.id, { y: unitMode === "meters" ? val / 0.0254 : val });
                                    }
                                  }}
                                  className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-amber-500"
                                />
                              </div>

                              {/* Width */}
                              <div className="flex flex-col gap-1">
                                <label className="text-[8px] font-mono uppercase text-marble/40 block">Width ({unitMode === "meters" ? "M" : "In"})</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={parseFloat((unitMode === "meters" ? zone.width * 0.0254 : zone.width).toFixed(2))}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) {
                                      handleUpdateConstraintZone(zone.id, { width: unitMode === "meters" ? val / 0.0254 : val });
                                    }
                                  }}
                                  className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-amber-500"
                                />
                              </div>

                              {/* Height */}
                              <div className="flex flex-col gap-1">
                                <label className="text-[8px] font-mono uppercase text-marble/40 block">Height ({unitMode === "meters" ? "M" : "In"})</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={parseFloat((unitMode === "meters" ? zone.height * 0.0254 : zone.height).toFixed(2))}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (!isNaN(val)) {
                                      handleUpdateConstraintZone(zone.id, { height: unitMode === "meters" ? val / 0.0254 : val });
                                    }
                                  }}
                                  className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-amber-500"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {constraintZones.length === 0 && (
                    <p className="text-[10px] font-mono text-marble/30 text-center italic py-2">No constraint zones configured.</p>
                  )}
                </div>
              )}
            </div>

            {/* 5. IDEAL STARTING STATE PLACEHOLDER */}
            <div className="bg-black/20 border border-white/5 rounded-xl overflow-hidden shadow-lg">
              <div 
                onClick={() => setIsStartingStateExpanded(!isStartingStateExpanded)}
                className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 cursor-pointer border-b border-white/5 transition-all select-none"
              >
                <div className="flex items-center gap-2">
                  {isStartingStateExpanded ? <ChevronUp size={14} className="text-marble/60" /> : <ChevronDown size={14} className="text-marble/40" />}
                  <Link size={14} className="text-marble/40" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">Ideal Starting State</span>
                </div>
                <span className="text-[9px] font-mono text-marble/50 bg-black/30 border border-white/5 px-2 py-0.5 rounded">
                  0.00° starting with 0.00 M/S
                </span>
              </div>
              {isStartingStateExpanded && (
                <div className="p-3 text-[10px] font-mono text-marble/30 text-center italic bg-black/10">
                  Starting configuration matches ideal coordinates.
                </div>
              )}
            </div>

            {/* 6. GOAL END STATE PLACEHOLDER */}
            <div className="bg-black/20 border border-white/5 rounded-xl overflow-hidden shadow-lg">
              <div 
                onClick={() => setIsEndStateExpanded(!isEndStateExpanded)}
                className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 cursor-pointer border-b border-white/5 transition-all select-none"
              >
                <div className="flex items-center gap-2">
                  {isEndStateExpanded ? <ChevronUp size={14} className="text-marble/60" /> : <ChevronDown size={14} className="text-marble/40" />}
                  <Link size={14} className="text-marble/40" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">Goal End State</span>
                </div>
                <span className="text-[9px] font-mono text-marble/50 bg-black/30 border border-white/5 px-2 py-0.5 rounded">
                  0.00° ending with 0.00 M/S
                </span>
              </div>
              {isEndStateExpanded && (
                <div className="p-3 text-[10px] font-mono text-marble/30 text-center italic bg-black/10">
                  Goal velocity set to zero at end node.
                </div>
              )}
            </div>

          </div>

          {/* Card 3: Cloud Sync / Saving */}
          {onSaveToCloud && (
            <div className="bg-black/20 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
              <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-cyan flex items-center gap-1.5">
                <FolderOpen size={14} /> Cloud Workspace
              </h3>

              <div className="flex gap-2">
                <button
                  onClick={() => onSaveToCloud(pathName, season, waypoints, markers, constraintZones, rotationTargets)}
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
