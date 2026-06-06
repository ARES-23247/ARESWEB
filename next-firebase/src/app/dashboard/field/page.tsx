"use client";

import React, { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  getDocs, 
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

interface FieldConfig {
  id: string;
  name: string;
  updatedAt: number;
  obstacles: FieldObstacle[];
}

export default function FieldObstacleEditor() {
  const [configs, setConfigs] = useState<FieldConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");
  const [configName, setConfigName] = useState<string>("New Configuration");
  const [obstacles, setObstacles] = useState<FieldObstacle[]>([]);
  const [selectedObstacleId, setSelectedObstacleId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

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
          obstacles: data.obstacles || []
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
      const res = await fetch("/api/analytics/onshape-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: fieldDocId,
          workspaceId: fieldWkId,
          elementId: fieldElId,
          type: "field"
        })
      });
      const data = await res.json();
      if (data.success) {
        const meta = {
          documentId: fieldDocId,
          workspaceId: fieldWkId,
          elementId: fieldElId,
          engineUsed: data.engine,
          fileSizeMb: data.fileSizeMb,
          optimizedUrl: data.cadUrl,
          fieldYear: data.fieldYear || "2025-2026 Into The Deep",
          elementCount: data.elementCount || 42
        };

        // Save to Firestore under settings/field_cad so it persists globally
        const fieldRef = doc(db, "settings", "field_cad");
        await setDoc(fieldRef, {
          documentId: fieldDocId,
          workspaceId: fieldWkId,
          elementId: fieldElId,
          cadUrl: data.cadUrl,
          syncMeta: meta
        });

        setFieldSyncMeta(meta);
        setIsFieldConnected(true);
        
        // Reload layouts list to fetch the newly generated layout from Firestore
        await fetchConfigs();
        alert(data.message || "Field CAD synchronized successfully!");
      } else {
        alert("Failed to sync Field CAD: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      console.error("Failed to sync Field CAD:", err);
      const isPermissionError = err?.message?.toLowerCase().includes("permission") || err?.code === "permission-denied";
      alert(
        isPermissionError
          ? "Failed to save sync metadata: Insufficient database permissions."
          : "Failed to sync Field CAD: " + (err?.message || "Network connection or parsing error.")
      );
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
    setSelectedObstacleId(null);
  };

  const handleCreateNew = () => {
    setSelectedConfigId("");
    setConfigName("New Field Layout");
    setObstacles([]);
    setSelectedObstacleId(null);
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

  const handleSaveToCloud = async () => {
    if (!configName.trim()) {
      alert("Please enter a layout name.");
      return;
    }
    setSaving(true);
    try {
      const docId = selectedConfigId || `config_${Math.random().toString(36).substring(2, 9)}`;
      const docRef = doc(db, "field_configs", docId);
      
      const payload = {
        name: configName,
        updatedAt: Date.now(),
        obstacles: obstacles.map((obs) => ({
          id: obs.id,
          name: obs.name,
          x: Number(obs.x),
          y: Number(obs.y),
          width: Number(obs.width),
          height: Number(obs.height)
        }))
      };

      await setDoc(docRef, payload);
      setSelectedConfigId(docId);
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
    ctx.fillStyle = "#0A0A0A";
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // 2. Draw 6x6 Grid Tiles (each tape tile is 24x24 inches = 0.6096m x 0.6096m)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
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
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 2;
    ctx.strokeRect(toPxX(1.8288), toPxY(1.8288), canvasSize - 2 * toPxX(1.8288), canvasSize - 2 * toPxY(1.8288));

    // 4. Draw Center Origin Marker
    ctx.strokeStyle = "rgba(245, 158, 11, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - 10, centerY);
    ctx.lineTo(centerX + 10, centerY);
    ctx.moveTo(centerX, centerY - 10);
    ctx.lineTo(centerX, centerY + 10);
    ctx.stroke();

    // 5. Draw red and blue zones/substations as faint context
    ctx.fillStyle = "rgba(239, 68, 68, 0.05)";
    ctx.beginPath();
    ctx.arc(toPxX(1.8288), toPxY(1.8288), 0.508 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(59, 130, 246, 0.05)";
    ctx.beginPath();
    ctx.arc(toPxX(-1.8288), toPxY(-1.8288), 0.508 * scale, 0, Math.PI * 2);
    ctx.fill();

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

  }, [obstacles, selectedObstacleId, canvasSize]);

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

    // 1. Check if we clicked on the active obstacle's resize handle
    if (selectedObstacleId) {
      const obs = obstacles.find((o) => o.id === selectedObstacleId);
      if (obs) {
        const handleX = toPxX(obs.y - obs.width / 2);
        const handleY = toPxY(obs.x - obs.height / 2);
        const dist = Math.hypot(mouseX - handleX, mouseY - handleY);

        if (dist <= 10) {
          // Resize mode initiated
          dragModeRef.current = "resizing";
          dragStartRef.current = {
            mx,
            my,
            ox: obs.x,
            oy: obs.y,
            ow: obs.width,
            oh: obs.height,
            // Fixed opposite corner (top-left in screen space is EKF X positive, Y positive)
            fixedX: obs.x + obs.height / 2,
            fixedY: obs.y + obs.width / 2
          };
          return;
        }
      }
    }

    // 2. Check if we clicked inside any obstacle (top-most in index gets selected)
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      const halfW = obs.width / 2;
      const halfH = obs.height / 2;

      const insideX = mx >= obs.x - halfH && mx <= obs.x + halfH;
      const insideY = my >= obs.y - halfW && my <= obs.y + halfW;

      if (insideX && insideY) {
        setSelectedObstacleId(obs.id);
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

    if (dragModeRef.current === "dragging" && selectedObstacleId) {
      const diffX = mx - dragStartRef.current.mx;
      const diffY = my - dragStartRef.current.my;

      // Bound center so it doesn't leave the field limits (1.8288m)
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
    } else if (dragModeRef.current === "resizing" && selectedObstacleId) {
      const drag = dragStartRef.current;
      if (drag.fixedX === undefined || drag.fixedY === undefined || drag.ow === undefined || drag.oh === undefined) return;

      // Opposite (fixed) corner in screen space (top-left) has higher values in EKF coords:
      // fixedX = obs.x + height/2
      // fixedY = obs.y + width/2
      // The cursor represents the bottom-right corner which has smaller values in EKF space:
      // mx is cursor EKF X, my is cursor EKF Y.
      
      const newHeight = Math.max(0.1, drag.fixedX - mx);
      const newWidth = Math.max(0.1, drag.fixedY - my);

      // Calculate new center based on keeping opposite corner fixed
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
            className="bg-black/50 text-white text-xs border border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:border-ares-gold uppercase font-bold cursor-pointer min-w-[150px]"
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
                style={{ width: `${canvasSize}px`, height: `${canvasSize}px` }}
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
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-semibold text-xs focus:outline-none focus:border-ares-gold transition-colors"
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
                className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 py-3 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-2 font-bold cursor-pointer disabled:opacity-20"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>

          {/* Active Obstacles & Selected Item Properties */}
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
                        className="text-marble/40 hover:text-red-400 p-1 cursor-pointer transition-colors"
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
                      className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-gold"
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
                      className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-gold"
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
                      className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-gold"
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
                      className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-gold"
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
                      className="bg-black/45 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono focus:outline-none focus:border-ares-gold"
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
                          {cfg.obstacles.length} {cfg.obstacles.length === 1 ? "box" : "boxes"}
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

      {/* ─── ONSHAPE CAD INTEGRATION SECTION ─── */}
      <section className="border-t border-white/5 pt-8 space-y-6">
        <div>
          <h2 className="text-lg font-black text-white uppercase tracking-tight font-heading flex items-center gap-2">
            <Link size={18} className="text-ares-gold animate-pulse" /> Onshape CAD Synchronization
          </h2>
          <p className="text-marble/70 text-xs mt-1">
            Manage your Onshape integrations. Synchronize 3D field meshes and associate robot assemblies to automatically fetch kinematic constraints and obstacle definitions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Onshape Field CAD Sync */}
          <div className="glass-card p-6 border border-white/10 bg-black/60 shadow-2xl flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-xs font-black uppercase text-white tracking-widest font-heading border-b border-white/5 pb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Map size={14} className="text-ares-gold animate-pulse" /> Onshape 3D Field Sync
                </span>
                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
                  isFieldConnected ? "bg-emerald-500/25 text-emerald-400 border border-emerald-500/20" : "bg-ares-gold/25 text-ares-gold border border-ares-gold/20"
                }`}>
                  {isFieldConnected ? "Synced" : "Not Synced"}
                </span>
              </h3>

              <div className="space-y-3.5 mt-4">
                <div>
                  <label className="text-[9px] font-black uppercase text-marble/45 tracking-widest block mb-1">
                    Field Document ID
                  </label>
                  <input
                    type="text"
                    placeholder="Paste Onshape URL or Document ID..."
                    value={fieldDocId}
                    onChange={(e) => {
                      const val = e.target.value;
                      const parsed = parseOnshapeUrl(val);
                      if (parsed) {
                        setFieldDocId(parsed.documentId);
                        setFieldWkId(parsed.workspaceId);
                        setFieldElId(parsed.elementId);
                      } else {
                        setFieldDocId(val);
                      }
                    }}
                    className="w-full bg-black/50 border border-white/5 focus:border-ares-gold/25 focus:ring-1 focus:ring-ares-gold/25 rounded-xl px-3 py-2 text-xs text-white placeholder-marble/30 font-medium font-mono focus:outline-none"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-[9px] font-black uppercase text-marble/45 tracking-widest block mb-1">Workspace ID</label>
                    <input
                      type="text"
                      placeholder="e.g. w_official..."
                      value={fieldWkId}
                      onChange={(e) => setFieldWkId(e.target.value)}
                      className="w-full bg-black/50 border border-white/5 focus:border-ares-gold/25 focus:ring-1 focus:ring-ares-gold/25 rounded-xl px-3 py-2 text-xs text-white placeholder-marble/30 font-medium font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-marble/45 tracking-widest block mb-1">Element ID</label>
                    <input
                      type="text"
                      placeholder="e.g. e_arena..."
                      value={fieldElId}
                      onChange={(e) => setFieldElId(e.target.value)}
                      className="w-full bg-black/50 border border-white/5 focus:border-ares-gold/25 focus:ring-1 focus:ring-ares-gold/25 rounded-xl px-3 py-2 text-xs text-white placeholder-marble/30 font-medium font-mono focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={handleSyncFieldCAD}
                disabled={loading}
                className={`w-full py-2.5 bg-ares-gold hover:bg-ares-gold-soft text-black text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer transition-all duration-300 shadow-md flex items-center justify-center gap-2 ${
                  loading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" /> Syncing Field CAD...
                  </>
                ) : (
                  <>
                    <Map size={12} /> Sync Global Field CAD
                  </>
                )}
              </button>

              {fieldSyncMeta && (
                <div className="bg-black/30 border border-white/5 p-3 rounded-xl space-y-1.5 text-[9px] font-mono text-marble/70">
                  <div className="flex justify-between">
                    <span>Field mesh size:</span>
                    <span className="text-white font-bold">{fieldSyncMeta.fileSizeMb.toFixed(2)} MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Season field:</span>
                    <span className="text-white font-bold">{fieldSyncMeta.fieldYear}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active obstacles:</span>
                    <span className="text-ares-gold font-bold">{fieldSyncMeta.elementCount} synced</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Onshape Robot CAD Sync */}
          <OnshapeRobotSyncCard />
        </div>
      </section>

    </div>
  );
}
