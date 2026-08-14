"use client";

import { useEffect, useRef, useState, useCallback, useId } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  Box,
  Layers,
  Download,
  RotateCcw,
  RotateCw,
  ExternalLink,
  Compass,
  AlertCircle,
  FileDown,
  ChevronRight,
  Grid3X3,
  Sparkles,
  Info
} from "lucide-react";
import SEO from "@/components/SEO";
import { siteConfig } from "@/lib/site-config";
import { isSafeExternalUrl, canEmbedCadUrl } from "@/app/robots/api";

export interface CadSubsystem {
  id: string;
  name: string;
  category: "chassis" | "intake" | "outtake" | "hang" | "electronics";
  description: string;
  weightLbs: number;
  partCount: number;
  material: string;
  primaryActuator: string;
  degreeOfFreedom: string;
  gearRatio: string;
  onshapeTabUrl: string;
  stepDownloadUrl: string;
  stlDownloadUrl: string;
  colorHex: number;
  colorName: string;
  keyFeatures: string[];
}

export interface RobotCadModel {
  id: string;
  name: string;
  seasonName: string;
  challengeName: string;
  description: string;
  totalWeightLbs: number;
  dimensions: string;
  onshapeDocumentUrl: string;
  onshapeEmbedUrl?: string;
  printablesUrl: string;
  stepArchiveUrl: string;
  stlArchiveUrl: string;
  subsystems: CadSubsystem[];
}

