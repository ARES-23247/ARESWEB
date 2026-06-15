"use client";

import React, { useState, useEffect, useRef } from "react";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { authenticatedFetch } from "@/lib/api";
import { 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from "firebase/firestore";
import { 
  Plus, 
  Trash2, 
  Save, 
  FilePlus, 
  Sliders, 
  Compass, 
  Activity, 
  RefreshCw, 
  Grid,
  Info,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Map,
  CheckCircle2,
  Link
} from "lucide-react";


interface FieldObstacle {
  id: string;
  name: string;
  x: number;      // EKF X in meters
  y: number;      // EKF Y in meters
  width: number;  // Width in meters
  height: number; // Height in meters
  isBlocking: boolean;
  obstacleType: "blocking" | "ramp";
  rampDirection?: "up" | "down" | "left" | "right";
}

interface ElementType {
  id: string;
  name: string;
  shape: "box" | "cylinder" | "sphere";
  width: number;       // For box (width along Y axis)
  height: number;      // For box (height along X axis)
  depth: number;       // Z axis height/thickness
  diameter?: number;   // For cylinder / sphere
  color: string;       // Hex color
  massKg: number;      // weight in kg
  movable: boolean;    // true = dynamic physics, false = static
}

interface FieldElementInstance {
  id: string;
  elementTypeId: string; // references ElementType.id
  x: number;             // EKF X
  y: number;             // EKF Y
  rotation: number;      // rotation in degrees
}

interface FieldConfig {
  id: string;
  name: string;
  updatedAt: number;
  fieldType?: "ftc" | "frc";
  gameYear?: string;
  xAxisDirection?: "up" | "down" | "left" | "right";
  yAxisDirection?: "up" | "down" | "left" | "right";
  redDriverStation?: "north" | "south" | "east" | "west";
  blueDriverStation?: "north" | "south" | "east" | "west";
  obstacles: FieldObstacle[];
  elementTypes?: ElementType[];
  elements?: FieldElementInstance[];
  cadUrl?: string;
  bgImageUrl?: string;
}

export default function FieldEditor() {
  const [configs, setConfigs] = useState<FieldConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");
  const [configName, setConfigName] = useState<string>("New Configuration");
  const [obstacles, setObstacles] = useState<FieldObstacle[]>([]);
  const [selectedObstacleId, setSelectedObstacleId] = useState<string | null>(null);

  // Field type, coordinate axis orientations, and driver stations configuration state
  const [fieldType, setFieldType] = useState<"ftc" | "frc">("ftc");
  const [gameYear, setGameYear] = useState<string>("2025-2026");
  const [xAxisDirection, setXAxisDirection] = useState<"up" | "down" | "left" | "right">("up");
  const [yAxisDirection, setYAxisDirection] = useState<"up" | "down" | "left" | "right">("left");
  const [redDriverStation, setRedDriverStation] = useState<"north" | "south" | "east" | "west">("south");
  const [blueDriverStation, setBlueDriverStation] = useState<"north" | "south" | "east" | "west">("north");

  // Display toggles
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showAllianceZones, setShowAllianceZones] = useState<boolean>(true);
  const [showCoordinateAxes, setShowCoordinateAxes] = useState<boolean>(true);

  // Custom game elements states
  const [editMode, setEditMode] = useState<"obstacles" | "elements">("obstacles");
  const [elementTypes, setElementTypes] = useState<ElementType[]>([]);
  const [elements, setElements] = useState<FieldElementInstance[]>([]);
  const [selectedElementTypeId, setSelectedElementTypeId] = useState<string | null>(null);
  const [selectedElementInstanceId, setSelectedElementInstanceId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // Local asset files upload states
  const [localBgFile, setLocalBgFile] = useState<File | null>(null);
  const [localGlbFile, setLocalGlbFile] = useState<File | null>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  // Client-side Three.js Top-Down GLB Snapshot generator
  const generateTopDownSnapshot = (glbBuffer: ArrayBuffer): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      try {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color("#0A0A0A");

        const fieldSize = 3.6576; // 12 feet
        const camera = new THREE.OrthographicCamera(
          -fieldSize / 2,
          fieldSize / 2,
          fieldSize / 2,
          -fieldSize / 2,
          0.1,
          100
        );
        camera.position.set(0, 10, 0);
        camera.lookAt(0, 0, 0);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
        dirLight.position.set(5, 15, 5);
        scene.add(dirLight);

        const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(512, 512);

        const loader = new GLTFLoader();
        loader.parse(
          glbBuffer,
          "",
          (gltf) => {
            scene.add(gltf.scene);
            renderer.render(scene, camera);
            renderer.domElement.toBlob((blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Failed to export WebGL canvas to Blob"));
              }
              renderer.dispose();
            }, "image/png");
          },
          (err) => {
            reject(err);
          }
        );
      } catch (e) {
        reject(e);
      }
    });
  };

  const handleGlbFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLocalGlbFile(file);
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const buffer = event.target?.result as ArrayBuffer;
        if (!buffer) return;
        try {
          const snapshotBlob = await generateTopDownSnapshot(buffer);
          const snapshotFile = new File([snapshotBlob], "snapshot_bg.png", { type: "image/png" });
          setLocalBgFile(snapshotFile);
        } catch (snapErr) {
          console.error("Failed to generate top-down snapshot from GLB:", snapErr);
          alert("Selected 3D file, but failed to generate a top-down preview. You can manually upload a 2D image instead.");
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("Error reading GLB file:", err);
    } finally {
      setLoading(false);
    }
  };

  // Onshape Field CAD settings state
  const [fieldDocId, setFieldDocId] = useState<string>("");
  const [fieldWkId, setFieldWkId] = useState<string>("");
  const [fieldElId, setFieldElId] = useState<string>("");
  const [fieldSyncMeta, setFieldSyncMeta] = useState<any | null>(null);
  const [isFieldConnected, setIsFieldConnected] = useState<boolean>(false);

  // Canvas Refs & States
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasSize, setCanvasSize] = useState<number>(450);

  // Interaction State
  const dragModeRef = useRef<"none" | "dragging" | "resizing">("none");
  const dragStartRef = useRef<{ mx: number; my: number; ox: number; oy: number; ow?: number; oh?: number; fixedX?: number; fixedY?: number }>({ mx: 0, my: 0, ox: 0, oy: 0 });

  const fieldW = fieldType === "ftc" ? 3.6576 : 16.542;
  const fieldH = fieldType === "ftc" ? 3.6576 : 8.007;

  const canvasW = fieldType === "ftc" ? canvasSize : Math.min(canvasSize * 1.6, 750);
  const canvasH = fieldType === "ftc" ? canvasSize : canvasW / (16.542 / 8.007);

  const scale = canvasW / fieldW;
  const centerX = canvasW / 2;
  const centerY = canvasH / 2;

  // Coordinate conversion helper functions
  const ekfToScreen = (x_ekf: number, y_ekf: number) => {
    let px = centerX;
    let py = centerY;

    // 1. Process X EKF component
    if (xAxisDirection === "right") px += x_ekf * scale;
    else if (xAxisDirection === "left") px -= x_ekf * scale;
    else if (xAxisDirection === "down") py += x_ekf * scale;
    else if (xAxisDirection === "up") py -= x_ekf * scale;

    // 2. Process Y EKF component
    if (yAxisDirection === "right") px += y_ekf * scale;
    else if (yAxisDirection === "left") px -= y_ekf * scale;
    else if (yAxisDirection === "down") py += y_ekf * scale;
    else if (yAxisDirection === "up") py -= y_ekf * scale;

    return { x: px, y: py };
  };

  const toPxX = (y_ekf: number) => ekfToScreen(0, y_ekf).x;
  const toPxY = (x_ekf: number) => ekfToScreen(x_ekf, 0).y;
  
  const toEkfX = (pxX: number, pxY: number) => {
    if (xAxisDirection === "right") {
      return (pxX - centerX) / scale;
    } else if (xAxisDirection === "left") {
      return (centerX - pxX) / scale;
    } else if (xAxisDirection === "down") {
      return (pxY - centerY) / scale;
    } else { // "up"
      return (centerY - pxY) / scale;
    }
  };

  const toEkfY = (pxX: number, pxY: number) => {
    if (yAxisDirection === "right") {
      return (pxX - centerX) / scale;
    } else if (yAxisDirection === "left") {
      return (centerX - pxX) / scale;
    } else if (yAxisDirection === "down") {
      return (pxY - centerY) / scale;
    } else { // "up"
      return (centerY - pxY) / scale;
    }
  };

  // Fetch all configurations from Firestore on load
  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "field_configs"), orderBy("updatedAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedConfigs: FieldConfig[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetchedConfigs.push({
          id: docSnap.id,
          name: data.name || "Untitled Layout",
          updatedAt: data.updatedAt || Date.now(),
          fieldType: data.fieldType || "ftc",
          gameYear: data.gameYear || "2025-2026",
          xAxisDirection: data.xAxisDirection || "up",
          yAxisDirection: data.yAxisDirection || "left",
          redDriverStation: data.redDriverStation || "south",
          blueDriverStation: data.blueDriverStation || "north",
          obstacles: data.obstacles || [],
          elementTypes: data.elementTypes || [],
          elements: data.elements || [],
          cadUrl: data.cadUrl || "",
          bgImageUrl: data.bgImageUrl || ""
        });
      });
      setConfigs(fetchedConfigs);
      
      // If we don't have a selection, load the first one or create default
      if (fetchedConfigs.length > 0 && !selectedConfigId) {
        loadConfig(fetchedConfigs[0]);
      }
    } catch (err) {
      console.error("Error fetching field configs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  // Set bgImage dynamically based on localBgFile selection or selectedConfigId URL change
  useEffect(() => {
    if (localBgFile) {
      const url = URL.createObjectURL(localBgFile);
      const img = new Image();
      img.src = url;
      img.onload = () => setBgImage(img);
      return () => URL.revokeObjectURL(url);
    } else {
      const activeConfig = configs.find((c) => c.id === selectedConfigId);
      const bgUrl = activeConfig?.bgImageUrl || "";
      if (bgUrl) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = bgUrl;
        img.onload = () => setBgImage(img);
        img.onerror = () => setBgImage(null);
      } else {
        setBgImage(null);
      }
    }
  }, [localBgFile, selectedConfigId, configs]);

  // Fetch global field CAD settings on mount
  useEffect(() => {
    const fetchFieldCadSettings = async () => {
      try {
        const fieldDocSnap = await getDoc(doc(db, "settings", "field_cad"));
        if (fieldDocSnap.exists()) {
          const fieldData = fieldDocSnap.data();
          setFieldDocId(fieldData.documentId || "");
          setFieldWkId(fieldData.workspaceId || "");
          setFieldElId(fieldData.elementId || "");
          setFieldSyncMeta(fieldData.syncMeta || null);
          setIsFieldConnected(!!fieldData.syncMeta);
        } else {
          // Defaults
          setFieldDocId("d_23247_ftc_field_into_the_deep");
          setFieldWkId("w_official_layout");
          setFieldElId("e_arena_mesh");
        }
      } catch (err) {
        console.warn("Failed to fetch field CAD settings on mount:", err);
      }
    };
    fetchFieldCadSettings();
  }, []);

  const handleSyncFieldCAD = async () => {
    if (!fieldDocId || !fieldWkId || !fieldElId) {
      alert("Please fill in all Field CAD credentials.");
      return;
    }

    setLoading(true);
    try {
      const res = await authenticatedFetch("/api/analytics/onshape-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: fieldDocId,
          workspaceId: fieldWkId,
          elementId: fieldElId,
          type: "field"
        })
      });
      if (res.status === 202 || res.ok) {
        alert("Field CAD synchronization initiated successfully in the background. The field layout and model will update in a few moments.");
      } else {
        const data = await res.json();
        alert("Failed to sync Field CAD: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      console.error("Failed to sync Field CAD:", err);
      alert("Failed to sync Field CAD: " + (err?.message || "Network connection or parsing error."));
    } finally {
      setLoading(false);
    }
  };

  // Set canvas size dynamically to fit container
  useEffect(() => {
    const handleResize = () => {
      const parent = canvasRef.current?.parentElement?.parentElement;
      if (parent) {
        const size = Math.min(parent.clientWidth - 48 || 600, 750);
        setCanvasSize(size);
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const loadConfig = (config: FieldConfig) => {
    setSelectedConfigId(config.id);
    setConfigName(config.name);
    setObstacles((config.obstacles || []).map(obs => ({
      ...obs,
      isBlocking: obs.isBlocking !== undefined ? obs.isBlocking : true,
      obstacleType: obs.obstacleType || "blocking"
    })));
    setElementTypes(config.elementTypes ? [...config.elementTypes] : []);
    setElements(config.elements ? [...config.elements] : []);
    setFieldType(config.fieldType || "ftc");
    setGameYear(config.gameYear || "2025-2026");
    setXAxisDirection(config.xAxisDirection || "up");
    setYAxisDirection(config.yAxisDirection || "left");
    setRedDriverStation(config.redDriverStation || "south");
    setBlueDriverStation(config.blueDriverStation || "north");
    setSelectedObstacleId(null);
    setSelectedElementInstanceId(null);
    setSelectedElementTypeId(null);
    setLocalBgFile(null);
    setLocalGlbFile(null);
  };

  const handleCreateNew = () => {
    setSelectedConfigId("");
    setConfigName("New Field Layout");
    setObstacles([]);
    
    // Pre-populate standard Element Types
    const defaultPollen: ElementType = {
      id: "type_pollen_" + Math.random().toString(36).substring(2, 5),
      name: "Pollen / Ball",
      shape: "sphere",
      width: 0.2,
      height: 0.2,
      depth: 0.2,
      diameter: 0.2,
      color: "#FFB81C", // ares-gold
      massKg: 0.1,
      movable: true
    };
    const defaultArtifact: ElementType = {
      id: "type_artifact_" + Math.random().toString(36).substring(2, 5),
      name: "Artifact / Block",
      shape: "box",
      width: 0.15,
      height: 0.15,
      depth: 0.15,
      color: "#C00000", // ares-red
      massKg: 0.15,
      movable: true
    };
    
    setElementTypes([defaultPollen, defaultArtifact]);
    setElements([]);
    setFieldType("ftc");
    setGameYear("2025-2026");
    setXAxisDirection("up");
    setYAxisDirection("left");
    setRedDriverStation("south");
    setBlueDriverStation("north");
    setSelectedObstacleId(null);
    setSelectedElementInstanceId(null);
    setSelectedElementTypeId(null);
    setLocalBgFile(null);
    setLocalGlbFile(null);
  };

  const handleAddObstacle = () => {
    const newObs: FieldObstacle = {
      id: Math.random().toString(36).substring(2, 9),
      name: `Obstacle ${obstacles.length + 1}`,
      x: 0, // center
      y: 0, // center
      width: 0.4, // 0.4 meters
      height: 0.4,
      isBlocking: true,
      obstacleType: "blocking"
    };
    setObstacles([...obstacles, newObs]);
    setSelectedObstacleId(newObs.id);
  };

  const handleDeleteObstacle = (id: string) => {
    setObstacles(obstacles.filter((obs) => obs.id !== id));
    if (selectedObstacleId === id) {
      setSelectedObstacleId(null);
    }
  };

  const handleUpdateObstacleField = (id: string, field: keyof FieldObstacle, value: any) => {
    setObstacles(
      obstacles.map((obs) => {
        if (obs.id === id) {
          return { ...obs, [field]: value };
        }
        return obs;
      })
    );
  };

  // Element Type Catalog Actions
  const handleAddElementType = () => {
    const newType: ElementType = {
      id: `type_${Math.random().toString(36).substring(2, 9)}`,
      name: `Element Type ${elementTypes.length + 1}`,
      shape: "sphere",
      width: 0.127, // 5 inches
      height: 0.127,
      depth: 0.127,
      diameter: 0.127,
      color: "#00E5FF", // Brand Cyan
      massKg: 0.1,
      movable: true
    };
    setElementTypes([...elementTypes, newType]);
    setSelectedElementTypeId(newType.id);
  };

  const handleDeleteElementType = (id: string) => {
    setElementTypes(elementTypes.filter((t) => t.id !== id));
    setElements(elements.filter((el) => el.elementTypeId !== id));
    if (selectedElementTypeId === id) {
      setSelectedElementTypeId(null);
    }
    if (selectedElementInstanceId) {
      const inst = elements.find((el) => el.id === selectedElementInstanceId);
      if (inst && inst.elementTypeId === id) {
        setSelectedElementInstanceId(null);
      }
    }
  };

  const handleUpdateElementTypeField = (id: string, field: keyof ElementType, value: any) => {
    setElementTypes(
      elementTypes.map((t) => {
        if (t.id === id) {
          const updated = { ...t, [field]: value };
          if (field === "diameter" && value) {
            updated.width = value;
            updated.height = value;
          }
          return updated;
        }
        return t;
      })
    );
  };

  // Placed Element Instance Actions
  const handleAddElementInstance = (elementTypeId: string) => {
    const type = elementTypes.find((t) => t.id === elementTypeId);
    if (!type) return;

    const newInst: FieldElementInstance = {
      id: `inst_${Math.random().toString(36).substring(2, 9)}`,
      elementTypeId,
      x: 0,
      y: 0,
      rotation: 0
    };
    setElements([...elements, newInst]);
    setSelectedElementInstanceId(newInst.id);
  };

  const handleDeleteElementInstance = (id: string) => {
    setElements(elements.filter((el) => el.id !== id));
    if (selectedElementInstanceId === id) {
      setSelectedElementInstanceId(null);
    }
  };

  const handleUpdateElementInstanceField = (id: string, field: keyof FieldElementInstance, value: any) => {
    setElements(
      elements.map((el) => {
        if (el.id === id) {
          return { ...el, [field]: value };
        }
        return el;
      })
    );
  };

  const handleSaveToCloud = async () => {
    if (!configName.trim()) {
      alert("Please enter a layout name.");
      return;
    }
    setSaving(true);
    try {
      const docId = selectedConfigId || `config_${Math.random().toString(36).substring(2, 9)}`;
      const docRef = doc(db, "field_configs", docId);

      let cadUrl = configs.find((c) => c.id === docId)?.cadUrl || "";
      let bgImageUrl = configs.find((c) => c.id === docId)?.bgImageUrl || "";

      if (localGlbFile) {
        const storagePath = `fields/layout_${docId}.glb`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, localGlbFile);
        cadUrl = await getDownloadURL(storageRef);
      }

      if (localBgFile) {
        const storagePath = `fields/layout_${docId}_bg.png`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, localBgFile);
        bgImageUrl = await getDownloadURL(storageRef);
      }
      
      const payload: any = {
        id: docId,
        name: configName,
        updatedAt: Date.now(),
        fieldType,
        gameYear,
        xAxisDirection,
        yAxisDirection,
        redDriverStation,
        blueDriverStation,
        obstacles: obstacles.map((obs) => ({
          id: obs.id,
          name: obs.name,
          x: Number(obs.x),
          y: Number(obs.y),
          width: Number(obs.width),
          height: Number(obs.height),
          isBlocking: Boolean(obs.isBlocking),
          obstacleType: obs.obstacleType,
          rampDirection: obs.rampDirection || null
        })),
        elementTypes: elementTypes.map((t) => ({
          id: t.id,
          name: t.name,
          shape: t.shape,
          width: Number(t.width),
          height: Number(t.height),
          depth: Number(t.depth),
          diameter: t.diameter ? Number(t.diameter) : undefined,
          color: t.color,
          massKg: Number(t.massKg),
          movable: Boolean(t.movable)
        })),
        elements: elements.map((el) => ({
          id: el.id,
          elementTypeId: el.elementTypeId,
          x: Number(el.x),
          y: Number(el.y),
          rotation: Number(el.rotation)
        }))
      };

      if (cadUrl) payload.cadUrl = cadUrl;
      if (bgImageUrl) payload.bgImageUrl = bgImageUrl;

      await setDoc(docRef, payload);
      setSelectedConfigId(docId);
      setLocalBgFile(null);
      setLocalGlbFile(null);
      await fetchConfigs();
      alert("Layout saved successfully to Firestore.");
    } catch (err: any) {
      console.error("Error saving layout:", err);
      alert("Failed to save layout: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLayout = async () => {
    if (!selectedConfigId) return;
    if (!confirm(`Are you sure you want to delete the layout "${configName}"?`)) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, "field_configs", selectedConfigId));
      setSelectedConfigId("");
      setConfigName("New Field Layout");
      setObstacles([]);
      setSelectedObstacleId(null);
      await fetchConfigs();
      alert("Layout deleted successfully.");
    } catch (err: any) {
      console.error("Error deleting layout:", err);
      alert("Failed to delete layout: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    ctx.scale(dpr, dpr);

    // 1. Draw Field Background
    if (bgImage) {
      ctx.drawImage(bgImage, 0, 0, canvasW, canvasH);
    } else {
      ctx.fillStyle = "#0A0A0A";
      ctx.fillRect(0, 0, canvasW, canvasH);
    }

    // Helper to check if a point is within the outer border padding (12px on all sides for driver stations)
    // 2. Draw Grid Lines (Only if showGrid is enabled)
    if (showGrid) {
      ctx.strokeStyle = bgImage ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      
      if (fieldType === "ftc") {
        // FTC: 6x6 tape tiles of 2ft (0.6096m)
        for (let i = -3; i <= 3; i++) {
          const offset = i * 0.6096;
          // Vertical EKF constant Y lines (from -1.8288 to 1.8288 EKF X)
          const pV1 = ekfToScreen(-1.8288, offset);
          const pV2 = ekfToScreen(1.8288, offset);
          ctx.beginPath();
          ctx.moveTo(pV1.x, pV1.y);
          ctx.lineTo(pV2.x, pV2.y);
          ctx.stroke();

          // Horizontal EKF constant X lines (from -1.8288 to 1.8288 EKF Y)
          const pH1 = ekfToScreen(offset, -1.8288);
          const pH2 = ekfToScreen(offset, 1.8288);
          ctx.beginPath();
          ctx.moveTo(pH1.x, pH1.y);
          ctx.lineTo(pH2.x, pH2.y);
          ctx.stroke();
        }
      } else {
        // FRC: 1-meter grid spacing
        const maxHalfX = Math.ceil(fieldH / 2);
        const maxHalfY = Math.ceil(fieldW / 2);
        
        ctx.strokeStyle = bgImage ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.02)";
        for (let x = -maxHalfX; x <= maxHalfX; x++) {
          const pV1 = ekfToScreen(x, -fieldW / 2);
          const pV2 = ekfToScreen(x, fieldW / 2);
          ctx.beginPath();
          ctx.moveTo(pV1.x, pV1.y);
          ctx.lineTo(pV2.x, pV2.y);
          ctx.stroke();
        }
        for (let y = -maxHalfY; y <= maxHalfY; y++) {
          const pH1 = ekfToScreen(-fieldH / 2, y);
          const pH2 = ekfToScreen(fieldH / 2, y);
          ctx.beginPath();
          ctx.moveTo(pH1.x, pH1.y);
          ctx.lineTo(pH2.x, pH2.y);
          ctx.stroke();
        }

        // Draw centerline (EKF X = 0 or Y = 0)
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1.5;
        const pC1 = ekfToScreen(0, -fieldW / 2);
        const pC2 = ekfToScreen(0, fieldW / 2);
        ctx.beginPath();
        ctx.moveTo(pC1.x, pC1.y);
        ctx.lineTo(pC2.x, pC2.y);
        ctx.stroke();
      }
    }

    // 3. Draw Outer Perimeter Wall
    ctx.strokeStyle = bgImage ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 2;
    const c1 = ekfToScreen(-fieldH / 2, -fieldW / 2);
    const c2 = ekfToScreen(fieldH / 2, fieldW / 2);
    const minWallX = Math.min(c1.x, c2.x);
    const maxWallX = Math.max(c1.x, c2.x);
    const minWallY = Math.min(c1.y, c2.y);
    const maxWallY = Math.max(c1.y, c2.y);
    ctx.strokeRect(minWallX, minWallY, maxWallX - minWallX, maxWallY - minWallY);

    // 4. Draw Center Origin Crosshair & EKF Axes Indicators (Only if showCoordinateAxes is enabled)
    if (showCoordinateAxes) {
      ctx.strokeStyle = "rgba(245, 158, 11, 0.25)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX - 8, centerY);
      ctx.lineTo(centerX + 8, centerY);
      ctx.moveTo(centerX, centerY - 8);
      ctx.lineTo(centerX, centerY + 8);
      ctx.stroke();

      // +X arrow indicator (red)
      const pXEnd = ekfToScreen(0.4, 0); // 0.4m arrow
      ctx.strokeStyle = "#C00000"; // ares-red
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(pXEnd.x, pXEnd.y);
      ctx.stroke();

      ctx.fillStyle = "#C00000";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      // Draw +X text slightly offset
      const xTextOffset = 8;
      let tx = pXEnd.x;
      let ty = pXEnd.y;
      if (pXEnd.x > centerX) tx += xTextOffset;
      else if (pXEnd.x < centerX) tx -= xTextOffset;
      if (pXEnd.y > centerY) ty += xTextOffset;
      else if (pXEnd.y < centerY) ty -= xTextOffset;
      ctx.fillText("+X", tx, ty + 3);

      // +Y arrow indicator (blue)
      const pYEnd = ekfToScreen(0, 0.4);
      ctx.strokeStyle = "#00E5FF"; // ares-cyan
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(pYEnd.x, pYEnd.y);
      ctx.stroke();

      ctx.fillStyle = "#00E5FF";
      ctx.fillText("+Y", pYEnd.x + (pYEnd.x > centerX ? 8 : (pYEnd.x < centerX ? -8 : 0)), pYEnd.y + (pYEnd.y > centerY ? 8 : (pYEnd.y < centerY ? -8 : 0)) + 3);
    }

    // 5. Draw Driver's Stations
    const drawDriverStation = (side: "north" | "south" | "east" | "west", color: string, text: string) => {
      ctx.fillStyle = color;
      ctx.save();
      if (side === "north") {
        ctx.fillRect(0, 0, canvasW, 12);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.fillText(text, canvasW / 2, 9);
      } else if (side === "south") {
        ctx.fillRect(0, canvasH - 12, canvasW, 12);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.fillText(text, canvasW / 2, canvasH - 3);
      } else if (side === "west") {
        ctx.fillRect(0, 0, 12, canvasH);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.translate(9, canvasH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(text, 0, 0);
      } else if (side === "east") {
        ctx.fillRect(canvasW - 12, 0, 12, canvasH);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.translate(canvasW - 9, canvasH / 2);
        ctx.rotate(Math.PI / 2);
        ctx.fillText(text, 0, 0);
      }
      ctx.restore();
    };

    drawDriverStation(redDriverStation, "rgba(192, 0, 0, 0.7)", "RED DRIVER STATION");
    drawDriverStation(blueDriverStation, "rgba(59, 130, 246, 0.7)", "BLUE DRIVER STATION");

    // 6. Draw red and blue zones/substations (Only for FTC and if no custom background image and enabled)
    if (fieldType === "ftc" && !bgImage && showAllianceZones) {
      ctx.fillStyle = "rgba(239, 68, 68, 0.05)";
      ctx.beginPath();
      const pRedCenter = ekfToScreen(1.8288, 1.8288);
      ctx.arc(pRedCenter.x, pRedCenter.y, 0.508 * scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(59, 130, 246, 0.05)";
      ctx.beginPath();
      const pBlueCenter = ekfToScreen(-1.8288, -1.8288);
      ctx.arc(pBlueCenter.x, pBlueCenter.y, 0.508 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // 7. Draw Obstacles
    obstacles.forEach((obs) => {
      const isSelected = obs.id === selectedObstacleId;
      const obsHalfW = obs.width / 2;
      const obsHalfH = obs.height / 2;

      // Map bounds properly using EKF coordinates to handle axis orientation changes
      const p1 = ekfToScreen(obs.x - obsHalfH, obs.y - obsHalfW);
      const p2 = ekfToScreen(obs.x + obsHalfH, obs.y + obsHalfW);
      const leftPx = Math.min(p1.x, p2.x);
      const topPx = Math.min(p1.y, p2.y);
      const wPx = Math.abs(p1.x - p2.x);
      const hPx = Math.abs(p1.y - p2.y);

      // Save context in case of dashed lines for non-blocking
      ctx.save();

      // Configure border/dash
      if (!obs.isBlocking || obs.obstacleType === "ramp") {
        ctx.setLineDash([4, 4]);
      }

      // 1. Draw Obstacle Body Fill
      if (obs.obstacleType === "ramp" && obs.rampDirection) {
        // Linear gradient representing the ramp incline slope
        let grad;
        if (obs.rampDirection === "up") {
          grad = ctx.createLinearGradient(leftPx, topPx + hPx, leftPx, topPx);
        } else if (obs.rampDirection === "down") {
          grad = ctx.createLinearGradient(leftPx, topPx, leftPx, topPx + hPx);
        } else if (obs.rampDirection === "left") {
          grad = ctx.createLinearGradient(leftPx + wPx, topPx, leftPx, topPx);
        } else { // "right"
          grad = ctx.createLinearGradient(leftPx, topPx, leftPx + wPx, topPx);
        }
        grad.addColorStop(0, isSelected ? "rgba(245, 158, 11, 0.05)" : "rgba(255, 255, 255, 0.02)");
        grad.addColorStop(1, isSelected ? "rgba(245, 158, 11, 0.25)" : "rgba(245, 158, 11, 0.15)");
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = isSelected ? "rgba(245, 158, 11, 0.2)" : "rgba(255, 255, 255, 0.07)";
      }
      ctx.fillRect(leftPx, topPx, wPx, hPx);

      // 2. Draw Obstacle Border
      ctx.strokeStyle = isSelected 
        ? "#F59E0B" 
        : (obs.obstacleType === "ramp" ? "rgba(245, 158, 11, 0.35)" : "rgba(255, 255, 255, 0.25)");
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(leftPx, topPx, wPx, hPx);
      ctx.restore();

      // 3. Draw Incline Arrow for Ramps
      if (obs.obstacleType === "ramp" && obs.rampDirection) {
        ctx.save();
        ctx.strokeStyle = isSelected ? "#F59E0B" : "rgba(245, 158, 11, 0.5)";
        ctx.lineWidth = 1.5;
        const cx = leftPx + wPx / 2;
        const cy = topPx + hPx / 2;
        ctx.beginPath();
        if (obs.rampDirection === "up") {
          ctx.moveTo(cx, cy + 8); ctx.lineTo(cx, cy - 8);
          ctx.lineTo(cx - 3, cy - 5); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx + 3, cy - 5);
        } else if (obs.rampDirection === "down") {
          ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8);
          ctx.lineTo(cx - 3, cy + 5); ctx.moveTo(cx, cy + 8); ctx.lineTo(cx + 3, cy + 5);
        } else if (obs.rampDirection === "left") {
          ctx.moveTo(cx + 8, cy); ctx.lineTo(cx - 8, cy);
          ctx.lineTo(cx - 5, cy - 3); ctx.moveTo(cx - 8, cy); ctx.lineTo(cx - 5, cy + 3);
        } else { // "right"
          ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy);
          ctx.lineTo(cx + 5, cy - 3); ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 5, cy + 3);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Name label
      ctx.fillStyle = isSelected ? "#F59E0B" : "rgba(255, 255, 255, 0.6)";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(obs.name, leftPx + wPx / 2, topPx + hPx / 2 - 3);

      // Bounding dimensions and type label (faint)
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.font = "8px monospace";
      ctx.fillText(
        `${obs.width.toFixed(2)}m x ${obs.height.toFixed(2)}m`, 
        leftPx + wPx / 2, 
        topPx + hPx / 2 + 7
      );
      if (obs.obstacleType === "ramp") {
        ctx.fillStyle = "rgba(245, 158, 11, 0.5)";
        ctx.fillText("RAMP", leftPx + wPx / 2, topPx + hPx / 2 + 16);
      }

      // Resize Handle at bottom-right corner (using absolute screen coordinates)
      if (isSelected) {
        ctx.fillStyle = "#F59E0B";
        ctx.beginPath();
        ctx.arc(leftPx + wPx, topPx + hPx, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    // 8. Draw Field Elements
    elements.forEach((el) => {
      const type = elementTypes.find((t) => t.id === el.elementTypeId);
      if (!type) return;

      const isSelected = el.id === selectedElementInstanceId;
      const sizeMeters = type.shape === "box" ? Math.max(type.width, type.height) : (type.diameter || 0.15);
      
      const pEl = ekfToScreen(el.x, el.y);
      const pxX = pEl.x;
      const pxY = pEl.y;

      ctx.save();
      ctx.translate(pxX, pxY);
      ctx.rotate(-el.rotation * Math.PI / 180);

      // Draw Shape
      ctx.fillStyle = type.color;
      ctx.strokeStyle = isSelected ? "#00E5FF" : "rgba(255,255,255,0.4)";
      ctx.lineWidth = isSelected ? 2.5 : 1;

      if (type.shape === "box") {
        const wPx = type.width * scale;
        const hPx = type.height * scale;
        ctx.fillRect(-wPx / 2, -hPx / 2, wPx, hPx);
        ctx.strokeRect(-wPx / 2, -hPx / 2, wPx, hPx);
      } else {
        // cylinder or sphere drawn as circle in 2D
        const radiusPx = ((type.diameter || 0.15) / 2) * scale;
        ctx.beginPath();
        ctx.arc(0, 0, radiusPx, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -radiusPx);
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.stroke();
      }

      ctx.restore();

      // Draw label name slightly below
      ctx.fillStyle = isSelected ? "#00E5FF" : "rgba(255, 255, 255, 0.7)";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(type.name, pxX, pxY + (sizeMeters * scale) / 2 + 10);
    });

  }, [obstacles, selectedObstacleId, canvasSize, bgImage, editMode, elements, elementTypes, selectedElementInstanceId, fieldType, xAxisDirection, yAxisDirection, redDriverStation, blueDriverStation, showGrid, showAllianceZones, showCoordinateAxes, canvasW, canvasH, fieldW, fieldH, scale]);

  // Mouse Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert mouse to EKF space coordinates
    const mx = toEkfX(mouseX, mouseY);
    const my = toEkfY(mouseX, mouseY);

    if (editMode === "obstacles") {
      // 1. Check if we clicked on the active obstacle's resize handle
      if (selectedObstacleId) {
        const obs = obstacles.find((o) => o.id === selectedObstacleId);
        if (obs) {
          const obsHalfW = obs.width / 2;
          const obsHalfH = obs.height / 2;
          const p1 = ekfToScreen(obs.x - obsHalfH, obs.y - obsHalfW);
          const p2 = ekfToScreen(obs.x + obsHalfH, obs.y + obsHalfW);
          const leftPx = Math.min(p1.x, p2.x);
          const topPx = Math.min(p1.y, p2.y);
          const wPx = Math.abs(p1.x - p2.x);
          const hPx = Math.abs(p1.y - p2.y);

          const handleX = leftPx + wPx;
          const handleY = topPx + hPx;
          const dist = Math.hypot(mouseX - handleX, mouseY - handleY);

          if (dist <= 10) {
            dragModeRef.current = "resizing";
            dragStartRef.current = {
              mx,
              my,
              ox: obs.x,
              oy: obs.y,
              ow: obs.width,
              oh: obs.height,
              fixedX: toEkfX(leftPx, topPx),
              fixedY: toEkfY(leftPx, topPx)
            };
            return;
          }
        }
      }

      // 2. Check if we clicked inside any obstacle
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        const halfW = obs.width / 2;
        const halfH = obs.height / 2;

        const insideX = mx >= obs.x - halfH && mx <= obs.x + halfH;
        const insideY = my >= obs.y - halfW && my <= obs.y + halfW;

        if (insideX && insideY) {
          setSelectedObstacleId(obs.id);
          setSelectedElementInstanceId(null);
          dragModeRef.current = "dragging";
          dragStartRef.current = {
            mx,
            my,
            ox: obs.x,
            oy: obs.y
          };
          return;
        }
      }

      // 3. Clicked empty space
      setSelectedObstacleId(null);
      dragModeRef.current = "none";
    } else {
      // editMode === "elements"
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        const type = elementTypes.find((t) => t.id === el.elementTypeId);
        if (!type) continue;

        const radius = type.shape === "box" ? Math.max(type.width, type.height) / 2 : (type.diameter || 0.15) / 2;
        const dist = Math.hypot(mx - el.x, my - el.y);

        if (dist <= radius + 0.08) { // 8cm click padding
          setSelectedElementInstanceId(el.id);
          setSelectedObstacleId(null);
          dragModeRef.current = "dragging";
          dragStartRef.current = {
            mx,
            my,
            ox: el.x,
            oy: el.y
          };
          return;
        }
      }

      setSelectedElementInstanceId(null);
      dragModeRef.current = "none";
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragModeRef.current === "none") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const mx = toEkfX(mouseX, mouseY);
    const my = toEkfY(mouseX, mouseY);

    if (dragModeRef.current === "dragging") {
      if (editMode === "obstacles" && selectedObstacleId) {
        const diffX = mx - dragStartRef.current.mx;
        const diffY = my - dragStartRef.current.my;

        const nextX = Math.max(-1.8, Math.min(1.8, dragStartRef.current.ox + diffX));
        const nextY = Math.max(-1.8, Math.min(1.8, dragStartRef.current.oy + diffY));

        setObstacles(
          obstacles.map((obs) => {
            if (obs.id === selectedObstacleId) {
              return {
                ...obs,
                x: Number(nextX.toFixed(3)),
                y: Number(nextY.toFixed(3))
              };
            }
            return obs;
          })
        );
      } else if (editMode === "elements" && selectedElementInstanceId) {
        const diffX = mx - dragStartRef.current.mx;
        const diffY = my - dragStartRef.current.my;

        const nextX = Math.max(-1.8, Math.min(1.8, dragStartRef.current.ox + diffX));
        const nextY = Math.max(-1.8, Math.min(1.8, dragStartRef.current.oy + diffY));

        setElements(
          elements.map((el) => {
            if (el.id === selectedElementInstanceId) {
              return {
                ...el,
                x: Number(nextX.toFixed(3)),
                y: Number(nextY.toFixed(3))
              };
            }
            return el;
          })
        );
      }
    } else if (dragModeRef.current === "resizing" && selectedObstacleId) {
      const drag = dragStartRef.current;
      if (drag.fixedX === undefined || drag.fixedY === undefined || drag.ow === undefined || drag.oh === undefined) return;

      const newHeight = Math.max(0.1, Math.abs(drag.fixedX - mx));
      const newWidth = Math.max(0.1, Math.abs(drag.fixedY - my));

      const newX = (drag.fixedX + mx) / 2;
      const newY = (drag.fixedY + my) / 2;

      setObstacles(
        obstacles.map((obs) => {
          if (obs.id === selectedObstacleId) {
            return {
              ...obs,
              width: Number(newWidth.toFixed(3)),
              height: Number(newHeight.toFixed(3)),
              x: Number(newX.toFixed(3)),
              y: Number(newY.toFixed(3))
            };
          }
          return obs;
        })
      );
    }
  };

  const handleMouseUp = () => {
    dragModeRef.current = "none";
  };

  const handleCanvasKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!selectedObstacleId) {
      if (e.key === "Enter" || e.key === " ") {
        if (obstacles.length > 0) {
          setSelectedObstacleId(obstacles[0].id);
          e.preventDefault();
        }
      }
      return;
    }

    const step = e.shiftKey ? 0.5 : 0.05;
    const obs = obstacles.find((o) => o.id === selectedObstacleId);
    if (!obs) return;

    const pCenter = ekfToScreen(obs.x, obs.y);
    const pXPlus = ekfToScreen(obs.x + step, obs.y);
    const pYPlus = ekfToScreen(obs.x, obs.y + step);

    const screenDX_for_ekfX = pXPlus.x - pCenter.x;
    const screenDY_for_ekfX = pXPlus.y - pCenter.y;
    const screenDX_for_ekfY = pYPlus.x - pCenter.x;
    const screenDY_for_ekfY = pYPlus.y - pCenter.y;

    let nextX = obs.x;
    let nextY = obs.y;

    if (e.key === "ArrowUp") {
      if (Math.abs(screenDY_for_ekfX) > Math.abs(screenDY_for_ekfY)) {
        nextX += screenDY_for_ekfX < 0 ? step : -step;
      } else {
        nextY += screenDY_for_ekfY < 0 ? step : -step;
      }
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      if (Math.abs(screenDY_for_ekfX) > Math.abs(screenDY_for_ekfY)) {
        nextX += screenDY_for_ekfX > 0 ? step : -step;
      } else {
        nextY += screenDY_for_ekfY > 0 ? step : -step;
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      if (Math.abs(screenDX_for_ekfX) > Math.abs(screenDX_for_ekfY)) {
        nextX += screenDX_for_ekfX < 0 ? step : -step;
      } else {
        nextY += screenDX_for_ekfY < 0 ? step : -step;
      }
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      if (Math.abs(screenDX_for_ekfX) > Math.abs(screenDX_for_ekfY)) {
        nextX += screenDX_for_ekfX > 0 ? step : -step;
      } else {
        nextY += screenDX_for_ekfY > 0 ? step : -step;
      }
      e.preventDefault();
    }

    if (nextX !== obs.x || nextY !== obs.y) {
      setObstacles(
        obstacles.map((o) =>
          o.id === obs.id
            ? { ...o, x: Number(nextX.toFixed(3)), y: Number(nextY.toFixed(3)) }
            : o
        )
      );
    }

    if (e.key === "Escape") {
      setSelectedObstacleId(null);
      e.preventDefault();
    } else if (e.key === "Tab") {
      const idx = obstacles.findIndex((o) => o.id === selectedObstacleId);
      if (idx !== -1) {
        const nextIdx = (idx + 1) % obstacles.length;
        setSelectedObstacleId(obstacles[nextIdx].id);
        e.preventDefault();
      }
    }
  };

  const selectedObs = obstacles.find((o) => o.id === selectedObstacleId);

  return (
    <div className="space-y-8">
      {/* Header Deck */}
      <header className="border-b border-white/5 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
            <Grid size={12} /> Robot Field Config
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter font-heading">
            Field Editor
          </h1>
          <p className="text-marble/70 text-xs md:text-sm mt-1.5 font-medium max-w-xl">
            Visually design and configure FTC and FRC field layouts. Adjust coordinate axes, define driver's stations, place game elements, and draw blocking walls or non-blocking ramps.
          </p>
        </div>

        {/* Global Save/Load Configuration Row */}
        <div className="flex flex-wrap items-center gap-3 bg-black/40 border border-white/10 p-3 rounded-2xl shrink-0">
          <select
            value={selectedConfigId}
            onChange={(e) => {
              const cfg = configs.find((c) => c.id === e.target.value);
              if (cfg) loadConfig(cfg);
            }}
            className="bg-black/50 text-white text-xs border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:border-ares-cyan uppercase font-bold cursor-pointer min-w-[150px]"
          >
            {configs.length === 0 ? (
              <option value="" className="bg-neutral-900">No Layouts Saved</option>
            ) : (
              configs.map((c) => (
                <option key={c.id} value={c.id} className="bg-neutral-900 text-white">
                  {c.name}
                </option>
              ))
            )}
          </select>

          <button
            onClick={handleCreateNew}
            className="px-3.5 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/5 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all"
            title="Create new empty configuration layout"
          >
            <FilePlus size={12} /> New Layout
          </button>
        </div>
      </header>

      {/* Main Workspace: Left canvas grid, Right sidebar controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Visual Canvas Panel */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="glass-card p-6 border border-white/10 bg-black/60 shadow-2xl flex flex-col items-center justify-center">
            
            <div className="flex items-center justify-between w-full mb-4 border-b border-white/5 pb-3">
              <span className="text-[10px] uppercase font-black tracking-widest text-ares-gold flex items-center gap-1.5">
                <Compass size={12} /> Interactive 2D Map View (12ft Grid)
              </span>
              <span className="text-[9px] font-mono text-marble/35 uppercase">
                EKF Origin: Center (0, 0)
              </span>
            </div>

            <div className="relative border border-white/10 bg-neutral-950 rounded-xl overflow-hidden shadow-inner cursor-crosshair">
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onKeyDown={handleCanvasKeyDown}
                tabIndex={0}
                role="img"
                aria-label="Interactive 2D Field Map. Use Arrow keys to move the selected obstacle, Tab to cycle obstacles, and Escape to deselect."
                style={{ width: `${canvasW}px`, height: `${canvasH}px` }}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              />
            </div>
            
            <div className="flex items-center gap-2.5 mt-4 text-[10px] leading-relaxed text-marble/40 font-mono">
              <Info size={11} className="text-ares-gold shrink-0 mt-0.5" />
              <span>
                Click empty space to deselect. Drag obstacles to move. Drag the gold corner handle to resize.
              </span>
            </div>

          </div>
        </div>

        {/* Configuration settings & Properties Panel */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {/* Mode Select Tabs */}
          <div className="flex bg-black/40 border border-white/10 p-1 rounded-xl w-full">
            <button
              onClick={() => setEditMode("obstacles")}
              className={`w-1/2 py-2 text-center text-[10px] uppercase font-black tracking-widest rounded-lg transition-all cursor-pointer ${
                editMode === "obstacles"
                  ? "bg-ares-gold text-black font-bold"
                  : "text-marble/60 hover:text-white"
              }`}
            >
              Obstacles Mode
            </button>
            <button
              onClick={() => setEditMode("elements")}
              className={`w-1/2 py-2 text-center text-[10px] uppercase font-black tracking-widest rounded-lg transition-all cursor-pointer ${
                editMode === "elements"
                  ? "bg-ares-gold text-black font-bold"
                  : "text-marble/60 hover:text-white"
              }`}
            >
              Game Elements Mode
            </button>
          </div>

          {/* Metadata Card */}
          <div className="glass-card p-6 border border-white/10 bg-black/60 shadow-2xl space-y-4">
            <h3 className="text-xs font-black uppercase text-white tracking-widest font-heading border-b border-white/5 pb-3 flex items-center gap-2">
              <Sliders size={14} className="text-ares-gold" /> Layout Settings
            </h3>
            
            <div className="flex flex-col gap-2">
              <label className="text-[9px] uppercase font-black tracking-widest text-marble/55">
                Layout Name
              </label>
              <input
                type="text"
                value={configName}
                onChange={(e) => setConfigName(e.target.value)}
                placeholder="Championship Finals layout..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-semibold text-xs focus:outline-none focus:border-ares-cyan transition-colors"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[9px] uppercase font-black tracking-widest text-marble/55">
                Game Year / Season
              </label>
              <input
                type="text"
                value={gameYear}
                onChange={(e) => setGameYear(e.target.value)}
                placeholder="e.g., 2025-2026..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-semibold text-xs focus:outline-none focus:border-ares-cyan transition-colors"
              />
            </div>

            {/* Field Configuration Subsection */}
            <div className="border-t border-white/5 pt-3 space-y-3">
              <span className="text-[9px] uppercase font-black tracking-widest text-ares-gold block font-semibold">
                Field Parameters
              </span>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    Field Type
                  </label>
                  <select
                    value={fieldType}
                    onChange={(e) => setFieldType(e.target.value as "ftc" | "frc")}
                    className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-ares-cyan cursor-pointer"
                  >
                    <option value="ftc">FTC (Square)</option>
                    <option value="frc">FRC (2:1 Rect)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    Red Station
                  </label>
                  <select
                    value={redDriverStation}
                    onChange={(e) => setRedDriverStation(e.target.value as any)}
                    className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-ares-cyan cursor-pointer"
                  >
                    <option value="north">North</option>
                    <option value="south">South</option>
                    <option value="east">East</option>
                    <option value="west">West</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    Blue Station
                  </label>
                  <select
                    value={blueDriverStation}
                    onChange={(e) => setBlueDriverStation(e.target.value as any)}
                    className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-ares-cyan cursor-pointer"
                  >
                    <option value="north">North</option>
                    <option value="south">South</option>
                    <option value="east">East</option>
                    <option value="west">West</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    +X Direction
                  </label>
                  <select
                    value={xAxisDirection}
                    onChange={(e) => setXAxisDirection(e.target.value as any)}
                    className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-ares-cyan cursor-pointer"
                  >
                    <option value="up">Up (North)</option>
                    <option value="down">Down (South)</option>
                    <option value="left">Left (West)</option>
                    <option value="right">Right (East)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    +Y Direction
                  </label>
                  <select
                    value={yAxisDirection}
                    onChange={(e) => setYAxisDirection(e.target.value as any)}
                    className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-ares-cyan cursor-pointer"
                  >
                    <option value="up">Up (North)</option>
                    <option value="down">Down (South)</option>
                    <option value="left">Left (West)</option>
                    <option value="right">Right (East)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Display Options Subsection */}
            <div className="border-t border-white/5 pt-3 space-y-2">
              <span className="text-[9px] uppercase font-black tracking-widest text-ares-gold block font-semibold">
                Display Options
              </span>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="show-grid-chk"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    className="w-4 h-4 accent-ares-gold cursor-pointer"
                  />
                  <label htmlFor="show-grid-chk" className="text-[10px] font-mono text-white cursor-pointer select-none">
                    Show Grid Lines
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="show-alliance-chk"
                    checked={showAllianceZones}
                    onChange={(e) => setShowAllianceZones(e.target.checked)}
                    className="w-4 h-4 accent-ares-gold cursor-pointer"
                  />
                  <label htmlFor="show-alliance-chk" className="text-[10px] font-mono text-white cursor-pointer select-none font-medium">
                    Show Alliance Zones (FTC Only)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="show-axes-chk"
                    checked={showCoordinateAxes}
                    onChange={(e) => setShowCoordinateAxes(e.target.checked)}
                    className="w-4 h-4 accent-ares-gold cursor-pointer"
                  />
                  <label htmlFor="show-axes-chk" className="text-[10px] font-mono text-white cursor-pointer select-none">
                    Show Coordinate Axes
                  </label>
                </div>
              </div>
            </div>

            {/* Field Assets Subsection */}
            <div className="border-t border-white/5 pt-3 space-y-3">
              <span className="text-[9px] uppercase font-black tracking-widest text-ares-gold block font-semibold font-heading">
                Field Assets (2D/3D)
              </span>
              
              <div className="space-y-3">
                {/* 3D Model Upload */}
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    3D Field Model (.glb, .gltf)
                  </label>
                  <input
                    type="file"
                    accept=".glb,.gltf"
                    onChange={handleGlbFileChange}
                    className="w-full text-[10px] text-marble/55 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:bg-ares-gold file:text-black hover:file:bg-ares-gold-soft file:cursor-pointer cursor-pointer bg-black/30 p-1.5 rounded-lg border border-white/5 focus:outline-none"
                  />
                  {(localGlbFile || configs.find((c) => c.id === selectedConfigId)?.cadUrl) && (
                    <p className="text-[8px] font-mono text-ares-success mt-0.5">
                      ✓ 3D Model GLB loaded
                    </p>
                  )}
                </div>

                {/* 2D Background Upload */}
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                    2D Field Image (.png, .jpg)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setLocalBgFile(file);
                    }}
                    className="w-full text-[10px] text-marble/55 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:bg-ares-gold file:text-black hover:file:bg-ares-gold-soft file:cursor-pointer cursor-pointer bg-black/30 p-1.5 rounded-lg border border-white/5 focus:outline-none"
                  />
                  {(localBgFile || configs.find((c) => c.id === selectedConfigId)?.bgImageUrl) && (
                    <p className="text-[8px] font-mono text-ares-success mt-0.5">
                      ✓ 2D Background loaded
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleSaveToCloud}
                disabled={saving}
                className="w-full bg-ares-gold text-black hover:bg-ares-gold-soft py-3 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-2 font-bold cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save size={12} /> Save Layout
                  </>
                )}
              </button>

              <button
                onClick={handleDeleteLayout}
                disabled={!selectedConfigId || loading}
                className="w-full bg-ares-red/10 hover:bg-ares-red/20 text-ares-red-light border border-ares-red/20 py-3 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-2 font-bold cursor-pointer disabled:opacity-20 focus:ring-2 focus:ring-ares-cyan focus:outline-none"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>

          {/* Active Panel conditional rendering */}
          {editMode === "obstacles" ? (
            /* Active Obstacles & Selected Item Properties */
            <div className="glass-card p-6 border border-white/10 bg-black/60 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <h3 className="text-xs font-black uppercase text-white tracking-widest font-heading flex items-center gap-2">
                  <Activity size={14} className="text-ares-gold" /> Obstacle Inventory
                </h3>
                <button
                  onClick={handleAddObstacle}
                  className="px-2.5 py-1 bg-ares-gold/15 hover:bg-ares-gold/25 text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30 text-[9px] uppercase font-black tracking-widest rounded-lg flex items-center gap-1 transition-all cursor-pointer font-bold"
                >
                  <Plus size={10} /> Add Box
                </button>
              </div>

              {/* List of Obstacles */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/5 pr-1">
                {obstacles.length === 0 ? (
                  <div className="text-[10px] font-mono text-marble/35 uppercase text-center py-6">
                    No obstacles placed yet.
                  </div>
                ) : (
                  obstacles.map((obs) => {
                    const isSelected = obs.id === selectedObstacleId;
                    return (
                      <div
                        key={obs.id}
                        onClick={() => setSelectedObstacleId(obs.id)}
                        className={`flex items-center justify-between px-3 py-2 border rounded-xl cursor-pointer transition-all ${
                          isSelected 
                            ? "bg-ares-gold/10 border-ares-gold text-white" 
                            : "bg-black/30 border-white/5 text-marble/70 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <span className="text-[11px] font-mono font-bold truncate">
                          {obs.name}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteObstacle(obs.id);
                          }}
                          className="text-marble/40 hover:text-ares-red-light p-1 cursor-pointer transition-colors focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                          title="Delete obstacle"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Selected Obstacle Parameter Controls */}
              {selectedObs ? (
                <div className="border-t border-white/5 pt-4 space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-ares-gold">
                    Parameters: {selectedObs.name}
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5 col-span-2">
                      <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                        Label Name
                      </label>
                      <input
                        type="text"
                        value={selectedObs.name}
                        onChange={(e) => handleUpdateObstacleField(selectedObs.id, "name", e.target.value)}
                        className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                        Position X (m)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={selectedObs.x}
                        onChange={(e) => handleUpdateObstacleField(selectedObs.id, "x", parseFloat(e.target.value) || 0)}
                        className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                        Position Y (m)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={selectedObs.y}
                        onChange={(e) => handleUpdateObstacleField(selectedObs.id, "y", parseFloat(e.target.value) || 0)}
                        className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                        Width (m) - Y Axis
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.05"
                        value={selectedObs.width}
                        onChange={(e) => handleUpdateObstacleField(selectedObs.id, "width", parseFloat(e.target.value) || 0.1)}
                        className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                        Height (m) - X Axis
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.05"
                        value={selectedObs.height}
                        onChange={(e) => handleUpdateObstacleField(selectedObs.id, "height", parseFloat(e.target.value) || 0.1)}
                        className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 col-span-2">
                      <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                        Obstacle Type
                      </label>
                      <select
                        value={selectedObs.obstacleType}
                        onChange={(e) => {
                          const newType = e.target.value as "blocking" | "ramp";
                          handleUpdateObstacleField(selectedObs.id, "obstacleType", newType);
                          // Automatically toggle blocking based on type, but allow overriding
                          handleUpdateObstacleField(selectedObs.id, "isBlocking", newType === "blocking");
                          if (newType === "ramp" && !selectedObs.rampDirection) {
                            handleUpdateObstacleField(selectedObs.id, "rampDirection", "up");
                          }
                        }}
                        className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-ares-cyan cursor-pointer"
                      >
                        <option value="blocking">Blocking Wall</option>
                        <option value="ramp">Non-Blocking Ramp</option>
                      </select>
                    </div>

                    {selectedObs.obstacleType === "ramp" && (
                      <div className="flex flex-col gap-1.5 col-span-2">
                        <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                          Ramp Incline Direction (Screen View)
                        </label>
                        <select
                          value={selectedObs.rampDirection || "up"}
                          onChange={(e) => handleUpdateObstacleField(selectedObs.id, "rampDirection", e.target.value as any)}
                          className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-ares-cyan cursor-pointer"
                        >
                          <option value="up">North (Up)</option>
                          <option value="down">South (Down)</option>
                          <option value="left">West (Left)</option>
                          <option value="right">East (Right)</option>
                        </select>
                      </div>
                    )}

                    <div className="flex items-center gap-2 col-span-2 pt-1">
                      <input
                        type="checkbox"
                        id={`obs-blocking-chk-${selectedObs.id}`}
                        checked={selectedObs.isBlocking}
                        onChange={(e) => handleUpdateObstacleField(selectedObs.id, "isBlocking", e.target.checked)}
                        className="w-4 h-4 accent-ares-gold cursor-pointer"
                      />
                      <label htmlFor={`obs-blocking-chk-${selectedObs.id}`} className="text-[10px] font-mono text-white cursor-pointer select-none font-medium">
                        Is Blocking (Physics Collider)
                      </label>
                    </div>
                  </div>

                  <div className="text-[9px] leading-relaxed text-marble/35 font-mono pt-1">
                    X coordinates represent North (+) / South (-).
                    <br />
                    Y coordinates represent West (+) / East (-).
                  </div>
                </div>
              ) : (
                <div className="border-t border-white/5 pt-4 text-[10px] font-mono text-marble/35 uppercase text-center">
                  Select an obstacle to edit parameters.
                </div>
              )}
            </div>
          ) : (
            /* Game Elements Panel */
            <div className="flex flex-col gap-6">
              {/* Element Types Catalog Card */}
              <div className="glass-card p-6 border border-white/10 bg-black/60 shadow-2xl space-y-5">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <h3 className="text-xs font-black uppercase text-white tracking-widest font-heading flex items-center gap-2">
                    <Sliders size={14} className="text-ares-gold" /> Element Types Catalog
                  </h3>
                  <button
                    onClick={handleAddElementType}
                    className="px-2.5 py-1 bg-ares-gold/15 hover:bg-ares-gold/25 text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30 text-[9px] uppercase font-black tracking-widest rounded-lg flex items-center gap-1 transition-all cursor-pointer font-bold"
                  >
                    <Plus size={10} /> New Type
                  </button>
                </div>

                {/* List of Types */}
                <div className="max-h-36 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/5 pr-1">
                  {elementTypes.length === 0 ? (
                    <div className="text-[10px] font-mono text-marble/35 uppercase text-center py-4">
                      No element types defined.
                    </div>
                  ) : (
                    elementTypes.map((t) => {
                      const isSelected = t.id === selectedElementTypeId;
                      return (
                        <div
                          key={t.id}
                          onClick={() => setSelectedElementTypeId(t.id)}
                          className={`flex items-center justify-between px-3 py-2 border rounded-xl cursor-pointer transition-all ${
                            isSelected
                              ? "bg-ares-gold/10 border-ares-gold text-white"
                              : "bg-black/30 border-white/5 text-marble/70 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: t.color }}
                            />
                            <span className="text-[11px] font-mono font-bold truncate">
                              {t.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddElementInstance(t.id);
                              }}
                              className="px-2 py-0.5 bg-white/5 hover:bg-white/10 text-white border border-white/5 text-[8px] uppercase font-black tracking-widest rounded transition-all cursor-pointer"
                              title="Place instance of this type on field"
                            >
                              Place
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteElementType(t.id);
                              }}
                              className="text-marble/45 hover:text-ares-red-light p-1 cursor-pointer transition-colors"
                              title="Delete type catalog template"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Selected Type Parameters */}
                {selectedElementTypeId ? (
                  (() => {
                    const t = elementTypes.find((x) => x.id === selectedElementTypeId);
                    if (!t) return null;
                    return (
                      <div className="border-t border-white/5 pt-4 space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-ares-gold">
                          Type Properties: {t.name}
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1.5 col-span-2">
                            <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                              Type Name
                            </label>
                            <input
                              type="text"
                              value={t.name}
                              onChange={(e) => handleUpdateElementTypeField(t.id, "name", e.target.value)}
                              className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                              Shape
                            </label>
                            <select
                              value={t.shape}
                              onChange={(e) => handleUpdateElementTypeField(t.id, "shape", e.target.value as any)}
                              className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-ares-cyan cursor-pointer"
                            >
                              <option value="sphere">Sphere (Circle)</option>
                              <option value="cylinder">Cylinder (Circle)</option>
                              <option value="box">Box (Rect)</option>
                            </select>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                              Color (Hex)
                            </label>
                            <div className="flex gap-1.5">
                              <input
                                type="color"
                                value={t.color}
                                onChange={(e) => handleUpdateElementTypeField(t.id, "color", e.target.value)}
                                className="w-8 h-8 rounded border border-white/10 bg-transparent cursor-pointer p-0 shrink-0"
                              />
                              <input
                                type="text"
                                value={t.color}
                                onChange={(e) => handleUpdateElementTypeField(t.id, "color", e.target.value)}
                                className="bg-black/45 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan w-full text-center"
                              />
                            </div>
                          </div>
                          {t.shape === "box" ? (
                            <>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                                  Width (m)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={t.width}
                                  onChange={(e) => handleUpdateElementTypeField(t.id, "width", parseFloat(e.target.value) || 0.15)}
                                  className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                                  Height (m)
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={t.height}
                                  onChange={(e) => handleUpdateElementTypeField(t.id, "height", parseFloat(e.target.value) || 0.15)}
                                  className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                                />
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                                Diameter (m)
                              </label>
                              <input
                                  type="number"
                                  step="0.01"
                                  value={t.diameter || 0.15}
                                  onChange={(e) => handleUpdateElementTypeField(t.id, "diameter", parseFloat(e.target.value) || 0.15)}
                                  className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                              />
                            </div>
                          )}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                              Depth/Z-Height (m)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={t.depth}
                              onChange={(e) => handleUpdateElementTypeField(t.id, "depth", parseFloat(e.target.value) || 0.15)}
                              className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                              Mass (kg)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={t.massKg}
                              onChange={(e) => handleUpdateElementTypeField(t.id, "massKg", parseFloat(e.target.value) || 0.1)}
                              className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                            />
                          </div>
                          <div className="flex items-center gap-2 col-span-2 pt-1">
                            <input
                              type="checkbox"
                              id="movable-chk"
                              checked={t.movable}
                              onChange={(e) => handleUpdateElementTypeField(t.id, "movable", e.target.checked)}
                              className="w-4 h-4 accent-ares-gold cursor-pointer"
                            />
                            <label htmlFor="movable-chk" className="text-[10px] font-mono text-white cursor-pointer select-none">
                              Movable Physics Body (Dynamic)
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="border-t border-white/5 pt-4 text-[10px] font-mono text-marble/35 uppercase text-center">
                    Select a type template to edit.
                  </div>
                )}
              </div>

              {/* Element Instances Inventory Card */}
              <div className="glass-card p-6 border border-white/10 bg-black/60 shadow-2xl space-y-5">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <h3 className="text-xs font-black uppercase text-white tracking-widest font-heading flex items-center gap-2">
                    <Activity size={14} className="text-ares-gold" /> Placed Elements
                  </h3>
                </div>

                {/* Placed Elements List */}
                <div className="max-h-36 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/5 pr-1">
                  {elements.length === 0 ? (
                    <div className="text-[10px] font-mono text-marble/35 uppercase text-center py-4">
                      No elements placed on field.
                    </div>
                  ) : (
                    elements.map((el, idx) => {
                      const type = elementTypes.find((t) => t.id === el.elementTypeId);
                      const isSelected = el.id === selectedElementInstanceId;
                      return (
                        <div
                          key={el.id}
                          onClick={() => setSelectedElementInstanceId(el.id)}
                          className={`flex items-center justify-between px-3 py-2 border rounded-xl cursor-pointer transition-all ${
                            isSelected
                              ? "bg-ares-gold/10 border-ares-gold text-white"
                              : "bg-black/30 border-white/5 text-marble/70 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: type?.color || "#fff" }}
                            />
                            <span className="text-[11px] font-mono font-bold truncate">
                              {type?.name || "Unknown"} #{idx + 1}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteElementInstance(el.id);
                            }}
                            className="text-marble/40 hover:text-ares-red-light p-1 cursor-pointer transition-colors"
                            title="Delete placed instance"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Selected Instance Parameters */}
                {selectedElementInstanceId ? (
                  (() => {
                    const el = elements.find((x) => x.id === selectedElementInstanceId);
                    if (!el) return null;
                    const type = elementTypes.find((t) => t.id === el.elementTypeId);
                    return (
                      <div className="border-t border-white/5 pt-4 space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-ares-gold">
                          Instance: {type?.name || "Element"}
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                              Position X (m)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={el.x}
                              onChange={(e) => handleUpdateElementInstanceField(el.id, "x", parseFloat(e.target.value) || 0)}
                              className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                              Position Y (m)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={el.y}
                              onChange={(e) => handleUpdateElementInstanceField(el.id, "y", parseFloat(e.target.value) || 0)}
                              className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5 col-span-2">
                            <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                              Rotation (deg)
                            </label>
                            <input
                              type="number"
                              step="1"
                              value={el.rotation}
                              onChange={(e) => handleUpdateElementInstanceField(el.id, "rotation", parseFloat(e.target.value) || 0)}
                              className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="border-t border-white/5 pt-4 text-[10px] font-mono text-marble/35 uppercase text-center">
                    Select a placed element to edit.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Saved Layout Library */}
          <div className="glass-card p-6 border border-white/10 bg-black/60 shadow-2xl space-y-4">
            <h3 className="text-xs font-black uppercase text-white tracking-widest font-heading border-b border-white/5 pb-3 flex items-center gap-2">
              <Map size={14} className="text-ares-gold" /> Saved Layout Library
            </h3>
            
            <div className="max-h-60 overflow-y-auto space-y-2.5 scrollbar-thin scrollbar-thumb-white/5 pr-1">
              {configs.length === 0 ? (
                <div className="text-[10px] font-mono text-marble/35 uppercase text-center py-8">
                  No layouts saved in library.
                </div>
              ) : (
                configs.map((cfg) => {
                  const isActive = cfg.id === selectedConfigId;
                  const formattedDate = new Date(cfg.updatedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  });
                  return (
                    <div
                      key={cfg.id}
                      onClick={() => loadConfig(cfg)}
                      className={`flex flex-col gap-1 p-3.5 border rounded-xl cursor-pointer transition-all ${
                        isActive
                          ? "bg-ares-gold/10 border-ares-gold text-white shadow-lg shadow-ares-gold/5"
                          : "bg-black/30 border-white/5 text-marble/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-extrabold truncate max-w-[130px] uppercase tracking-wide">
                          {cfg.name}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {cfg.gameYear && (
                            <span className="text-[7.5px] font-mono bg-ares-gold/15 border border-ares-gold/25 text-ares-gold px-1.5 py-0.5 rounded uppercase font-bold">
                              {cfg.gameYear}
                            </span>
                          )}
                          <span className="text-[8px] font-mono bg-white/5 px-2 py-0.5 rounded text-marble/50">
                            {cfg.obstacles.length} {cfg.obstacles.length === 1 ? "box" : "boxes"} | {(cfg.elements || []).length} elements
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-marble/40 mt-1 font-medium font-mono">
                        <span>Updated: {formattedDate}</span>
                        {isActive && <span className="text-ares-gold font-bold text-[8px] uppercase tracking-widest">Active</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Onshape Field CAD Synchronization was moved to the unified bottom section */}
        </div>

      </div>



    </div>
  );
}
