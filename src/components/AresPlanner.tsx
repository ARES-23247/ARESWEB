"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Minimize2 } from "lucide-react";

// Types
import { Waypoint, EventMarker, ConstraintZone, RotationTarget, AresPlannerProps } from "../types/planner";
export type { Waypoint, EventMarker, ConstraintZone, RotationTarget };

// Helper math and serializers
import { generateBezierPath } from "../lib/planner/bezierMath";
import { computeTrajectoryAnalytics } from "../lib/planner/trajectoryAnalytics";
import { mirrorPath, rotatePath } from "../lib/planner/pathTransforms";
import { serializePath, deserializePath } from "../lib/planner/pathSerializer";

// Custom hooks
import { usePlannerDrag } from "../hooks/planner/usePlannerDrag";
import { usePlannerKeyboard } from "../hooks/planner/usePlannerKeyboard";
import { usePlannerCanvas } from "../hooks/planner/usePlannerCanvas";
import { useRobotSync } from "../hooks/planner/useRobotSync";

// Sub-components
import PlannerHeaderBar from "./planner/PlannerHeaderBar";
import FieldSettingsCard from "./planner/FieldSettingsCard";
import PathTransformsCard from "./planner/PathTransformsCard";
import WaypointsAccordion from "./planner/WaypointsAccordion";
import EventMarkersAccordion from "./planner/EventMarkersAccordion";
import RotationTargetsAccordion from "./planner/RotationTargetsAccordion";
import ConstraintZonesAccordion from "./planner/ConstraintZonesAccordion";
import KinematicsPanel from "./planner/KinematicsPanel";
import StartEndStatePanel from "./planner/StartEndStatePanel";
import CloudSyncCard from "./planner/CloudSyncCard";
import RobotSyncCard from "./planner/RobotSyncCard";
import PlannerBottomBar from "./planner/PlannerBottomBar";

