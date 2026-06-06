"use client";

import React, { useRef, useEffect, useState } from "react";
import { useScopeStore } from "../store/scopeStore";
import { Move, Compass, Eye, Map, Sliders } from "lucide-react";
import * as THREE from "three";

export default function WebGLReplayCanvas() {
  const { 
    telemetryData, 
    comparisonTelemetryData, 
    currentTimeMs, 
    getCurrentFrame, 
    getCurrentComparisonFrame, 
    plannedPath, 
    driveMode, 
    setDriveMode 
  } = useScopeStore();
  const [viewMode, setViewMode] = useState<"2d" | "3d">("3d");
  const [showFov, setShowFov] = useState<boolean>(true);
  
  const canvas2DRef = useRef<HTMLCanvasElement | null>(null);
  const container3DRef = useRef<HTMLDivElement | null>(null);

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

  const currentFrame = getCurrentFrame();

  // Helper to extract camera poses from telemetry frame values dynamically
  interface CameraPose {
    x: number;
    y: number;
    yaw: number;
  }

  const getCameraPoses = (frame: any): CameraPose[] => {
    const poses: CameraPose[] = [];
    let i = 0;
    while (true) {
      const prefix1 = `Vision/Camera_${i}`;
      const prefix2 = `Vision/CameraPoses/${i}`;
      const prefix3 = `camera_pose_${i}`;
      
      const getValByKeywords = (keys: string[]) => {
        for (const k of keys) {
          if (frame.values[k] !== undefined) return frame.values[k];
        }
        return undefined;
      };
      
      const cx = getValByKeywords([`${prefix1}_X`, `${prefix1}_x`, `${prefix2}/Translation_X`, `${prefix2}/Translation_x`, `${prefix2}/x`, `${prefix3}_x`]);
      const cy = getValByKeywords([`${prefix1}_Y`, `${prefix1}_y`, `${prefix2}/Translation_Y`, `${prefix2}/Translation_y`, `${prefix2}/y`, `${prefix3}_y`]);
      const cyaw = getValByKeywords([`${prefix1}_Yaw`, `${prefix1}_yaw`, `${prefix2}/Rotation_Z`, `${prefix2}/Rotation_z`, `${prefix2}/yaw`, `${prefix3}_yaw`]);
      
      if (cx === undefined || cy === undefined) {
        break;
      }
      
      poses.push({ x: cx, y: cy, yaw: cyaw ?? 0 });
      i++;
      if (i > 10) break;
    }
    
    if (poses.length === 0) {
      // Default single front camera
      return [{ x: 0.18, y: 0.0, yaw: 0.0 }];
    }
    return poses;
  };

  // Helper to extract swerve module angles dynamically
  const getSwerveAngles = (frame: any) => {
    if (!frame || !frame.values) return { fl: 0, fr: 0, bl: 0, br: 0 };
    const getVal = (prefixes: string[]) => {
      for (const p of prefixes) {
        if (frame.values[p] !== undefined) return frame.values[p];
      }
      return 0;
    };
    return {
      fl: getVal(["Drive/Swerve/Angle_FL", "Drive/Swerve/Module_FL/Angle", "Drive/Swerve/FL_Angle", "Drive/Swerve/FL/Angle", "swerve/angle/fl", "swerve/fl/angle"]),
      fr: getVal(["Drive/Swerve/Angle_FR", "Drive/Swerve/Module_FR/Angle", "Drive/Swerve/FR_Angle", "Drive/Swerve/FR/Angle", "swerve/angle/fr", "swerve/fr/angle"]),
      bl: getVal(["Drive/Swerve/Angle_BL", "Drive/Swerve/Module_BL/Angle", "Drive/Swerve/BL_Angle", "Drive/Swerve/BL/Angle", "swerve/angle/bl", "swerve/bl/angle"]),
      br: getVal(["Drive/Swerve/Angle_BR", "Drive/Swerve/Module_BR/Angle", "Drive/Swerve/BR_Angle", "Drive/Swerve/BR/Angle", "swerve/angle/br", "swerve/br/angle"])
    };
  };

  // ─── 2D TACTICAL VIEW RENDER ENGINE ───
  useEffect(() => {
    if (viewMode !== "2d") return;
    const canvas = canvas2DRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(canvas.parentElement?.clientWidth || 360, 420);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const width = size;
    const height = size;
    const fieldSizeMeters = 3.6576;
    const padding = 15;
    const mapSize = width - padding * 2;
    const scale = mapSize / fieldSizeMeters; // pixels per meter

    const centerX = width / 2;
    const centerY = height / 2;

    // Center-origin EKF coordinates (X forward, Y left) to canvas pixels
    const toPxX = (y_ekf: number) => centerX - y_ekf * scale; // Left is positive Y, maps to screen left
    const toPxY = (x_ekf: number) => centerY - x_ekf * scale; // Forward is positive X, maps to screen top

    // Background
    ctx.fillStyle = "#0D0D0D";
    ctx.fillRect(0, 0, width, height);

    // 6x6 Grid Tiles (each is 24x24 inches = 0.6096m x 0.6096m)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      const offset = i * 0.6096;
      // Vertical grid lines (constant Y_ekf)
      ctx.beginPath();
      ctx.moveTo(toPxX(offset), toPxY(-1.8288));
      ctx.lineTo(toPxX(offset), toPxY(1.8288));
      ctx.stroke();

      // Horizontal grid lines (constant X_ekf)
      ctx.beginPath();
      ctx.moveTo(toPxX(-1.8288), toPxY(offset));
      ctx.lineTo(toPxX(1.8288), toPxY(offset));
      ctx.stroke();
    }

    // Outer Perimeter Wall
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.rect(toPxX(1.8288), toPxY(1.8288), mapSize, mapSize);
    ctx.stroke();

    // Red Basket Corner (Top-Left on screen, EKF X = 1.8288, Y = 1.8288)
    ctx.fillStyle = "rgba(239, 68, 68, 0.1)";
    ctx.beginPath();
    ctx.arc(toPxX(1.8288), toPxY(1.8288), 0.508 * scale, 0, Math.PI * 2); // 20 inches = 0.508m
    ctx.fill();

    // Blue Basket Corner (Bottom-Right on screen, EKF X = -1.8288, Y = -1.8288)
    ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
    ctx.beginPath();
    ctx.arc(toPxX(-1.8288), toPxY(-1.8288), 0.508 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Substations (Red bottom-left screen, Blue top-right screen)
    ctx.fillStyle = "rgba(239, 68, 68, 0.08)";
    ctx.fillRect(toPxX(1.8288), toPxY(-1.2192), 0.6096 * scale, 0.6096 * scale); // 24 inches = 0.6096m
    ctx.strokeStyle = "rgba(239, 68, 68, 0.2)";
    ctx.strokeRect(toPxX(1.8288), toPxY(-1.2192), 0.6096 * scale, 0.6096 * scale);

    ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
    ctx.fillRect(toPxX(-1.2192), toPxY(1.8288), 0.6096 * scale, 0.6096 * scale);
    ctx.strokeStyle = "rgba(59, 130, 246, 0.2)";
    ctx.strokeRect(toPxX(-1.2192), toPxY(1.8288), 0.6096 * scale, 0.6096 * scale);

    // Planned Path (Dashed Cyan Spline)
    if (plannedPath && plannedPath.length > 0) {
      ctx.strokeStyle = "rgba(6, 182, 212, 0.75)"; // Cyan-500
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      for (let i = 0; i < plannedPath.length; i++) {
        const pt = plannedPath[i];
        if (i === 0) ctx.moveTo(toPxX(pt.y), toPxY(pt.x));
        else ctx.lineTo(toPxX(pt.y), toPxY(pt.x));
      }
      ctx.stroke();
      ctx.setLineDash([]); // Reset dashed line style

      // Start node (green ring)
      ctx.fillStyle = "#10B981"; // Emerald
      ctx.beginPath();
      ctx.arc(toPxX(plannedPath[0].y), toPxY(plannedPath[0].x), 4, 0, Math.PI * 2);
      ctx.fill();

      // End node (red ring)
      ctx.fillStyle = "#EF4444"; // Red
      ctx.beginPath();
      ctx.arc(toPxX(plannedPath[plannedPath.length - 1].y), toPxY(plannedPath[plannedPath.length - 1].x), 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Glowing Trail
    if (telemetryData && telemetryData.timestamps.length > 0) {
      const times = telemetryData.timestamps;
      let currentIndex = 0;
      for (let i = 0; i < times.length; i++) {
        if (times[i] <= currentTimeMs) currentIndex = i;
        else break;
      }

      if (currentIndex > 0) {
        ctx.strokeStyle = "rgba(245, 158, 11, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i <= currentIndex; i++) {
          const pt = telemetryData.coords[i];
          if (!pt) continue;
          if (i === 0) ctx.moveTo(toPxX(pt.y), toPxY(pt.x));
          else ctx.lineTo(toPxX(pt.y), toPxY(pt.x));
        }
        ctx.stroke();
      }
    }

    // Comparison Trail (Dashed Red Line)
    if (comparisonTelemetryData && comparisonTelemetryData.timestamps.length > 0) {
      const times = comparisonTelemetryData.timestamps;
      let currentIndex = 0;
      for (let i = 0; i < times.length; i++) {
        if (times[i] <= currentTimeMs) currentIndex = i;
        else break;
      }

      if (currentIndex > 0) {
        ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        for (let i = 0; i <= currentIndex; i++) {
          const pt = comparisonTelemetryData.coords[i];
          if (!pt) continue;
          if (i === 0) ctx.moveTo(toPxX(pt.y), toPxY(pt.x));
          else ctx.lineTo(toPxX(pt.y), toPxY(pt.x));
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Camera FOV Wedges (drawn under the robot chassis)
    if (showFov && currentFrame) {
      const cameras = getCameraPoses(currentFrame);
      cameras.forEach((cam) => {
        const cx = currentFrame.x + cam.x * Math.cos(currentFrame.heading) - cam.y * Math.sin(currentFrame.heading);
        const cy = currentFrame.y + cam.x * Math.sin(currentFrame.heading) + cam.y * Math.cos(currentFrame.heading);
        const camHeading = currentFrame.heading + cam.yaw;
        
        const pxX = toPxX(cy);
        const pxY = toPxY(cx);
        const rangePx = 4.0 * scale;
        const halfFov = (31.5 * Math.PI) / 180;
        const screenAngle = -camHeading - Math.PI / 2;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pxX, pxY);
        ctx.arc(pxX, pxY, rangePx, screenAngle - halfFov, screenAngle + halfFov);
        ctx.closePath();
        ctx.fillStyle = "rgba(245, 158, 11, 0.05)";
        ctx.fill();

        ctx.strokeStyle = "rgba(245, 158, 11, 0.25)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.restore();
      });
    }

    // Robot Chassis (0.4572m Square = 18")
    if (currentFrame) {
      const pxX = toPxX(currentFrame.y);
      const pxY = toPxY(currentFrame.x);
      const robotSizePx = 0.4572 * scale;

      ctx.save();
      ctx.translate(pxX, pxY);
      ctx.rotate(-currentFrame.heading);

      // Chassis Body
      ctx.fillStyle = "rgba(245, 158, 11, 0.25)";
      ctx.beginPath();
      ctx.rect(-robotSizePx / 2, -robotSizePx / 2, robotSizePx, robotSizePx);
      ctx.fill();

      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Drivetrain Wheels (rotating module vectors if Swerve is active)
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 1;

      const wheelW = 0.1016 * scale; // 4 inches
      const wheelH = 0.2032 * scale; // 8 inches
      const swerveAngles = getSwerveAngles(currentFrame);

      const drawWheel2D = (offsetX: number, offsetY: number, moduleAngle: number) => {
        ctx.save();
        ctx.translate(offsetX, offsetY);
        if (driveMode === "swerve") {
          ctx.rotate(-moduleAngle);
        }
        ctx.fillRect(-wheelH / 2, -wheelW / 2, wheelH, wheelW);
        ctx.strokeRect(-wheelH / 2, -wheelW / 2, wheelH, wheelW);
        ctx.restore();
      };

      // Draw 4 wheels: FL, FR, BL, BR
      drawWheel2D(-robotSizePx / 2 + wheelH / 2, -robotSizePx / 2 - wheelW / 2, swerveAngles.fl);
      drawWheel2D(robotSizePx / 2 - wheelH / 2, -robotSizePx / 2 - wheelW / 2, swerveAngles.fr);
      drawWheel2D(-robotSizePx / 2 + wheelH / 2, robotSizePx / 2 + wheelW / 2, swerveAngles.bl);
      drawWheel2D(robotSizePx / 2 - wheelH / 2, robotSizePx / 2 + wheelW / 2, swerveAngles.br);

      // Red Heading Arrow
      ctx.strokeStyle = "#EF4444";
      ctx.fillStyle = "#EF4444";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -robotSizePx * 0.7);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, -robotSizePx * 0.7);
      ctx.lineTo(-4 * scale, -robotSizePx * 0.5);
      ctx.lineTo(4 * scale, -robotSizePx * 0.5);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(pxX, pxY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Comparison Ghost Robot Chassis (dashed red outline)
    const comparisonFrame = getCurrentComparisonFrame();
    if (comparisonFrame) {
      const pxX = toPxX(comparisonFrame.y);
      const pxY = toPxY(comparisonFrame.x);
      const robotSizePx = 0.4572 * scale;

      ctx.save();
      ctx.translate(pxX, pxY);
      ctx.rotate(-comparisonFrame.heading);

      // Chassis Body (dashed red)
      ctx.fillStyle = "rgba(239, 68, 68, 0.12)";
      ctx.beginPath();
      ctx.rect(-robotSizePx / 2, -robotSizePx / 2, robotSizePx, robotSizePx);
      ctx.fill();

      ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Heading Arrow (Dashed Red)
      ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -robotSizePx * 0.7);
      ctx.stroke();

      ctx.restore();
    }
  }, [viewMode, telemetryData, comparisonTelemetryData, currentTimeMs, currentFrame, driveMode, showFov]);

  // ─── 3D ARENA VIEW RENDER ENGINE (THREE.JS) ───
  useEffect(() => {
    if (viewMode !== "3d") return;
    const container = container3DRef.current;
    if (!container) return;

    // 1. Initialise Scene, Camera, Renderer
    const width = container.clientWidth || 360;
    const height = container.clientHeight || 360;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0A0A0A");
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    camera.position.set(0, 110, 130);
    camera.lookAt(0, -10, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(40, 120, 40);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    const arenaLight = new THREE.PointLight(0xF59E0B, 1.2, 120);
    arenaLight.position.set(0, 30, 0);
    scene.add(arenaLight);

    // 3. FTC Floor (3.6576m x 3.6576m)
    const floorGeo = new THREE.PlaneGeometry(3.6576, 3.6576);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, metalness: 0.1 });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const gridHelper = new THREE.GridHelper(3.6576, 6, 0x333333, 0x222222);
    gridHelper.position.y = 0.001;
    scene.add(gridHelper);

    // 4. Glass Walls
    const glassWallMat = new THREE.MeshPhysicalMaterial({
      color: 0x555555,
      transparent: true,
      opacity: 0.15,
      roughness: 0.1,
      transmission: 0.6,
      thickness: 0.05,
      side: THREE.DoubleSide
    });

    const addWall = (w: number, h: number, x: number, y: number, z: number, rY = 0) => {
      const geo = new THREE.BoxGeometry(w, h, 0.05);
      const mesh = new THREE.Mesh(geo, glassWallMat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = rY;
      scene.add(mesh);
    };

    addWall(3.6576, 0.3048, 0, 0.1524, -1.8288); // North (12 inches height is 0.3048m, y-position is 0.1524m)
    addWall(3.6576, 0.3048, 0, 0.1524, 1.8288);  // South
    addWall(3.6576, 0.3048, -1.8288, 0.1524, 0, Math.PI / 2); // West
    addWall(3.6576, 0.3048, 1.8288, 0.1524, 0, Math.PI / 2);  // East

    // 5. Game Field elements
    const basketRedBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.381, 0.4572, 0.0254, 16), // 15" radius is 0.381m, 18" radius is 0.4572m, 1" height is 0.0254m
      new THREE.MeshStandardMaterial({ color: 0xEF4444, roughness: 0.5 })
    );
    basketRedBase.position.set(-1.524, 0.0127, 1.524); // (-60", 0.5", 60") becomes (-1.524m, 0.0127m, 1.524m)
    scene.add(basketRedBase);

    const basketBlueBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.381, 0.4572, 0.0254, 16),
      new THREE.MeshStandardMaterial({ color: 0x3B82F6, roughness: 0.5 })
    );
    basketBlueBase.position.set(1.524, 0.0127, -1.524); // (60", 0.5", -60") becomes (1.524m, 0.0127m, -1.524m)
    scene.add(basketBlueBase);

    // Submersible Cage
    const submersibleGroup = new THREE.Group();
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9, roughness: 0.1 });
    const addPipe = (len: number, x: number, y: number, z: number, rot = new THREE.Euler()) => {
      const geo = new THREE.CylinderGeometry(0.02, 0.02, len, 8); // 0.8 inches is ~0.02m
      const mesh = new THREE.Mesh(geo, pipeMat);
      mesh.position.set(x, y, z);
      mesh.rotation.copy(rot);
      submersibleGroup.add(mesh);
    };
    addPipe(0.4572, -0.3048, 0.2286, -0.3048); // 18", -12", 9", -12"
    addPipe(0.4572, 0.3048, 0.2286, -0.3048);
    addPipe(0.4572, -0.3048, 0.2286, 0.3048);
    addPipe(0.4572, 0.3048, 0.2286, 0.3048);
    addPipe(0.6096, 0, 0.4572, -0.3048, new THREE.Euler(0, 0, Math.PI / 2)); // 24", 0, 18", -12"
    addPipe(0.6096, 0, 0.4572, 0.3048, new THREE.Euler(0, 0, Math.PI / 2));
    addPipe(0.6096, -0.3048, 0.4572, 0, new THREE.Euler(Math.PI / 2, 0, 0));
    addPipe(0.6096, 0.3048, 0.4572, 0, new THREE.Euler(Math.PI / 2, 0, 0));
    scene.add(submersibleGroup);

    // 6. 3D Robot Model Group
    const robot = new THREE.Group();
    robotGroupRef.current = robot;
    scene.add(robot);

    // Chassis body base (0.4572m square = 18")
    const chassisGeo = new THREE.BoxGeometry(0.4572, 0.127, 0.4572); // 18" x 5" x 18"
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0xF59E0B,
      metalness: 0.6,
      roughness: 0.2,
      transparent: true,
      opacity: 0.95
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = 0.0889; // 3.5 inches
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    robot.add(chassis);

    // Red Front indicator arrow mesh
    const arrowGeo = new THREE.ConeGeometry(0.0635, 0.1524, 4); // 2.5" radius, 6" length
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xEF4444 });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.position.set(0, 0.1651, -0.2286); // 0, 6.5", -9"
    arrow.rotation.x = -Math.PI / 2;
    robot.add(arrow);

    // Swerve wheel module cylinders (placed inside intermediate pivot groups)
    const wheelGeo = new THREE.CylinderGeometry(0.0762, 0.0762, 0.0635, 16); // 3" radius, 2.5" thickness
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9, metalness: 0.1 });
    
    const create3DWheelModule = (x: number, y: number, z: number) => {
      const pivotGroup = new THREE.Group();
      pivotGroup.position.set(x, y, z);
      
      const mesh = new THREE.Mesh(wheelGeo, wheelMat);
      mesh.rotation.z = Math.PI / 2;
      mesh.castShadow = true;
      pivotGroup.add(mesh);
      
      robot.add(pivotGroup);
      return pivotGroup;
    };

    moduleLFRef.current = create3DWheelModule(-0.2413, 0.0762, -0.1778); // -9.5", 3", -7"
    moduleRFRef.current = create3DWheelModule(0.2413, 0.0762, -0.1778);
    moduleBLRef.current = create3DWheelModule(-0.2413, 0.0762, 0.1778);
    moduleBRRef.current = create3DWheelModule(0.2413, 0.0762, 0.1778);

    // Rails mechanism
    const railMat = new THREE.MeshStandardMaterial({ color: 0xCCCCCC, metalness: 0.9, roughness: 0.2 });
    const railGeo = new THREE.BoxGeometry(0.0254, 0.6096, 0.0254); // 1" x 24" x 1"
    
    const railL = new THREE.Mesh(railGeo, railMat);
    railL.position.set(-0.1016, 0.3683, 0.1016); // -4", 14.5", 4"
    robot.add(railL);

    const railR = new THREE.Mesh(railGeo, railMat);
    railR.position.set(0.1016, 0.3683, 0.1016);
    robot.add(railR);

    // Sliding carriage
    const carriageGeo = new THREE.BoxGeometry(0.2286, 0.0762, 0.1016); // 9" x 3" x 4"
    const carriageMat = new THREE.MeshStandardMaterial({ color: 0xEE4444, metalness: 0.3, roughness: 0.5 });
    const carriage = new THREE.Mesh(carriageGeo, carriageMat);
    carriage.position.set(0, 0.2032, 0.1016); // 0, 8", 4"
    robot.add(carriage);
    slideCarriageRef.current = carriage;

    // Intake pivot arm
    const armGeo = new THREE.BoxGeometry(0.0508, 0.0508, 0.254); // 2" x 2" x 10"
    const armMat = new THREE.MeshStandardMaterial({ color: 0xF59E0B, metalness: 0.8 });
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(0, 0, -0.1016); // 0, 0, -4"
    carriage.add(arm);
    intakeArmRef.current = arm;

    // 7. Trails
    const trailGeo = new THREE.BufferGeometry();
    const trailMat = new THREE.LineBasicMaterial({ color: 0xF59E0B, linewidth: 2 });
    const trail = new THREE.Line(trailGeo, trailMat);
    scene.add(trail);
    trailLineRef.current = trail;

    const compTrailGeo = new THREE.BufferGeometry();
    const compTrailMat = new THREE.LineDashedMaterial({ 
      color: 0xEF4444,
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
      color: 0x06B6D4,
      linewidth: 1.5,
      dashSize: 3,
      gapSize: 2
    });
    const plannedTrail = new THREE.Line(plannedTrailGeo, plannedTrailMat);
    scene.add(plannedTrail);
    plannedPathLineRef.current = plannedTrail;

    // 7.5 3D Comparison Ghost Robot Model Group
    const compRobot = new THREE.Group();
    comparisonRobotGroupRef.current = compRobot;
    scene.add(compRobot);

    const compChassisGeo = new THREE.BoxGeometry(0.4572, 0.127, 0.4572);
    const compChassisMat = new THREE.MeshStandardMaterial({
      color: 0xEF4444, // Red
      metalness: 0.3,
      roughness: 0.5,
      transparent: true,
      opacity: 0.35
    });
    const compChassis = new THREE.Mesh(compChassisGeo, compChassisMat);
    compChassis.position.y = 0.0889;
    compRobot.add(compChassis);

    const compArrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: 0xEF4444, transparent: true, opacity: 0.5 }));
    compArrow.position.set(0, 0.1651, -0.2286);
    compArrow.rotation.x = -Math.PI / 2;
    compRobot.add(compArrow);

    // 8. Animation loop
    let active = true;
    const animate = () => {
      if (!active) return;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();

    // 9. Resize Listener
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      active = false;
      window.removeEventListener("resize", handleResize);
      
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        } else {
          object.material.dispose();
        }
      });

      renderer.dispose();
      container.innerHTML = "";
    };
  }, [viewMode]);

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
  }, [viewMode, currentFrame, currentTimeMs, telemetryData, comparisonTelemetryData, plannedPath, driveMode, showFov]);

  return (
    <div className="glass-card p-6 border border-white/10 flex flex-col gap-5 justify-between h-full">
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
      <div className="relative aspect-square w-full max-w-[360px] bg-black/85 rounded-2xl border border-white/5 overflow-hidden flex items-center justify-center shadow-inner self-center">
        {viewMode === "2d" ? (
          <canvas ref={canvas2DRef} style={{ display: "block" }} />
        ) : (
          <div 
            ref={container3DRef} 
            className="w-full h-full relative" 
            style={{ minHeight: "360px" }}
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
