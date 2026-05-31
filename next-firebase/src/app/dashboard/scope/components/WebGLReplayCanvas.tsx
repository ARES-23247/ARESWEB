"use client";

import React, { useRef, useEffect, useState } from "react";
import { useScopeStore } from "../store/scopeStore";
import { Move, Compass, Eye, Map } from "lucide-react";
import * as THREE from "three";

export default function WebGLReplayCanvas() {
  const { telemetryData, currentTimeMs, getCurrentFrame } = useScopeStore();
  const [viewMode, setViewMode] = useState<"2d" | "3d">("3d");
  
  const canvas2DRef = useRef<HTMLCanvasElement | null>(null);
  const container3DRef = useRef<HTMLDivElement | null>(null);

  // Three.js instances stored in refs to avoid re-creation and ensure clean disposal
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const robotGroupRef = useRef<THREE.Group | null>(null);
  const slideCarriageRef = useRef<THREE.Mesh | null>(null);
  const intakeArmRef = useRef<THREE.Mesh | null>(null);
  const trailLineRef = useRef<THREE.Line | null>(null);

  const currentFrame = getCurrentFrame();

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
    const fieldSizeInches = 144.0;
    const padding = 15;
    const mapSize = width - padding * 2;
    const scale = mapSize / fieldSizeInches;

    const toPxX = (inchX: number) => padding + inchX * scale;
    const toPxY = (inchY: number) => height - padding - inchY * scale;

    // Background
    ctx.fillStyle = "#0D0D0D";
    ctx.fillRect(0, 0, width, height);

    // 6x6 Grid Tiles (each is 24x24 inches)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
      const offset = i * 24;
      ctx.beginPath();
      ctx.moveTo(toPxX(offset), toPxY(0));
      ctx.lineTo(toPxX(offset), toPxY(144));
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(toPxX(0), toPxY(offset));
      ctx.lineTo(toPxX(144), toPxY(offset));
      ctx.stroke();
    }

    // Outer Perimeter Wall
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.rect(toPxX(0), toPxY(144), mapSize, mapSize);
    ctx.stroke();

    // Red Basket Corner (Top-Left)
    ctx.fillStyle = "rgba(239, 68, 68, 0.1)";
    ctx.beginPath();
    ctx.arc(toPxX(0), toPxY(144), 20 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Blue Basket Corner (Bottom-Right)
    ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
    ctx.beginPath();
    ctx.arc(toPxX(144), toPxY(0), 20 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Substations
    ctx.fillStyle = "rgba(239, 68, 68, 0.08)";
    ctx.fillRect(toPxX(0), toPxY(24), 24 * scale, 24 * scale);
    ctx.strokeStyle = "rgba(239, 68, 68, 0.2)";
    ctx.strokeRect(toPxX(0), toPxY(24), 24 * scale, 24 * scale);

    ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
    ctx.fillRect(toPxX(120), toPxY(144), 24 * scale, 24 * scale);
    ctx.strokeStyle = "rgba(59, 130, 246, 0.2)";
    ctx.strokeRect(toPxX(120), toPxY(144), 24 * scale, 24 * scale);

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
          if (i === 0) ctx.moveTo(toPxX(pt.x), toPxY(pt.y));
          else ctx.lineTo(toPxX(pt.x), toPxY(pt.y));
        }
        ctx.stroke();
      }
    }

    // Robot Chassis (18" Square)
    if (currentFrame) {
      const pxX = toPxX(currentFrame.x);
      const pxY = toPxY(currentFrame.y);
      const robotSizePx = 18.0 * scale;

      ctx.save();
      ctx.translate(pxX, pxY);
      ctx.rotate(-currentFrame.heading);

      ctx.fillStyle = "rgba(245, 158, 11, 0.25)";
      ctx.beginPath();
      ctx.rect(-robotSizePx / 2, -robotSizePx / 2, robotSizePx, robotSizePx);
      ctx.fill();

      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Mecanum Wheels
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      const wheelW = 4 * scale;
      const wheelH = 8 * scale;
      ctx.fillRect(-robotSizePx/2, -robotSizePx/2 - wheelW, wheelH, wheelW);
      ctx.fillRect(robotSizePx/2 - wheelH, -robotSizePx/2 - wheelW, wheelH, wheelW);
      ctx.fillRect(-robotSizePx/2, robotSizePx/2, wheelH, wheelW);
      ctx.fillRect(robotSizePx/2 - wheelH, robotSizePx/2, wheelH, wheelW);

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
  }, [viewMode, telemetryData, currentTimeMs, currentFrame]);

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
    // Position camera in a beautiful isometric-style high angle
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

    // 3. FTC Floor (144" x 144") scaled to units (1 unit = 1 inch)
    // Floor Tile Base
    const floorGeo = new THREE.PlaneGeometry(144, 144);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.8,
      metalness: 0.1,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // 6x6 Tile Grid Lines
    const gridHelper = new THREE.GridHelper(144, 6, 0x333333, 0x222222);
    gridHelper.position.y = 0.05;
    scene.add(gridHelper);

    // 4. Perimeter Glass Walls (12" high, slightly elevated)
    const glassWallMat = new THREE.MeshPhysicalMaterial({
      color: 0x555555,
      transparent: true,
      opacity: 0.15,
      roughness: 0.1,
      transmission: 0.6,
      thickness: 1.5,
      side: THREE.DoubleSide
    });

    const addWall = (w: number, h: number, x: number, y: number, z: number, rY = 0) => {
      const geo = new THREE.BoxGeometry(w, h, 2);
      const mesh = new THREE.Mesh(geo, glassWallMat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = rY;
      scene.add(mesh);
    };

    // 4 borders (Center is 0,0,0. Bounds are -72 to 72)
    addWall(144, 12, 0, 6, -72); // North
    addWall(144, 12, 0, 6, 72);  // South
    addWall(144, 12, -72, 6, 0, Math.PI / 2); // West
    addWall(144, 12, 72, 6, 0, Math.PI / 2);  // East

    // 5. Procedural 3D FTC Into The Deep Field Elements
    // Red Basket Corner (Base + elevated target basket)
    const basketRedBase = new THREE.Mesh(
      new THREE.CylinderGeometry(15, 18, 1, 16),
      new THREE.MeshStandardMaterial({ color: 0xEF4444, roughness: 0.5 })
    );
    basketRedBase.position.set(-60, 0.5, 60);
    scene.add(basketRedBase);

    // Blue Basket Corner
    const basketBlueBase = new THREE.Mesh(
      new THREE.CylinderGeometry(15, 18, 1, 16),
      new THREE.MeshStandardMaterial({ color: 0x3B82F6, roughness: 0.5 })
    );
    basketBlueBase.position.set(60, 0.5, -60);
    scene.add(basketBlueBase);

    // Central Submersible Structure (Center of field, 24" cube frame cage)
    const submersibleGroup = new THREE.Group();
    submersibleGroup.position.set(0, 0, 0);

    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.9, roughness: 0.1 });
    const addPipe = (len: number, x: number, y: number, z: number, rot = new THREE.Euler()) => {
      const geo = new THREE.CylinderGeometry(0.8, 0.8, len, 8);
      const mesh = new THREE.Mesh(geo, pipeMat);
      mesh.position.set(x, y, z);
      mesh.rotation.copy(rot);
      mesh.castShadow = true;
      submersibleGroup.add(mesh);
    };

    // 4 vertical posts of Submersible
    addPipe(18, -12, 9, -12);
    addPipe(18, 12, 9, -12);
    addPipe(18, -12, 9, 12);
    addPipe(18, 12, 9, 12);
    
    // Top horizontal framework
    addPipe(24, 0, 18, -12, new THREE.Euler(0, 0, Math.PI / 2));
    addPipe(24, 0, 18, 12, new THREE.Euler(0, 0, Math.PI / 2));
    addPipe(24, -12, 18, 0, new THREE.Euler(Math.PI / 2, 0, 0));
    addPipe(24, 12, 18, 0, new THREE.Euler(Math.PI / 2, 0, 0));

    scene.add(submersibleGroup);

    // 6. Detailed 3D Robot Group (18" x 18" scale limit)
    const robot = new THREE.Group();
    robotGroupRef.current = robot;
    scene.add(robot);

    // Chassis body base (Translucent gold / tech look)
    const chassisGeo = new THREE.BoxGeometry(18, 5, 18);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0xF59E0B,
      metalness: 0.6,
      roughness: 0.2,
      transparent: true,
      opacity: 0.95
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = 3.5;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    robot.add(chassis);

    // Red Front indicator arrow mesh
    const arrowGeo = new THREE.ConeGeometry(2.5, 6, 4);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xEF4444 });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.position.set(0, 6.5, -9);
    arrow.rotation.x = -Math.PI / 2;
    robot.add(arrow);

    // 4 Mecanum Wheels (cylinders)
    const wheelGeo = new THREE.CylinderGeometry(3, 3, 2.5, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9, metalness: 0.1 });
    const addWheelMesh = (x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(wheelGeo, wheelMat);
      mesh.position.set(x, y, z);
      mesh.rotation.z = Math.PI / 2;
      mesh.castShadow = true;
      robot.add(mesh);
    };
    addWheelMesh(-9.5, 3, -7); // LF
    addWheelMesh(9.5, 3, -7);  // RF
    addWheelMesh(-9.5, 3, 7);  // LR
    addWheelMesh(9.5, 3, 7);   // RR

    // Vertical linear slides mechanism (2 rails + sliding stage)
    const railMat = new THREE.MeshStandardMaterial({ color: 0xCCCCCC, metalness: 0.9, roughness: 0.2 });
    const railGeo = new THREE.BoxGeometry(1, 24, 1);
    
    const railL = new THREE.Mesh(railGeo, railMat);
    railL.position.set(-4, 14.5, 4);
    railL.castShadow = true;
    robot.add(railL);

    const railR = new THREE.Mesh(railGeo, railMat);
    railR.position.set(4, 14.5, 4);
    railR.castShadow = true;
    robot.add(railR);

    // Sliding carriage (moves vertically based on linear slide height telemetry)
    const carriageGeo = new THREE.BoxGeometry(9, 3, 4);
    const carriageMat = new THREE.MeshStandardMaterial({ color: 0xEE4444, metalness: 0.3, roughness: 0.5 });
    const carriage = new THREE.Mesh(carriageGeo, carriageMat);
    carriage.position.set(0, 8, 4);
    carriage.castShadow = true;
    robot.add(carriage);
    slideCarriageRef.current = carriage;

    // Intake pivot arm on carriage
    const armGeo = new THREE.BoxGeometry(2, 2, 10);
    const armMat = new THREE.MeshStandardMaterial({ color: 0xF59E0B, metalness: 0.8 });
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(0, 0, -4); // attached to carriage front
    carriage.add(arm);
    intakeArmRef.current = arm;

    // 7. Dynamic 3D Path Trail Line
    const trailGeo = new THREE.BufferGeometry();
    const trailMat = new THREE.LineBasicMaterial({ color: 0xF59E0B, linewidth: 2 });
    const trail = new THREE.Line(trailGeo, trailMat);
    scene.add(trail);
    trailLineRef.current = trail;

    // 8. Dynamic Animation Rendering loop
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

    // 10. Clean-up function (dispose resources to prevent GPU context memory leaks)
    return () => {
      active = false;
      window.removeEventListener("resize", handleResize);
      
      // Dispose meshes, geometries, materials
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

    // Update 3D Robot Pose and slide mechanics in real-time
    const robot = robotGroupRef.current;
    if (robot && currentFrame) {
      // In 2D, coordinates map bottom-left (0,0) to top-right (144, 144)
      // In 3D, center is (0,0). So:
      // X coordinate -> robot.position.x = X - 72
      // Y coordinate -> robot.position.z = 72 - Y
      robot.position.x = currentFrame.x - 72;
      robot.position.z = 72 - currentFrame.y;
      
      // Telemetry headings are counter-clockwise radians (standard).
      // Three.js right-handed rotation around Y axis matches this.
      robot.rotation.y = currentFrame.heading;

      // Linear Slide Height kinematics
      const carriage = slideCarriageRef.current;
      if (carriage) {
        // Translate slides height directly to mesh vertical coordinate offsets
        // Max slides height ~24 inches, scale mesh representation accordingly
        const minHeightOffset = 5; // rest position
        const targetHeight = currentFrame.slides.height;
        carriage.position.y = minHeightOffset + targetHeight * 0.75;
      }

      // Intake pivot rotation (animated based on current loads / state)
      const intake = intakeArmRef.current;
      if (intake) {
        // Modulate visual pivot angle slightly based on simulated telemetry values
        const pivotLoad = currentFrame.intake.current;
        intake.rotation.x = Math.min(Math.PI / 4, pivotLoad * 0.5);
      }
    }

    // Update 3D Historical Path Trail
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
          // Draw path slightly floating above the tiles at Y=0.25 to prevent grid z-fighting
          points.push(new THREE.Vector3(pt.x - 72, 0.25, 72 - pt.y));
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
  }, [viewMode, currentFrame, currentTimeMs, telemetryData]);

  return (
    <div className="glass-card p-6 border border-white/10 flex flex-col gap-5 justify-between h-full">
      {/* HUD Metrics & Selector Header */}
      <div className="w-full border-b border-white/5 pb-3">
        <div className="flex items-center justify-between mb-3.5">
          <h3 className="text-sm font-black uppercase text-white tracking-widest font-heading">
            🗺️ ARES-Scope viewport
          </h3>
          
          {/* 2D/3D View Selector Tabs */}
          <div className="flex bg-black/45 border border-white/5 p-0.5 rounded-lg gap-0.5">
            <button
              onClick={() => setViewMode("2d")}
              className={`px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-1 cursor-pointer ${
                viewMode === "2d" ? "bg-ares-gold text-black" : "text-marble/45 hover:text-white"
              }`}
            >
              <Eye size={10} /> Tactical 2D
            </button>
            <button
              onClick={() => setViewMode("3d")}
              className={`px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-1 cursor-pointer ${
                viewMode === "3d" ? "bg-ares-gold text-black" : "text-marble/45 hover:text-white"
              }`}
            >
              <Map size={10} /> Arena 3D
            </button>
          </div>
        </div>
        
        {/* Coordinate Panel HUD HUD */}
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
            Robot kinematic rendering: Slides elevation & pivots synced.
          </>
        ) : (
          <>
            Tactical 2D View: Odometry coordinate traces on 12ft square tiles. <br />
            Path rendering: Golden pose history line trail active.
          </>
        )}
      </div>
    </div>
  );
}