export default function AresPlanner({
  initialPathData,
  cloudPaths = [],
  onSaveToCloud,
  onLoadPath,
  isSavingCloud = false,
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

  // Kinematics and start/end states
  const [maxVelocity, setMaxVelocity] = useState(3.0);
  const [maxAcceleration, setMaxAcceleration] = useState(3.0);
  const [maxAngularVelocity, setMaxAngularVelocity] = useState(270.0);
  const [maxAngularAcceleration, setMaxAngularAcceleration] = useState(270.0);
  const [startVelocity, setStartVelocity] = useState(0.0);
  const [startHeading, setStartHeading] = useState(0.0);
  const [endVelocity, setEndVelocity] = useState(0.0);
  const [endHeading, setEndHeading] = useState(0.0);
  const [isKinematicsExpanded, setIsKinematicsExpanded] = useState(false);
  const [lockedWaypoints, setLockedWaypoints] = useState<Record<number, boolean>>({});

  const toggleLockWaypoint = (idx: number) => {
    setLockedWaypoints((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Sidebar accordion expansion states
  const [isWaypointsExpanded, setIsWaypointsExpanded] = useState(true);
  const [isEventsExpanded, setIsEventsExpanded] = useState(true);
  const [isRotationExpanded, setIsRotationExpanded] = useState(false);
  const [isPointZonesExpanded, setIsPointZonesExpanded] = useState(false);
  const [isStartingStateExpanded, setIsStartingStateExpanded] = useState(false);
  const [isEndStateExpanded, setIsEndStateExpanded] = useState(false);

  // Expanded individual waypoints
  const [expandedWaypoints, setExpandedWaypoints] = useState<Record<number, boolean>>({ 0: true });

  // Lock body scroll when zen mode is active to prevent scroll to footer, and listen to Escape key
  useEffect(() => {
    if (isZenMode) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isZenMode) {
        setIsZenMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
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

  // Core data arrays
  const [waypoints, setWaypoints] = useState<Waypoint[]>([
    { anchor: { x: 24, y: 120 }, prevControl: null, nextControl: { x: 48, y: 100 } },
    { anchor: { x: 72, y: 72 }, prevControl: { x: 60, y: 84 }, nextControl: { x: 84, y: 60 } },
    { anchor: { x: 120, y: 24 }, prevControl: { x: 100, y: 36 }, nextControl: null },
  ]);

  const [markers, setMarkers] = useState<EventMarker[]>([
    { id: "1", name: "Intake Down", progress: 0.15, actions: ["LowerIntake", "StartRoller"] },
    { id: "2", name: "Outtake Score", progress: 0.85, actions: ["RaiseSlide", "OpenClaw"] },
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

      setMaxVelocity(initialPathData.maxVelocity ?? 3.0);
      setMaxAcceleration(initialPathData.maxAcceleration ?? 3.0);
      setMaxAngularVelocity(initialPathData.maxAngularVelocity ?? 270.0);
      setMaxAngularAcceleration(initialPathData.maxAngularAcceleration ?? 270.0);
      setStartVelocity(initialPathData.startVelocity ?? 0.0);
      setStartHeading(initialPathData.startHeading ?? 0.0);
      setEndVelocity(initialPathData.endVelocity ?? 0.0);
      setEndHeading(initialPathData.endHeading ?? 0.0);
      setLockedWaypoints({});
    }
  }, [initialPathData]);

  // Spline values reference for rendering loops
  const waypointsRef = useRef<Waypoint[]>(waypoints);
  const markersRef = useRef<EventMarker[]>(markers);
  const constraintZonesRef = useRef<ConstraintZone[]>(constraintZones);
  const rotationTargetsRef = useRef<RotationTarget[]>(rotationTargets);
  const selectedConstraintZoneIdRef = useRef<string | null>(selectedConstraintZoneId);
  const selectedRotationTargetIdRef = useRef<string | null>(selectedRotationTargetId);

  const pathRef = useRef<{ x: number; y: number }[]>([]);
  const robotRef = useRef({ progress: 0, x: 24, y: 120, heading: 0 });
  const isPlayingRef = useRef(isPlaying);

  // Keep references updated
  useEffect(() => {
    waypointsRef.current = waypoints;
  }, [waypoints]);
  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);
  useEffect(() => {
    constraintZonesRef.current = constraintZones;
  }, [constraintZones]);
  useEffect(() => {
    rotationTargetsRef.current = rotationTargets;
  }, [rotationTargets]);
  useEffect(() => {
    selectedConstraintZoneIdRef.current = selectedConstraintZoneId;
  }, [selectedConstraintZoneId]);
  useEffect(() => {
    selectedRotationTargetIdRef.current = selectedRotationTargetId;
  }, [selectedRotationTargetId]);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Compute actual spline points
  useEffect(() => {
    pathRef.current = generateBezierPath(waypoints);
  }, [waypoints]);

  const lockedWaypointsRef = useRef<Record<number, boolean>>(lockedWaypoints);
  useEffect(() => {
    lockedWaypointsRef.current = lockedWaypoints;
  }, [lockedWaypoints]);

  const trajectoryAnalytics = useMemo(() => {
    return computeTrajectoryAnalytics(
      waypoints,
      constraintZones,
      maxVelocity,
      maxAcceleration,
      startVelocity,
      endVelocity
    );
  }, [waypoints, constraintZones, maxVelocity, maxAcceleration, startVelocity, endVelocity]);

  const trajectoryAnalyticsRef = useRef(trajectoryAnalytics);
  useEffect(() => {
    trajectoryAnalyticsRef.current = trajectoryAnalytics;
  }, [trajectoryAnalytics]);

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

  // Waypoint deletions
  const handleDeleteWaypoint = (idx: number) => {
    if (waypoints.length <= 2) return; // Keep minimum 2 points
    if (lockedWaypoints[idx]) return;
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
    const newAnchor = {
      x: Math.min(136, lastWp.anchor.x + 24),
      y: Math.max(8, lastWp.anchor.y - 24),
    };
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
      nextControl: null,
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
    setMarkers(markers.map((m) => (m.id === id ? { ...m, ...updates } : m)));
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
      maxVelocity: 1.5,
    };
    setConstraintZones([...constraintZones, newZone]);
    setSelectedConstraintZoneId(newZone.id);
    setSelectedWaypointIdx(null);
    setSelectedMarkerId(null);
    setSelectedRotationTargetId(null);
  };

  const handleUpdateConstraintZone = (id: string, updates: Partial<ConstraintZone>) => {
    setConstraintZones(constraintZones.map((z) => (z.id === id ? { ...z, ...updates } : z)));
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
      waypointIndex: linkedWpIdx,
    };
    setRotationTargets([...rotationTargets, newTarget]);
    setSelectedRotationTargetId(newTarget.id);
    setSelectedWaypointIdx(null);
    setSelectedMarkerId(null);
    setSelectedConstraintZoneId(null);
  };

  const handleUpdateRotationTarget = (id: string, updates: Partial<RotationTarget>) => {
    setRotationTargets(rotationTargets.map((r) => (r.id === id ? { ...r, ...updates } : r)));
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

  const handleUpdateWaypointHeading = (idx: number, valStr: string) => {
    if (lockedWaypoints[idx]) return;
    const val = parseFloat(valStr);
    if (isNaN(val)) return;

    setWaypoints((prev) => {
      const nextWps = [...prev];
      const wp = { ...nextWps[idx] };
      const rad = val * (Math.PI / 180);

      // Determine which control point to rotate
      if (wp.nextControl) {
        const dx = wp.nextControl.x - wp.anchor.x;
        const dy = wp.nextControl.y - wp.anchor.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        wp.nextControl = {
          x: wp.anchor.x + len * Math.cos(rad),
          y: wp.anchor.y + len * Math.sin(rad),
        };

        // Mirror to prevControl for C1 continuity
        if (wp.prevControl) {
          wp.prevControl = {
            x: wp.anchor.x - len * Math.cos(rad),
            y: wp.anchor.y - len * Math.sin(rad),
          };
        }
      } else if (wp.prevControl) {
        const dx = wp.anchor.x - wp.prevControl.x;
        const dy = wp.anchor.y - wp.prevControl.y;
        const len = Math.sqrt(dx * dx + dy * dy);

        // Prev control is in the opposite direction of path tangent
        wp.prevControl = {
          x: wp.anchor.x - len * Math.cos(rad),
          y: wp.anchor.y - len * Math.sin(rad),
        };
      }

      nextWps[idx] = wp;
      return nextWps;
    });
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
    if (lockedWaypoints[idx]) return;
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
    if (lockedWaypoints[idx]) return;
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
        y: wp.anchor.y + dy * scale,
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

  const handleMirror = (axis: "x" | "y") => {
    const transformed = mirrorPath(
      axis,
      waypoints,
      rotationTargets,
      constraintZones,
      startHeading,
      endHeading
    );
    setWaypoints(transformed.waypoints);
    setRotationTargets(transformed.rotationTargets);
    setConstraintZones(transformed.constraintZones);
    setStartHeading(transformed.startHeading);
    setEndHeading(transformed.endHeading);
  };

  const handleRotate = (angleDeg: number) => {
    const transformed = rotatePath(
      angleDeg,
      waypoints,
      rotationTargets,
      constraintZones,
      startHeading,
      endHeading
    );
    setWaypoints(transformed.waypoints);
    setRotationTargets(transformed.rotationTargets);
    setConstraintZones(transformed.constraintZones);
    setStartHeading(transformed.startHeading);
    setEndHeading(transformed.endHeading);
  };

  // JSON Exporter
  const handleExportJSON = () => {
    const jsonStr = serializePath(
      pathName,
      season,
      waypoints,
      markers,
      constraintZones,
      rotationTargets,
      maxVelocity,
      maxAcceleration,
      maxAngularVelocity,
      maxAngularAcceleration,
      startVelocity,
      startHeading,
      endVelocity,
      endHeading
    );

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonStr);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${pathName.toLowerCase().replace(/\s+/g, "_")}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // JSON Importer
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = deserializePath(event.target?.result as string);
          setPathName(data.name);
          setSeason(data.season);
          setWaypoints(data.waypoints);
          setMarkers(data.markers);
          setConstraintZones(data.constraintZones);
          setRotationTargets(data.rotationTargets);
          setLockedWaypoints({});

          setMaxVelocity(data.maxVelocity);
          setMaxAcceleration(data.maxAcceleration);
          setMaxAngularVelocity(data.maxAngularVelocity);
          setMaxAngularAcceleration(data.maxAngularAcceleration);
          setStartVelocity(data.startVelocity);
          setStartHeading(data.startHeading);
          setEndVelocity(data.endVelocity);
          setEndHeading(data.endHeading);
        } catch (err) {
          console.error("Failed to parse imported path JSON:", err);
          alert("Invalid path JSON file.");
        }
      };
      reader.readAsText(file);
    }
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

  // Hook 1: Robot Wifi/ADB sync
  const {
    robotIp,
    setRobotIp,
    syncStatus,
    syncLog,
    copiedCmd,
    handleSyncToRobot,
    adbPushCmd,
    copyAdbCmd,
  } = useRobotSync({
    pathName,
    season,
    waypoints,
    markers,
    constraintZones,
    rotationTargets,
    maxVelocity,
    maxAcceleration,
    maxAngularVelocity,
    maxAngularAcceleration,
    startVelocity,
    startHeading,
    endVelocity,
    endHeading,
  });

  // Hook 2: Pointer drag gestures
  const { handlePointerDown, handlePointerMove, handlePointerUp } = usePlannerDrag({
    canvasRef,
    canvasDim,
    waypoints,
    setWaypoints,
    markers,
    setMarkers,
    constraintZones,
    setConstraintZones,
    rotationTargets,
    setRotationTargets,
    lockedWaypoints,
    isAddingMarker,
    setIsAddingMarker,
    pathRef,
    setSelectedWaypointIdx,
    setSelectedMarkerId,
    setSelectedRotationTargetId,
    setSelectedConstraintZoneId,
    setIsPlaying,
  });

  // Hook 3: Keyboard controls
  const { handleCanvasKeyDown } = usePlannerKeyboard({
    selectedWaypointIdx,
    setSelectedWaypointIdx,
    waypoints,
    lockedWaypoints,
    handleUpdateWaypointAnchor,
  });

  // Hook 4: Canvas rendering loop
  usePlannerCanvas({
    canvasRef,
    canvasDim,
    season,
    customBgImage,
    selectedWaypointIdx,
    selectedMarkerId,
    selectedConstraintZoneId,
    selectedRotationTargetId,
    decodeDarkImage,
    decodeLightImage,
    waypointsRef,
    markersRef,
    constraintZonesRef,
    rotationTargetsRef,
    pathRef,
    robotRef,
    isPlaying,
    isPlayingRef,
    setIsPlaying,
    lockedWaypointsRef,
    trajectoryAnalyticsRef,
    maxVelocity,
    startHeading,
    endHeading,
  });

  return (
    <div
      ref={containerRef}
      className={`w-full flex flex-col gap-6 p-4 rounded-xl border border-white/10 ${
        isZenMode
          ? "fixed inset-0 z-[9999] bg-obsidian p-6 overflow-y-auto"
          : "glass-card max-w-5xl mx-auto"
      }`}
    >
      {/* Floating minimize button for fullscreen/zen mode */}
      {isZenMode && (
        <button
          onClick={() => setIsZenMode(false)}
          className="fixed top-6 right-6 z-[10000] p-3 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/10 shadow-2xl cursor-pointer transition-all duration-300 flex items-center justify-center hover:scale-105"
          title="Exit Fullscreen (Esc)"
        >
          <Minimize2 size={16} />
        </button>
      )}

      {/* Top Header Bar */}
      <PlannerHeaderBar
        pathName={pathName}
        setPathName={setPathName}
        originMode={originMode}
        setOriginMode={setOriginMode}
        unitMode={unitMode}
        setUnitMode={setUnitMode}
        isZenMode={isZenMode}
        setIsZenMode={setIsZenMode}
      />

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
              onKeyDown={handleCanvasKeyDown}
              tabIndex={0}
              role="img"
              aria-label="Interactive 2D Path Planner. Press Arrow keys to move selected waypoint. Press Tab to cycle through waypoints, and Escape to deselect."
              className="block cursor-crosshair select-none touch-none max-w-full rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              style={{ width: `${canvasDim}px`, height: `${canvasDim}px` }}
            />
            {/* Overlay Cursor coordinates tracking */}
            <div className="absolute bottom-4 left-4 bg-obsidian/90 border border-white/10 px-2.5 py-1.5 rounded text-[10px] font-mono text-white select-none shadow">
              <span className="text-marble/40 uppercase">Robot Pos: </span>
              {getCoordinatesDisplay(robotRef.current.x, robotRef.current.y)}
            </div>
            {/* Overlay Trajectory Analytics */}
            <div className="absolute top-4 right-4 bg-obsidian/90 border border-white/10 px-2.5 py-1.5 rounded text-[10px] font-mono text-white select-none shadow flex flex-col gap-0.5">
              <div>
                <span className="text-marble/40 uppercase">Length: </span>
                <span className="text-ares-cyan font-bold">
                  {unitMode === "meters"
                    ? `${(trajectoryAnalytics.length * 0.0254).toFixed(2)} m`
                    : `${trajectoryAnalytics.length.toFixed(1)} in`}
                </span>
              </div>
              <div>
                <span className="text-marble/40 uppercase">Est. Time: </span>
                <span className="text-ares-gold font-bold">
                  {trajectoryAnalytics.duration.toFixed(2)}s
                </span>
              </div>
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
          <FieldSettingsCard
            season={season}
            setSeason={setSeason}
            customBgName={customBgName}
            handleCustomBgUpload={handleCustomBgUpload}
          />

          {/* Path Transforms Utility Card */}
          <PathTransformsCard handleMirror={handleMirror} handleRotate={handleRotate} />

          {/* Collapsible Accordion Side Panel */}
          <div className="flex flex-col gap-3">
            {/* 1. WAYPOINTS ACCORDION */}
            <WaypointsAccordion
              waypoints={waypoints}
              expandedWaypoints={expandedWaypoints}
              setExpandedWaypoints={setExpandedWaypoints}
              selectedWaypointIdx={selectedWaypointIdx}
              setSelectedWaypointIdx={setSelectedWaypointIdx}
              setSelectedMarkerId={setSelectedMarkerId}
              lockedWaypoints={lockedWaypoints}
              toggleLockWaypoint={toggleLockWaypoint}
              handleDeleteWaypoint={handleDeleteWaypoint}
              handleAddWaypoint={handleAddWaypoint}
              unitMode={unitMode}
              handleUpdateWaypointAnchor={handleUpdateWaypointAnchor}
              handleUpdateWaypointHeading={handleUpdateWaypointHeading}
              handleUpdateControlLength={handleUpdateControlLength}
              getWaypointHeadingDegrees={getWaypointHeadingDegrees}
              getControlLength={getControlLength}
              isWaypointsExpanded={isWaypointsExpanded}
              setIsWaypointsExpanded={setIsWaypointsExpanded}
            />

            {/* 2. EVENT MARKERS ACCORDION */}
            <EventMarkersAccordion
              markers={markers}
              selectedMarkerId={selectedMarkerId}
              setSelectedMarkerId={setSelectedMarkerId}
              setSelectedWaypointIdx={setSelectedWaypointIdx}
              setSelectedRotationTargetId={setSelectedRotationTargetId}
              setSelectedConstraintZoneId={setSelectedConstraintZoneId}
              handleDeleteMarker={handleDeleteMarker}
              handleUpdateMarker={handleUpdateMarker}
              handleTriggerAddMarker={handleTriggerAddMarker}
              isEventsExpanded={isEventsExpanded}
              setIsEventsExpanded={setIsEventsExpanded}
            />

            {/* 3. ROTATION TARGETS EDITOR */}
            <RotationTargetsAccordion
              rotationTargets={rotationTargets}
              selectedRotationTargetId={selectedRotationTargetId}
              setSelectedRotationTargetId={setSelectedRotationTargetId}
              setSelectedWaypointIdx={setSelectedWaypointIdx}
              setSelectedMarkerId={setSelectedMarkerId}
              setSelectedConstraintZoneId={setSelectedConstraintZoneId}
              handleAddRotationTarget={handleAddRotationTarget}
              handleUpdateRotationTarget={handleUpdateRotationTarget}
              handleDeleteRotationTarget={handleDeleteRotationTarget}
              waypoints={waypoints}
              unitMode={unitMode}
              isRotationExpanded={isRotationExpanded}
              setIsRotationExpanded={setIsRotationExpanded}
            />

            {/* 4. CONSTRAINT ZONES EDITOR */}
            <ConstraintZonesAccordion
              constraintZones={constraintZones}
              selectedConstraintZoneId={selectedConstraintZoneId}
              setSelectedConstraintZoneId={setSelectedConstraintZoneId}
              setSelectedWaypointIdx={setSelectedWaypointIdx}
              setSelectedMarkerId={setSelectedMarkerId}
              setSelectedRotationTargetId={setSelectedRotationTargetId}
              handleAddConstraintZone={handleAddConstraintZone}
              handleUpdateConstraintZone={handleUpdateConstraintZone}
              handleDeleteConstraintZone={handleDeleteConstraintZone}
              unitMode={unitMode}
              isPointZonesExpanded={isPointZonesExpanded}
              setIsPointZonesExpanded={setIsPointZonesExpanded}
            />

            {/* Robot Kinematics Panel */}
            <KinematicsPanel
              maxVelocity={maxVelocity}
              setMaxVelocity={setMaxVelocity}
              maxAcceleration={maxAcceleration}
              setMaxAcceleration={setMaxAcceleration}
              maxAngularVelocity={maxAngularVelocity}
              setMaxAngularVelocity={setMaxAngularVelocity}
              maxAngularAcceleration={maxAngularAcceleration}
              setMaxAngularAcceleration={setMaxAngularAcceleration}
              isKinematicsExpanded={isKinematicsExpanded}
              setIsKinematicsExpanded={setIsKinematicsExpanded}
            />

            {/* Ideal Starting & Goal End States Panel */}
            <StartEndStatePanel
              waypoints={waypoints}
              lockedWaypoints={lockedWaypoints}
              startVelocity={startVelocity}
              setStartVelocity={setStartVelocity}
              startHeading={startHeading}
              setStartHeading={setStartHeading}
              endVelocity={endVelocity}
              setEndVelocity={setEndVelocity}
              endHeading={endHeading}
              setEndHeading={setEndHeading}
              unitMode={unitMode}
              handleUpdateWaypointAnchor={handleUpdateWaypointAnchor}
              isStartingStateExpanded={isStartingStateExpanded}
              setIsStartingStateExpanded={setIsStartingStateExpanded}
              isEndStateExpanded={isEndStateExpanded}
              setIsEndStateExpanded={setIsEndStateExpanded}
            />
          </div>

          {/* Card 3: Cloud Workspace Card */}
          <CloudSyncCard
            pathName={pathName}
            season={season}
            waypoints={waypoints}
            markers={markers}
            constraintZones={constraintZones}
            rotationTargets={rotationTargets}
            maxVelocity={maxVelocity}
            maxAcceleration={maxAcceleration}
            maxAngularVelocity={maxAngularVelocity}
            maxAngularAcceleration={maxAngularAcceleration}
            startVelocity={startVelocity}
            startHeading={startHeading}
            endVelocity={endVelocity}
            endHeading={endHeading}
            cloudPaths={cloudPaths}
            onSaveToCloud={onSaveToCloud}
            onLoadPath={onLoadPath}
            isSavingCloud={isSavingCloud}
          />

          {/* Card 4: Local Robot Sync panel */}
          <RobotSyncCard
            robotIp={robotIp}
            setRobotIp={setRobotIp}
            syncStatus={syncStatus}
            syncLog={syncLog}
            copiedCmd={copiedCmd}
            handleSyncToRobot={handleSyncToRobot}
            adbPushCmd={adbPushCmd}
            copyAdbCmd={copyAdbCmd}
          />
        </div>
      </div>

      {/* Control Buttons bottom bar */}
      <PlannerBottomBar
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        handleImportJSON={handleImportJSON}
        handleExportJSON={handleExportJSON}
      />
    </div>
  );
}