export const ROBOT_CAD_MODELS: RobotCadModel[] = [
  {
    id: "ares-xxiv-intothedeep",
    name: "ARES XXIV // Apex",
    seasonName: "2024-2025",
    challengeName: "INTO THE DEEP",
    description:
      "Precision holonomic competition robot designed for rapid sample harvesting, high-basket scoring, and reliable level-3 ascent. Engineered in Onshape with high-tolerance 6061-T6 aluminum CNC plates, 3D printed TPU intake compliant wheels, and custom continuous dual-stage slide mechanics.",
    totalWeightLbs: 38.4,
    dimensions: "17.8\" x 17.5\" x 13.9\"",
    onshapeDocumentUrl:
      "https://cad.onshape.com/documents/681f8b6764dc7e001a56cb6e/w/32f2f707f1556a3e147f2081/e/54b7c191a89c44566c7b9192",
    onshapeEmbedUrl:
      "https://cad.onshape.com/documents/681f8b6764dc7e001a56cb6e/w/32f2f707f1556a3e147f2081/e/54b7c191a89c44566c7b9192",
    printablesUrl: "https://www.printables.com/@ARESFTC_3784306",
    stepArchiveUrl: "https://aresfirst.org/cad/ares-xxiv-full-assembly.step",
    stlArchiveUrl: "https://aresfirst.org/cad/ares-xxiv-3d-print-pack.zip",
    subsystems: [
      {
        id: "chassis",
        name: "Holonomic Drivetrain & Odometry",
        category: "chassis",
        description:
          "Ultra-low center of gravity 8-wheel dropped center chassis with dual sprung dead-wheel odometry modules for sub-millimeter autonomous localization.",
        weightLbs: 14.2,
        partCount: 48,
        material: "6061-T6 Aluminum (4mm) & Carbon Fiber",
        primaryActuator: "4x REV UltraPlanetary HD Hex (19.2:1)",
        degreeOfFreedom: "3-DOF (X, Y, Theta)",
        gearRatio: "19.2:1 Planetary + 1:1 Bevel",
        onshapeTabUrl:
          "https://cad.onshape.com/documents/681f8b6764dc7e001a56cb6e/w/32f2f707f1556a3e147f2081/e/tab_chassis",
        stepDownloadUrl: "https://aresfirst.org/cad/subsystems/xxiv-chassis.step",
        stlDownloadUrl: "https://aresfirst.org/cad/subsystems/xxiv-chassis-stl.zip",
        colorHex: 0x00e5ff,
        colorName: "ARES Cyan",
        keyFeatures: [
          "Sprung dead-wheel odometry with 2048 CPR optical encoders",
          "Recessed battery cradle lowering overall center of mass",
          "Quick-swap bumper mounting system conforming to FTC rules",
        ],
      },
      {
        id: "intake",
        name: "Active Roller Coral/Sample Intake",
        category: "intake",
        description:
          "High-speed compliant-wheel intake system with optical color sorting, active centering vector wheels, and dual-position deployment linkage.",
        weightLbs: 5.8,
        partCount: 32,
        material: "TPU 95A, Carbon Polycarbonate & Delrin",
        primaryActuator: "1x REV Core Hex + 2x Smart Servo 2000",
        degreeOfFreedom: "2-DOF (Roller Spin + Pivot Articulation)",
        gearRatio: "3:1 Timing Belt Drive",
        onshapeTabUrl:
          "https://cad.onshape.com/documents/681f8b6764dc7e001a56cb6e/w/32f2f707f1556a3e147f2081/e/tab_intake",
        stepDownloadUrl: "https://aresfirst.org/cad/subsystems/xxiv-intake.step",
        stlDownloadUrl: "https://aresfirst.org/cad/subsystems/xxiv-intake-stl.zip",
        colorHex: 0xffb81c,
        colorName: "ARES Gold",
        keyFeatures: [
          "REV Color Sensor V3 integration for autonomous sample discrimination",
          "Custom compliant TPU intake rollers with helical grip ridges",
          "Passive jam-reversal elastic suspension",
        ],
      },
      {
        id: "outtake",
        name: "Continuous Linear Lift & Outtake Mast",
        category: "outtake",
        description:
          "Rigid cascading dual-stage linear slide assembly with high-speed Dyneema cord rigging, precision limit switches, and rotating deposit bucket.",
        weightLbs: 9.6,
        partCount: 64,
        material: "MISUMI SAR3 Extrusions & PETG-CF",
        primaryActuator: "2x REV HD Hex Dual-Motor Synchronous Spool",
        degreeOfFreedom: "2-DOF (Extension + Pitch Deposit)",
        gearRatio: "3.7:1 High-Speed Planetary",
        onshapeTabUrl:
          "https://cad.onshape.com/documents/681f8b6764dc7e001a56cb6e/w/32f2f707f1556a3e147f2081/e/tab_outtake",
        stepDownloadUrl: "https://aresfirst.org/cad/subsystems/xxiv-outtake.step",
        stlDownloadUrl: "https://aresfirst.org/cad/subsystems/xxiv-outtake-stl.zip",
        colorHex: 0xc00000,
        colorName: "ARES Red",
        keyFeatures: [
          "Full extension to 42 inches in under 0.65 seconds",
          "Dual magnetic Hall-effect homing sensors",
          "Carbon fiber reinforced deposit head with active claw closure",
        ],
      },
      {
        id: "hang",
        name: "High-Torque Ascend Winch & Hook",
        category: "hang",
        description:
          "Compact mechanical locking winch system capable of hoisting the complete 38 lb robot onto the submersed rung with zero backdrive.",
        weightLbs: 4.3,
        partCount: 22,
        material: "7075-T6 Aluminum Pinions & Steel Ratchet Pawl",
        primaryActuator: "1x REV UltraPlanetary (60:1) with One-Way Ratchet",
        degreeOfFreedom: "1-DOF (Telescoping Hook Winch)",
        gearRatio: "60:1 Planetary Reduction",
        onshapeTabUrl:
          "https://cad.onshape.com/documents/681f8b6764dc7e001a56cb6e/w/32f2f707f1556a3e147f2081/e/tab_hang",
        stepDownloadUrl: "https://aresfirst.org/cad/subsystems/xxiv-hang.step",
        stlDownloadUrl: "https://aresfirst.org/cad/subsystems/xxiv-hang-stl.zip",
        colorHex: 0xcd7f32,
        colorName: "ARES Bronze",
        keyFeatures: [
          "Automatic mechanical anti-backdrive pawl engagement",
          "Self-centering hook geometry with lead-in chamfers",
          "1200 lb rated UHMWPE braided cord",
        ],
      },
      {
        id: "electronics",
        name: "Control Hub & Power Distribution Bay",
        category: "electronics",
        description:
          "Protected internal electronics bay with vibration isolation dampeners, labeled CAN wiring harnesses, and accessible master switch.",
        weightLbs: 4.5,
        partCount: 18,
        material: "Anti-Static ABS & Silicone Isolation Bushings",
        primaryActuator: "REV Control Hub + REV Expansion Hub",
        degreeOfFreedom: "0-DOF (Fixed Structural Isolation)",
        gearRatio: "N/A (Electronic Control)",
        onshapeTabUrl:
          "https://cad.onshape.com/documents/681f8b6764dc7e001a56cb6e/w/32f2f707f1556a3e147f2081/e/tab_electronics",
        stepDownloadUrl: "https://aresfirst.org/cad/subsystems/xxiv-electronics.step",
        stlDownloadUrl: "https://aresfirst.org/cad/subsystems/xxiv-electronics-stl.zip",
        colorHex: 0xffffff,
        colorName: "Marble White",
        keyFeatures: [
          "Shock-isolated 3D printed cradle for REV Control Hub",
          "Integrated Anderson Powerpole power distribution block",
          "Optically transparent polycarbonate service hatch",
        ],
      },
    ],
  },
  {
    id: "ares-xxiii-centerstage",
    name: "ARES XXIII // Titan V2",
    seasonName: "2023-2024",
    challengeName: "CENTERSTAGE",
    description:
      "State-championship winning robot featuring a 45-degree angled pixel deposit mechanism, dual drone launcher, and balanced center-stage rigging.",
    totalWeightLbs: 36.2,
    dimensions: "16.5\" x 16.5\" x 14.2\"",
    onshapeDocumentUrl: siteConfig.urls.onshape,
    printablesUrl: "https://www.printables.com/@ARESFTC_3784306",
    stepArchiveUrl: "https://aresfirst.org/cad/ares-xxiii-full-assembly.step",
    stlArchiveUrl: "https://aresfirst.org/cad/ares-xxiii-3d-print-pack.zip",
    subsystems: [
      {
        id: "chassis",
        name: "GoBILDA Strafer Chassis",
        category: "chassis",
        description:
          "Direct-drive Mecanum chassis with custom channel bracing and internal dead-wheel odometry pods.",
        weightLbs: 15.0,
        partCount: 42,
        material: "GoBILDA 1120 Series Channel & Aluminum",
        primaryActuator: "4x GoBILDA 5202 Yellow Jacket (19.2:1)",
        degreeOfFreedom: "3-DOF Holonomic",
        gearRatio: "19.2:1",
        onshapeTabUrl: siteConfig.urls.onshape,
        stepDownloadUrl: "https://aresfirst.org/cad/subsystems/xxiii-chassis.step",
        stlDownloadUrl: "https://aresfirst.org/cad/subsystems/xxiii-chassis-stl.zip",
        colorHex: 0x00e5ff,
        colorName: "ARES Cyan",
        keyFeatures: ["96mm Mecanum wheels", "Spring-loaded odometry pods"],
      },
      {
        id: "outtake",
        name: "Dual Pixel Angled Deposit Box",
        category: "outtake",
        description:
          "Twin-servo gated pixel box with active angle adjustment and dual distance sensors for backdrop alignment.",
        weightLbs: 6.8,
        partCount: 28,
        material: "Carbon-Fiber Nylon 3D Print",
        primaryActuator: "3x Axon Mini Servos",
        degreeOfFreedom: "2-DOF",
        gearRatio: "Direct Servo Drive",
        onshapeTabUrl: siteConfig.urls.onshape,
        stepDownloadUrl: "https://aresfirst.org/cad/subsystems/xxiii-outtake.step",
        stlDownloadUrl: "https://aresfirst.org/cad/subsystems/xxiii-outtake-stl.zip",
        colorHex: 0xc00000,
        colorName: "ARES Red",
        keyFeatures: ["Individual pixel release gates", "Backdrop alignment ultrasonic sensor"],
      },
    ],
  },
];

