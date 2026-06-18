"use client";

import React, { useState, useEffect } from "react";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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
import { authenticatedFetch } from "@/lib/api";

import FieldCanvas, { 
  FieldObstacle, 
  ElementType, 
  FieldElementInstance, 
  FieldAprilTag 
} from "./components/FieldCanvas";
import CropModal from "./components/CropModal";
import { generateTopDownSnapshot } from "./utils/threeSnapshot";

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
  apriltags?: FieldAprilTag[];
  cadUrl?: string;
  bgImageUrl?: string;
}

export default function FieldEditor() {
  const [configs, setConfigs] = useState<FieldConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");
  const [configName, setConfigName] = useState<string>("New Configuration");
  const [obstacles, setObstacles] = useState<FieldObstacle[]>([]);
  const [selectedObstacleId, setSelectedObstacleId] = useState<string | null>(null);
  
  const [fieldType, setFieldType] = useState<"ftc" | "frc">("ftc");
  const [gameYear, setGameYear] = useState<string>("2025-2026");
  const [xAxisDirection, setXAxisDirection] = useState<"up" | "down" | "left" | "right">("up");
  const [yAxisDirection, setYAxisDirection] = useState<"up" | "down" | "left" | "right">("left");
  const [redDriverStation, setRedDriverStation] = useState<"north" | "south" | "east" | "west">("south");
  const [blueDriverStation, setBlueDriverStation] = useState<"north" | "south" | "east" | "west">("north");
  
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showAllianceZones, setShowAllianceZones] = useState<boolean>(true);
  const [showCoordinateAxes, setShowCoordinateAxes] = useState<boolean>(true);
  
  const [elementTypes, setElementTypes] = useState<ElementType[]>([]);
  const [elements, setElements] = useState<FieldElementInstance[]>([]);
  const [selectedElementTypeId, setSelectedElementTypeId] = useState<string | null>(null);
  const [selectedElementInstanceId, setSelectedElementInstanceId] = useState<string | null>(null);

  const [isLayoutSettingsExpanded, setIsLayoutSettingsExpanded] = useState<boolean>(true);
  const [isObstaclesExpanded, setIsObstaclesExpanded] = useState<boolean>(true);
  const [isElementCatalogExpanded, setIsElementCatalogExpanded] = useState<boolean>(true);
  const [isPlacedElementsExpanded, setIsPlacedElementsExpanded] = useState<boolean>(true);
  const [isTagsExpanded, setIsTagsExpanded] = useState<boolean>(true);
  const [isLibraryExpanded, setIsLibraryExpanded] = useState<boolean>(true);

  const [apriltags, setApriltags] = useState<FieldAprilTag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);

  const [isDrawingPolygon, setIsDrawingPolygon] = useState<boolean>(false);
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]);
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);

  const [importText, setImportText] = useState<string>("[]");
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const [localBgFile, setLocalBgFile] = useState<File | null>(null);
  const [localGlbFile, setLocalGlbFile] = useState<File | null>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);

  const [rawUploadedImage, setRawUploadedImage] = useState<HTMLImageElement | null>(null);
  const [showCropModal, setShowCropModal] = useState<boolean>(false);

  const [fieldDocId, setFieldDocId] = useState<string>("");
  const [fieldWkId, setFieldWkId] = useState<string>("");
  const [fieldElId, setFieldElId] = useState<string>("");
  const [fieldSyncMeta, setFieldSyncMeta] = useState<any | null>(null);
  const [isFieldConnected, setIsFieldConnected] = useState<boolean>(false);

  // Field dimensions in meters
  const fieldW = fieldType === "ftc" ? 3.6576 : 8.211;
  const fieldH = fieldType === "ftc" ? 3.6576 : 16.541;

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

  useEffect(() => {
    fetchConfigs();
  }, []);

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
      
      if (fetchedConfigs.length > 0 && !selectedConfigId) {
        loadConfig(fetchedConfigs[0]);
      }
    } catch (err) {
      console.error("Error fetching field configs:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadConfig = (config: FieldConfig) => {
    setSelectedConfigId(config.id);
    setConfigName(config.name);
    setObstacles((config.obstacles || []).map(obs => ({
      ...obs,
      isBlocking: obs.isBlocking !== undefined ? obs.isBlocking : true,
      obstacleType: obs.obstacleType || "blocking",
      shape: obs.shape || "rectangle",
      points: obs.points || []
    })));
    setElementTypes(config.elementTypes ? [...config.elementTypes] : []);
    setElements(config.elements ? [...config.elements] : []);
    setApriltags(config.apriltags ? [...config.apriltags] : []);
    setFieldType(config.fieldType || "ftc");
    setGameYear(config.gameYear || "2025-2026");
    setXAxisDirection(config.xAxisDirection || "up");
    setYAxisDirection(config.yAxisDirection || "left");
    setRedDriverStation(config.redDriverStation || "south");
    setBlueDriverStation(config.blueDriverStation || "north");
    setSelectedObstacleId(null);
    setSelectedElementInstanceId(null);
    setSelectedElementTypeId(null);
    setSelectedTagId(null);
    setLocalBgFile(null);
    setLocalGlbFile(null);
  };

  const handleCreateNew = () => {
    setSelectedConfigId("");
    setConfigName("New Field Layout");
    setObstacles([]);
    
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
    setApriltags([]);
    setFieldType("ftc");
    setGameYear("2025-2026");
    setXAxisDirection("up");
    setYAxisDirection("left");
    setRedDriverStation("south");
    setBlueDriverStation("north");
    setSelectedObstacleId(null);
    setSelectedElementInstanceId(null);
    setSelectedElementTypeId(null);
    setSelectedTagId(null);
    setLocalBgFile(null);
    setLocalGlbFile(null);
  };

  const handleAddObstacle = () => {
    const newObs: FieldObstacle = {
      id: Math.random().toString(36).substring(2, 9),
      name: `Obstacle ${obstacles.length + 1}`,
      x: fieldType === "frc" ? fieldH / 2 : 0,
      y: fieldType === "frc" ? fieldW / 2 : 0,
      width: 0.4,
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

  const handleAddElementType = () => {
    const newType: ElementType = {
      id: `type_${Math.random().toString(36).substring(2, 9)}`,
      name: `Element Type ${elementTypes.length + 1}`,
      shape: "sphere",
      width: 0.127,
      height: 0.127,
      depth: 0.127,
      diameter: 0.127,
      color: "#00E5FF",
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

  const handleAddElementInstance = (elementTypeId: string) => {
    const type = elementTypes.find((t) => t.id === elementTypeId);
    if (!type) return;

    const newInst: FieldElementInstance = {
      id: `inst_${Math.random().toString(36).substring(2, 9)}`,
      elementTypeId,
      x: fieldType === "frc" ? fieldH / 2 : 0,
      y: fieldType === "frc" ? fieldW / 2 : 0,
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

  const handleAddAprilTag = () => {
    let nextId = 1;
    while (apriltags.some(t => t.id === nextId)) {
      nextId++;
    }
    const newTag: FieldAprilTag = {
      id: nextId,
      x: fieldType === "frc" ? fieldH / 2 : 0,
      y: fieldType === "frc" ? fieldW / 2 : 0,
      z: 0.5,
      yaw: 0
    };
    setApriltags([...apriltags, newTag]);
    setSelectedTagId(newTag.id);
    setSelectedObstacleId(null);
    setSelectedElementInstanceId(null);
  };

  const handleDeleteAprilTag = (id: number) => {
    setApriltags(apriltags.filter((t) => t.id !== id));
    if (selectedTagId === id) {
      setSelectedTagId(null);
    }
  };

  const handleUpdateAprilTagField = (id: number, field: keyof FieldAprilTag, value: any) => {
    setApriltags(
      apriltags.map((t) => {
        if (t.id === id) {
          return { ...t, [field]: value };
        }
        return t;
      })
    );
  };

  const handleImportAprilTagsJson = (jsonText: string) => {
    try {
      const parsed = JSON.parse(jsonText);
      const tagsList = Array.isArray(parsed) ? parsed : (parsed.tags || []);
      if (!Array.isArray(tagsList)) {
        alert("Invalid JSON format. Could not find tags array.");
        return;
      }

      const limitX = fieldH / 2;
      const limitY = fieldW / 2;
      const newTags: FieldAprilTag[] = [];

      tagsList.forEach((t: any) => {
        const id = t.id !== undefined ? t.id : (t.ID !== undefined ? t.ID : newTags.length + 1);
        
        let rawX = 0;
        let rawY = 0;
        let rawZ = 0;
        let yawDeg = 0;

        if (t.pose?.translation) {
          rawX = t.pose.translation.x || 0;
          rawY = t.pose.translation.y || 0;
          rawZ = t.pose.translation.z || 0;
        } else if (t.x !== undefined) {
          rawX = t.x;
          rawY = t.y || 0;
          rawZ = t.z || 0;
        }

        if (t.pose?.rotation?.quaternion) {
          const q = t.pose.rotation.quaternion;
          const w = q.w !== undefined ? q.w : (q.W !== undefined ? q.W : 1);
          const z = q.z !== undefined ? q.z : (q.Z !== undefined ? q.Z : 0);
          yawDeg = (2 * Math.atan2(z, w) * 180) / Math.PI;
        } else if (t.pose?.rotation?.yaw !== undefined) {
          yawDeg = (t.pose.rotation.yaw * 180) / Math.PI;
        } else if (t.yaw !== undefined) {
          yawDeg = t.yaw;
        }

        let finalX = rawX;
        let finalY = rawY;
        if (fieldType !== "frc") {
          if (Math.abs(rawX) > limitX || Math.abs(rawY) > limitY) {
            if (rawX >= 0 && rawX <= fieldH) {
              finalX = rawX - limitX;
            }
            if (rawY >= 0 && rawY <= fieldW) {
              finalY = rawY - limitY;
            }
          }
        }

        newTags.push({
          id: Number(id),
          x: Number(finalX.toFixed(3)),
          y: Number(finalY.toFixed(3)),
          z: Number(rawZ.toFixed(3)),
          yaw: Number(yawDeg.toFixed(1))
        });
      });

      if (newTags.length > 0) {
        setApriltags(newTags);
        alert(`Successfully imported ${newTags.length} AprilTags.`);
      } else {
        alert("No valid AprilTags found in JSON.");
      }
    } catch (err: any) {
      alert("Failed to parse JSON: " + err.message);
    }
  };

  const handleMirrorObstacle = (obsId: string, axis: "x" | "y" | "center") => {
    const obs = obstacles.find(o => o.id === obsId);
    if (!obs) return;

    const mirroredObs: FieldObstacle = {
      ...obs,
      id: Math.random().toString(36).substring(2, 9),
      name: `${obs.name} (Mirrored)`
    };

    const flipRampDir = (dir?: "up" | "down" | "left" | "right", axisFlip?: "x" | "y" | "center") => {
      if (!dir) return undefined;
      if (axisFlip === "x") {
        if (dir === "left") return "right";
        if (dir === "right") return "left";
      } else if (axisFlip === "y") {
        if (dir === "up") return "down";
        if (dir === "down") return "up";
      } else if (axisFlip === "center") {
        if (dir === "left") return "right";
        if (dir === "right") return "left";
        if (dir === "up") return "down";
        if (dir === "down") return "up";
      }
      return dir;
    };

    if (fieldType === "frc") {
      if (axis === "x") {
        mirroredObs.y = fieldW - obs.y;
        mirroredObs.rampDirection = flipRampDir(obs.rampDirection, "x");
        if (obs.shape === "polygon" && obs.points) {
          mirroredObs.points = obs.points.map(p => ({ x: p.x, y: fieldW - p.y }));
          mirroredObs.x = obs.x;
          mirroredObs.y = fieldW - obs.y;
        }
      } else if (axis === "y") {
        mirroredObs.x = fieldH - obs.x;
        mirroredObs.rampDirection = flipRampDir(obs.rampDirection, "y");
        if (obs.shape === "polygon" && obs.points) {
          mirroredObs.points = obs.points.map(p => ({ x: fieldH - p.x, y: p.y }));
          mirroredObs.x = fieldH - obs.x;
          mirroredObs.y = obs.y;
        }
      } else {
        mirroredObs.x = fieldH - obs.x;
        mirroredObs.y = fieldW - obs.y;
        mirroredObs.rampDirection = flipRampDir(obs.rampDirection, "center");
        if (obs.shape === "polygon" && obs.points) {
          mirroredObs.points = obs.points.map(p => ({ x: fieldH - p.x, y: fieldW - p.y }));
          mirroredObs.x = fieldH - obs.x;
          mirroredObs.y = fieldW - obs.y;
        }
      }
    } else {
      if (axis === "x") {
        mirroredObs.y = -obs.y;
        mirroredObs.rampDirection = flipRampDir(obs.rampDirection, "x");
        if (obs.shape === "polygon" && obs.points) {
          mirroredObs.points = obs.points.map(p => ({ x: p.x, y: -p.y }));
          mirroredObs.x = obs.x;
          mirroredObs.y = -obs.y;
        }
      } else if (axis === "y") {
        mirroredObs.x = -obs.x;
        mirroredObs.rampDirection = flipRampDir(obs.rampDirection, "y");
        if (obs.shape === "polygon" && obs.points) {
          mirroredObs.points = obs.points.map(p => ({ x: -p.x, y: p.y }));
          mirroredObs.x = -obs.x;
          mirroredObs.y = obs.y;
        }
      } else {
        mirroredObs.x = -obs.x;
        mirroredObs.y = -obs.y;
        mirroredObs.rampDirection = flipRampDir(obs.rampDirection, "center");
        if (obs.shape === "polygon" && obs.points) {
          mirroredObs.points = obs.points.map(p => ({ x: -p.x, y: -p.y }));
          mirroredObs.x = -obs.x;
          mirroredObs.y = -obs.y;
        }
      }
    }

    setObstacles([...obstacles, mirroredObs]);
    setSelectedObstacleId(mirroredObs.id);
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
          rampDirection: obs.rampDirection || null,
          shape: obs.shape || "rectangle",
          points: (obs.points || []).map(p => ({ x: Number(p.x), y: Number(p.y) }))
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
        })),
        apriltags: apriltags.map((tag) => ({
          id: Number(tag.id),
          x: Number(tag.x),
          y: Number(tag.y),
          z: Number(tag.z),
          yaw: Number(tag.yaw)
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

  const handleDeleteLayout = async (configIdOrEvent?: string | React.MouseEvent, name?: string) => {
    const targetId = typeof configIdOrEvent === "string" ? configIdOrEvent : selectedConfigId;
    const targetName = name || (typeof configIdOrEvent === "string" ? configs.find(c => c.id === configIdOrEvent)?.name : configName) || "this layout";
    if (!targetId) return;
    if (!confirm(`Are you sure you want to delete the layout "${targetName}"?`)) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, "field_configs", targetId));
      if (targetId === selectedConfigId) {
        setSelectedConfigId("");
        setConfigName("New Field Layout");
        setObstacles([]);
        setSelectedObstacleId(null);
      }
      await fetchConfigs();
      alert("Layout deleted successfully.");
    } catch (err: any) {
      console.error("Error deleting layout:", err);
      alert("Failed to delete layout: " + err.message);
    } finally {
      setLoading(false);
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
      </header>

      {/* Main Workspace: Left canvas grid, Right sidebar controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Visual Canvas Panel */}
        <FieldCanvas
          fieldType={fieldType}
          bgImage={bgImage}
          showGrid={showGrid}
          showAllianceZones={showAllianceZones}
          showCoordinateAxes={showCoordinateAxes}
          xAxisDirection={xAxisDirection}
          yAxisDirection={yAxisDirection}
          redDriverStation={redDriverStation}
          blueDriverStation={blueDriverStation}
          obstacles={obstacles}
          setObstacles={setObstacles}
          selectedObstacleId={selectedObstacleId}
          setSelectedObstacleId={setSelectedObstacleId}
          elements={elements}
          setElements={setElements}
          elementTypes={elementTypes}
          selectedElementInstanceId={selectedElementInstanceId}
          setSelectedElementInstanceId={setSelectedElementInstanceId}
          apriltags={apriltags}
          setApriltags={setApriltags}
          selectedTagId={selectedTagId}
          setSelectedTagId={setSelectedTagId}
          isDrawingPolygon={isDrawingPolygon}
          setIsDrawingPolygon={setIsDrawingPolygon}
          drawingPoints={drawingPoints}
          setDrawingPoints={setDrawingPoints}
          hoverPoint={hoverPoint}
          setHoverPoint={setHoverPoint}
        />

        {/* Configuration settings & Properties Panel */}
        <div className="lg:col-span-1 flex flex-col gap-6">

          {/* Saved Layout Library */}
          <div className={`glass-card border border-white/10 bg-black/60 shadow-2xl transition-all duration-200 ${isLibraryExpanded ? "p-6 space-y-4" : "p-4 space-y-0"}`}>
            <h3 
              onClick={() => setIsLibraryExpanded(!isLibraryExpanded)}
              className={`text-xs font-black uppercase text-white tracking-widest font-heading flex items-center justify-between cursor-pointer hover:text-ares-gold transition-colors select-none ${
                isLibraryExpanded ? "border-b border-white/5 pb-3" : ""
              }`}
            >
              <span className="flex items-center gap-2">
                <Map size={14} className="text-ares-gold" /> Saved Layout Library
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateNew();
                  }}
                  className="px-2.5 py-1 bg-ares-gold/15 hover:bg-ares-gold/25 text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30 text-[9px] uppercase font-black tracking-widest rounded-lg flex items-center gap-1 transition-all cursor-pointer font-bold"
                  title="Create new empty configuration layout"
                >
                  <Plus size={10} /> New Layout
                </button>
                {isLibraryExpanded ? <ChevronUp size={14} className="text-marble/40" /> : <ChevronDown size={14} className="text-marble/40" />}
              </div>
            </h3>
            
            {isLibraryExpanded && (
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
                            <button
                              onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteLayout(cfg.id, cfg.name);
                              }}
                              className="text-marble/45 hover:text-ares-red-light p-1 cursor-pointer transition-colors"
                              title="Delete layout"
                            >
                              <Trash2 size={12} />
                            </button>
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
            )}
          </div>

          {/* Layout Settings Card */}
          <div className={`glass-card border border-white/10 bg-black/60 shadow-2xl transition-all duration-200 ${isLayoutSettingsExpanded ? "p-6 space-y-4" : "p-4 space-y-0"}`}>
            <h3 
              onClick={() => setIsLayoutSettingsExpanded(!isLayoutSettingsExpanded)}
              className={`text-xs font-black uppercase text-white tracking-widest font-heading flex items-center justify-between cursor-pointer hover:text-ares-gold transition-colors select-none ${
                isLayoutSettingsExpanded ? "border-b border-white/5 pb-3" : ""
              }`}
            >
              <span className="flex items-center gap-2">
                <Sliders size={14} className="text-ares-gold" /> Layout Settings
              </span>
              {isLayoutSettingsExpanded ? <ChevronUp size={14} className="text-marble/40" /> : <ChevronDown size={14} className="text-marble/40" />}
            </h3>
            
            {isLayoutSettingsExpanded && (
              <>
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
                  <select
                    value={["2025-2026", "2024-2025", "2023-2024", "2022-2023", "2021-2022"].includes(gameYear) ? gameYear : "custom"}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "custom") {
                        setGameYear("");
                      } else {
                        setGameYear(val);
                      }
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-white font-semibold text-xs focus:outline-none focus:border-ares-cyan cursor-pointer transition-colors"
                  >
                    <option value="2025-2026">2025-2026 Season</option>
                    <option value="2024-2025">2024-2025 (Into The Deep / Reefscape)</option>
                    <option value="2023-2024">2023-2024 (Centerstage / Crescendo)</option>
                    <option value="2022-2023">2022-2023 (Powerplay / Charged Up)</option>
                    <option value="2021-2022">2021-2022 (Freight Frenzy / Rapid React)</option>
                    <option value="custom">Other / Custom Year...</option>
                  </select>

                  {!["2025-2026", "2024-2025", "2023-2024", "2022-2023", "2021-2022"].includes(gameYear) && (
                    <input
                      type="text"
                      value={gameYear}
                      onChange={(e) => setGameYear(e.target.value)}
                      placeholder="Enter custom year (e.g., 2020-2021)..."
                      className="w-full bg-black/45 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-ares-cyan mt-1.5"
                    />
                  )}
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
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const img = new Image();
                              img.src = event.target?.result as string;
                              img.onload = () => {
                                setRawUploadedImage(img);
                                setShowCropModal(true);
                              };
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="w-full text-[10px] text-marble/55 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:bg-ares-gold file:text-black hover:file:bg-ares-gold-soft file:cursor-pointer cursor-pointer bg-black/30 p-1.5 rounded-lg border border-white/5 focus:outline-none"
                      />
                      {(localBgFile || configs.find((c) => c.id === selectedConfigId)?.bgImageUrl) && (
                        <div className="flex flex-col gap-1.5 mt-0.5">
                          <p className="text-[8px] font-mono text-ares-success">
                            ✓ 2D Background loaded
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              if (bgImage) {
                                setRawUploadedImage(bgImage);
                                setShowCropModal(true);
                              } else {
                                alert("No background image currently loaded in cache.");
                              }
                            }}
                            className="text-left text-[8.5px] font-black uppercase text-ares-gold hover:text-ares-gold-soft tracking-wider cursor-pointer"
                          >
                            Adjust Crop & Alignment
                          </button>
                        </div>
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
                    onClick={() => handleDeleteLayout()}
                    disabled={!selectedConfigId || loading}
                    className="w-full bg-ares-red/10 hover:bg-ares-red/20 text-ares-red-light border border-ares-red/20 py-3 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-2 font-bold cursor-pointer disabled:opacity-20 focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Obstacle Inventory */}
          <div className={`glass-card border border-white/10 bg-black/60 shadow-2xl transition-all duration-200 ${isObstaclesExpanded ? "p-6 space-y-5" : "p-4 space-y-0"}`}>
            <div 
              onClick={() => setIsObstaclesExpanded(!isObstaclesExpanded)}
              className={`flex items-center justify-between cursor-pointer hover:text-ares-gold select-none ${
                isObstaclesExpanded ? "border-b border-white/5 pb-3" : ""
              }`}
            >
              <h3 className="text-xs font-black uppercase text-white tracking-widest font-heading flex items-center gap-2 transition-colors">
                <Activity size={14} className="text-ares-gold" /> Obstacle Inventory
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddObstacle();
                  }}
                  className="px-2 py-0.5 bg-ares-gold/15 hover:bg-ares-gold/25 text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30 text-[8.5px] uppercase font-black tracking-widest rounded transition-all cursor-pointer font-bold shrink-0"
                >
                  <Plus size={10} /> Add Box
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDrawingPolygon(!isDrawingPolygon);
                    setDrawingPoints([]);
                    setHoverPoint(null);
                  }}
                  className={`px-2 py-0.5 text-[8.5px] uppercase font-black tracking-widest rounded transition-all cursor-pointer font-bold shrink-0 ${
                    isDrawingPolygon 
                      ? "bg-ares-cyan/25 border border-ares-cyan text-ares-cyan" 
                      : "bg-ares-gold/15 hover:bg-ares-gold/25 text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30"
                  }`}
                >
                  <Plus size={10} /> {isDrawingPolygon ? "Drawing" : "Draw Poly"}
                </button>
                {isObstaclesExpanded ? <ChevronUp size={14} className="text-marble/40 cursor-pointer" /> : <ChevronDown size={14} className="text-marble/40 cursor-pointer" />}
              </div>
            </div>

            {isObstaclesExpanded && (
              <>
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
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedObstacleId(obs.id);
                          }}
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
                          Centroid X (m)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={selectedObs.x}
                          onChange={(e) => {
                            const newX = parseFloat(e.target.value) || 0;
                            const diffX = newX - selectedObs.x;
                            if (selectedObs.shape === "polygon" && selectedObs.points) {
                              const updatedPoints = selectedObs.points.map(p => ({ x: p.x + diffX, y: p.y }));
                              handleUpdateObstacleField(selectedObs.id, "points", updatedPoints);
                            }
                            handleUpdateObstacleField(selectedObs.id, "x", newX);
                          }}
                          className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                          Centroid Y (m)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={selectedObs.y}
                          onChange={(e) => {
                            const newY = parseFloat(e.target.value) || 0;
                            const diffY = newY - selectedObs.y;
                            if (selectedObs.shape === "polygon" && selectedObs.points) {
                              const updatedPoints = selectedObs.points.map(p => ({ x: p.x, y: p.y + diffY }));
                              handleUpdateObstacleField(selectedObs.id, "points", updatedPoints);
                            }
                            handleUpdateObstacleField(selectedObs.id, "y", newY);
                          }}
                          className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                        />
                      </div>

                      {selectedObs.shape === "polygon" ? (
                        <div className="col-span-2 space-y-3">
                          <div className="flex items-center justify-between border-t border-white/5 pt-2">
                            <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                              Edit Vertices (meters)
                            </label>
                          </div>

                          <div className="space-y-1.5 border border-white/5 bg-black/20 p-2.5 rounded-xl max-h-36 overflow-y-auto">
                            {(selectedObs.points || []).map((pt, idx) => {
                              return (
                                <div key={idx} className="flex items-center gap-1.5">
                                  <span className="text-[8px] font-mono text-marble/35 w-3.5">
                                    #{idx + 1}
                                  </span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={pt.x}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      const raw = parseFloat(e.target.value) || 0;
                                      const updated = (selectedObs.points || []).map((p, i) =>
                                        i === idx ? { ...p, x: raw } : p
                                      );
                                      handleUpdateObstacleField(selectedObs.id, "points", updated);
                                      const newCx = updated.reduce((sum, p) => sum + p.x, 0) / updated.length;
                                      handleUpdateObstacleField(selectedObs.id, "x", Number(newCx.toFixed(3)));
                                    }}
                                    className="w-full bg-black/45 border border-white/10 rounded-lg px-1.5 py-1 text-[10px] text-white font-mono text-center focus:outline-none focus:border-ares-cyan"
                                    placeholder="X"
                                  />
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={pt.y}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      const raw = parseFloat(e.target.value) || 0;
                                      const updated = (selectedObs.points || []).map((p, i) =>
                                        i === idx ? { ...p, y: raw } : p
                                      );
                                      handleUpdateObstacleField(selectedObs.id, "points", updated);
                                      const newCy = updated.reduce((sum, p) => sum + p.y, 0) / updated.length;
                                      handleUpdateObstacleField(selectedObs.id, "y", Number(newCy.toFixed(3)));
                                    }}
                                    className="w-full bg-black/45 border border-white/10 rounded-lg px-1.5 py-1 text-[10px] text-white font-mono text-center focus:outline-none focus:border-ares-cyan"
                                    placeholder="Y"
                                  />
                                  <button
                                    onClick={() => {
                                      const updated = (selectedObs.points || []).filter((_, i) => i !== idx);
                                      handleUpdateObstacleField(selectedObs.id, "points", updated);
                                      if (updated.length > 0) {
                                        const newCx = updated.reduce((sum, p) => sum + p.x, 0) / updated.length;
                                        const newCy = updated.reduce((sum, p) => sum + p.y, 0) / updated.length;
                                        handleUpdateObstacleField(selectedObs.id, "x", Number(newCx.toFixed(3)));
                                        handleUpdateObstacleField(selectedObs.id, "y", Number(newCy.toFixed(3)));
                                      }
                                    }}
                                    className="text-marble/40 hover:text-ares-red-light p-0.5 transition-colors"
                                    title="Remove vertex"
                                  >
                                    <Trash2 size={10} />
                                  </button>
                                </div>
                              );
                            })}

                            <button
                              onClick={() => {
                                const newPt = { x: selectedObs.x + 0.1, y: selectedObs.y + 0.1 };
                                const updated = [...(selectedObs.points || []), newPt];
                                handleUpdateObstacleField(selectedObs.id, "points", updated);
                                const newCx = updated.reduce((sum, p) => sum + p.x, 0) / updated.length;
                                const newCy = updated.reduce((sum, p) => sum + p.y, 0) / updated.length;
                                handleUpdateObstacleField(selectedObs.id, "x", Number(newCx.toFixed(3)));
                                handleUpdateObstacleField(selectedObs.id, "y", Number(newCy.toFixed(3)));
                              }}
                              className="w-full py-1 text-[8px] uppercase font-black tracking-widest text-ares-gold border border-dashed border-ares-gold/20 hover:border-ares-gold/40 hover:bg-ares-gold/5 rounded-lg transition-all cursor-pointer"
                            >
                              Add Vertex
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
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
                        </>
                      )}

                      {/* Mirror Duplicate controls */}
                      <div className="col-span-2 border-t border-white/5 pt-3 space-y-2">
                        <span className="text-[8px] uppercase font-black tracking-widest text-marble/45 block font-semibold">
                          Mirror Duplicate Copy
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => handleMirrorObstacle(selectedObs.id, "x")}
                            className="py-1.5 text-[8.5px] font-bold uppercase tracking-wider text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30 hover:bg-ares-gold/5 rounded-lg transition-all cursor-pointer"
                            title="Duplicate and mirror across X-axis"
                          >
                            X-Axis (Y)
                          </button>
                          <button
                            onClick={() => handleMirrorObstacle(selectedObs.id, "y")}
                            className="py-1.5 text-[8.5px] font-bold uppercase tracking-wider text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30 hover:bg-ares-gold/5 rounded-lg transition-all cursor-pointer"
                            title="Duplicate and mirror across Y-axis"
                          >
                            Y-Axis (X)
                          </button>
                          <button
                            onClick={() => handleMirrorObstacle(selectedObs.id, "center")}
                            className="py-1.5 text-[8.5px] font-bold uppercase tracking-wider text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30 hover:bg-ares-gold/5 rounded-lg transition-all cursor-pointer"
                            title="Duplicate and mirror across center"
                          >
                            Center
                          </button>
                        </div>
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
                            Ramp Incline Direction
                          </label>
                          <select
                            value={selectedObs.rampDirection || "up"}
                            onChange={(e) => handleUpdateObstacleField(selectedObs.id, "rampDirection", e.target.value)}
                            className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-ares-cyan cursor-pointer"
                          >
                            <option value="up">North (Up)</option>
                            <option value="down">South (Down)</option>
                            <option value="left">West (Left)</option>
                            <option value="right">East (Right)</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-white/5 pt-4 text-[10px] font-mono text-marble/35 uppercase text-center">
                    Select an obstacle to edit properties.
                  </div>
                )}
              </>
            )}
          </div>

          {/* Placed Elements Catalog template creator */}
          <div className={`glass-card border border-white/10 bg-black/60 shadow-2xl transition-all duration-200 ${isElementCatalogExpanded ? "p-6 space-y-5" : "p-4 space-y-0"}`}>
            <div 
              onClick={() => setIsElementCatalogExpanded(!isElementCatalogExpanded)}
              className={`flex items-center justify-between cursor-pointer hover:text-ares-gold select-none ${
                isElementCatalogExpanded ? "border-b border-white/5 pb-3" : ""
              }`}
            >
              <h3 className="text-xs font-black uppercase text-white tracking-widest font-heading flex items-center gap-2 transition-colors">
                <Grid size={14} className="text-ares-gold" /> Element Catalog Types
              </h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddElementType();
                  }}
                  className="px-2.5 py-1 bg-ares-gold/15 hover:bg-ares-gold/25 text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30 text-[9px] uppercase font-black tracking-widest rounded-lg flex items-center gap-1 transition-all cursor-pointer font-bold"
                >
                  <Plus size={10} /> New Type
                </button>
                {isElementCatalogExpanded ? <ChevronUp size={14} className="text-marble/40" /> : <ChevronDown size={14} className="text-marble/40" />}
              </div>
            </div>

            {isElementCatalogExpanded && (
              <>
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
              </>
            )}
          </div>

          {/* Placed Elements Inventory Card */}
          <div className={`glass-card border border-white/10 bg-black/60 shadow-2xl transition-all duration-200 ${isPlacedElementsExpanded ? "p-6 space-y-5" : "p-4 space-y-0"}`}>
            <div 
              onClick={() => setIsPlacedElementsExpanded(!isPlacedElementsExpanded)}
              className={`flex items-center justify-between cursor-pointer hover:text-ares-gold select-none ${
                isPlacedElementsExpanded ? "border-b border-white/5 pb-3" : ""
              }`}
            >
              <h3 className="text-xs font-black uppercase text-white tracking-widest font-heading flex items-center gap-2 transition-colors">
                <Activity size={14} className="text-ares-gold" /> Placed Elements
              </h3>
              {isPlacedElementsExpanded ? <ChevronUp size={14} className="text-marble/40" /> : <ChevronDown size={14} className="text-marble/40" />}
            </div>

            {isPlacedElementsExpanded && (
              <>
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
              </>
            )}
          </div>

          {/* AprilTags Inventory Card */}
          <div className={`glass-card border border-white/10 bg-black/60 shadow-2xl transition-all duration-200 ${isTagsExpanded ? "p-6 space-y-5" : "p-4 space-y-0"}`}>
            <div 
              onClick={() => setIsTagsExpanded(!isTagsExpanded)}
              className={`flex items-center justify-between cursor-pointer hover:text-ares-gold select-none ${
                isTagsExpanded ? "border-b border-white/5 pb-3" : ""
              }`}
            >
              <h3 className="text-xs font-black uppercase text-white tracking-widest font-heading flex items-center gap-2 transition-colors">
                <Compass size={14} className="text-ares-gold" /> AprilTags Inventory
              </h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddAprilTag();
                  }}
                  className="px-2.5 py-1 bg-ares-gold/15 hover:bg-ares-gold/25 text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30 text-[9px] uppercase font-black tracking-widest rounded-lg flex items-center gap-1 transition-all cursor-pointer font-bold shrink-0"
                >
                  <Plus size={10} /> Add Tag
                </button>
                {isTagsExpanded ? <ChevronUp size={14} className="text-marble/40 cursor-pointer" /> : <ChevronDown size={14} className="text-marble/40 cursor-pointer" />}
              </div>
            </div>

            {isTagsExpanded && (
              <>
                <div className="max-h-36 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-white/5 pr-1">
                  {apriltags.length === 0 ? (
                    <div className="text-[10px] font-mono text-marble/35 uppercase text-center py-4">
                      No AprilTags placed yet.
                    </div>
                  ) : (
                    apriltags.map((tag) => {
                      const isSelected = tag.id === selectedTagId;
                      return (
                        <div
                          key={tag.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTagId(tag.id);
                            setSelectedObstacleId(null);
                            setSelectedElementInstanceId(null);
                          }}
                          className={`flex items-center justify-between px-3 py-2 border rounded-xl cursor-pointer transition-all ${
                            isSelected
                              ? "bg-ares-gold/10 border-ares-gold text-white"
                              : "bg-black/30 border-white/5 text-marble/70 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <span className="text-[11px] font-mono font-bold truncate">
                            Tag #{tag.id} ({tag.x.toFixed(2)}, {tag.y.toFixed(2)})
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAprilTag(tag.id);
                            }}
                            className="text-marble/40 hover:text-ares-red-light p-1 cursor-pointer transition-colors"
                            title="Delete tag"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {selectedTagId !== null ? (
                  (() => {
                    const tag = apriltags.find((t) => t.id === selectedTagId);
                    if (!tag) return null;
                    return (
                      <div className="border-t border-white/5 pt-4 space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-ares-gold font-bold">
                          Tag Properties: Tag #{tag.id}
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                              Tag ID (Integer)
                            </label>
                            <input
                              type="number"
                              step="1"
                              value={tag.id}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleUpdateAprilTagField(tag.id, "id", parseInt(e.target.value) || 0)}
                              className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                              Height Z (m)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={tag.z}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleUpdateAprilTagField(tag.id, "z", parseFloat(e.target.value) || 0)}
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
                              value={tag.x}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleUpdateAprilTagField(tag.id, "x", parseFloat(e.target.value) || 0)}
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
                              value={tag.y}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleUpdateAprilTagField(tag.id, "y", parseFloat(e.target.value) || 0)}
                              className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5 col-span-2">
                            <label className="text-[8px] uppercase font-black tracking-widest text-marble/45">
                              Yaw Angle (degrees)
                            </label>
                            <input
                              type="number"
                              step="1"
                              value={tag.yaw}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => handleUpdateAprilTagField(tag.id, "yaw", parseFloat(e.target.value) || 0)}
                              className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-cyan"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="border-t border-white/5 pt-4 text-[10px] font-mono text-marble/35 uppercase text-center">
                    Select a placed AprilTag to edit.
                  </div>
                )}

                {/* WPILib JSON Importer */}
                <div className="border-t border-white/5 pt-4 space-y-2.5">
                  <span className="text-[9px] uppercase font-black tracking-widest text-ares-gold block font-semibold font-heading">
                    WPILib apriltags.json Import
                  </span>
                  <p className="text-[8.5px] text-marble/40 leading-relaxed font-mono">
                    Paste the raw content of your WPILib format apriltags.json file below to import all tags automatically.
                  </p>
                  <textarea
                    value={importText}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder='e.g., {"tags": [{"ID": 1, "pose": {"translation": {"x": 1.5, "y": 1.5, "z": 0.5}, "rotation": {"quaternion": {"W": 1, "X": 0, "Y": 0, "Z": 0}}}}]}'
                    className="w-full h-16 bg-black/40 border border-white/10 rounded-lg p-2 text-[9px] font-mono text-white focus:outline-none focus:border-ares-cyan resize-none"
                  />
                  <button
                    onClick={() => {
                      handleImportAprilTagsJson(importText);
                      setImportText("");
                    }}
                    className="w-full py-1.5 bg-ares-gold/15 hover:bg-ares-gold/25 text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30 text-[9px] uppercase font-black tracking-widest rounded-lg transition-all font-bold cursor-pointer"
                  >
                    Parse and Import
                  </button>
                </div>
              </>
            )}
          </div>

        </div>

      </div>

      {/* Onshape Synchronization Settings card */}
      <div className="glass-card p-6 border border-white/10 bg-black/60 shadow-2xl max-w-4xl">
        <h3 className="text-xs font-black uppercase text-white tracking-widest font-heading border-b border-white/5 pb-3 mb-4 flex items-center gap-2">
          <Link size={14} className="text-ares-gold" /> Onshape Field CAD Synchronization
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="field-doc-id" className="text-[8px] uppercase font-black tracking-widest text-marble/45">
              Document ID
            </label>
            <input
              id="field-doc-id"
              type="text"
              value={fieldDocId}
              onChange={(e) => setFieldDocId(e.target.value)}
              className="bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-ares-cyan"
              placeholder="Onshape Doc ID"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="field-wk-id" className="text-[8px] uppercase font-black tracking-widest text-marble/45">
              Workspace ID
            </label>
            <input
              id="field-wk-id"
              type="text"
              value={fieldWkId}
              onChange={(e) => setFieldWkId(e.target.value)}
              className="bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-ares-cyan"
              placeholder="Onshape Workspace ID"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="field-el-id" className="text-[8px] uppercase font-black tracking-widest text-marble/45">
              Element ID
            </label>
            <input
              id="field-el-id"
              type="text"
              value={fieldElId}
              onChange={(e) => setFieldElId(e.target.value)}
              className="bg-neutral-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-ares-cyan"
              placeholder="Onshape Assembly Element ID"
            />
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-white/5 pt-4">
          <div className="text-[10px] text-marble/40 leading-relaxed font-mono flex items-center gap-1.5">
            {isFieldConnected ? (
              <>
                <span className="text-ares-success">● Connected</span>
                <span>Last Sync: {fieldSyncMeta?.lastSyncedAt ? new Date(fieldSyncMeta.lastSyncedAt).toLocaleString() : "Never"}</span>
              </>
            ) : (
              <span>Not synchronized yet.</span>
            )}
          </div>
          <button
            onClick={handleSyncFieldCAD}
            disabled={loading}
            className="px-4 py-2 bg-ares-gold text-black hover:bg-ares-gold-soft text-[9px] uppercase font-black tracking-widest rounded-lg transition-all font-bold cursor-pointer disabled:opacity-50"
          >
            {loading ? "Syncing..." : "Sync CAD assembly"}
          </button>
        </div>
      </div>

      {/* Crop & Alignment Modal */}
      <CropModal
        isOpen={showCropModal}
        onClose={() => setShowCropModal(false)}
        rawUploadedImage={rawUploadedImage}
        fieldType={fieldType}
        onApplyCrop={(croppedFile, croppedBgImage) => {
          setLocalBgFile(croppedFile);
          setBgImage(croppedBgImage);
          setShowCropModal(false);
        }}
      />

    </div>
  );
}
