"use client";
import React, { useState, useEffect } from "react";
import { authenticatedFetch } from "@/lib/api";
import { Link, RefreshCw, CheckCircle2, Cpu, ChevronDown, ChevronUp } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";

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
    onshapeElementId: "e_chassis_assembly",
    syncMeta: null
  },
  { 
    id: "prometheus", 
    name: "Prometheus", 
    seasonName: "2024-2025", 
    challengeName: "CENTERSTAGE", 
    onshapeDocId: "d_23247_ftc_prometheus", 
    onshapeWorkspaceId: "w_centerstage_final", 
    onshapeElementId: "e_lift_mechanism",
    syncMeta: null
  }
];

export default function OnshapeRobotSyncCard() {
  const [robots, setRobots] = useState<any[]>([]);
  const [selectedRobotId, setSelectedRobotId] = useState("");

  // Robot States
  const [robotDocId, setRobotDocId] = useState("");
  const [robotWkId, setRobotWkId] = useState("");
  const [robotElId, setRobotElId] = useState("");
  const [robotSyncMeta, setRobotSyncMeta] = useState<SyncMetadata | null>(null);
  const [isRobotConnected, setIsRobotConnected] = useState(false);

  const [loading, setLoading] = useState(false);

  // Load robots list from Firestore on mount
  useEffect(() => {
    const fetchRobots = async () => {
      try {
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
      } catch (err) {
        console.warn("Firestore empty or disconnected, using mock robots:", err);
        setRobots(MOCK_ROBOT_TYPES);
        setSelectedRobotId(MOCK_ROBOT_TYPES[0].id);
        setRobotDocId(MOCK_ROBOT_TYPES[0].onshapeDocId);
        setRobotWkId(MOCK_ROBOT_TYPES[0].onshapeWorkspaceId);
        setRobotElId(MOCK_ROBOT_TYPES[0].onshapeElementId);
      }
    };

    fetchRobots();
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
      const res = await authenticatedFetch("/api/analytics/onshape-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: robotDocId,
          workspaceId: robotWkId,
          elementId: robotElId,
          type: "robot",
          robotId: selectedRobotId
        })
      });
      if (res.status === 202 || res.ok) {
        alert("Robot CAD synchronization initiated successfully in the background. The model will update in a few moments.");
      } else {
        const data = await res.json();
        alert("Failed to sync Robot CAD: " + (data.error || "Unknown error"));
      }
    } catch (err: any) {
      console.error("Failed to sync Robot CAD:", err);
      alert("Failed to sync Robot CAD: " + (err?.message || "Network connection or parsing error."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-6 border border-white/10 bg-black/60 shadow-2xl flex flex-col justify-between space-y-4">
      {/* Header */}
      <div>
        <div className="border-b border-white/5 pb-3 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase text-white tracking-widest font-heading flex items-center gap-2">
            <Link size={14} className="text-ares-gold animate-pulse" /> Onshape Robot CAD Sync
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
            placeholder="Paste Onshape URL or Document ID..."
            value={robotDocId}
            onChange={(e) => {
              const val = e.target.value;
              const parsed = parseOnshapeUrl(val);
              if (parsed) {
                setRobotDocId(parsed.documentId);
                setRobotWkId(parsed.workspaceId);
                setRobotElId(parsed.elementId);
              } else {
                setRobotDocId(val);
              }
            }}
            className="w-full bg-black/50 border border-white/5 focus:border-ares-cyan focus:ring-1 focus:ring-ares-cyan/25 rounded-xl px-3 py-2 text-xs text-white placeholder-marble/30 font-medium font-mono focus:outline-none"
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
              className="w-full bg-black/50 border border-white/5 focus:border-ares-cyan focus:ring-1 focus:ring-ares-cyan/25 rounded-xl px-3 py-2 text-xs text-white placeholder-marble/30 font-medium font-mono focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[9px] font-black uppercase text-marble/45 tracking-widest block mb-1">Element ID</label>
            <input
              type="text"
              placeholder="e.g. e_chassis..."
              value={robotElId}
              onChange={(e) => setRobotElId(e.target.value)}
              className="w-full bg-black/50 border border-white/5 focus:border-ares-cyan focus:ring-1 focus:ring-ares-cyan/25 rounded-xl px-3 py-2 text-xs text-white placeholder-marble/30 font-medium font-mono focus:outline-none"
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

        {robotSyncMeta && (
          <div className="bg-black/30 border border-white/5 p-3 rounded-xl space-y-1.5 text-[9px] font-mono text-marble/70">
            <div className="flex justify-between">
              <span>File size:</span>
              <span className="text-white font-bold">{robotSyncMeta.fileSizeMb.toFixed(2)} MB</span>
            </div>
            <div className="flex justify-between">
              <span>Compiler:</span>
              <span className="text-ares-gold font-bold">{robotSyncMeta.engineUsed.split(" ")[0]}</span>
            </div>
            <div className="flex justify-between">
              <span>Mate bindings:</span>
              <span className="text-white font-bold">{robotSyncMeta.mateBindings?.length} active Mates</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
