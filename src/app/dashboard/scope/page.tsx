"use client";

import React, { useEffect, useState, useRef } from "react";
import { authenticatedFetch } from "@/lib/api";
import { useScopeStore, TelemetryData } from "./store/scopeStore";
import SyncRobotLogsModal from "./components/SyncRobotLogsModal";
import { db, getDocWithTimeout, getDocsWithTimeout } from "@/lib/firebase";
import { doc, collection, query, orderBy } from "firebase/firestore";
import { 
  RefreshCw, 
  Play, 
  Pause, 
  ChevronDown, 
  ChevronRight 
} from "lucide-react";
import { useSearchParams } from "react-router-dom";

// Custom Hooks
import { useNT4Client } from "./hooks/useNT4Client";
import { 
  useScopeLayout, 
  LayoutItem, 
  ChartConfig, 
  DashboardPreset,
  migrateLayoutCoordinates 
} from "./hooks/useScopeLayout";
import { useAutoLogSync } from "@/hooks/scope/useAutoLogSync";

export { migrateLayoutCoordinates };
export type { LayoutItem, ChartConfig, DashboardPreset };

// Subcomponents
import ScopeHeader from "./components/ScopeHeader";
import LocalSimulatorPanel from "./components/LocalSimulatorPanel";
import LiveStreamModal from "./components/LiveStreamModal";
import SavePresetModal from "./components/SavePresetModal";
import TimelineDeck from "./components/TimelineDeck";

// Decomposed Modular Components
import PresetManager from "./components/PresetManager";
import WorkspaceGrid from "./components/WorkspaceGrid";
import TelemetryLogParser, { useTelemetryParser } from "./components/TelemetryLogParser";

// Standard components needed for AdvantageScope-style desktop tabs
import WebGLReplayCanvas from "./components/WebGLReplayCanvas";
import TelemetryCharts from "./components/TelemetryCharts";
import VariablesTuner from "./components/VariablesTuner";
import ConsoleLogsWidget from "./components/ConsoleLogsWidget";

// Tree structures for AdvantageScope variables tree view
interface TreeNode {
  name: string;
  fullPath?: string;
  children?: TreeNode[];
}

function buildVariableTree(channels: Record<string, any>): TreeNode[] {
  const root: TreeNode[] = [];

  Object.keys(channels).forEach((path) => {
    const parts = path.split("/");
    let currentLevel = root;

    parts.forEach((part, index) => {
      const isLeaf = index === parts.length - 1;
      let existingNode = currentLevel.find((node) => node.name === part);

      if (!existingNode) {
        existingNode = {
          name: part,
          ...(isLeaf ? { fullPath: path } : { children: [] }),
        };
        currentLevel.push(existingNode);
      }

      if (!isLeaf && existingNode.children) {
        currentLevel = existingNode.children;
      }
    });
  });

  // Sort nodes alphabetically
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach(node => {
      if (node.children) {
        sortNodes(node.children);
      }
    });
  };
  sortNodes(root);

  return root;
}

