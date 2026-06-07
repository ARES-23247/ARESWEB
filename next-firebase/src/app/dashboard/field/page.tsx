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
import OnshapeRobotSyncCard from "./components/OnshapeRobotSyncCard";

const parseOnshapeUrl = (url: string) => {
  const match = url.match(/\/documents\/([a-zA-Z0-9_-]+)\/(?:w|v)\/([a-zA-Z0-9_-]+)\/e\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return {
      documentId: match[1],
      workspaceId: match[2],
      elementId: match[3]
    };
  }
  return null;
};

interface FieldObstacle {
  id: string;
  name: string;
  x: number;      // EKF X in meters (forward from center, positive is up)
  y: number;      // EKF Y in meters (left from center, positive is left)
  width: number;  // Width in meters (horizontal on screen, EKF Y axis)
  height: number; // Height in meters (vertical on screen, EKF X axis)
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
  obstacles: FieldObstacle[];
  elementTypes?: ElementType[];
  elements?: FieldElementInstance[];
  cadUrl?: string;
  bgImageUrl?: string;
}

export default function FieldObstacleEditor() {
  const [configs, setConfigs] = useState<FieldConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");
  const [configName, setConfigName] = useState<string>("New Configuration");
  const [obstacles, setObstacles] = useState<FieldObstacle[]>([]);
  const [selectedObstacleId, setSelectedObstacleId] = useState<string | null>(null);

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

  const fieldSizeMeters = 3.6576; // 12 feet
  const scale = canvasSize / fieldSizeMeters;
  const centerX = canvasSize / 2;
  const centerY = canvasSize / 2;

  // Coordinate conversion helper functions
  const toPxX = (y_ekf: number) => centerX - y_ekf * scale;
  const toPxY = (x_ekf: number) => centerY - x_ekf * scale;
  
  const toEkfX = (pxY: number) => (centerY - pxY) / scale;
  const toEkfY = (pxX: number) => (centerX - pxX) / scale;

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
      const parent = canvasRef.current?.parentElement;
      if (parent) {
        const size = Math.min(parent.clientWidth || 450, 500);
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
    setObstacles([...config.obstacles]);
    setElementTypes(config.elementTypes ? [...config.elementTypes] : []);
    setElements(config.elements ? [...config.elements] : []);
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
    setElementTypes([]);
    setElements([]);
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
      width: 0.4, // 0.4 meters (~16 inches)
      height: 0.4
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
        obstacles: obstacles.map((obs) => ({
          id: obs.id,
          name: obs.name,
          x: Number(obs.x),
          y: Number(obs.y),
          width: Number(obs.width),
          height: Number(obs.height)
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
    canvas.width = canvasSize * dpr;
    canvas.height = canvasSize * dpr;
    ctx.scale(dpr, dpr);

    // 1. Draw Field Background
    if (bgImage) {
      ctx.drawImage(bgImage, 0, 0, canvasSize, canvasSize);
    } else {
      ctx.fillStyle = "#0A0A0A";
      ctx.fillRect(0, 0, canvasSize, canvasSize);
    }

    // 2. Draw 6x6 Grid Tiles (each tape tile is 24x24 inches = 0.6096m x 0.6096m)
    ctx.strokeStyle = bgImage ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.03)";
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

    // 3. Draw Outer Perimeter Wall
    ctx.strokeStyle = bgImage ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 2;
    ctx.strokeRect(toPxX(1.8288), toPxY(1.8288), canvasSize - 2 * toPxX(1.8288), canvasSize - 2 * toPxY(1.8288));

    // 4. Draw Center Origin Marker
    ctx.strokeStyle = "rgba(245, 158, 11, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - 10, centerY);
    ctx.lineTo(centerX + 10, centerY);
    ctx.moveTo(centerX, centerY - 10);
    ctx.lineTo(centerX, centerY + 10);
    ctx.stroke();

    // 5. Draw red and blue zones/substations as faint context (only if no custom background image)
    if (!bgImage) {
      ctx.fillStyle = "rgba(239, 68, 68, 0.05)";
      ctx.beginPath();
      ctx.arc(toPxX(1.8288), toPxY(1.8288), 0.508 * scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(59, 130, 246, 0.05)";
      ctx.beginPath();
      ctx.arc(toPxX(-1.8288), toPxY(-1.8288), 0.508 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Draw Obstacles
    obstacles.forEach((obs) => {
      const isSelected = obs.id === selectedObstacleId;
      const obsHalfW = obs.width / 2;
      const obsHalfH = obs.height / 2;

      const leftPx = toPxX(obs.y + obsHalfW);
      const topPx = toPxY(obs.x + obsHalfH);
      const wPx = obs.width * scale;
      const hPx = obs.height * scale;

      // Obstacle body
      ctx.fillStyle = isSelected ? "rgba(245, 158, 11, 0.2)" : "rgba(255, 255, 255, 0.08)";
      ctx.fillRect(leftPx, topPx, wPx, hPx);

      // Obstacle border
      ctx.strokeStyle = isSelected ? "#F59E0B" : "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(leftPx, topPx, wPx, hPx);

      // Name label
      ctx.fillStyle = isSelected ? "#F59E0B" : "rgba(255, 255, 255, 0.6)";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(obs.name, leftPx + wPx / 2, topPx + hPx / 2 + 3);

      // Bounding dimensions label (faint)
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.font = "8px monospace";
      ctx.fillText(
        `${obs.width.toFixed(2)}m x ${obs.height.toFixed(2)}m`, 
        leftPx + wPx / 2, 
        topPx + hPx / 2 + 13
      );

      // Resize Handle at bottom-right corner
      if (isSelected) {
        ctx.fillStyle = "#F59E0B";
        ctx.beginPath();
        // Bottom-Right Corner in screen: leftPx + wPx, topPx + hPx
        ctx.arc(leftPx + wPx, topPx + hPx, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    // 7. Draw Field Elements
    elements.forEach((el) => {
      const type = elementTypes.find((t) => t.id === el.elementTypeId);
      if (!type) return;

      const isSelected = el.id === selectedElementInstanceId;
      const sizeMeters = type.shape === "box" ? Math.max(type.width, type.height) : (type.diameter || 0.15);
      
      const pxX = toPxX(el.y);
      const pxY = toPxY(el.x);

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

  }, [obstacles, selectedObstacleId, canvasSize, bgImage, editMode, elements, elementTypes, selectedElementInstanceId]);

  // Mouse Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert mouse to EKF space coordinates
    const mx = toEkfX(mouseY);
    const my = toEkfY(mouseX);

    if (editMode === "obstacles") {
      // 1. Check if we clicked on the active obstacle's resize handle
      if (selectedObstacleId) {
        const obs = obstacles.find((o) => o.id === selectedObstacleId);
        if (obs) {
          const handleX = toPxX(obs.y - obs.width / 2);
          const handleY = toPxY(obs.x - obs.height / 2);
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
              fixedX: obs.x + obs.height / 2,
              fixedY: obs.y + obs.width / 2
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

    const mx = toEkfX(mouseY);
    const my = toEkfY(mouseX);

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

      const newHeight = Math.max(0.1, drag.fixedX - mx);
      const newWidth = Math.max(0.1, drag.fixedY - my);

      const newX = drag.fixedX - newHeight / 2;
      const newY = drag.fixedY - newWidth / 2;

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

    const step = e.shiftKey ? 1.0 : 0.1;
    const obs = obstacles.find((o) => o.id === selectedObstacleId);
    if (!obs) return;

    if (e.key === "ArrowUp") {
      handleUpdateObstacleField(obs.id, "y", Number((obs.y + step).toFixed(2)));
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      handleUpdateObstacleField(obs.id, "y", Number((obs.y - step).toFixed(2)));
      e.preventDefault();
    } else if (e.key === "ArrowLeft") {
      handleUpdateObstacleField(obs.id, "x", Number((obs.x - step).toFixed(2)));
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      handleUpdateObstacleField(obs.id, "x", Number((obs.x + step).toFixed(2)));
      e.preventDefault();
    } else if (e.key === "Escape") {
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
            Field Obstacle Editor
          </h1>
          <p className="text-marble/70 text-xs md:text-sm mt-1.5 font-medium max-w-xl">
            Visually design dynamic obstacle layout configurations. Map bounding boxes to the EKF center-origin coordinate system and load them inside ARES-Scope replays.
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
                style={{ width: `${canvasSize}px`, height: `${canvasSize}px` }}
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
                        <span className="text-xs font-extrabold truncate max-w-[150px] uppercase tracking-wide">
                          {cfg.name}
                        </span>
                        <span className="text-[8px] font-mono bg-white/5 px-2 py-0.5 rounded text-marble/50">
                          {cfg.obstacles.length} {cfg.obstacles.length === 1 ? "box" : "boxes"} | {(cfg.elements || []).length} elements
                        </span>
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

      {/* ─── FTC FIELD ASSETS INTEGRATION SECTION ─── */}
      <section className="border-t border-white/5 pt-8 space-y-6">
        <div>
          <h2 className="text-lg font-black text-white uppercase tracking-tight font-heading flex items-center gap-2">
            <Link size={18} className="text-ares-gold animate-pulse" /> Simulation Field Integrations
          </h2>
          <p className="text-marble/70 text-xs mt-1">
            Manage your physical simulation environments. Upload 3D field meshes and custom 2D layouts to associate obstacle geometries with active simulation modes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* FTC Field Asset Manager */}
          <div className="glass-card p-6 border border-white/10 bg-black/60 shadow-2xl flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-xs font-black uppercase text-white tracking-widest font-heading border-b border-white/5 pb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Map size={14} className="text-ares-gold" /> FTC Field Asset Manager
                </span>
                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
                  (localGlbFile || configs.find((c) => c.id === selectedConfigId)?.cadUrl) ? "bg-ares-success/25 text-ares-success border border-ares-success/20" : "bg-ares-gold/25 text-ares-gold border border-ares-gold/20"
                }`}>
                  {(localGlbFile || configs.find((c) => c.id === selectedConfigId)?.cadUrl) ? "Assets Active" : "No 3D Model"}
                </span>
              </h3>

              <div className="space-y-4 mt-4">
                {/* 3D Model GLB File Upload */}
                <div>
                  <label className="text-[9px] font-black uppercase text-marble/45 tracking-widest block mb-1">
                    Upload 3D Field Model (.glb, .gltf)
                  </label>
                  <input
                    type="file"
                    accept=".glb,.gltf"
                    onChange={handleGlbFileChange}
                    className="w-full text-xs text-marble/55 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:white file:bg-ares-gold file:text-black hover:file:bg-ares-gold-soft file:cursor-pointer cursor-pointer bg-black/30 p-2 rounded-xl border border-white/5 focus:outline-none"
                  />
                  {(localGlbFile || configs.find((c) => c.id === selectedConfigId)?.cadUrl) && (
                    <p className="text-[8px] font-mono text-ares-success mt-1">
                      ✓ 3D Model GLB associated: {localGlbFile ? localGlbFile.name : "Saved on Cloud"}
                    </p>
                  )}
                </div>

                {/* 2D Background Image Upload */}
                <div>
                  <label className="text-[9px] font-black uppercase text-marble/45 tracking-widest block mb-1">
                    Upload 2D Field Image (.png, .jpg)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setLocalBgFile(file);
                    }}
                    className="w-full text-xs text-marble/55 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:white file:bg-ares-gold file:text-black hover:file:bg-ares-gold-soft file:cursor-pointer cursor-pointer bg-black/30 p-2 rounded-xl border border-white/5 focus:outline-none"
                  />
                  {(localBgFile || configs.find((c) => c.id === selectedConfigId)?.bgImageUrl) && (
                    <p className="text-[8px] font-mono text-ares-success mt-1">
                      ✓ 2D Background associated: {localBgFile ? localBgFile.name : "Saved on Cloud"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 text-[9px] leading-relaxed text-marble/40 font-mono">
              Note: When you select a 3D field model (.glb), ARES will automatically render a top-down orthographic snapshot on the client and set it as the background image. If you prefer, you can manually upload a custom 2D field diagram.
            </div>
          </div>

          {/* Onshape Robot CAD Sync */}
          <OnshapeRobotSyncCard />
        </div>
      </section>

    </div>
  );
}
