"use client";
import React, { useState, useEffect } from "react";
import { Link, RefreshCw, CheckCircle2, Cpu, Map, ChevronDown, ChevronUp } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";

interface SyncMetadata {
  documentId: string;
  workspaceId: string;
  elementId: string;
  lastSyncedAt?: any;
  optimizedUrl: string;
  engineUsed: string;
  fileSizeMb: number;
  mateBindings?: Array<{ mateName: string; type: string; channel: string }>;
  fieldYear?: string;
  elementCount?: number;
}

const MOCK_ROBOT_TYPES = [
  { 
    id: "minotaur", 
    name: "Minotaur", 
    seasonName: "2025-2026", 
    challengeName: "INTO THE DEEP", 
    onshapeDocId: "d_23247_ares_robot_v4", 
    onshapeWorkspaceId: "w_build_season_final", 
    onshapeElementId: "e_chassis_assembly" 
  },
  { 
    id: "prometheus", 
    name: "Prometheus", 
    seasonName: "2024-2025", 
    challengeName: "CENTERSTAGE", 
    onshapeDocId: "d_23247_ftc_prometheus", 
    onshapeWorkspaceId: "w_centerstage_final", 
    onshapeElementId: "e_lift_mechanism" 
  }
];

export default function OnshapeSyncCard() {
  const [robots, setRobots] = useState<any[]>([]);
  const [selectedRobotId, setSelectedRobotId] = useState("");

  // Robot States
  const [robotDocId, setRobotDocId] = useState("");
  const [robotWkId, setRobotWkId] = useState("");
  const [robotElId, setRobotElId] = useState("");
  const [robotSyncMeta, setRobotSyncMeta] = useState<SyncMetadata | null>(null);
  const [isRobotConnected, setIsRobotConnected] = useState(false);

  // Field States
  const [fieldDocId, setFieldDocId] = useState("");
  const [fieldWkId, setFieldWkId] = useState("");
  const [fieldElId, setFieldElId] = useState("");
  const [fieldSyncMeta, setFieldSyncMeta] = useState<SyncMetadata | null>(null);
  const [isFieldConnected, setIsFieldConnected] = useState(false);

  const [loading, setLoading] = useState(false);
  const [showFieldConfig, setShowFieldConfig] = useState(false);

  // Load robots list and field CAD settings from Firestore on mount
  useEffect(() => {
    const fetchRobotsAndField = async () => {
      try {
        // 1. Fetch robots list
        const robotsSnap = await getDocs(collection(db, "robots"));
        const robotsList = robotsSnap.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: data.name || docSnap.id,
            seasonName: data.seasonName || "Legacy",
            challengeName: data.challengeName || "Unknown",
            onshapeDocId: data.onshapeDocId || "",
            onshapeWorkspaceId: data.onshapeWorkspaceId || "",
            onshapeElementId: data.onshapeElementId || "",
            syncMeta: data.syncMeta || null,
            ...data
          };
        });

        const activeList = robotsList.length > 0 ? robotsList : MOCK_ROBOT_TYPES;
        setRobots(activeList);

        // Pre-select first robot
        if (activeList.length > 0) {
          const initial = activeList[0];
          setSelectedRobotId(initial.id);
          setRobotDocId(initial.onshapeDocId || "");
          setRobotWkId(initial.onshapeWorkspaceId || "");
          setRobotElId(initial.onshapeElementId || "");
          setRobotSyncMeta(initial.syncMeta || null);
          setIsRobotConnected(!!initial.syncMeta);
        }

        // 2. Fetch global field CAD settings
        const fieldDocSnap = await getDoc(doc(db, "settings", "field_cad"));
        if (fieldDocSnap.exists()) {
          const fieldData = fieldDocSnap.data();
          setFieldDocId(fieldData.documentId || "");
          setFieldWkId(fieldData.workspaceId || "");
          setFieldElId(fieldData.elementId || "");
          setFieldSyncMeta(fieldData.syncMeta || null);
          setIsFieldConnected(!!fieldData.syncMeta);
        } else {
          // Fallback to default
          setFieldDocId("d_23247_ftc_field_into_the_deep");
          setFieldWkId("w_official_layout");
          setFieldElId("e_arena_mesh");
        }
      } catch (err) {
        console.warn("Firestore empty or disconnected, using mock robots:", err);
        setRobots(MOCK_ROBOT_TYPES);
        setSelectedRobotId(MOCK_ROBOT_TYPES[0].id);
        setRobotDocId(MOCK_ROBOT_TYPES[0].onshapeDocId);
        setRobotWkId(MOCK_ROBOT_TYPES[0].onshapeWorkspaceId);
        setRobotElId(MOCK_ROBOT_TYPES[0].onshapeElementId);

        setFieldDocId("d_23247_ftc_field_into_the_deep");
        setFieldWkId("w_official_layout");
        setFieldElId("e_arena_mesh");
      }
    };

    fetchRobotsAndField();
  }, []);

  const handleRobotChange = (robotId: string) => {
    setSelectedRobotId(robotId);
    const selected = robots.find(r => r.id === robotId);
    if (selected) {
      setRobotDocId(selected.onshapeDocId || "");
      setRobotWkId(selected.onshapeWorkspaceId || "");
      setRobotElId(selected.onshapeElementId || "");
      setRobotSyncMeta(selected.syncMeta || null);
      setIsRobotConnected(!!selected.syncMeta);
    }
  };

  const handleSyncRobotCAD = async () => {
    if (!robotDocId || !robotWkId || !robotElId) {
      alert("Please fill in all Robot CAD credentials.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/analytics/onshape-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: robotDocId,
          workspaceId: robotWkId,
          elementId: robotElId,
          type: "robot"
        })
      });
      const data = await res.json();
      if (data.success) {
        const meta: SyncMetadata = {
          documentId: robotDocId,
          workspaceId: robotWkId,
          elementId: robotElId,
          engineUsed: data.engine,
          fileSizeMb: data.fileSizeMb,
          optimizedUrl: data.cadUrl,
          mateBindings: [
            { mateName: "LinearSlideMate", type: "Slider", channel: "mechanisms/slide/height" },
            { mateName: "IntakePivotMate", type: "Revolute", channel: "mechanisms/intake/current" }
          ]
        };

        // Save to Firestore under the selected robot document
        const robotRef = doc(db, "robots", selectedRobotId);
        await setDoc(robotRef, {
          onshapeDocId: robotDocId,
          onshapeWorkspaceId: robotWkId,
          onshapeElementId: robotElId,
          onshapeUrl: `https://cad.onshape.com/documents/${robotDocId}/w/${robotWkId}/e/${robotElId}`,
          cadViewerUrl: data.cadUrl,
          syncMeta: meta
        }, { merge: true });

        // Update local state
        setRobots(prev => prev.map(r => r.id === selectedRobotId ? {
          ...r,
          onshapeDocId: robotDocId,
          onshapeWorkspaceId: robotWkId,
          onshapeElementId: robotElId,
          onshapeUrl: `https://cad.onshape.com/documents/${robotDocId}/w/${robotWkId}/e/${robotElId}`,
          cadViewerUrl: data.cadUrl,
          syncMeta: meta
        } : r));

        setRobotSyncMeta(meta);
        setIsRobotConnected(true);
      } else {
        alert("Failed to sync Robot CAD: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Failed to sync Robot CAD model: Network connection error.");
    } finally {
      setLoading(false);
    }
  };

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
        const meta: SyncMetadata = {
          documentId: fieldDocId,
          workspaceId: fieldWkId,
          elementId: fieldElId,
          engineUsed: data.engine,
          fileSizeMb: data.fileSizeMb,
          optimizedUrl: data.cadUrl,
          fieldYear: "2025-2026 Into The Deep",
          elementCount: 42
        };

        // Save to Firestore under settings/field_cad
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
      } else {
        alert("Failed to sync Field CAD: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      alert("Failed to sync Field CAD model: Network connection error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-6 border border-white/10 flex flex-col gap-5 h-full justify-between">
      {/* Header */}
      <div>
        <div className="border-b border-white/5 pb-3 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase text-white tracking-widest font-heading flex items-center gap-2">
            <Link size={14} className="text-ares-gold animate-pulse" /> Onshape CAD Manager
          </h3>
          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
            isRobotConnected ? "bg-emerald-500/25 text-emerald-400 border border-emerald-500/20" : "bg-ares-gold/25 text-ares-gold border border-ares-gold/20"
          }`}>
            {isRobotConnected ? "Robot Linked" : "Robot Unlinked"}
          </span>
        </div>

        {/* Robot Selector */}
        <div className="mt-4">
          <label className="text-[9px] font-black uppercase text-marble/45 tracking-widest block mb-1">
            Associate CAD to Robot Class/Type
          </label>
          <div className="relative flex items-center bg-black/50 border border-white/5 px-3 py-2 rounded-xl text-xs">
            <Cpu size={14} className="text-ares-gold mr-2" />
            <select
              value={selectedRobotId}
              onChange={(e) => handleRobotChange(e.target.value)}
              className="bg-transparent text-white focus:outline-none font-bold uppercase cursor-pointer w-full"
            >
              {robots.map((r) => (
                <option key={r.id} value={r.id} className="bg-neutral-900 text-white">
                  {r.name} ({r.seasonName})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Robot Input Fields */}
      <div className="space-y-3.5">
        <div>
          <label className="text-[9px] font-black uppercase text-marble/45 tracking-widest block mb-1">
            Robot Assembly Document ID
          </label>
          <input
            type="text"
            placeholder="e.g. d_23247_ares_robot..."
            value={robotDocId}
            onChange={(e) => setRobotDocId(e.target.value)}
            className="w-full bg-black/50 border border-white/5 focus:border-ares-gold/25 focus:ring-1 focus:ring-ares-gold/25 rounded-xl px-3 py-2 text-xs text-white placeholder-marble/30 font-medium font-mono focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <label className="text-[9px] font-black uppercase text-marble/45 tracking-widest block mb-1">Workspace ID</label>
            <input
              type="text"
              placeholder="e.g. w_official..."
              value={robotWkId}
              onChange={(e) => setRobotWkId(e.target.value)}
              className="w-full bg-black/50 border border-white/5 focus:border-ares-gold/25 focus:ring-1 focus:ring-ares-gold/25 rounded-xl px-3 py-2 text-xs text-white placeholder-marble/30 font-medium font-mono focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[9px] font-black uppercase text-marble/45 tracking-widest block mb-1">Element ID</label>
            <input
              type="text"
              placeholder="e.g. e_chassis..."
              value={robotElId}
              onChange={(e) => setRobotElId(e.target.value)}
              className="w-full bg-black/50 border border-white/5 focus:border-ares-gold/25 focus:ring-1 focus:ring-ares-gold/25 rounded-xl px-3 py-2 text-xs text-white placeholder-marble/30 font-medium font-mono focus:outline-none"
            />
          </div>
        </div>

        <button
          onClick={handleSyncRobotCAD}
          disabled={loading}
          className={`w-full py-2.5 bg-ares-gold hover:bg-ares-gold-soft text-black text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer transition-all duration-300 shadow-md flex items-center justify-center gap-2 ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {loading ? (
            <>
              <RefreshCw size={12} className="animate-spin" /> Syncing Robot meshes...
            </>
          ) : (
            <>
              <Cpu size={12} /> Sync Onshape Robot CAD
            </>
          )}
        </button>
      </div>

      {/* Robot Synced Metadata Display */}
      {robotSyncMeta && (
        <div className="bg-black/45 border border-white/5 p-4 rounded-xl space-y-2.5 text-[10px]">
          <h4 className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-white/5 pb-1.5">
            <CheckCircle2 size={12} className="text-emerald-400" /> Synced Robot Configuration
          </h4>
          <ul className="space-y-1.5 font-medium text-marble/85 font-mono">
            <li className="flex justify-between">
              <span className="text-marble/45">File size:</span>
              <span className="text-white font-bold">{robotSyncMeta.fileSizeMb.toFixed(2)} MB</span>
            </li>
            <li className="flex justify-between">
              <span className="text-marble/45">Compiler:</span>
              <span className="text-ares-gold font-bold">{robotSyncMeta.engineUsed.split(" ")[0]}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-marble/45">Mate bindings:</span>
              <span className="text-white font-bold">{robotSyncMeta.mateBindings?.length} active Mates</span>
            </li>
          </ul>
        </div>
      )}

      {/* Collapsible Global Field CAD Config */}
      <div className="border-t border-white/5 pt-4">
        <button
          onClick={() => setShowFieldConfig(!showFieldConfig)}
          className="w-full flex items-center justify-between text-marble/45 hover:text-white transition-colors cursor-pointer text-[10px] font-black uppercase tracking-wider"
        >
          <span className="flex items-center gap-1.5">
            <Map size={12} className="text-ares-gold" /> Global Field CAD (One-time Config)
          </span>
          {showFieldConfig ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {showFieldConfig && (
          <div className="space-y-3.5 mt-3 animate-fadeIn">
            <p className="text-[9px] text-marble/50 leading-relaxed font-medium">
              Configure the 3D game arena mesh parameters once globally for ARES-Scope Replay rendering.
            </p>
            <div>
              <label className="text-[9px] font-black uppercase text-marble/45 tracking-widest block mb-1">
                Field Document ID
              </label>
              <input
                type="text"
                placeholder="e.g. d_23247_ftc_field..."
                value={fieldDocId}
                onChange={(e) => setFieldDocId(e.target.value)}
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

            <button
              onClick={handleSyncFieldCAD}
              disabled={loading}
              className={`w-full py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 text-[9px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer transition-all duration-300 shadow-md flex items-center justify-center gap-2 ${
                loading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw size={10} className="animate-spin" /> Syncing Field...
                </>
              ) : (
                <>
                  <Map size={10} /> Sync Global Field CAD
                </>
              )}
            </button>

            {fieldSyncMeta && (
              <div className="bg-black/30 border border-white/5 p-3 rounded-lg space-y-1.5 text-[9px] font-mono text-marble/70">
                <div className="flex justify-between">
                  <span>Field size:</span>
                  <span className="text-white">{fieldSyncMeta.fileSizeMb.toFixed(2)} MB</span>
                </div>
                <div className="flex justify-between">
                  <span>Season field:</span>
                  <span className="text-white">{fieldSyncMeta.fieldYear}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