const VariableTreeItem = ({ 
  node, 
  selectedKeys, 
  onToggle, 
  currentFrameValues 
}: { 
  node: TreeNode; 
  selectedKeys: string[]; 
  onToggle: (key: string) => void;
  currentFrameValues: Record<string, any>;
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const isLeaf = !node.children;
  const isSelected = node.fullPath ? selectedKeys.includes(node.fullPath) : false;

  if (isLeaf) {
    let rawVal = node.fullPath && currentFrameValues[node.fullPath];
    let val = "N/A";
    if (rawVal !== undefined && rawVal !== null) {
      if (typeof rawVal === "number") {
        val = rawVal.toFixed(2);
      } else if (typeof rawVal === "boolean") {
        val = rawVal ? "TRUE" : "FALSE";
      } else {
        val = String(rawVal);
      }
    }
      
    return (
      <div 
        onClick={() => node.fullPath && onToggle(node.fullPath)}
        className={`flex items-center justify-between py-1 px-2 text-xs font-mono rounded cursor-pointer select-none transition-colors ${
          isSelected 
            ? "bg-ares-red/20 text-white border-l-2 border-ares-red" 
            : "text-marble/70 hover:bg-white/5 hover:text-white"
        }`}
      >
        <span className="truncate pr-2 text-left" title={node.fullPath}>{node.name}</span>
        <span className="text-[10px] font-bold text-ares-gold/90 bg-black/45 px-1.5 py-0.5 rounded border border-white/5 font-mono shrink-0">
          {val}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 py-1 px-2 text-xs font-bold uppercase tracking-wider text-marble/95 hover:bg-white/5 rounded cursor-pointer select-none"
      >
        {isOpen ? <ChevronDown size={12} className="text-marble/40 shrink-0" /> : <ChevronRight size={12} className="text-marble/40 shrink-0" />}
        <span className="font-heading truncate text-white/80">{node.name}</span>
      </div>
      
      {isOpen && (
        <div className="pl-3.5 border-l border-white/5 ml-3.5 space-y-0.5">
          {node.children?.map((child) => (
            <VariableTreeItem 
              key={child.name} 
              node={child} 
              selectedKeys={selectedKeys} 
              onToggle={onToggle}
              currentFrameValues={currentFrameValues}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function ScopeDashboard() {
  const { 
    isPlaying, 
    currentTimeMs, 
    playbackSpeed, 
    telemetryData, 
    comparisonTelemetryData,
    consoleLogs,
    isStreaming,
    connectionStatus,
    setPlaying, 
    setCurrentTimeMs, 
    setPlaybackSpeed, 
    setTelemetryData,
    setComparisonTelemetryData,
    setConsoleLogs,
    setPlannedPath,
    setFieldObstacles,
    setFieldElements,
    setFieldElementTypes,
    setFieldCadUrl,
    setFieldBgImageUrl,
    selectedKeys,
    toggleSelectedKey,
    getCurrentFrame
  } = useScopeStore();

  // Custom Hooks
  const {
    ipAddress,
    setIpAddress,
    showLiveModal,
    setShowLiveModal,
    directConnect,
    setDirectConnect,
    handleConnectLive,
    handleDisconnectLive,
    handlePublishValue
  } = useNT4Client();

  const autoSyncState = useAutoLogSync(ipAddress);

  const {
    isEditMode,
    setIsEditMode,
    gridContainerRef,
    dashboardLayout,
    setDashboardLayout,
    chartConfigs,
    setChartConfigs,
    tuningConstants,
    setTuningConstants,
    cloudPresets,
    activePresetId,
    setActivePresetId,
    showSavePresetModal,
    setShowSavePresetModal,
    newPresetName,
    setNewPresetName,
    isSharedToggle,
    setIsSharedToggle,
    savingPreset,
    isMobile,
    editingCardId,
    setEditingCardId,
    editingTitleText,
    setEditingTitleText,
    handleAddWidget,
    handleDuplicateChart,
    handleDeleteWidget,
    handleAddToGroup,
    handleRemoveFromGroup,
    handleStartRename,
    handleSaveRename,
    handleExportLayout,
    handleImportLayout,
    handleResetLayout,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleSavePreset,
    handleLoadPreset,
    handleDeletePresetFromCloud,
    handleToggleFullscreen
  } = useScopeLayout();

  const [selectedRunId, setSelectedRunId] = useState("");
  const [runs, setRuns] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [visionEvents, setVisionEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"charts" | "field" | "console" | "tuner" | "grid">("charts");

  // Load telemetry runs index on mount
  useEffect(() => {
    const fetchRuns = async () => {
      try {
        const q = query(collection(db, "telemetry_runs"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocsWithTimeout(q, 3000);
        const list: any[] = [];
        querySnapshot.forEach((docSnap: any) => {
          list.push({ runId: docSnap.id, ...docSnap.data() });
        });
        setRuns(list);
        if (list.length > 0) {
          setSelectedRunId(list[0].runId);
        } else {
          setSelectedRunId("");
        }
      } catch (err) {
        console.warn("Failed to fetch runs list, using mock defaults", err);
      }
    };
    fetchRuns();
  }, []);

  // Fetch actions and vision events when selectedRunId changes
  useEffect(() => {
    if (!selectedRunId) return;
    const fetchExtraData = async () => {
      try {
        const actRes = await authenticatedFetch(`/api/replay/${selectedRunId}/actions`);
        if (actRes.ok) {
          const actData = await actRes.json();
          setActions(actData);
        } else {
          setActions([]);
        }

        const visRes = await authenticatedFetch(`/api/replay/${selectedRunId}/vision`);
        if (visRes.ok) {
          const visData = await visRes.json();
          setVisionEvents(visData);
        } else {
          setVisionEvents([]);
        }
      } catch (err) {
        console.error("Failed to fetch replay details:", err);
        setActions([]);
        setVisionEvents([]);
      }
    };
    fetchExtraData();
  }, [selectedRunId]);

  const {
    parseCSVText,
    parseLocalLogFile,
    parseConsoleLogFile,
    parseComparisonLogFile,
    parseLocalPathFile,
    generatePlannedPathFromWaypoints
  } = useTelemetryParser(setLoading, handleDisconnectLive);

  // Robot Log Sync States
  const [showSyncModal, setShowSyncModal] = useState(false);
  
  // Video Sync States
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Local Simulator Launcher States
  const [showSimDrawer, setShowSimDrawer] = useState(false);
  const [simState, setSimState] = useState<'idle' | 'building' | 'running'>('idle');

  // Field Obstacle Configuration States
  const [fieldConfigs, setFieldConfigs] = useState<{ id: string; name: string; obstacles: any[]; elements?: any[]; elementTypes?: any[]; cadUrl?: string; bgImageUrl?: string }[]>([]);
  const [selectedFieldConfigId, setSelectedFieldConfigId] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Listen to url param ?sim=true to open drawer
  useEffect(() => {
    if (searchParams.get("sim") === "true") {
      setShowSimDrawer(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchFieldConfigs = async () => {
      try {
        const q = query(collection(db, "field_configs"), orderBy("updatedAt", "desc"));
        const querySnapshot = await getDocsWithTimeout(q);
        const configs: any[] = [];
        querySnapshot.forEach((docSnap: any) => {
          configs.push({ id: docSnap.id, ...docSnap.data() });
        });
        setFieldConfigs(configs);
        
        // Auto-select the first one if available
        if (configs.length > 0) {
          setSelectedFieldConfigId(configs[0].id);
          setFieldObstacles(configs[0].obstacles || []);
          setFieldElements(configs[0].elements || []);
          setFieldElementTypes(configs[0].elementTypes || []);
          setFieldCadUrl(configs[0].cadUrl || null);
          setFieldBgImageUrl(configs[0].bgImageUrl || null);
        } else {
          setFieldObstacles(null);
          setFieldElements(null);
          setFieldElementTypes(null);
          setFieldCadUrl(null);
          setFieldBgImageUrl(null);
        }
      } catch (err) {
        console.error("Failed to fetch field configurations:", err);
      }
    };
    fetchFieldConfigs();
  }, [setFieldObstacles, setFieldElements, setFieldElementTypes, setFieldCadUrl, setFieldBgImageUrl]);

  const handleFieldConfigChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const configId = e.target.value;
    setSelectedFieldConfigId(configId);
    if (!configId) {
      setFieldObstacles(null);
      setFieldElements(null);
      setFieldElementTypes(null);
      setFieldCadUrl(null);
      setFieldBgImageUrl(null);
      return;
    }
    const config = fieldConfigs.find((c) => c.id === configId);
    if (config) {
      setFieldObstacles(config.obstacles || []);
      setFieldElements(config.elements || []);
      setFieldElementTypes(config.elementTypes || []);
      setFieldCadUrl(config.cadUrl || null);
      setFieldBgImageUrl(config.bgImageUrl || null);
    } else {
      setFieldObstacles(null);
      setFieldElements(null);
      setFieldElementTypes(null);
      setFieldCadUrl(null);
      setFieldBgImageUrl(null);
    }
  };

  // Fetch telemetry log (BigQuery / Local Fallback)
  const fetchTelemetryRun = async (runId: string) => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(`/api/analytics/telemetry-log?runId=${runId}`);
      const data = await res.json();
      if (data && data.timestamps) {
        setTelemetryData(data as TelemetryData);
      }
    } catch (err) {
      console.error("Failed to fetch telemetry run:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("logId")) {
        return; // Skip loading default telemetry if loading from URL parameter
      }
    }
    if (!isStreaming) {
      fetchTelemetryRun(selectedRunId);
    }
  }, [selectedRunId, isStreaming]);

  // File change event wrappers
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseLocalLogFile(e.target.files[0]);
    }
  };

  const handleComparisonInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseComparisonLogFile(e.target.files[0]);
    }
  };

  const handleConsoleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseConsoleLogFile(e.target.files[0]);
    }
  };

  const handlePathInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseLocalPathFile(e.target.files[0]);
    }
  };

  // High-performance 60 FPS animation/playback loop
  useEffect(() => {
    if (!isPlaying || !telemetryData || isStreaming) return;

    let lastTime = performance.now();
    let animationFrameId: number;

    const loop = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;

      // Advance playhead proportional to elapsed real-world time and playback speed
      const state = useScopeStore.getState();
      state.setCurrentTimeMs(state.currentTimeMs + delta * state.playbackSpeed);
      
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, telemetryData, isStreaming]);

  // Sync video playback speed to master playbackSpeed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, videoUrl]);

  // Sync play/pause states of video to master isPlaying
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying, videoUrl]);

  // Sync video current time to master currentTimeMs
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const timeSec = currentTimeMs / 1000;
    // Only update if difference is > 0.15 seconds to avoid sync fighting / jitter
    if (Math.abs(video.currentTime - timeSec) > 0.15) {
      video.currentTime = timeSec;
    }
  }, [currentTimeMs, videoUrl]);

  const isTauri = typeof window !== "undefined" && ("__TAURI__" in window || "__TAURI_INTERNALS__" in window || "__TAURI_IPC__" in window);

  const currentFrame = getCurrentFrame();
  const currentFrameValues = currentFrame?.values || {};
  const variableTree = telemetryData ? buildVariableTree(telemetryData.channels) : [];

  const formatTime = (ms: number) => {
    const totalSecs = ms / 1000;
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toFixed(2).padStart(5, "0")}`;
  };

  if (isTauri) {
    return (
      <div className="w-screen h-screen bg-[#09090b] text-marble flex flex-col overflow-hidden select-none fixed inset-0 z-50">
        {/* Header Toolbar */}
        <div className="w-full h-12 bg-[#0c0c0f] border-b border-white/5 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-black tracking-tighter text-white font-heading">
              ARES <span className="bg-ares-red text-white px-1.5 py-0.5 ares-cut-sm font-bold text-xs ml-1">SCOPE</span>
            </span>
            <span className="text-[8px] bg-ares-gold/15 text-ares-gold border border-ares-gold/25 px-1.5 py-0.5 rounded uppercase font-bold font-mono tracking-wider">
              Desktop Mode
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSimDrawer(true)}
              className="px-4 py-1.5 bg-ares-red hover:bg-ares-red/80 text-white text-[10px] font-black uppercase tracking-wider rounded ares-cut-sm cursor-pointer transition-colors shadow-lg shadow-ares-red/10"
            >
              🛠️ Simulator & Dependency Panel
            </button>
          </div>
        </div>

        {/* Main Workspace Body */}
        <div className="flex-1 flex min-h-0 w-full">
          
          {/* Left Sidebar */}
          <div className="w-80 border-r border-white/5 bg-[#0b0b0d] flex flex-col shrink-0 p-4 gap-4 overflow-y-auto">
            {/* Connection/Source Box */}
            <div className="bg-black/35 border border-white/5 p-4 rounded-xl space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black text-ares-gold font-heading">
                  Telemetry Channel
                </span>
                <span className={`w-2 h-2 rounded-full ${
                  connectionStatus === "connected" ? "bg-ares-success animate-pulse" : 
                  connectionStatus === "connecting" ? "bg-ares-gold animate-bounce" : "bg-ares-danger"
                }`} />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] uppercase font-bold text-marble/40">
                  NetworkTables Server IP
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    className="flex-1 bg-black/60 border border-white/10 rounded px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-ares-red"
                    placeholder="192.168.43.1"
                  />
                  {connectionStatus === "connected" ? (
                    <button
                      onClick={handleDisconnectLive}
                      className="bg-ares-red hover:bg-ares-red/80 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded ares-cut-sm cursor-pointer transition-colors"
                    >
                      Stop
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnectLive(ipAddress)}
                      className="bg-ares-gold hover:bg-ares-gold/80 text-black text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded ares-cut-sm cursor-pointer transition-colors font-extrabold"
                    >
                      Live
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex flex-col gap-2">
                <label className="text-[9px] uppercase font-bold text-marble/40">
                  Log Operations
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-center text-[10px] font-bold uppercase tracking-wider py-1.5 rounded cursor-pointer transition-colors">
                    📁 Load File
                    <input
                      type="file"
                      accept=".csv,.json"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={() => setShowSyncModal(true)}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-bold uppercase tracking-wider py-1.5 rounded cursor-pointer transition-colors"
                  >
                    🔄 Sync Hub
                  </button>
                </div>
              </div>
            </div>

            {/* Collapsible Variables Tree (AdvantageScope Tree View) */}
            <div className="flex-1 flex flex-col min-h-0 bg-black/20 border border-white/5 rounded-xl p-3">
              <span className="text-[10px] uppercase font-black text-marble/40 tracking-wider mb-2 font-heading">
                Variables Tree
              </span>
              <div className="flex-grow overflow-y-auto space-y-1.5 pr-1">
                {variableTree.length === 0 ? (
                  <div className="text-[10px] text-marble/30 italic p-2 text-left">
                    No active telemetry channels. Connect live or load a log file.
                  </div>
                ) : (
                  variableTree.map((node) => (
                    <VariableTreeItem
                      key={node.name}
                      node={node}
                      selectedKeys={selectedKeys}
                      onToggle={toggleSelectedKey}
                      currentFrameValues={currentFrameValues}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Main Canvas (AdvantageScope Multi-tab area) */}
          <div className="flex-1 bg-[#09090b] flex flex-col min-w-0 p-4 pb-0">
            {/* Tab Selector row */}
            <div className="flex items-center gap-1.5 bg-[#0f0f12] border border-white/5 p-1 rounded-xl w-fit mb-4 shrink-0">
              {(
                [
                  { id: "charts", label: "📈 Charts" },
                  { id: "field", label: "🤖 3D Field" },
                  { id: "console", label: "📋 Console" },
                  { id: "tuner", label: "🎛️ Tuner" },
                  { id: "grid", label: "💻 Workspace Grid" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                    activeTab === tab.id
                      ? "bg-ares-red text-white font-extrabold shadow-lg shadow-ares-red/10"
                      : "text-marble/45 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Active Tab Viewport */}
            <div className="flex-1 min-h-0 relative">
              {activeTab === "charts" && (
                <div className="bg-[#0b0b0d] rounded-xl border border-white/5 p-6 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4 shrink-0">
                    <h3 className="text-xs font-black uppercase text-white font-heading">
                      Telemetry Channel Charts
                    </h3>
                    <p className="text-[9px] uppercase font-bold text-marble/45">
                      Select variables in the tree to graph
                    </p>
                  </div>
                  <div className="flex-grow min-h-0 relative">
                    <TelemetryCharts />
                  </div>
                </div>
              )}

              {activeTab === "field" && (
                <div className="bg-[#0b0b0d] rounded-xl border border-white/5 overflow-hidden h-full flex flex-col">
                  <div className="flex items-center justify-between p-4 bg-black/35 border-b border-white/5 select-none text-[10px] uppercase font-bold text-marble/60 shrink-0">
                    <span className="font-heading text-white font-bold">
                      3D Field Visualization
                    </span>
                    <span className="text-[9px] text-ares-gold bg-ares-gold/10 px-1.5 py-0.5 rounded border border-ares-gold/20">
                      WebGL Active
                    </span>
                  </div>
                  <div className="flex-grow min-h-0 relative">
                    <WebGLReplayCanvas />
                  </div>
                </div>
              )}

              {activeTab === "console" && (
                <div className="bg-[#0b0b0d] rounded-xl border border-white/5 p-6 h-full overflow-y-auto">
                  <ConsoleLogsWidget />
                </div>
              )}

              {activeTab === "tuner" && (
                <div className="bg-[#0b0b0d] rounded-xl border border-white/5 p-6 h-full overflow-y-auto">
                  <VariablesTuner
                    isStreaming={isStreaming}
                    onPublishValue={handlePublishValue}
                    savedConstants={tuningConstants}
                    onConstantsChange={setTuningConstants}
                  />
                </div>
              )}

              {activeTab === "grid" && (
                <div className="h-full overflow-y-auto pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <PresetManager
                      activePresetId={activePresetId}
                      cloudPresets={cloudPresets}
                      isEditMode={isEditMode}
                      handleResetLayout={handleResetLayout}
                      handleLoadPreset={handleLoadPreset}
                      handleDeletePresetFromCloud={handleDeletePresetFromCloud}
                      handleAddWidget={handleAddWidget}
                      handleExportLayout={handleExportLayout}
                      handleImportLayout={handleImportLayout}
                      setShowSavePresetModal={setShowSavePresetModal}
                      setIsEditMode={setIsEditMode}
                    />
                  </div>
                  <WorkspaceGrid
                    dashboardLayout={dashboardLayout}
                    isEditMode={isEditMode}
                    isMobile={isMobile}
                    gridContainerRef={gridContainerRef}
                    editingCardId={editingCardId}
                    editingTitleText={editingTitleText}
                    chartConfigs={chartConfigs}
                    tuningConstants={tuningConstants}
                    videoUrl={videoUrl}
                    isStreaming={isStreaming}
                    consoleLogs={consoleLogs}
                    videoRef={videoRef}
                    setVideoUrl={setVideoUrl}
                    setEditingTitleText={setEditingTitleText}
                    setEditingCardId={setEditingCardId}
                    setDashboardLayout={setDashboardLayout}
                    setChartConfigs={setChartConfigs}
                    setTuningConstants={setTuningConstants}
                    handlePointerDown={handlePointerDown}
                    handlePointerMove={handlePointerMove}
                    handlePointerUp={handlePointerUp}
                    handleToggleFullscreen={handleToggleFullscreen}
                    handleSaveRename={handleSaveRename}
                    handleStartRename={handleStartRename}
                    handleDuplicateChart={handleDuplicateChart}
                    handleDeleteWidget={handleDeleteWidget}
                    handleRemoveFromGroup={handleRemoveFromGroup}
                    handleAddToGroup={handleAddToGroup}
                    handlePublishValue={handlePublishValue}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Playback Control Bar */}
        <div className="w-full bg-[#0c0c0f] border-t border-white/5 flex flex-col shrink-0">
          {/* Interactive Scrubber line */}
          <div className="w-full px-6 pt-2">
            <input
              type="range"
              min="0"
              max={telemetryData?.maxTimeMs || 100}
              value={currentTimeMs}
              onChange={(e) => setCurrentTimeMs(parseInt(e.target.value))}
              className="w-full accent-ares-red bg-white/5 h-1 hover:h-2 rounded-lg appearance-none cursor-pointer outline-none transition-all duration-150"
            />
          </div>
          
          {/* Playback Buttons & Timestamp */}
          <div className="flex items-center justify-between px-6 py-2 pb-3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setPlaying(!isPlaying)}
                className="w-7 h-7 rounded-full bg-ares-red hover:bg-ares-red/80 text-white flex items-center justify-center cursor-pointer transition-all duration-150 shadow-md transform active:scale-95 shrink-0"
              >
                {isPlaying ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
              </button>

              <div className="flex items-center bg-black/35 border border-white/5 p-0.5 rounded-lg gap-0.5">
                {([0.25, 0.5, 1.0, 1.5, 2.0] as const).map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all duration-150 cursor-pointer ${
                      playbackSpeed === speed
                        ? "bg-white text-black font-extrabold"
                        : "text-marble/45 hover:text-white"
                    }`}
                  >
                    {speed.toFixed(2)}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4 text-right">
              <span className="text-[9px] uppercase font-bold text-marble/35">
                Active OpMode: <span className="text-white">{telemetryData?.opModeName || "Live NT Connection"}</span>
              </span>
              <span className="text-xs text-white font-mono font-bold">
                {formatTime(currentTimeMs)} / <span className="text-marble/35">{formatTime(telemetryData?.maxTimeMs || 0)}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Modal windows */}
        <LiveStreamModal
          isOpen={showLiveModal}
          onClose={() => setShowLiveModal(false)}
          ipAddress={ipAddress}
          setIpAddress={setIpAddress}
          handleConnectLive={handleConnectLive}
          directConnect={directConnect}
          setDirectConnect={setDirectConnect}
        />

        <SyncRobotLogsModal
          isOpen={showSyncModal}
          onClose={() => setShowSyncModal(false)}
          ipAddress={ipAddress}
          setIpAddress={setIpAddress}
        />

        <SavePresetModal
          isOpen={showSavePresetModal}
          onClose={() => setShowSavePresetModal(false)}
          newPresetName={newPresetName}
          setNewPresetName={setNewPresetName}
          isSharedToggle={isSharedToggle}
          setIsSharedToggle={setIsSharedToggle}
          savingPreset={savingPreset}
          handleSavePreset={handleSavePreset}
        />

        <LocalSimulatorPanel
          isOpen={showSimDrawer}
          onClose={() => setShowSimDrawer(false)}
          selectedFieldConfigId={selectedFieldConfigId}
          handleFieldConfigChange={handleFieldConfigChange}
          fieldConfigs={fieldConfigs}
          simState={simState}
          setSimState={setSimState}
          handleConnectLive={handleConnectLive}
          ipAddress={ipAddress}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      
      {/* Header Deck */}
      <ScopeHeader
        isStreaming={isStreaming}
        connectionStatus={connectionStatus}
        simState={simState}
        fieldConfigs={fieldConfigs}
        selectedFieldConfigId={selectedFieldConfigId}
        handleFieldConfigChange={handleFieldConfigChange}
        selectedRunId={selectedRunId}
        setSelectedRunId={setSelectedRunId}
        setShowLiveModal={setShowLiveModal}
        setShowSimDrawer={setShowSimDrawer}
        setShowSyncModal={setShowSyncModal}
        handleDisconnectLive={handleDisconnectLive}
        comparisonTelemetryData={comparisonTelemetryData}
        setComparisonTelemetryData={setComparisonTelemetryData}
        consoleLogs={consoleLogs}
        setConsoleLogs={setConsoleLogs}
        setVideoUrl={setVideoUrl}
        runs={runs}
        handleFileInput={handleFileInput}
        handleComparisonInput={handleComparisonInput}
        handleConsoleInput={handleConsoleInput}
        handlePathInput={handlePathInput}
        ipAddress={ipAddress}
        autoSyncState={autoSyncState}
      />

      {/* Loading overlay spinner */}
      {loading && (
        <div className="glass-card border border-white/10 bg-black/45 p-8 rounded-2xl flex flex-col items-center justify-center gap-4 py-16 animate-pulse">
          <RefreshCw size={32} className="text-ares-gold animate-spin" />
          <p className="text-xs font-black uppercase text-marble/55 tracking-widest font-heading">
            Syncing Telemetry Channels...
          </p>
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          <PresetManager
            activePresetId={activePresetId}
            cloudPresets={cloudPresets}
            isEditMode={isEditMode}
            handleResetLayout={handleResetLayout}
            handleLoadPreset={handleLoadPreset}
            handleDeletePresetFromCloud={handleDeletePresetFromCloud}
            handleAddWidget={handleAddWidget}
            handleExportLayout={handleExportLayout}
            handleImportLayout={handleImportLayout}
            setShowSavePresetModal={setShowSavePresetModal}
            setIsEditMode={setIsEditMode}
          />

          <WorkspaceGrid
            dashboardLayout={dashboardLayout}
            isEditMode={isEditMode}
            isMobile={isMobile}
            gridContainerRef={gridContainerRef}
            editingCardId={editingCardId}
            editingTitleText={editingTitleText}
            chartConfigs={chartConfigs}
            tuningConstants={tuningConstants}
            videoUrl={videoUrl}
            isStreaming={isStreaming}
            consoleLogs={consoleLogs}
            videoRef={videoRef}
            setVideoUrl={setVideoUrl}
            setEditingTitleText={setEditingTitleText}
            setEditingCardId={setEditingCardId}
            setDashboardLayout={setDashboardLayout}
            setChartConfigs={setChartConfigs}
            setTuningConstants={setTuningConstants}
            handlePointerDown={handlePointerDown}
            handlePointerMove={handlePointerMove}
            handlePointerUp={handlePointerUp}
            handleToggleFullscreen={handleToggleFullscreen}
            handleSaveRename={handleSaveRename}
            handleStartRename={handleStartRename}
            handleDuplicateChart={handleDuplicateChart}
            handleDeleteWidget={handleDeleteWidget}
            handleRemoveFromGroup={handleRemoveFromGroup}
            handleAddToGroup={handleAddToGroup}
            handlePublishValue={handlePublishValue}
          />

          <TimelineDeck actions={actions} visionEvents={visionEvents} />

          <TelemetryLogParser
            onFileDropped={parseLocalLogFile}
          />
        </div>
      )}

      {/* Live Stream connection Modal */}
      <LiveStreamModal
        isOpen={showLiveModal}
        onClose={() => setShowLiveModal(false)}
        ipAddress={ipAddress}
        setIpAddress={setIpAddress}
        handleConnectLive={handleConnectLive}
        directConnect={directConnect}
        setDirectConnect={setDirectConnect}
      />

      <SyncRobotLogsModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        ipAddress={ipAddress}
        setIpAddress={setIpAddress}
      />

      {/* Save presets cloud Modal */}
      <SavePresetModal
        isOpen={showSavePresetModal}
        onClose={() => setShowSavePresetModal(false)}
        newPresetName={newPresetName}
        setNewPresetName={setNewPresetName}
        isSharedToggle={isSharedToggle}
        setIsSharedToggle={setIsSharedToggle}
        savingPreset={savingPreset}
        handleSavePreset={handleSavePreset}
      />

      {/* Local Simulator drawer Controls */}
      <LocalSimulatorPanel
        isOpen={showSimDrawer}
        onClose={() => setShowSimDrawer(false)}
        selectedFieldConfigId={selectedFieldConfigId}
        handleFieldConfigChange={handleFieldConfigChange}
        fieldConfigs={fieldConfigs}
        simState={simState}
        setSimState={setSimState}
        handleConnectLive={handleConnectLive}
        ipAddress={ipAddress}
      />

    </div>
  );
}
