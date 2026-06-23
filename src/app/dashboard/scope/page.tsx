"use client";

import React, { useEffect, useState, useRef } from "react";
import { authenticatedFetch } from "@/lib/api";
import { useScopeStore, TelemetryData } from "./store/scopeStore";
import SyncRobotLogsModal from "./components/SyncRobotLogsModal";
import { db, getDocWithTimeout, getDocsWithTimeout } from "@/lib/firebase";
import { doc, collection, query, orderBy } from "firebase/firestore";
import { RefreshCw } from "lucide-react";
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
    setFieldBgImageUrl
  } = useScopeStore();

  // Custom Hooks
  const {
    ipAddress,
    setIpAddress,
    showLiveModal,
    setShowLiveModal,
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
      />

    </div>
  );
}
