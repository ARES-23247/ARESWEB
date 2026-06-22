"use client";

import React, { useRef, useEffect, useState } from "react";
import { useScopeStore } from "../store/scopeStore";
import { Move, Compass, Eye, Map } from "lucide-react";
import * as THREE from "three";
import { setupThreeScene } from "../utils/threeSceneSetup";
import { createRobotModel, createComparisonRobotModel } from "../utils/robotMeshLoader";
import { drawTactical2D } from "../utils/drawTactical2D";
import { getCameraPoses, getSwerveAngles } from "../utils/poseUtils";
import { useKeyboardController } from "../hooks/useKeyboardController";

export default function WebGLReplayCanvas() {
  const { 
    telemetryData, 
    comparisonTelemetryData, 
    currentTimeMs, 
    setCurrentTimeMs,
    getCurrentFrame, 
    getCurrentComparisonFrame, 
    plannedPath, 
    driveMode, 
    setDriveMode,
    fieldObstacles,
    fieldElements,
    fieldElementTypes,
    fieldCadUrl,
    fieldBgImageUrl,
    ntClient
  } = useScopeStore();
  const [viewMode, setViewMode] = useState<"2d" | "3d">("3d");
  const [showFov, setShowFov] = useState<boolean>(true);
  const [parentDimensions, setParentDimensions] = useState({ width: 360, height: 360 });

  const currentFrame = getCurrentFrame();

  // --- WEB KEYBOARD CONTROLLER FOR SIMULATOR ---
  useKeyboardController(ntClient, currentFrame, fieldObstacles);
  
  const canvas2DRef = useRef<HTMLCanvasElement | null>(null);
  const container3DRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // ResizeObserver to detect layout sizes dynamically (handling grid resizes & window scaling)
  useEffect(() => {
    const parent = canvas2DRef.current?.parentElement || container3DRef.current?.parentElement;
    if (!parent) return;

    const handleResize = () => {
      setParentDimensions({
        width: parent.clientWidth || 360,
        height: parent.clientHeight || 360
      });
    };

    handleResize();

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(parent);

    window.addEventListener("resize", handleResize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [viewMode]);

  // Load background image from fieldBgImageUrl
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [bgImageLoaded, setBgImageLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (!fieldBgImageUrl) {
      setBgImage(null);
      setBgImageLoaded(false);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setBgImage(img);
      setBgImageLoaded(true);
    };
    img.onerror = () => {
      console.warn("[WebGLReplayCanvas] Failed to load background image:", fieldBgImageUrl);
      setBgImage(null);
      setBgImageLoaded(false);
    };
    img.src = fieldBgImageUrl;
  }, [fieldBgImageUrl]);

  // Handle 3D Renderer and Camera aspect ratios dynamically when parentDimensions updates
  useEffect(() => {
    if (viewMode !== "3d" || !rendererRef.current || !cameraRef.current || !container3DRef.current) return;
    const w = parentDimensions.width;
    const h = parentDimensions.height;
    cameraRef.current.aspect = w / h;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(w, h);
  }, [parentDimensions, viewMode]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
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

  // Three.js instances stored in refs to avoid re-creation
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const robotGroupRef = useRef<THREE.Group | null>(null);
  const comparisonRobotGroupRef = useRef<THREE.Group | null>(null);
  const slideCarriageRef = useRef<THREE.Mesh | null>(null);
  const intakeArmRef = useRef<THREE.Mesh | null>(null);
  const trailLineRef = useRef<THREE.Line | null>(null);
  const comparisonTrailLineRef = useRef<THREE.Line | null>(null);
  const plannedPathLineRef = useRef<THREE.Line | null>(null);
  const cameraFovGroupsRef = useRef<THREE.Group[]>([]);

  // Wheel module group refs for Swerve steering pivots
  const moduleLFRef = useRef<THREE.Group | null>(null);
  const moduleRFRef = useRef<THREE.Group | null>(null);
  const moduleBLRef = useRef<THREE.Group | null>(null);
  const moduleBRRef = useRef<THREE.Group | null>(null);

  // ─── 2D TACTICAL VIEW RENDER ENGINE ───
  useEffect(() => {
    if (viewMode !== "2d") return;
    const canvas = canvas2DRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(parentDimensions.width, parentDimensions.height);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    drawTactical2D({
      ctx,
      parentDimensions: { width: size, height: size },
      bgImage,
      bgImageLoaded,
      fieldObstacles,
      plannedPath,
      telemetryData,
      comparisonTelemetryData,
      currentTimeMs,
      currentFrame,
      comparisonFrame: getCurrentComparisonFrame(),
      driveMode,
      showFov,
    });
  }, [
    viewMode,
    telemetryData,
    comparisonTelemetryData,
    currentTimeMs,
    currentFrame,
    driveMode,
    showFov,
    fieldObstacles,
    parentDimensions,
    bgImage,
    bgImageLoaded,
    getCurrentComparisonFrame
  ]);

  // ─── 3D ARENA VIEW RENDER ENGINE (THREE.JS) ───
  useEffect(() => {
    if (viewMode !== "3d") return;
    const container = container3DRef.current;
    if (!container) return;

    // 1. Initialise Scene, Camera, Renderer
    const { scene, camera, renderer, cleanup } = setupThreeScene(
      container,
      fieldCadUrl,
      fieldObstacles,
      fieldElements,
      fieldElementTypes
    );
    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;

    // 6. 3D Robot Model Group
    const {
      robotGroup,
      moduleLF,
      moduleRF,
      moduleBL,
      moduleBR,
      slideCarriage,
      intakeArm
    } = createRobotModel();
    robotGroupRef.current = robotGroup;
    moduleLFRef.current = moduleLF;
    moduleRFRef.current = moduleRF;
    moduleBLRef.current = moduleBL;
    moduleBRRef.current = moduleBR;
    slideCarriageRef.current = slideCarriage;
    intakeArmRef.current = intakeArm;
    scene.add(robotGroup);

    // 7. Trails
    const trailGeo = new THREE.BufferGeometry();
    const trailMat = new THREE.LineBasicMaterial({ color: 0xFFB81C, linewidth: 2 });
    const trail = new THREE.Line(trailGeo, trailMat);
    scene.add(trail);
    trailLineRef.current = trail;

    const compTrailGeo = new THREE.BufferGeometry();
    const compTrailMat = new THREE.LineDashedMaterial({ 
      color: 0xC00000,
      linewidth: 1.5,
      dashSize: 0.1,
      gapSize: 0.08,
      transparent: true,
      opacity: 0.6
    });
    const compTrail = new THREE.Line(compTrailGeo, compTrailMat);
    scene.add(compTrail);
    comparisonTrailLineRef.current = compTrail;

    const plannedTrailGeo = new THREE.BufferGeometry();
    const plannedTrailMat = new THREE.LineDashedMaterial({ 
      color: 0x00E5FF,
      linewidth: 1.5,
      dashSize: 3,
      gapSize: 2
    });
    const plannedTrail = new THREE.Line(plannedTrailGeo, plannedTrailMat);
    scene.add(plannedTrail);
    plannedPathLineRef.current = plannedTrail;

    // 7.5 3D Comparison Ghost Robot Model Group
    const compRobot = createComparisonRobotModel();
    comparisonRobotGroupRef.current = compRobot;
    scene.add(compRobot);

    // 8. Animation loop
    let active = true;
    const animate = () => {
      if (!active) return;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    return () => {
      active = false;
      cleanup();
    };
  }, [viewMode, fieldObstacles, fieldElements, fieldElementTypes, fieldCadUrl]);

  // ─── 3D TELEMETRY SYNCHRONIZATION KINEMATICS ───
  useEffect(() => {
    if (viewMode !== "3d" || !sceneRef.current) return;

    const robot = robotGroupRef.current;
    if (robot && currentFrame) {
      robot.position.x = -currentFrame.y;
      robot.position.z = -currentFrame.x;
      robot.rotation.y = currentFrame.heading;

      // Swerve module steering orientations
      const swerveAngles = getSwerveAngles(currentFrame);
      if (driveMode === "swerve") {
        if (moduleLFRef.current) moduleLFRef.current.rotation.y = swerveAngles.fl;
        if (moduleRFRef.current) moduleRFRef.current.rotation.y = swerveAngles.fr;
        if (moduleBLRef.current) moduleBLRef.current.rotation.y = swerveAngles.bl;
        if (moduleBRRef.current) moduleBRRef.current.rotation.y = swerveAngles.br;
      } else {
        if (moduleLFRef.current) moduleLFRef.current.rotation.y = 0;
        if (moduleRFRef.current) moduleRFRef.current.rotation.y = 0;
        if (moduleBLRef.current) moduleBLRef.current.rotation.y = 0;
        if (moduleBRRef.current) moduleBRRef.current.rotation.y = 0;
      }

      // Linear Slide Height (dynamic check)
      const carriage = slideCarriageRef.current;
      if (carriage) {
        const slideHeight = currentFrame.values["Superstructure/Elevator_Height"] || currentFrame.values["Elevator/Height"] || currentFrame.values["slides/height"] || 0;
        const minHeightOffset = 0.127; // 5 inches
        carriage.position.y = minHeightOffset + slideHeight * 0.75;
      }

      // Intake pivot rotation (dynamic check)
      const intake = intakeArmRef.current;
      if (intake) {
        const pivotLoad = currentFrame.values["Drive/MotorCurrent_FR"] || currentFrame.values["Intake/Current"] || currentFrame.values["intake/current"] || 0;
        intake.rotation.x = Math.min(Math.PI / 4, pivotLoad * 0.5);
      }

      // Update camera FOV meshes
      if (!showFov) {
        cameraFovGroupsRef.current.forEach((g) => robot.remove(g));
        cameraFovGroupsRef.current = [];
      } else {
        const cameras = getCameraPoses(currentFrame);
        if (cameraFovGroupsRef.current.length !== cameras.length) {
          cameraFovGroupsRef.current.forEach((g) => robot.remove(g));
          cameraFovGroupsRef.current = [];
          
          cameras.forEach((cam) => {
            const group = new THREE.Group();
            
            // 1. Semi-transparent fill mesh
            const shape = new THREE.Shape();
            shape.moveTo(0, 0);
            const halfFov = (31.5 * Math.PI) / 180;
            const numPoints = 16;
            for (let i = 0; i <= numPoints; i++) {
              const angle = -halfFov + (i / numPoints) * (2 * halfFov);
              shape.lineTo(4.0 * Math.sin(angle), -4.0 * Math.cos(angle));
            }
            shape.lineTo(0, 0);
            
            const fovGeo = new THREE.ShapeGeometry(shape);
            const fovMat = new THREE.MeshBasicMaterial({
              color: 0xFFB81C,
              transparent: true,
              opacity: 0.04,
              side: THREE.DoubleSide
            });
            const fovMesh = new THREE.Mesh(fovGeo, fovMat);
            fovMesh.rotation.x = Math.PI / 2; // Lay flat
            group.add(fovMesh);
            
            // 2. Dashed outline line
            const outlinePoints = [];
            outlinePoints.push(new THREE.Vector3(0, 0.001, 0));
            for (let i = 0; i <= numPoints; i++) {
              const angle = -halfFov + (i / numPoints) * (2 * halfFov);
              outlinePoints.push(new THREE.Vector3(4.0 * Math.sin(angle), 0.001, -4.0 * Math.cos(angle)));
            }
            outlinePoints.push(new THREE.Vector3(0, 0.001, 0));
            
            const borderGeo = new THREE.BufferGeometry().setFromPoints(outlinePoints);
            const borderMat = new THREE.LineDashedMaterial({
              color: 0xFFB81C,
              opacity: 0.25,
              transparent: true,
              dashSize: 0.15,
              gapSize: 0.1
            });
            const borderLine = new THREE.Line(borderGeo, borderMat);
            borderLine.computeLineDistances();
            group.add(borderLine);
            
            robot.add(group);
            cameraFovGroupsRef.current.push(group);
          });
        }
        
        // Update positions of the camera groups relative to the robot center
        cameras.forEach((cam, idx) => {
          const group = cameraFovGroupsRef.current[idx];
          if (group) {
            group.position.x = -cam.y;
            group.position.z = -cam.x;
            group.position.y = 0.005; // Slightly above robot chassis base helper height
            group.rotation.y = cam.yaw;
          }
        });
      }
    }

    // Historical Path Trail
    const trail = trailLineRef.current;
    if (trail && telemetryData && telemetryData.timestamps.length > 0) {
      const times = telemetryData.timestamps;
      let currentIndex = 0;
      for (let i = 0; i < times.length; i++) {
        if (times[i] <= currentTimeMs) currentIndex = i;
        else break;
      }

      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= currentIndex; i++) {
        const pt = telemetryData.coords[i];
        if (pt) {
          points.push(new THREE.Vector3(-pt.y, 0.01, -pt.x));
        }
      }

      if (points.length > 0) {
        trail.geometry.setFromPoints(points);
        trail.geometry.computeBoundingBox();
        trail.geometry.computeBoundingSphere();
        trail.visible = true;
      } else {
        trail.visible = false;
      }
    }

    // Planned Path Line
    const plannedTrail = plannedPathLineRef.current;
    if (plannedTrail && plannedPath && plannedPath.length > 0) {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i < plannedPath.length; i++) {
        const pt = plannedPath[i];
        points.push(new THREE.Vector3(-pt.y, 0.005, -pt.x));
      }
      plannedTrail.geometry.setFromPoints(points);
      plannedTrail.computeLineDistances();
      plannedTrail.geometry.computeBoundingBox();
      plannedTrail.geometry.computeBoundingSphere();
      plannedTrail.visible = true;
    } else if (plannedTrail) {
      plannedTrail.visible = false;
    }

    // Sync comparison ghost robot in 3D
    const compRobot = comparisonRobotGroupRef.current;
    const compFrame = getCurrentComparisonFrame();
    if (compRobot) {
      if (compFrame && comparisonTelemetryData) {
        compRobot.position.x = -compFrame.y;
        compRobot.position.z = -compFrame.x;
        compRobot.rotation.y = compFrame.heading;
        compRobot.visible = true;
      } else {
        compRobot.visible = false;
      }
    }

    // Sync comparison 3D trail
    const compTrail = comparisonTrailLineRef.current;
    if (compTrail) {
      if (comparisonTelemetryData && comparisonTelemetryData.timestamps.length > 0) {
        const times = comparisonTelemetryData.timestamps;
        let currentIndex = 0;
        for (let i = 0; i < times.length; i++) {
          if (times[i] <= currentTimeMs) currentIndex = i;
          else break;
        }

        const points: THREE.Vector3[] = [];
        for (let i = 0; i <= currentIndex; i++) {
          const pt = comparisonTelemetryData.coords[i];
          if (pt) {
            points.push(new THREE.Vector3(-pt.y, 0.008, -pt.x)); // slightly below main trail to avoid Z-fighting
          }
        }

        if (points.length > 0) {
          compTrail.geometry.setFromPoints(points);
          compTrail.computeLineDistances();
          compTrail.geometry.computeBoundingBox();
          compTrail.geometry.computeBoundingSphere();
          compTrail.visible = true;
        } else {
          compTrail.visible = false;
        }
      } else {
        compTrail.visible = false;
      }
    }
  }, [viewMode, currentFrame, currentTimeMs, telemetryData, comparisonTelemetryData, plannedPath, driveMode, showFov, getCurrentComparisonFrame]);

  return (
    <div className="flex flex-col gap-5 justify-between h-full p-4">
      {/* HUD Metrics & Selector Header */}
      <div className="w-full border-b border-white/5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
          <h3 className="text-sm font-black uppercase text-white tracking-widest font-heading">
            🗺️ ARES-Scope viewport
          </h3>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Drive Mode Selector */}
            <div className="flex bg-black/45 border border-white/5 p-0.5 rounded-lg gap-0.5">
              <button
                onClick={() => setDriveMode("mecanum")}
                className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  driveMode === "mecanum" ? "bg-white/10 text-white font-black" : "text-marble/40 hover:text-white"
                }`}
              >
                Mecanum
              </button>
              <button
                onClick={() => setDriveMode("swerve")}
                className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  driveMode === "swerve" ? "bg-white/10 text-white font-black" : "text-marble/40 hover:text-white"
                }`}
              >
                Swerve
              </button>
            </div>

            {/* Camera FOV Toggle */}
            <button
              onClick={() => setShowFov(!showFov)}
              className={`px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                showFov ? "bg-ares-gold text-black font-black" : "text-marble/45 hover:text-white bg-black/45 border border-white/5"
              }`}
            >
              Cam FOV
            </button>

            {/* 2D/3D View Selector Tabs */}
            <div className="flex bg-black/45 border border-white/5 p-0.5 rounded-lg gap-0.5">
              <button
                onClick={() => setViewMode("2d")}
                className={`px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-1 cursor-pointer ${
                  viewMode === "2d" ? "bg-ares-gold text-black font-black" : "text-marble/45 hover:text-white"
                }`}
              >
                <Eye size={10} /> Tactical 2D
              </button>
              <button
                onClick={() => setViewMode("3d")}
                className={`px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-1 cursor-pointer ${
                  viewMode === "3d" ? "bg-ares-gold text-black font-black" : "text-marble/45 hover:text-white"
                }`}
              >
                <Map size={10} /> Arena 3D
              </button>
            </div>
          </div>
        </div>
        
        {/* Coordinate Panel HUD */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-black/45 border border-white/5 p-2 rounded-xl text-center">
            <span className="text-[8px] uppercase font-bold text-marble/40 tracking-wider flex items-center justify-center gap-1">
              <Move size={8} /> Coord X
            </span>
            <p className="text-sm font-black font-heading text-white mt-0.5">
              {currentFrame ? `${currentFrame.x.toFixed(2)}m` : `0.00m`}
            </p>
          </div>
          <div className="bg-black/45 border border-white/5 p-2 rounded-xl text-center">
            <span className="text-[8px] uppercase font-bold text-marble/40 tracking-wider flex items-center justify-center gap-1">
              <Move size={8} /> Coord Y
            </span>
            <p className="text-sm font-black font-heading text-white mt-0.5">
              {currentFrame ? `${currentFrame.y.toFixed(2)}m` : `0.00m`}
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

      {/* Main WebGL Replay Viewport */}
      <div className="relative flex-grow w-full h-0 bg-black/85 rounded-2xl border border-white/5 overflow-hidden flex items-center justify-center shadow-inner">
        {viewMode === "2d" ? (
          <canvas 
            ref={canvas2DRef} 
            style={{ display: "block" }} 
            role="img" 
            aria-label="Tactical 2D Replay Viewport. Use Left/Right Arrow keys to scrub through time, and Home/End to jump to start/end." 
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          />
        ) : (
          <div 
            ref={container3DRef} 
            className="w-full h-full absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan" 
            tabIndex={0}
            onKeyDown={handleKeyDown}
            role="img"
            aria-label="3D Arena Replay Viewport. Use Left/Right Arrow keys to scrub through time, and Home/End to jump to start/end."
          />
        )}
      </div>

      <div className="text-[9px] font-mono text-marble/35 text-center leading-relaxed">
        {viewMode === "3d" ? (
          <>
            3D Arena: Into The Deep 2025-26 Season Layout. <br />
            Robot model: {driveMode === "swerve" ? "Swerve Drivetrain (Pivoting wheels active)" : "Mecanum Drivetrain"}.
          </>
        ) : (
          <>
            Tactical 2D View: Odometry coordinate traces on 12ft square tiles. <br />
            Drivetrain: {driveMode === "swerve" ? "Swerve (vector steer)" : "Mecanum"}.
          </>
        )}
      </div>
    </div>
  );
}
