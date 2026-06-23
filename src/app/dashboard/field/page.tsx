"use client";

import React, { useState, useEffect } from "react";
import { db, storage, getDocWithTimeout, getDocsWithTimeout } from "@/lib/firebase";
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
  Sliders, 
  Compass, 
  Activity, 
  Grid,
  ChevronDown,
  ChevronUp,
  Map,
  Link
} from "lucide-react";
import { authenticatedFetch } from "@/lib/api";

import FieldCanvas from "./components/FieldCanvas";
import { 
  FieldObstacle, 
  ElementType, 
  FieldElementInstance, 
  FieldAprilTag 
} from "./types";
import CropModal from "./components/CropModal";
import { useFieldLoader } from "./hooks/useFieldLoader";
import DriverStationCard from "./components/DriverStationCard";
import ObstaclesListAccordion from "./components/ObstaclesListAccordion";
import AprilTagRosterAccordion from "./components/AprilTagRosterAccordion";
import PlacedElementsAccordion from "./components/PlacedElementsAccordion";
import ElementCatalogAccordion from "./components/ElementCatalogAccordion";
import { downloadRobotConfigJson } from "./utils/fieldConfigExporter";
import { useScopeStore } from "../scope/store/scopeStore";



export interface FieldConfig {
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
  const { ntClient, connectionStatus } = useScopeStore();
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

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const {
    localBgFile,
    setLocalBgFile,
    localGlbFile,
    setLocalGlbFile,
    bgImage,
    setBgImage,
    rawUploadedImage,
    setRawUploadedImage,
    showCropModal,
    setShowCropModal,
    handleGlbFileChange,
    handleBgFileChange,
    resetLoader,
  } = useFieldLoader({
    configs,
    selectedConfigId,
    setLoading,
  });

  const [fieldDocId, setFieldDocId] = useState<string>("");
  const [fieldWkId, setFieldWkId] = useState<string>("");
  const [fieldElId, setFieldElId] = useState<string>("");
  const [fieldSyncMeta, setFieldSyncMeta] = useState<any | null>(null);
  const [isFieldConnected, setIsFieldConnected] = useState<boolean>(false);

  // Field dimensions in meters
  const fieldW = fieldType === "ftc" ? 3.6576 : 8.211;
  const fieldH = fieldType === "ftc" ? 3.6576 : 16.541;

  useEffect(() => {
    fetchConfigs();
  }, []);