export function isWebGLAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

export type ViewportCameraPreset = "iso" | "top" | "front" | "side";
export type ShadingMode = "solid" | "wireframe" | "studio";

export default function Cad3DViewerPage() {
  const [selectedRobotId, setSelectedRobotId] = useState<string>(ROBOT_CAD_MODELS[0].id);
  const [selectedSubsystemId, setSelectedSubsystemId] = useState<string | null>(null);
  const [isAutoRotate, setIsAutoRotate] = useState<boolean>(true);
  const [isExplodedView, setIsExplodedView] = useState<boolean>(false);
  const [shadingMode, setShadingMode] = useState<ShadingMode>("solid");
  const [cameraPreset, setCameraPreset] = useState<ViewportCameraPreset>("iso");
  const [isWebGlSupported, setIsWebGlSupported] = useState<boolean>(() => isWebGLAvailable());
  const [showOnshapeEmbed, setShowOnshapeEmbed] = useState<boolean>(false);
  const [screenReaderAnnouncement, setScreenReaderAnnouncement] = useState<string>("");

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const threeSceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    subsystemMeshes: Map<string, THREE.Group>;
    animationFrameId?: number;
  } | null>(null);

  const activeRobot =
    ROBOT_CAD_MODELS.find((r) => r.id === selectedRobotId) ?? ROBOT_CAD_MODELS[0];
  const activeSubsystem = activeRobot.subsystems.find((s) => s.id === selectedSubsystemId) ?? null;

  const statusLiveId = useId();

  // Handle camera positioning based on preset
  const setCameraPresetView = useCallback((preset: ViewportCameraPreset) => {
    setCameraPreset(preset);
    const sceneState = threeSceneRef.current;
    if (!sceneState) return;

    const { camera, controls } = sceneState;
    switch (preset) {
      case "top":
        camera.position.set(0, 30, 0);
        camera.lookAt(0, 0, 0);
        break;
      case "front":
        camera.position.set(0, 8, 30);
        camera.lookAt(0, 8, 0);
        break;
      case "side":
        camera.position.set(30, 8, 0);
        camera.lookAt(0, 8, 0);
        break;
      case "iso":
      default:
        camera.position.set(22, 20, 22);
        camera.lookAt(0, 6, 0);
        break;
    }
    controls.target.set(0, preset === "top" ? 0 : 6, 0);
    controls.update();
    setScreenReaderAnnouncement(`Camera switched to ${preset} projection view.`);
  }, []);

  // Build Three.js 3D Geometric Robot representation
  const buildRobot3DAssembly = useCallback(
    (scene: THREE.Scene, robot: RobotCadModel): Map<string, THREE.Group> => {
      const meshMap = new Map<string, THREE.Group>();

      // Clear previous robot meshes
      const existingRobot = scene.getObjectByName("robot-assembly");
      if (existingRobot) {
        scene.remove(existingRobot);
      }

      const robotAssemblyGroup = new THREE.Group();
      robotAssemblyGroup.name = "robot-assembly";

      robot.subsystems.forEach((subsystem) => {
        const subGroup = new THREE.Group();
        subGroup.name = `subsystem-${subsystem.id}`;

        const materialColor = subsystem.colorHex;
        const mainMaterial = new THREE.MeshStandardMaterial({
          color: materialColor,
          metalness: 0.6,
          roughness: 0.35,
          wireframe: shadingMode === "wireframe",
        });

        const accentMaterial = new THREE.MeshStandardMaterial({
          color: 0x1a1a1a,
          metalness: 0.8,
          roughness: 0.2,
          wireframe: shadingMode === "wireframe",
        });

        const metalBrushedMaterial = new THREE.MeshStandardMaterial({
          color: 0xcccccc,
          metalness: 0.9,
          roughness: 0.15,
          wireframe: shadingMode === "wireframe",
        });

        if (subsystem.category === "chassis") {
          // Chassis frame plates
          const frameGeometry = new THREE.BoxGeometry(16, 1.2, 16);
          const frameMesh = new THREE.Mesh(frameGeometry, mainMaterial);
          frameMesh.position.set(0, 2, 0);
          subGroup.add(frameMesh);

          // 4 Mecanum / Traction Wheels
          const wheelPositions = [
            [-7.5, 2, -7],
            [7.5, 2, -7],
            [-7.5, 2, 7],
            [7.5, 2, 7],
          ];
          wheelPositions.forEach((pos) => {
            const wheelGeom = new THREE.CylinderGeometry(2, 2, 1.5, 24);
            const wheelMesh = new THREE.Mesh(wheelGeom, accentMaterial);
            wheelMesh.rotation.z = Math.PI / 2;
            wheelMesh.position.set(pos[0], pos[1], pos[2]);
            subGroup.add(wheelMesh);
          });
        } else if (subsystem.category === "intake") {
          // Intake rollers and articulators
          const intakeBarGeom = new THREE.CylinderGeometry(0.8, 0.8, 12, 16);
          const intakeBarMesh = new THREE.Mesh(intakeBarGeom, mainMaterial);
          intakeBarMesh.rotation.z = Math.PI / 2;
          intakeBarMesh.position.set(0, 3.5, 9.5);
          subGroup.add(intakeBarMesh);

          const intakeArmGeom = new THREE.BoxGeometry(1.2, 4, 6);
          const leftArm = new THREE.Mesh(intakeArmGeom, accentMaterial);
          leftArm.position.set(-6, 3, 6);
          const rightArm = new THREE.Mesh(intakeArmGeom, accentMaterial);
          rightArm.position.set(6, 3, 6);
          subGroup.add(leftArm, rightArm);
        } else if (subsystem.category === "outtake") {
          // Vertical Mast & Cascading Slides
          const mastGeom = new THREE.BoxGeometry(1.5, 16, 2);
          const leftMast = new THREE.Mesh(mastGeom, metalBrushedMaterial);
          leftMast.position.set(-4, 10, -2);
          const rightMast = new THREE.Mesh(mastGeom, metalBrushedMaterial);
          rightMast.position.set(4, 10, -2);

          const slideCrossGeom = new THREE.BoxGeometry(9, 1.5, 1.5);
          const slideCross = new THREE.Mesh(slideCrossGeom, mainMaterial);
          slideCross.position.set(0, 14, -1.8);

          const depositBucketGeom = new THREE.BoxGeometry(6, 4, 5);
          const depositBucket = new THREE.Mesh(depositBucketGeom, mainMaterial);
          depositBucket.position.set(0, 13, 1);

          subGroup.add(leftMast, rightMast, slideCross, depositBucket);
        } else if (subsystem.category === "hang") {
          // Winch and Hook Assembly
          const hookGeom = new THREE.TorusGeometry(2, 0.4, 8, 24, Math.PI);
          const hookMesh = new THREE.Mesh(hookGeom, mainMaterial);
          hookMesh.rotation.x = Math.PI;
          hookMesh.position.set(0, 19, -3);

          const winchSpoolGeom = new THREE.CylinderGeometry(1.5, 1.5, 3, 16);
          const spoolMesh = new THREE.Mesh(winchSpoolGeom, accentMaterial);
          spoolMesh.rotation.z = Math.PI / 2;
          spoolMesh.position.set(0, 4, -5);

          subGroup.add(hookMesh, spoolMesh);
        } else if (subsystem.category === "electronics") {
          // REV Control Hub & Battery Box
          const hubGeom = new THREE.BoxGeometry(6, 1.5, 4);
          const hubMesh = new THREE.Mesh(hubGeom, mainMaterial);
          hubMesh.position.set(0, 3.2, -1);

          const batteryGeom = new THREE.BoxGeometry(4, 3, 3);
          const batteryMesh = new THREE.Mesh(batteryGeom, accentMaterial);
          batteryMesh.position.set(0, 3.8, -5);

          subGroup.add(hubMesh, batteryMesh);
        }

        meshMap.set(subsystem.id, subGroup);
        robotAssemblyGroup.add(subGroup);
      });

      scene.add(robotAssemblyGroup);
      return meshMap;
    },
    [shadingMode]
  );

  // Initialize Three.js Viewport
  useEffect(() => {
    if (!isWebGlSupported || !canvasContainerRef.current) return;

    const container = canvasContainerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e0e11);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(40, 20, 0x00e5ff, 0x222228);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight1.position.set(20, 40, 20);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x00e5ff, 1.0);
    dirLight2.position.set(-20, 20, -20);
    scene.add(dirLight2);

    const redAccentLight = new THREE.DirectionalLight(0xc00000, 0.8);
    redAccentLight.position.set(0, -10, 20);
    scene.add(redAccentLight);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(22, 20, 22);

    // Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
    } catch {
      setIsWebGlSupported(false);
      return;
    }

    // Clean previous canvases
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      `Interactive 3D CAD model viewer of ${activeRobot.name}`
    );
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.tabIndex = 0;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Keep above floor
    controls.minDistance = 8;
    controls.maxDistance = 80;
    controls.target.set(0, 6, 0);
    controls.autoRotate = isAutoRotate;
    controls.autoRotateSpeed = 2.0;

    const subsystemMeshes = buildRobot3DAssembly(scene, activeRobot);

    threeSceneRef.current = {
      scene,
      camera,
      renderer,
      controls,
      subsystemMeshes,
    };

    // Animation Loop
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    threeSceneRef.current.animationFrameId = animId;

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animId);
      controls.dispose();
      renderer.dispose();
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      threeSceneRef.current = null;
    };
  }, [isWebGlSupported, activeRobot, buildRobot3DAssembly, isAutoRotate]);

  // Update Auto-Rotate state on controls
  useEffect(() => {
    if (threeSceneRef.current?.controls) {
      threeSceneRef.current.controls.autoRotate = isAutoRotate;
    }
  }, [isAutoRotate]);

  // Update Highlight / Isolation / Exploded View of Subsystems in 3D scene
  useEffect(() => {
    const sceneState = threeSceneRef.current;
    if (!sceneState) return;

    const { subsystemMeshes } = sceneState;

    subsystemMeshes.forEach((meshGroup, id) => {
      const isSelected = selectedSubsystemId === null || selectedSubsystemId === id;
      const isDimmed = selectedSubsystemId !== null && selectedSubsystemId !== id;

      // Adjust mesh materials and positions
      meshGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.material instanceof THREE.MeshStandardMaterial) {
            child.material.opacity = isDimmed ? 0.2 : 1.0;
            child.material.transparent = isDimmed;
            child.material.wireframe = shadingMode === "wireframe";
          }
        }
      });

      // Exploded offsets
      if (isExplodedView) {
        if (id === "chassis") meshGroup.position.set(0, -3, 0);
        else if (id === "intake") meshGroup.position.set(0, 2, 8);
        else if (id === "outtake") meshGroup.position.set(0, 8, -2);
        else if (id === "hang") meshGroup.position.set(0, 14, -5);
        else if (id === "electronics") meshGroup.position.set(0, 5, 0);
      } else {
        meshGroup.position.set(0, 0, 0);
      }

      if (isSelected && selectedSubsystemId === id) {
        // Focus camera on selected subsystem
        const targetPos = new THREE.Vector3();
        meshGroup.getWorldPosition(targetPos);
        sceneState.controls.target.lerp(targetPos, 0.5);
      }
    });
  }, [selectedSubsystemId, isExplodedView, shadingMode]);

  const handleSubsystemSelect = (subsystemId: string | null) => {
    setSelectedSubsystemId(subsystemId);
    if (subsystemId) {
      const sub = activeRobot.subsystems.find((s) => s.id === subsystemId);
      setScreenReaderAnnouncement(
        `Selected subsystem: ${sub?.name ?? subsystemId}. Inspecting technical specs.`
      );
    } else {
      setScreenReaderAnnouncement("Reset subsystem focus to full robot assembly.");
    }
  };

  const handleResetCamera = () => {
    setCameraPresetView("iso");
    setSelectedSubsystemId(null);
    setIsExplodedView(false);
  };

  return (
    <main className="w-full min-h-screen bg-obsidian text-marble py-8">
      <SEO
        title="Interactive 3D CAD & Subsystem Viewer"
        description="Explore FTC 23247 competition robot CAD models in interactive 3D WebGL, inspect subsystem assemblies, and download STEP/STL CAD files."
      />

      {/* Screen Reader Live Region */}
      <div
        id={statusLiveId}
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {screenReaderAnnouncement}
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Hero Title & Season Badge */}
        <header className="mb-10 border-b border-white/10 pb-8">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="inline-flex items-center gap-1.5 bg-ares-red text-white px-3.5 py-1.5 ares-cut-sm text-xs font-black uppercase tracking-[0.2em] border border-ares-bronze">
              <Sparkles aria-hidden="true" size={14} className="text-ares-gold" />
              CAD & Subsystems
            </span>
            <span className="inline-block bg-white/10 text-ares-cyan px-3 py-1 text-xs font-black uppercase tracking-wider ares-cut-sm">
              FTC {activeRobot.seasonName} // {activeRobot.challengeName}
            </span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl sm:text-6xl font-black tracking-tight uppercase font-heading text-white leading-tight">
                Interactive 3D CAD Viewer
              </h1>
              <p className="mt-3 text-marble/80 text-base sm:text-lg max-w-3xl leading-relaxed">
                Inspect high-precision mechanical assemblies, analyze degrees of freedom, and
                export open-source STEP and 3D printable STL files for the ARES FTC fleet.
              </p>
            </div>

            {/* Direct Onshape & Printables Actions */}
            <div className="flex flex-wrap items-center gap-3">
              {isSafeExternalUrl(activeRobot.onshapeDocumentUrl) && (
                <a
                  href={activeRobot.onshapeDocumentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="clipped-button bg-ares-red text-white text-xs uppercase font-black tracking-wider flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  aria-label={`Open ${activeRobot.name} workspace on Onshape CAD`}
                >
                  <ExternalLink aria-hidden="true" size={15} />
                  Onshape Workspace
                </a>
              )}
              {isSafeExternalUrl(activeRobot.printablesUrl) && (
                <a
                  href={activeRobot.printablesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="clipped-button bg-white/10 hover:bg-white/20 text-white text-xs uppercase font-bold tracking-wider flex items-center gap-2 border border-white/20 focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  aria-label="Open ARES 3D Models on Printables"
                >
                  <Layers aria-hidden="true" size={15} className="text-ares-gold" />
                  Printables Hub
                </a>
              )}
            </div>
          </div>

          {/* Model Selector Tabs */}
          <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Select Robot Model">
            {ROBOT_CAD_MODELS.map((robot) => {
              const isCurrent = robot.id === selectedRobotId;
              return (
                <button
                  key={robot.id}
                  role="tab"
                  aria-selected={isCurrent}
                  onClick={() => {
                    setSelectedRobotId(robot.id);
                    setSelectedSubsystemId(null);
                    setScreenReaderAnnouncement(`Loaded robot model ${robot.name}`);
                  }}
                  className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider ares-cut-sm transition-all flex items-center gap-2 border focus-visible:ring-2 focus-visible:ring-ares-cyan ${
                    isCurrent
                      ? "bg-ares-cyan/20 border-ares-cyan text-white shadow-lg shadow-ares-cyan/10"
                      : "bg-black/40 border-white/10 text-marble/70 hover:text-white hover:border-white/30"
                  }`}
                >
                  <Box
                    aria-hidden="true"
                    size={14}
                    className={isCurrent ? "text-ares-cyan" : "text-marble/40"}
                  />
                  {robot.name}
                </button>
              );
            })}
          </div>
        </header>

        {/* Main 3D Viewport & Controls Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12">
          {/* Left Column: 3D Viewport & Interactive Tools */}
          <div className="lg:col-span-8 space-y-6">
            <section
              aria-label="3D CAD Viewport Section"
              className="bg-black/60 border border-white/15 ares-cut-lg overflow-hidden relative shadow-2xl flex flex-col"
            >
              {/* Viewport Header Bar */}
              <div className="bg-black/80 px-4 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-white">
                  <Compass aria-hidden="true" size={16} className="text-ares-cyan" />
                  <span>Viewport: {activeSubsystem ? activeSubsystem.name : "Full Assembly"}</span>
                </div>

                {/* Shading & View Preset Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div
                    className="inline-flex rounded-sm bg-white/5 p-0.5 border border-white/10"
                    role="group"
                    aria-label="Camera Presets"
                  >
                    {(["iso", "top", "front", "side"] as ViewportCameraPreset[]).map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setCameraPresetView(preset)}
                        className={`px-2 py-1 text-[10px] font-black uppercase tracking-widest ares-cut-xs transition-colors focus-visible:ring-1 focus-visible:ring-ares-cyan ${
                          cameraPreset === preset
                            ? "bg-ares-cyan text-black"
                            : "text-marble/70 hover:text-white"
                        }`}
                        aria-pressed={cameraPreset === preset}
                        aria-label={`${preset.toUpperCase()} Camera View`}
                      >
                        {preset.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      const nextMode: ShadingMode =
                        shadingMode === "solid"
                          ? "wireframe"
                          : shadingMode === "wireframe"
                          ? "studio"
                          : "solid";
                      setShadingMode(nextMode);
                      setScreenReaderAnnouncement(`Shading mode changed to ${nextMode}`);
                    }}
                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-marble border border-white/10 ares-cut-xs text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 focus-visible:ring-1 focus-visible:ring-ares-cyan"
                    aria-label={`Current shading: ${shadingMode}. Click to toggle.`}
                  >
                    <Grid3X3 aria-hidden="true" size={12} className="text-ares-gold" />
                    {shadingMode}
                  </button>

                  <button
                    onClick={() => {
                      setIsAutoRotate(!isAutoRotate);
                      setScreenReaderAnnouncement(
                        isAutoRotate ? "Auto-rotation stopped" : "Auto-rotation started"
                      );
                    }}
                    className={`px-2.5 py-1 border ares-cut-xs text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 focus-visible:ring-1 focus-visible:ring-ares-cyan ${
                      isAutoRotate
                        ? "bg-ares-gold/20 border-ares-gold text-white"
                        : "bg-white/5 border-white/10 text-marble/60"
                    }`}
                    aria-pressed={isAutoRotate}
                    aria-label="Toggle 3D auto rotation"
                  >
                    <RotateCw
                      aria-hidden="true"
                      size={12}
                      className={isAutoRotate ? "animate-spin text-ares-gold" : ""}
                    />
                    Spin
                  </button>

                  <button
                    onClick={() => {
                      setIsExplodedView(!isExplodedView);
                      setScreenReaderAnnouncement(
                        isExplodedView
                          ? "Collapsed exploded view to assembled state"
                          : "Exploded subsystem assemblies"
                      );
                    }}
                    className={`px-2.5 py-1 border ares-cut-xs text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 focus-visible:ring-1 focus-visible:ring-ares-cyan ${
                      isExplodedView
                        ? "bg-ares-red/30 border-ares-red text-white"
                        : "bg-white/5 border-white/10 text-marble/60"
                    }`}
                    aria-pressed={isExplodedView}
                    aria-label="Toggle exploded assembly view"
                  >
                    <Layers aria-hidden="true" size={12} className="text-ares-red" />
                    Explode
                  </button>
                </div>
              </div>

              {/* 3D WebGL Canvas or Graceful Fallback */}
              {isWebGlSupported ? (
                <div
                  ref={canvasContainerRef}
                  className="w-full h-[460px] sm:h-[540px] bg-[#0e0e11] relative focus:outline-none cursor-grab active:cursor-grabbing"
                  data-testid="cad-webgl-canvas"
                />
              ) : (
                <div
                  role="region"
                  aria-label="3D Viewport Fallback"
                  data-testid="cad-webgl-fallback"
                  className="w-full min-h-[460px] bg-black/80 p-8 flex flex-col items-center justify-center text-center space-y-6"
                >
                  <div className="p-4 bg-ares-red/10 border border-ares-red/30 ares-cut-md max-w-lg">
                    <AlertCircle aria-hidden="true" size={32} className="text-ares-red mx-auto mb-3" />
                    <h2 className="text-lg font-black uppercase text-white tracking-wider">
                      WebGL Hardware Acceleration Unavailable
                    </h2>
                    <p className="text-xs text-marble/80 mt-2 leading-relaxed">
                      Your current browser or hardware environment does not support WebGL 3D
                      rendering. You can still inspect full CAD assemblies directly in the Onshape
                      cloud workspace or download STEP and STL files below.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-4 justify-center">
                    {isSafeExternalUrl(activeRobot.onshapeDocumentUrl) && (
                      <a
                        href={activeRobot.onshapeDocumentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="clipped-button bg-ares-red text-white text-xs uppercase font-bold flex items-center gap-2"
                      >
                        <ExternalLink aria-hidden="true" size={14} /> Open in Onshape
                      </a>
                    )}
                    <a
                      href={activeRobot.stepArchiveUrl}
                      download
                      className="clipped-button bg-white/10 text-white text-xs uppercase font-bold flex items-center gap-2 border border-white/20"
                    >
                      <Download aria-hidden="true" size={14} /> Download STEP Archive
                    </a>
                  </div>
                </div>
              )}

              {/* Viewport Footer Bar & Keyboard Accessibility Controls */}
              <div className="bg-black/90 p-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-marble/60 text-[11px]">
                  <Info aria-hidden="true" size={14} className="text-ares-cyan shrink-0" />
                  <span>Click and drag to orbit • Scroll to zoom • Right-click to pan</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetCamera}
                    className="px-3 py-1 bg-white/5 hover:bg-white/10 text-marble border border-white/10 ares-cut-xs text-[10px] font-black uppercase tracking-wider flex items-center gap-1 focus-visible:ring-1 focus-visible:ring-ares-cyan"
                    aria-label="Reset View and Camera"
                  >
                    <RotateCcw aria-hidden="true" size={11} />
                    Reset View
                  </button>

                  {activeSubsystem && (
                    <button
                      onClick={() => handleSubsystemSelect(null)}
                      className="px-3 py-1 bg-ares-red/20 hover:bg-ares-red/30 text-white border border-ares-red/40 ares-cut-xs text-[10px] font-black uppercase tracking-wider flex items-center gap-1 focus-visible:ring-1 focus-visible:ring-ares-cyan"
                      aria-label="Show All Subsystems"
                    >
                      Show Full Robot
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Optional Embedded Onshape CAD Viewer Drawer */}
            {activeRobot.onshapeEmbedUrl && canEmbedCadUrl(activeRobot.onshapeEmbedUrl) && (
              <section className="bg-white/5 border border-white/10 ares-cut-lg p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2">
                      <ExternalLink aria-hidden="true" size={16} className="text-ares-cyan" />
                      Live Onshape Direct Document Embed
                    </h2>
                    <p className="text-xs text-marble/70 mt-1">
                      Render the native Onshape workspace directly inside ARES portal with full feature
                      tree access.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowOnshapeEmbed(!showOnshapeEmbed)}
                    className="clipped-button bg-ares-red text-white text-xs uppercase font-bold"
                    aria-expanded={showOnshapeEmbed}
                  >
                    {showOnshapeEmbed ? "Hide Onshape Frame" : "Launch Live Onshape"}
                  </button>
                </div>

                {showOnshapeEmbed && (
                  <div className="aspect-video w-full bg-black ares-cut-md overflow-hidden border border-white/20 mt-4">
                    <iframe
                      src={activeRobot.onshapeEmbedUrl}
                      title={`${activeRobot.name} Onshape Model`}
                      className="w-full h-full border-0"
                      sandbox="allow-scripts allow-forms allow-popups allow-presentation"
                      allowFullScreen
                    />
                  </div>
                )}
              </section>
            )}

            {/* STEP & STL Download Center */}
            <section
              aria-label="CAD Downloads & Fabrication Files"
              className="bg-white/5 border border-white/10 ares-cut-lg p-6 sm:p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-ares-red/20 ares-cut-sm border border-ares-red/30">
                  <FileDown aria-hidden="true" size={20} className="text-ares-red" />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-wider text-white font-heading">
                    Fabrication & CAD File Center
                  </h2>
                  <p className="text-xs text-marble/70">
                    Open-source engineering models released under CC-BY-NC-SA 4.0 for FIRST teams.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-black/40 border border-white/10 p-5 ares-cut-md flex flex-col justify-between space-y-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-ares-cyan block mb-1">
                      Master CAD Assembly
                    </span>
                    <h3 className="text-base font-bold text-white uppercase">Full Robot STEP (.step)</h3>
                    <p className="text-xs text-marble/70 mt-1">
                      Parasolid/STEP master assembly compatible with SolidWorks, Autodesk Fusion, and Onshape.
                    </p>
                  </div>
                  <a
                    href={activeRobot.stepArchiveUrl}
                    download
                    className="clipped-button bg-ares-red text-white text-xs uppercase font-black flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  >
                    <Download aria-hidden="true" size={14} />
                    Download STEP ({activeRobot.totalWeightLbs} lbs)
                  </a>
                </div>

                <div className="bg-black/40 border border-white/10 p-5 ares-cut-md flex flex-col justify-between space-y-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-ares-gold block mb-1">
                      Additive Manufacturing
                    </span>
                    <h3 className="text-base font-bold text-white uppercase">3D Printable STL / 3MF Pack</h3>
                    <p className="text-xs text-marble/70 mt-1">
                      Pre-oriented high-strength parts (TPU wheels, sensor mounts, slide brackets).
                    </p>
                  </div>
                  <a
                    href={activeRobot.stlArchiveUrl}
                    download
                    className="clipped-button bg-white/10 hover:bg-white/20 text-white text-xs uppercase font-black flex items-center justify-center gap-2 border border-white/20 focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  >
                    <Layers aria-hidden="true" size={14} className="text-ares-gold" />
                    Download STL Pack
                  </a>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Subsystems Assembly Breakdown & Specs */}
          <div className="lg:col-span-4 space-y-6">
            {/* Robot Overview Card */}
            <div className="bg-black/60 border border-white/10 ares-cut-lg p-6 shadow-xl">
              <div className="border-b border-white/10 pb-4 mb-4">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-ares-cyan block mb-1">
                  Assembly Specs
                </span>
                <h2 className="text-2xl font-black uppercase tracking-tight text-white font-heading">
                  {activeRobot.name}
                </h2>
                <p className="text-xs text-marble/70 mt-2 leading-relaxed">
                  {activeRobot.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                <div className="bg-white/5 p-3 ares-cut-xs border border-white/5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-marble/50 block">
                    Total Mass
                  </span>
                  <span className="text-sm font-bold text-white">{activeRobot.totalWeightLbs} lbs</span>
                </div>
                <div className="bg-white/5 p-3 ares-cut-xs border border-white/5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-marble/50 block">
                    Envelope Size
                  </span>
                  <span className="text-sm font-bold text-white">{activeRobot.dimensions}</span>
                </div>
              </div>
            </div>

            {/* Subsystem Assembly List */}
            <div className="bg-black/60 border border-white/10 ares-cut-lg p-6 shadow-xl">
              <div className="flex items-center justify-between gap-2 mb-4 border-b border-white/10 pb-3">
                <h3 className="text-base font-black uppercase tracking-wider text-white flex items-center gap-2 font-heading">
                  <Layers aria-hidden="true" size={16} className="text-ares-gold" />
                  Subsystems Breakdown
                </h3>
                <span className="text-[10px] font-bold text-marble/50 uppercase tracking-widest">
                  {activeRobot.subsystems.length} Assemblies
                </span>
              </div>

              <div className="space-y-3" role="list" aria-label="Robot Subsystem Assemblies">
                {activeRobot.subsystems.map((subsystem) => {
                  const isSelected = subsystem.id === selectedSubsystemId;
                  return (
                    <article
                      key={subsystem.id}
                      role="listitem"
                      className={`p-4 ares-cut-sm border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-ares-cyan/15 border-ares-cyan text-white shadow-lg shadow-ares-cyan/10"
                          : "bg-white/5 border-white/10 hover:border-white/30 text-marble"
                      }`}
                      onClick={() => handleSubsystemSelect(isSelected ? null : subsystem.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                              style={{ backgroundColor: `#${subsystem.colorHex.toString(16).padStart(6, "0")}` }}
                              aria-hidden="true"
                            />
                            <h4 className="text-sm font-bold text-white uppercase leading-snug">
                              {subsystem.name}
                            </h4>
                          </div>
                          <p className="text-xs text-marble/70 line-clamp-2 mt-1">
                            {subsystem.description}
                          </p>
                        </div>
                        <ChevronRight
                          aria-hidden="true"
                          size={16}
                          className={`shrink-0 transition-transform ${
                            isSelected ? "rotate-90 text-ares-cyan" : "text-marble/40"
                          }`}
                        />
                      </div>

                      {/* Expanded Subsystem Details */}
                      {isSelected && (
                        <div className="mt-4 pt-3 border-t border-white/10 space-y-3 text-xs">
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-marble/50 font-bold block">Weight:</span>
                              <span className="text-white font-medium">{subsystem.weightLbs} lbs</span>
                            </div>
                            <div>
                              <span className="text-marble/50 font-bold block">Part Count:</span>
                              <span className="text-white font-medium">{subsystem.partCount} parts</span>
                            </div>
                            <div>
                              <span className="text-marble/50 font-bold block">Actuators:</span>
                              <span className="text-white font-medium">{subsystem.primaryActuator}</span>
                            </div>
                            <div>
                              <span className="text-marble/50 font-bold block">DOF:</span>
                              <span className="text-white font-medium">{subsystem.degreeOfFreedom}</span>
                            </div>
                          </div>

                          <div>
                            <span className="text-marble/50 font-bold block mb-1">Key Engineering Specs:</span>
                            <ul className="space-y-1 list-disc list-inside text-marble/80 text-[11px]">
                              {subsystem.keyFeatures.map((feat, idx) => (
                                <li key={idx}>{feat}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-2">
                            {isSafeExternalUrl(subsystem.onshapeTabUrl) && (
                              <a
                                href={subsystem.onshapeTabUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 bg-ares-red text-white text-[10px] font-black uppercase ares-cut-xs flex items-center gap-1 focus-visible:ring-1 focus-visible:ring-ares-cyan"
                              >
                                <ExternalLink aria-hidden="true" size={10} />
                                Onshape Tab
                              </a>
                            )}
                            <a
                              href={subsystem.stepDownloadUrl}
                              download
                              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase ares-cut-xs flex items-center gap-1 border border-white/15 focus-visible:ring-1 focus-visible:ring-ares-cyan"
                            >
                              <Download aria-hidden="true" size={10} />
                              STEP
                            </a>
                            <a
                              href={subsystem.stlDownloadUrl}
                              download
                              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase ares-cut-xs flex items-center gap-1 border border-white/15 focus-visible:ring-1 focus-visible:ring-ares-cyan"
                            >
                              <Layers aria-hidden="true" size={10} />
                              STL
                            </a>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
