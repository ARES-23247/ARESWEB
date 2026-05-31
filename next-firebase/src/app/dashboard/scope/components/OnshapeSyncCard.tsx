"use client";

import React, { useState } from "react";
import { Link, RefreshCw, CheckCircle2, Cpu, Map } from "lucide-react";

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

export default function OnshapeSyncCard() {
  const [activeTab, setActiveTab] = useState<"robot" | "field">("robot");

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

  // Pre-fills
  const prefillAresAssembly = () => {
    if (activeTab === "robot") {
      setRobotDocId("d_23247_ares_robot_v4");
      setRobotWkId("w_build_season_final");
      setRobotElId("e_chassis_assembly");
    } else {
      setFieldDocId("d_23247_ftc_field_into_the_deep");
      setFieldWkId("w_official_layout");
      setFieldElId("e_arena_mesh");
    }
  };

  // Run Onshape sync pipeline
  const handleSyncCAD = async () => {
    const docId = activeTab === "robot" ? robotDocId : fieldDocId;
    const wkId = activeTab === "robot" ? robotWkId : fieldWkId;
    const elId = activeTab === "robot" ? robotElId : fieldElId;

    if (!docId || !wkId || !elId) {
      alert(`Please enter the Onshape Document, Workspace, and Element IDs for the ${activeTab}.`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/analytics/onshape-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: docId,
          workspaceId: wkId,
          elementId: elId,
          type: activeTab
        })
      });
      const data = await res.json();
      if (data.success) {
        const meta: SyncMetadata = {
          documentId: docId,
          workspaceId: wkId,
          elementId: elId,
          engineUsed: data.engine,
          fileSizeMb: data.fileSizeMb,
          optimizedUrl: data.cadUrl
        };

        if (activeTab === "robot") {
          meta.mateBindings = [
            { mateName: "LinearSlideMate", type: "Slider", channel: "mechanisms/slide/height" },
            { mateName: "IntakePivotMate", type: "Revolute", channel: "mechanisms/intake/current" }
          ];
          setRobotSyncMeta(meta);
          setIsRobotConnected(true);
        } else {
          meta.fieldYear = "2025-2026 Into The Deep";
          meta.elementCount = 42;
          setFieldSyncMeta(meta);
          setIsFieldConnected(true);
        }
      }
    } catch (err) {
      alert(`Failed to sync Onshape ${activeTab} CAD model: Network connection error.`);
    } finally {
      setLoading(false);
    }
  };

  const currentDocId = activeTab === "robot" ? robotDocId : fieldDocId;
  const currentWkId = activeTab === "robot" ? robotWkId : fieldWkId;
  const currentElId = activeTab === "robot" ? robotElId : fieldElId;

  const setCurrentDocId = activeTab === "robot" ? setRobotDocId : setFieldDocId;
  const setCurrentWkId = activeTab === "robot" ? setRobotWkId : setFieldWkId;
  const setCurrentElId = activeTab === "robot" ? setRobotElId : setFieldElId;

  const activeSyncMeta = activeTab === "robot" ? robotSyncMeta : fieldSyncMeta;
  const isConnected = activeTab === "robot" ? isRobotConnected : isFieldConnected;

  return (
    <div className="glass-card p-6 border border-white/10 flex flex-col gap-5 h-full justify-between">
      {/* Header */}
      <div>
        <div className="border-b border-white/5 pb-3 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase text-white tracking-widest font-heading flex items-center gap-2">
            <Link size={14} className="text-ares-gold animate-pulse" /> Onshape Workspace Link
          </h3>
          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
            isConnected ? "bg-emerald-500/25 text-emerald-400 border border-emerald-500/20" : "bg-ares-gold/25 text-ares-gold border border-ares-gold/20"
          }`}>
            {isConnected ? "Linked" : "Disconnected"}
          </span>
        </div>
        
        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 mt-4 bg-black/45 border border-white/5 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab("robot")}
            className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "robot" ? "bg-ares-gold text-black" : "text-marble/45 hover:text-white"
            }`}
          >
            <Cpu size={10} /> Robot Model
          </button>
          <button
            onClick={() => setActiveTab("field")}
            className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "field" ? "bg-ares-gold text-black" : "text-marble/45 hover:text-white"
            }`}
          >
            <Map size={10} /> 3D Field Environment
          </button>
        </div>
      </div>

      {/* Input Fields */}
      <div className="space-y-3.5">
        <div>
          <label className="text-[9px] font-black uppercase text-marble/45 tracking-widest block mb-1">
            {activeTab === "robot" ? "Robot Assembly" : "Field Scene"} Document ID
          </label>
          <input
            type="text"
            placeholder={activeTab === "robot" ? "e.g. d_23247_ares_robot..." : "e.g. d_23247_ftc_field..."}
            value={currentDocId}
            onChange={(e) => setCurrentDocId(e.target.value)}
            className="w-full bg-black/50 border border-white/5 focus:border-ares-gold/25 focus:ring-1 focus:ring-ares-gold/25 rounded-xl px-3 py-2 text-xs text-white placeholder-marble/30 font-medium font-mono focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <div>
            <label className="text-[9px] font-black uppercase text-marble/45 tracking-widest block mb-1">Workspace ID</label>
            <input
              type="text"
              placeholder="e.g. w_official..."
              value={currentWkId}
              onChange={(e) => setCurrentWkId(e.target.value)}
              className="w-full bg-black/50 border border-white/5 focus:border-ares-gold/25 focus:ring-1 focus:ring-ares-gold/25 rounded-xl px-3 py-2 text-xs text-white placeholder-marble/30 font-medium font-mono focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[9px] font-black uppercase text-marble/45 tracking-widest block mb-1">Element ID</label>
            <input
              type="text"
              placeholder={activeTab === "robot" ? "e.g. e_chassis..." : "e.g. e_arena..."}
              value={currentElId}
              onChange={(e) => setCurrentElId(e.target.value)}
              className="w-full bg-black/50 border border-white/5 focus:border-ares-gold/25 focus:ring-1 focus:ring-ares-gold/25 rounded-xl px-3 py-2 text-xs text-white placeholder-marble/30 font-medium font-mono focus:outline-none"
            />
          </div>
        </div>

        {/* Quick Pre-fill */}
        <button
          onClick={prefillAresAssembly}
          className="text-[9px] font-bold text-ares-gold hover:underline cursor-pointer tracking-wide flex items-center gap-1 mt-1"
        >
          ✨ Pre-fill ARES {activeTab === "robot" ? "Robot" : "Field"} CAD Credentials
        </button>
      </div>

      {/* Synced Metadata Display */}
      {activeSyncMeta && (
        <div className="bg-black/45 border border-white/5 p-4 rounded-xl space-y-2.5 text-[10px]">
          <h4 className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-white/5 pb-1.5">
            <CheckCircle2 size={12} className="text-emerald-400" /> Active {activeTab === "robot" ? "Robot" : "Field"} CAD Session
          </h4>
          <ul className="space-y-1.5 font-medium text-marble/85 font-mono">
            <li className="flex justify-between">
              <span className="text-marble/45">File size:</span>
              <span className="text-white font-bold">{activeSyncMeta.fileSizeMb.toFixed(2)} MB</span>
            </li>
            <li className="flex justify-between">
              <span className="text-marble/45">Compiler:</span>
              <span className="text-ares-gold font-bold">{activeSyncMeta.engineUsed.split(" ")[0]}</span>
            </li>
            {activeTab === "robot" ? (
              <li className="flex justify-between">
                <span className="text-marble/45">Mate bindings:</span>
                <span className="text-white font-bold">{activeSyncMeta.mateBindings?.length} active Mates</span>
              </li>
            ) : (
              <>
                <li className="flex justify-between">
                  <span className="text-marble/45">Season field:</span>
                  <span className="text-white font-bold">{activeSyncMeta.fieldYear}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-marble/45">3D Elements:</span>
                  <span className="text-white font-bold">{activeSyncMeta.elementCount} elements</span>
                </li>
              </>
            )}
          </ul>
        </div>
      )}

      {/* Sync / Authorise buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSyncCAD}
          disabled={loading}
          className={`flex-1 py-2.5 bg-ares-gold hover:bg-ares-gold-soft text-black text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer transition-all duration-300 shadow-md flex items-center justify-center gap-2 ${
            loading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {loading ? (
            <>
              <RefreshCw size={12} className="animate-spin" /> Compiling Meshes...
            </>
          ) : (
            <>
              <RefreshCw size={12} /> Sync Onshape CAD
            </>
          )}
        </button>
      </div>
    </div>
  );
}