  useEffect(() => {
    const fetchFieldCadSettings = async () => {
      try {
        const fieldDocSnap = await getDocWithTimeout(doc(db, "settings", "field_cad"));
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
      const querySnapshot = await getDocsWithTimeout(q);
      const fetchedConfigs: FieldConfig[] = [];
      querySnapshot.forEach((docSnap: any) => {
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

  const handleExportRobotJson = () => {
    const currentConfig: FieldConfig = {
      id: selectedConfigId,
      name: configName,
      updatedAt: Date.now(),
      fieldType,
      gameYear,
      xAxisDirection,
      yAxisDirection,
      redDriverStation,
      blueDriverStation,
      obstacles,
      elementTypes,
      elements,
      apriltags
    };
    downloadRobotConfigJson(currentConfig);
  };

  const handlePushToSimulator = async () => {
    // 1. Save to cloud first to make sure database is up to date
    await handleSaveToCloud();
    
    // 2. Publish to NT4 if connected
    if (ntClient) {
      try {
        const obstaclesPayload = obstacles.map((obs) => ({
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
          points: (obs.points || []).map(p => ({ x: Number(p.x), y: Number(p.y) })),
          friction: obs.friction !== undefined ? Number(obs.friction) : 0.5,
          restitution: obs.restitution !== undefined ? Number(obs.restitution) : 0.3,
          rotation: obs.rotation !== undefined ? Number(obs.rotation) : 0.0
        }));
        
        const payloadStr = JSON.stringify({ obstacles: obstaclesPayload });
        ntClient.publishPersistent("ARES/Input/obstacles", payloadStr, "string");
        
        if (selectedConfigId) {
          ntClient.publishPersistent("ARES/Input/configId", selectedConfigId, "string");
        }
        
        alert("Pushed updated layout to the active simulator daemon over NetworkTables!");
      } catch (err: any) {
        console.error("Failed to push layout to simulator over NT4:", err);
        alert("Layout saved to Firestore, but failed to push directly to simulator: " + err.message);
      }
    } else {
      alert("Layout saved to Firestore. Simulator is not connected via NT4, but it will reload this layout next time it polls Firestore (if running with --watch) or on restart.");
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

          <DriverStationCard
            isLayoutSettingsExpanded={isLayoutSettingsExpanded}
            setIsLayoutSettingsExpanded={setIsLayoutSettingsExpanded}
            configName={configName}
            setConfigName={setConfigName}
            gameYear={gameYear}
            setGameYear={setGameYear}
            fieldType={fieldType}
            setFieldType={setFieldType}
            redDriverStation={redDriverStation}
            setRedDriverStation={setRedDriverStation}
            blueDriverStation={blueDriverStation}
            setBlueDriverStation={setBlueDriverStation}
            xAxisDirection={xAxisDirection}
            setXAxisDirection={setXAxisDirection}
            yAxisDirection={yAxisDirection}
            setYAxisDirection={setYAxisDirection}
            showGrid={showGrid}
            setShowGrid={setShowGrid}
            showAllianceZones={showAllianceZones}
            setShowAllianceZones={setShowAllianceZones}
            showCoordinateAxes={showCoordinateAxes}
            setShowCoordinateAxes={setShowCoordinateAxes}
            localGlbFile={localGlbFile}
            hasGlbUrl={!!configs.find((c) => c.id === selectedConfigId)?.cadUrl}
            handleGlbFileChange={handleGlbFileChange}
            localBgFile={localBgFile}
            hasBgImageUrl={!!configs.find((c) => c.id === selectedConfigId)?.bgImageUrl}
            handleBgFileChange={handleBgFileChange}
            bgImage={bgImage}
            setRawUploadedImage={setRawUploadedImage}
            setShowCropModal={setShowCropModal}
            saving={saving}
            handleSaveToCloud={handleSaveToCloud}
            selectedConfigId={selectedConfigId}
            loading={loading}
            handleDeleteLayout={handleDeleteLayout}
            handleExportRobotJson={handleExportRobotJson}
            handlePushToSimulator={handlePushToSimulator}
            connectionStatus={connectionStatus}
          />

          <ObstaclesListAccordion
            isObstaclesExpanded={isObstaclesExpanded}
            setIsObstaclesExpanded={setIsObstaclesExpanded}
            obstacles={obstacles}
            selectedObstacleId={selectedObstacleId}
            setSelectedObstacleId={setSelectedObstacleId}
            handleAddObstacle={handleAddObstacle}
            handleDeleteObstacle={handleDeleteObstacle}
            handleUpdateObstacleField={handleUpdateObstacleField}
            isDrawingPolygon={isDrawingPolygon}
            setIsDrawingPolygon={setIsDrawingPolygon}
            setDrawingPoints={setDrawingPoints}
            setHoverPoint={setHoverPoint}
            handleMirrorObstacle={handleMirrorObstacle}
            fieldType={fieldType}
          />

          <ElementCatalogAccordion
            isElementCatalogExpanded={isElementCatalogExpanded}
            setIsElementCatalogExpanded={setIsElementCatalogExpanded}
            elementTypes={elementTypes}
            selectedElementTypeId={selectedElementTypeId}
            setSelectedElementTypeId={setSelectedElementTypeId}
            handleAddElementType={handleAddElementType}
            handleDeleteElementType={handleDeleteElementType}
            handleUpdateElementTypeField={handleUpdateElementTypeField}
            handleAddElementInstance={handleAddElementInstance}
          />

          <PlacedElementsAccordion
            isPlacedElementsExpanded={isPlacedElementsExpanded}
            setIsPlacedElementsExpanded={setIsPlacedElementsExpanded}
            elements={elements}
            elementTypes={elementTypes}
            selectedElementInstanceId={selectedElementInstanceId}
            setSelectedElementInstanceId={setSelectedElementInstanceId}
            handleDeleteElementInstance={handleDeleteElementInstance}
            handleUpdateElementInstanceField={handleUpdateElementInstanceField}
          />

          <AprilTagRosterAccordion
            isTagsExpanded={isTagsExpanded}
            setIsTagsExpanded={setIsTagsExpanded}
            apriltags={apriltags}
            selectedTagId={selectedTagId}
            setSelectedTagId={setSelectedTagId}
            setSelectedObstacleId={setSelectedObstacleId}
            setSelectedElementInstanceId={setSelectedElementInstanceId}
            handleAddAprilTag={handleAddAprilTag}
            handleDeleteAprilTag={handleDeleteAprilTag}
            handleUpdateAprilTagField={handleUpdateAprilTagField}
            handleImportAprilTagsJson={handleImportAprilTagsJson}
          />

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
