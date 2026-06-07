"use client";

import React, { useEffect, useState, useRef } from "react";
import { authenticatedFetch } from "@/lib/api";
import { useScopeStore, TelemetryData } from "./store/scopeStore";
import { NT4Client } from "./store/nt4Client";
import { useFocusTrap } from "@/lib/useFocusTrap";
import WebGLReplayCanvas from "./components/WebGLReplayCanvas";
import TelemetryCharts from "./components/TelemetryCharts";
import StateInspector from "./components/StateInspector";
import HealthDiagnostics from "./components/HealthDiagnostics";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, query, orderBy, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { 
  Play, 
  Pause, 
  FastForward, 
  FolderOpen, 
  Activity, 
  Database,
  Sparkles,
  RefreshCw,
  Cpu,
  Compass,
  Wifi,
  WifiOff,
  X,
  Eye,
  Sliders,
  Terminal,
  Square,
  Copy,
  Check,
  Plus,
  Trash2,
  Maximize2,
  Edit3,
  Layout,
  Save,
  Download,
  Upload,
  RotateCcw
} from "lucide-react";
import { useSearchParams } from "react-router-dom";

export interface ChartConfig {
  id: string;
  selectedKeys: string[];
}

export interface LayoutItem {
  id: string;
  type: "visualizer" | "inspector" | "diagnostics" | "logs" | "charts";
  title: string;
  visible: boolean;
  colSpan: number;
  height: "short" | "medium" | "tall";
  order: number;
}

export interface DashboardPreset {
  id: string;
  name: string;
  isShared: boolean;
  createdBy?: string;
  creatorName?: string;
  layout: LayoutItem[];
  chartConfigs: ChartConfig[];
  updatedAt: any;
}

const DEFAULT_LAYOUT: LayoutItem[] = [
  { id: "visualizer", type: "visualizer", title: "3D Field Visualizer", visible: true, colSpan: 1, height: "tall", order: 1 },
  { id: "diagnostics", type: "diagnostics", title: "Health & Diagnostics", visible: true, colSpan: 2, height: "tall", order: 2 },
  { id: "charts-1", type: "charts", title: "Telemetry Chart", visible: true, colSpan: 2, height: "medium", order: 3 },
  { id: "inspector", type: "inspector", title: "State Inspector", visible: true, colSpan: 1, height: "medium", order: 4 },
  { id: "logs", type: "logs", title: "System Console Logs", visible: true, colSpan: 2, height: "medium", order: 5 },
];

const DEFAULT_CHART_CONFIGS: ChartConfig[] = [
  { id: "charts-1", selectedKeys: ["Robot/BatteryVoltage", "Robot/LoopTime"] }
];

export default function ScopeDashboard() {
  const { 
    isPlaying, 
    currentTimeMs, 
    playbackSpeed, 
    telemetryData, 
    comparisonTelemetryData,
    consoleLogs,
    isStreaming,
    streamSource,
    connectionStatus,
    setPlaying, 
    setCurrentTimeMs, 
    setPlaybackSpeed, 
    setTelemetryData,
    setComparisonTelemetryData,
    setConsoleLogs,
    setPlannedPath,
    setStreaming,
    setStreamSource,
    setConnectionStatus,
    addLiveFrame,
    setFieldObstacles,
    setFieldElements,
    setFieldElementTypes,
    setFieldCadUrl
  } = useScopeStore();

  const [selectedRunId, setSelectedRunId] = useState("run_2026_championship_finals");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [ipAddress, setIpAddress] = useState("192.168.43.1");
  const [showLiveModal, setShowLiveModal] = useState(false);
  const liveModalRef = useFocusTrap(showLiveModal, () => setShowLiveModal(false));
  const [searchParams] = useSearchParams();
  
  // Video Sync States
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Local Simulator Launcher States
  const [showSimDrawer, setShowSimDrawer] = useState(false);
  const simDrawerRef = useFocusTrap(showSimDrawer, () => setShowSimDrawer(false));
  const [daemonUrl, setDaemonUrl] = useState("ws://localhost:8080");
  const [daemonStatus, setDaemonStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [simState, setSimState] = useState<'idle' | 'building' | 'running'>('idle');
  const [daemonLogs, setDaemonLogs] = useState<string[]>([]);
  const [simAutoScrollLogs, setSimAutoScrollLogs] = useState(true);
  const [osTab, setOsTab] = useState<'windows' | 'mac' | 'linux'>('windows');
  const [copied, setCopied] = useState(false);
  
  // EKF config overrides states
  const [visionStdDevX, setVisionStdDevX] = useState(0.05);
  const [visionStdDevY, setVisionStdDevY] = useState(0.05);
  const [visionStdDevTheta, setVisionStdDevTheta] = useState(0.1);

  // Field Obstacle Configuration States
  const [fieldConfigs, setFieldConfigs] = useState<{ id: string; name: string; obstacles: any[]; elements?: any[]; elementTypes?: any[]; cadUrl?: string }[]>([]);
  const [selectedFieldConfigId, setSelectedFieldConfigId] = useState<string>("");

  // authentication
  const { user } = useAuth();

  // layout customization state
  const [isEditMode, setIsEditMode] = useState(false);
  const [dashboardLayout, setDashboardLayout] = useState<LayoutItem[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ares_scope_layout");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.error("Failed to parse stored layout:", e);
        }
      }
    }
    return DEFAULT_LAYOUT;
  });

  const [chartConfigs, setChartConfigs] = useState<ChartConfig[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ares_scope_chart_configs");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.error("Failed to parse stored chart configs:", e);
        }
      }
    }
    return DEFAULT_CHART_CONFIGS;
  });

  // persisting layout changes
  useEffect(() => {
    localStorage.setItem("ares_scope_layout", JSON.stringify(dashboardLayout));
  }, [dashboardLayout]);

  useEffect(() => {
    localStorage.setItem("ares_scope_chart_configs", JSON.stringify(chartConfigs));
  }, [chartConfigs]);

  // presets and cloud variables
  const [cloudPresets, setCloudPresets] = useState<DashboardPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string>("");
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [isSharedToggle, setIsSharedToggle] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);

  // drag-and-drop state
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);

  // card renaming state
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingTitleText, setEditingTitleText] = useState<string>("");

  const fetchLayoutPresets = async () => {
    const presetsList: DashboardPreset[] = [];
    
    // 1. Fetch team layouts
    try {
      const teamQuery = query(collection(db, "team_layouts"), orderBy("updatedAt", "desc"));
      const teamSnap = await getDocs(teamQuery);
      teamSnap.forEach(docSnap => {
        presetsList.push({ id: docSnap.id, ...docSnap.data() } as DashboardPreset);
      });
    } catch (err) {
      console.error("Failed to fetch team layouts:", err);
    }

    // 2. Fetch private user layouts
    if (user) {
      try {
        const privateQuery = query(
          collection(db, "user_profiles", user.uid, "layouts"),
          orderBy("updatedAt", "desc")
        );
        const privateSnap = await getDocs(privateQuery);
        privateSnap.forEach(docSnap => {
          presetsList.push({ id: docSnap.id, ...docSnap.data() } as DashboardPreset);
        });
      } catch (err) {
        console.error("Failed to fetch private layouts:", err);
      }
    }

    setCloudPresets(presetsList);
  };

  useEffect(() => {
    fetchLayoutPresets();
  }, [user]);

  useEffect(() => {
    const fetchFieldConfigs = async () => {
      try {
        const q = query(collection(db, "field_configs"), orderBy("updatedAt", "desc"));
        const querySnapshot = await getDocs(q);
        const configs: any[] = [];
        querySnapshot.forEach((docSnap) => {
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
        } else {
          setFieldObstacles(null);
          setFieldElements(null);
          setFieldElementTypes(null);
          setFieldCadUrl(null);
        }
      } catch (err) {
        console.error("Failed to fetch field configurations:", err);
      }
    };
    fetchFieldConfigs();
  }, [setFieldObstacles, setFieldElements, setFieldElementTypes, setFieldCadUrl]);

  const handleFieldConfigChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const configId = e.target.value;
    setSelectedFieldConfigId(configId);
    if (!configId) {
      setFieldObstacles(null);
      setFieldElements(null);
      setFieldElementTypes(null);
      setFieldCadUrl(null);
      return;
    }
    const config = fieldConfigs.find((c) => c.id === configId);
    if (config) {
      setFieldObstacles(config.obstacles || []);
      setFieldElements(config.elements || []);
      setFieldElementTypes(config.elementTypes || []);
      setFieldCadUrl(config.cadUrl || null);
    } else {
      setFieldObstacles(null);
      setFieldElements(null);
      setFieldElementTypes(null);
      setFieldCadUrl(null);
    }
  };

  // Layout Operations
  const handleAddChart = () => {
    const newId = `charts-${Date.now()}`;
    const nextOrder = dashboardLayout.length > 0
      ? Math.max(...dashboardLayout.map(item => item.order)) + 1
      : 1;

    const newLayoutItem: LayoutItem = {
      id: newId,
      type: "charts",
      title: "Telemetry Chart",
      visible: true,
      colSpan: 2,
      height: "medium",
      order: nextOrder
    };

    const newChartConfig: ChartConfig = {
      id: newId,
      selectedKeys: ["Robot/BatteryVoltage"]
    };

    setDashboardLayout([...dashboardLayout, newLayoutItem]);
    setChartConfigs([...chartConfigs, newChartConfig]);
  };

  const handleDuplicateChart = (sourceId: string) => {
    const sourceConfig = chartConfigs.find(c => c.id === sourceId);
    const sourceLayout = dashboardLayout.find(l => l.id === sourceId);
    if (!sourceLayout) return;

    const newId = `charts-${Date.now()}`;
    const nextOrder = Math.max(...dashboardLayout.map(item => item.order)) + 1;

    const newLayoutItem: LayoutItem = {
      ...sourceLayout,
      id: newId,
      title: `${sourceLayout.title} (Copy)`,
      order: nextOrder
    };

    const newChartConfig: ChartConfig = {
      id: newId,
      selectedKeys: sourceConfig ? [...sourceConfig.selectedKeys] : ["Robot/BatteryVoltage"]
    };

    setDashboardLayout([...dashboardLayout, newLayoutItem]);
    setChartConfigs([...chartConfigs, newChartConfig]);
  };

  const handleDeleteChart = (cardId: string) => {
    setDashboardLayout(dashboardLayout.filter(item => item.id !== cardId));
    setChartConfigs(chartConfigs.filter(config => config.id !== cardId));
  };

  const handleStartRename = (cardId: string, currentTitle: string) => {
    setEditingCardId(cardId);
    setEditingTitleText(currentTitle);
  };

  const handleSaveRename = (cardId: string) => {
    if (editingTitleText.trim() === "") return;
    setDashboardLayout(dashboardLayout.map(item => 
      item.id === cardId ? { ...item, title: editingTitleText.trim() } : item
    ));
    setEditingCardId(null);
  };

  const handleExportLayout = () => {
    const payload = {
      layout: dashboardLayout,
      chartConfigs: chartConfigs
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ares_scope_layout_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportLayout = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const payload = JSON.parse(event.target?.result as string);
          if (payload && Array.isArray(payload.layout) && Array.isArray(payload.chartConfigs)) {
            setDashboardLayout(payload.layout);
            setChartConfigs(payload.chartConfigs);
          } else {
            alert("Invalid layout file format.");
          }
        } catch (err: any) {
          alert("Failed to parse layout JSON: " + err.message);
        }
      };
      reader.readAsText(e.target.files[0]);
    }
  };

  const handleResetLayout = () => {
    setDashboardLayout(DEFAULT_LAYOUT);
    setChartConfigs(DEFAULT_CHART_CONFIGS);
    setActivePresetId("");
  };

  // Drag and drop sorting mechanics
  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    if (!isEditMode) return;
    setDraggedCardId(cardId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, cardId: string) => {
    if (!isEditMode || draggedCardId === cardId) return;
    e.preventDefault();
  };

  const handleDropCard = (e: React.DragEvent, targetCardId: string) => {
    if (!isEditMode || !draggedCardId || draggedCardId === targetCardId) return;
    
    const sourceItem = dashboardLayout.find(item => item.id === draggedCardId);
    const targetItem = dashboardLayout.find(item => item.id === targetCardId);
    if (!sourceItem || !targetItem) return;

    const sourceOrder = sourceItem.order;
    const targetOrder = targetItem.order;

    const updatedLayout = dashboardLayout.map(item => {
      if (item.id === draggedCardId) {
        return { ...item, order: targetOrder };
      } else if (item.id === targetCardId) {
        return { ...item, order: sourceOrder };
      }
      return item;
    });

    setDashboardLayout(updatedLayout);
    setDraggedCardId(null);
  };

  // Cloud presets actions
  const handleSavePreset = async () => {
    if (!newPresetName.trim()) return;
    setSavingPreset(true);

    const presetId = `preset-${Date.now()}`;
    const presetData = {
      name: newPresetName.trim(),
      isShared: isSharedToggle,
      createdBy: user?.uid || "anonymous",
      creatorName: user?.displayName || "Anonymous Team Member",
      layout: dashboardLayout,
      chartConfigs: chartConfigs,
      updatedAt: serverTimestamp()
    };

    try {
      if (isSharedToggle) {
        await setDoc(doc(db, "team_layouts", presetId), presetData);
      } else if (user) {
        await setDoc(doc(db, "user_profiles", user.uid, "layouts", presetId), presetData);
      } else {
        throw new Error("You must be logged in to save private presets.");
      }

      setShowSavePresetModal(false);
      setNewPresetName("");
      fetchLayoutPresets();
      setActivePresetId(presetId);
    } catch (err: any) {
      console.error("Failed to save preset:", err);
      alert("Failed to save preset: " + err.message);
    } finally {
      setSavingPreset(false);
    }
  };

  const handleLoadPreset = (presetId: string) => {
    const preset = cloudPresets.find(p => p.id === presetId);
    if (preset) {
      setDashboardLayout(preset.layout);
      setChartConfigs(preset.chartConfigs);
      setActivePresetId(presetId);
    }
  };

  const handleDeletePresetFromCloud = async (preset: DashboardPreset, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete preset "${preset.name}"?`)) return;

    try {
      if (preset.isShared) {
        await deleteDoc(doc(db, "team_layouts", preset.id));
      } else if (user) {
        await deleteDoc(doc(db, "user_profiles", user.uid, "layouts", preset.id));
      }
      fetchLayoutPresets();
      if (activePresetId === preset.id) {
        setActivePresetId("");
      }
    } catch (err: any) {
      console.error("Failed to delete preset:", err);
      alert("Failed to delete preset: " + err.message);
    }
  };

  // Fullscreen Zoom handler
  const handleToggleFullscreen = (cardId: string) => {
    const element = document.getElementById(`workspace-card-${cardId}`);
    if (!element) return;

    if (!document.fullscreenElement) {
      element.requestFullscreen().catch(err => {
        console.error("Error attempting to enable full-screen mode:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Console Log UI States
  const [logFilter, setLogFilter] = useState("");
  const [logLevelFilter, setLogLevelFilter] = useState<"ALL" | "INFO" | "WARN" | "ERROR">("ALL");
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const activeLogs = consoleLogs
    ? consoleLogs.filter((log) => log.timestamp <= currentTimeMs)
    : [];

  const filteredLogs = activeLogs.filter((log) => {
    const matchesLevel = logLevelFilter === "ALL" || log.level === logLevelFilter;
    const matchesSearch = log.message.toLowerCase().includes(logFilter.toLowerCase()) || 
                          log.level.toLowerCase().includes(logFilter.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  // Auto scroll effect
  useEffect(() => {
    if (autoScrollLogs && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [activeLogs.length, autoScrollLogs]);
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pathInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const comparisonInputRef = useRef<HTMLInputElement | null>(null);
  const consoleInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ntClientRef = useRef<NT4Client | null>(null);

  // High-performance 60 FPS animation/playback loop
  useEffect(() => {
    if (!isPlaying || !telemetryData || isStreaming) return;

    let lastTime = performance.now();
    let animationFrameId: number;

    const loop = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;

      // Advance playhead proportional to elapsed real-world time and playback speed
      setCurrentTimeMs(currentTimeMs + delta * playbackSpeed);
      
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, currentTimeMs, playbackSpeed, telemetryData, isStreaming]);

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

  // Securely close any active live connections on unmount
  useEffect(() => {
    return () => {
      if (ntClientRef.current) {
        ntClientRef.current.disconnect();
      }
    };
  }, []);

  // Listen to url param ?sim=true to open drawer
  useEffect(() => {
    if (searchParams.get("sim") === "true") {
      setShowSimDrawer(true);
    }
  }, [searchParams]);

  // WebSocket / Log refs and effects for Simulator
  const simWsRef = useRef<WebSocket | null>(null);
  const simTerminalEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (simAutoScrollLogs && simTerminalEndRef.current) {
      simTerminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [daemonLogs, simAutoScrollLogs]);

  const connectToDaemon = () => {
    if (simWsRef.current) {
      simWsRef.current.close();
    }

    setDaemonStatus('connecting');
    setDaemonLogs((prev) => [...prev, `[System] Connecting to sim launcher daemon at ${daemonUrl}...`]);

    try {
      const ws = new WebSocket(daemonUrl);
      simWsRef.current = ws;

      ws.onopen = () => {
        setDaemonStatus('connected');
        setDaemonLogs((prev) => [...prev, '[System] Connected to launcher daemon successfully.']);
      };

      ws.onclose = () => {
        setDaemonStatus('disconnected');
        setSimState('idle');
        setDaemonLogs((prev) => [...prev, '[System] Connection to daemon closed.']);
        simWsRef.current = null;
      };

      ws.onerror = () => {
        setDaemonLogs((prev) => [...prev, `[System Error] WebSocket connection failed. Verify daemon is running at ${daemonUrl}.`]);
        setDaemonStatus('disconnected');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "status") {
            setSimState(msg.status);
            if (msg.status === "running") {
              setDaemonLogs((prev) => [...prev, '[System] Simulator is running. Auto-connecting live telemetry...']);
              handleConnectLive("127.0.0.1");
            }
          } 
          
          else if (msg.type === "log") {
            setDaemonLogs((prev) => [...prev, msg.line]);
          } 
          
          else if (msg.type === "exit") {
            setSimState('idle');
            setDaemonLogs((prev) => [...prev, `[System] Simulator exited with code ${msg.code} (Success: ${msg.success}).`]);
          }
        } catch (e) {
          console.error("Failed to parse daemon message:", e);
        }
      };
    } catch (err: any) {
      setDaemonLogs((prev) => [...prev, `[System Error] Failed to create WebSocket connection: ${err.message}`]);
      setDaemonStatus('disconnected');
    }
  };

  const disconnectFromDaemon = () => {
    if (simWsRef.current) {
      simWsRef.current.close();
      simWsRef.current = null;
    }
  };

  const startSimulator = () => {
    if (!simWsRef.current || daemonStatus !== 'connected') return;
    setDaemonLogs((prev) => [...prev, '[System] Requesting simulator launch with EKF and layout config...']);
    setSimState('building');
    
    const activeConfig = fieldConfigs.find(c => c.id === selectedFieldConfigId);
    const obstacles = activeConfig ? activeConfig.obstacles : [];
    const elements = activeConfig ? activeConfig.elements : [];
    const elementTypes = activeConfig ? activeConfig.elementTypes : [];

    simWsRef.current.send(JSON.stringify({
      type: "start",
      params: {
        visionStdDevX,
        visionStdDevY,
        visionStdDevTheta,
        obstacles,
        elements,
        elementTypes
      }
    }));
  };

  const stopSimulator = () => {
    if (!simWsRef.current || daemonStatus !== 'connected') return;
    setDaemonLogs((prev) => [...prev, '[System] Requesting simulator stop...']);
    simWsRef.current.send(JSON.stringify({ type: "stop" }));
  };

  // Clean up simulator WebSocket on unmount
  useEffect(() => {
    return () => {
      if (simWsRef.current) {
        simWsRef.current.close();
      }
    };
  }, []);

  const handleConnectLive = (targetIp?: string) => {
    const connectIp = targetIp || ipAddress;
    if (ntClientRef.current) {
      ntClientRef.current.disconnect();
    }

    setStreaming(true);
    setStreamSource("local");
    setTelemetryData(null); // Clear static log logs
    setPlaying(false);

    const client = new NT4Client(
      connectIp,
      (frame) => {
        addLiveFrame(frame);
      },
      (status) => {
        setConnectionStatus(status);
        if (status === "disconnected") {
          setStreaming(false);
        }
      }
    );

    ntClientRef.current = client;
    client.connect();
    setShowLiveModal(false);
  };

  const handleDisconnectLive = () => {
    if (ntClientRef.current) {
      ntClientRef.current.disconnect();
      ntClientRef.current = null;
    }
    setStreaming(false);
    setStreamSource(null);
    setConnectionStatus("disconnected");
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

  // Format time (ms -> "M:SS.S")
  const formatTime = (ms: number) => {
    const totalSecs = ms / 1000;
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toFixed(1).padStart(4, "0")}`;
  };

  // Drag and drop local CSV log parser
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      parseLocalLogFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseLocalLogFile(e.target.files[0]);
    }
  };

  // Standalone CSV parser that updates the scope store telemetry data
  const parseCSVText = (text: string, fileName: string) => {
    // Simple CSV parser
    const lines = text.split("\n").filter((l) => l.trim() !== "");
    if (lines.length < 2) throw new Error("Invalid CSV format.");

    const headers = lines[0].split(",").map((h) => h.trim());
    const timestamps: number[] = [];
    const coords: { x: number; y: number; heading: number }[] = [];
    const channels: Record<string, number[]> = {};
    
    headers.forEach((h) => {
      channels[h] = [];
    });

    const findColIndex = (names: string[]) => {
      return headers.findIndex((h) => 
        names.some((n) => h.toLowerCase() === n.toLowerCase() || h.toLowerCase().includes(n.toLowerCase()))
      );
    };

    const xIdx = findColIndex(["drive/pose_x", "drive/odom_x", "posex", "x", "estimatedpose[0]", "robotpose[0]"]);
    const yIdx = findColIndex(["drive/pose_y", "drive/odom_y", "posey", "y", "estimatedpose[1]", "robotpose[1]"]);
    const headingIdx = findColIndex(["drive/drive_heading", "drive/pose_heading", "drive/odom_heading", "heading", "poseheading", "estimatedpose[2]", "robotpose[2]"]);
    const timeIdx = findColIndex(["timestampms", "timestamp", "time", "ms"]);

    // Process line rows
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      if (cols.length < headers.length) continue;

      const colsNum = cols.map((c) => parseFloat(c.trim()) || 0);

      const t = timeIdx !== -1 ? colsNum[timeIdx] : (i - 1) * 20;
      timestamps.push(t);
      
      let x = xIdx !== -1 ? colsNum[xIdx] : 0.0;
      let y = yIdx !== -1 ? colsNum[yIdx] : 0.0;
      let heading = headingIdx !== -1 ? colsNum[headingIdx] : 0.0;

      // Ensure coordinates are in center-origin meters.
      // If they look like bottom-left inches (large values), convert to center-origin meters:
      if (Math.abs(x) > 5.0 || Math.abs(y) > 5.0) {
        const tempX = x;
        x = (y - 72) / 39.3701;
        y = -(tempX - 72) / 39.3701;
        heading = heading - Math.PI / 2;
      }

      coords.push({ x, y, heading });

      headers.forEach((h, idx) => {
        channels[h].push(colsNum[idx]);
      });
    }

    const customTelemetry: TelemetryData = {
      runId: fileName.substring(0, 15),
      opModeName: "ARESImportedCloudLog",
      timestamps: timestamps,
      coords: coords,
      channels: channels,
      maxTimeMs: timestamps.length > 0 ? timestamps[timestamps.length - 1] - timestamps[0] : 0
    };

    setTelemetryData(customTelemetry);
    console.log(`[CSV Parser] Parsed and loaded file: ${fileName}`);
  };

  // Local log parsing engine (Zero UI block)
  const parseLocalLogFile = (file: File) => {
    handleDisconnectLive();
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Empty file data.");
        parseCSVText(text, file.name);
      } catch (err: any) {
        alert("Failed to parse log file: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  // Parser for synchronised console log statements
  const parseConsoleLogFile = (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Empty file data.");

        const lines = text.split("\n").filter((l) => l.trim() !== "");
        const parsedEntries: any[] = [];

        lines.forEach((line, idx) => {
          let timestamp = idx * 100; // default incremental fallback (ms)
          let level: "INFO" | "WARN" | "ERROR" = "INFO";
          let message = line;

          // Deduce level
          if (line.includes("[WARN]") || line.toLowerCase().includes("warn")) {
            level = "WARN";
          } else if (line.includes("[ERROR]") || line.toLowerCase().includes("error") || line.toLowerCase().includes("fail")) {
            level = "ERROR";
          }

          // Extract bracketed or colon timestamps: e.g. [1.25s], [1250ms], 1250:
          const bracketMatch = line.match(/\[(\d+(?:\.\d+)?)(s|ms)?\]/);
          const colonMatch = line.match(/^(\d+(?:\.\d+)?)(s|ms)?:/);
          
          if (bracketMatch) {
            const val = parseFloat(bracketMatch[1]);
            const unit = bracketMatch[2] || "ms";
            timestamp = unit === "s" ? val * 1000 : val;
            message = line.replace(bracketMatch[0], "").trim();
          } else if (colonMatch) {
            const val = parseFloat(colonMatch[1]);
            const unit = colonMatch[2] || "ms";
            timestamp = unit === "s" ? val * 1000 : val;
            message = line.replace(colonMatch[0], "").trim();
          }

          // Strip level brackets from the visual message string
          message = message.replace(/\[(INFO|WARN|ERROR)\]/i, "").replace(/\s+/g, " ").trim();

          parsedEntries.push({ timestamp, level, message });
        });

        // Ensure chronological sorting
        parsedEntries.sort((a, b) => a.timestamp - b.timestamp);

        setConsoleLogs(parsedEntries);
        console.log(`[Console Log Parser] Loaded ${parsedEntries.length} entries: ${file.name}`);
      } catch (err: any) {
        alert("Failed to parse console log file: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleConsoleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseConsoleLogFile(e.target.files[0]);
    }
  };

  // Parser for second telemetry run (comparison overlay)
  const parseComparisonLogFile = (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Empty file data.");

        const lines = text.split("\n").filter((l) => l.trim() !== "");
        if (lines.length < 2) throw new Error("Invalid CSV format.");

        const headers = lines[0].split(",").map((h) => h.trim());
        const timestamps: number[] = [];
        const coords: { x: number; y: number; heading: number }[] = [];
        const channels: Record<string, number[]> = {};
        
        headers.forEach((h) => {
          channels[h] = [];
        });

        const findColIndex = (names: string[]) => {
          return headers.findIndex((h) => 
            names.some((n) => h.toLowerCase() === n.toLowerCase() || h.toLowerCase().includes(n.toLowerCase()))
          );
        };

        const xIdx = findColIndex(["drive/pose_x", "drive/odom_x", "posex", "x", "estimatedpose[0]", "robotpose[0]"]);
        const yIdx = findColIndex(["drive/pose_y", "drive/odom_y", "posey", "y", "estimatedpose[1]", "robotpose[1]"]);
        const headingIdx = findColIndex(["drive/drive_heading", "drive/pose_heading", "drive/odom_heading", "heading", "poseheading", "estimatedpose[2]", "robotpose[2]"]);
        const timeIdx = findColIndex(["timestampms", "timestamp", "time", "ms"]);

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",");
          if (cols.length < headers.length) continue;

          const colsNum = cols.map((c) => parseFloat(c.trim()) || 0);

          const t = timeIdx !== -1 ? colsNum[timeIdx] : (i - 1) * 20;
          timestamps.push(t);
          
          let x = xIdx !== -1 ? colsNum[xIdx] : 0.0;
          let y = yIdx !== -1 ? colsNum[yIdx] : 0.0;
          let heading = headingIdx !== -1 ? colsNum[headingIdx] : 0.0;

          if (Math.abs(x) > 5.0 || Math.abs(y) > 5.0) {
            const tempX = x;
            x = (y - 72) / 39.3701;
            y = -(tempX - 72) / 39.3701;
            heading = heading - Math.PI / 2;
          }

          coords.push({ x, y, heading });

          headers.forEach((h, idx) => {
            channels[h].push(colsNum[idx]);
          });
        }

        const customTelemetry: TelemetryData = {
          runId: file.name.substring(0, 15),
          opModeName: "ARESComparisonLog",
          timestamps: timestamps,
          coords: coords,
          channels: channels,
          maxTimeMs: timestamps.length > 0 ? timestamps[timestamps.length - 1] - timestamps[0] : 0
        };

        setComparisonTelemetryData(customTelemetry);
        console.log(`[Comparison Parser] Parsed and loaded comparison: ${file.name}`);
      } catch (err: any) {
        alert("Failed to parse comparison log: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleComparisonInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseComparisonLogFile(e.target.files[0]);
    }
  };

  // Helper to generate dense points along the Bezier curves from saved waypoints
  const generatePlannedPathFromWaypoints = (wps: any[]) => {
    const parsedWaypoints = wps.map((wp: any) => {
      // Convert AresPlanner inches to EKF meters
      const anchor = {
        x: (wp.anchor.y * 0.0254) - 1.8288,
        y: 1.8288 - (wp.anchor.x * 0.0254)
      };
      
      const prevControl = wp.prevControl 
        ? { x: (wp.prevControl.y * 0.0254) - 1.8288, y: 1.8288 - (wp.prevControl.x * 0.0254) }
        : anchor;
        
      const nextControl = wp.nextControl
        ? { x: (wp.nextControl.y * 0.0254) - 1.8288, y: 1.8288 - (wp.nextControl.x * 0.0254) }
        : anchor;
        
      return { anchor, prevControl, nextControl };
    });

    if (parsedWaypoints.length === 0) return [];

    const densePoints: { x: number; y: number; heading: number }[] = [];
    
    let initialHeading = 0;
    if (parsedWaypoints.length > 1) {
      const wp1 = parsedWaypoints[0];
      const wp2 = parsedWaypoints[1];
      const p0 = wp1.anchor;
      const p1 = wp1.nextControl;
      const dx = 3 * (p1.x - p0.x);
      const dy = 3 * (p1.y - p0.y);
      initialHeading = Math.atan2(dy, dx);
    }
    
    densePoints.push({
      x: parsedWaypoints[0].anchor.x,
      y: parsedWaypoints[0].anchor.y,
      heading: initialHeading
    });

    const numSamples = 20;
    for (let i = 0; i < parsedWaypoints.length - 1; i++) {
      const wp1 = parsedWaypoints[i];
      const wp2 = parsedWaypoints[i + 1];
      
      const p0 = wp1.anchor;
      const p1 = wp1.nextControl;
      const p2 = wp2.prevControl;
      const p3 = wp2.anchor;

      for (let step = 1; step <= numSamples; step++) {
        const t = step / numSamples;
        const omt = 1 - t;
        const omt2 = omt * omt;
        const omt3 = omt2 * omt;
        const t2 = t * t;
        const t3 = t2 * t;

        const x = omt3 * p0.x + 3 * omt2 * t * p1.x + 3 * omt * t2 * p2.x + t3 * p3.x;
        const y = omt3 * p0.y + 3 * omt2 * t * p1.y + 3 * omt * t2 * p2.y + t3 * p3.y;

        const dx = 3 * omt2 * (p1.x - p0.x) + 6 * omt * t * (p2.x - p1.x) + 3 * t2 * (p3.x - p2.x);
        const dy = 3 * omt2 * (p1.y - p0.y) + 6 * omt * t * (p2.y - p1.y) + 3 * t2 * (p3.y - p2.y);
        const heading = Math.atan2(dy, dx);

        densePoints.push({ x, y, heading });
      }
    }
    return densePoints;
  };

  // Effect to load cloud telemetry log if logId search parameter is set
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const logId = params.get("logId");
    if (!logId) return;

    const loadCloudLog = async () => {
      handleDisconnectLive();
      setLoading(true);
      try {
        const docRef = doc(db, "aresplanner_log_data", logId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          throw new Error("Telemetry log content not found in the cloud.");
        }

        const data = docSnap.data();
        if (!data || !data.csvData) {
          throw new Error("Telemetry log is empty or invalid.");
        }

        // Fetch the corresponding metadata to get the actual file name and path version
        const metaRef = doc(db, "aresplanner_logs", logId);
        const metaSnap = await getDoc(metaRef);
        const metaData = metaSnap.exists() ? metaSnap.data() : null;
        const name = metaData?.name || "cloud_telemetry.csv";

        parseCSVText(data.csvData, name);

        // Load the frozen planned path version from the log metadata
        if (metaData?.pathState?.waypoints) {
          const densePoints = generatePlannedPathFromWaypoints(metaData.pathState.waypoints);
          setPlannedPath(densePoints);
          console.log(`[Path Versioning] Loaded frozen path version from log metadata for replay.`);
        }
      } catch (err: any) {
        console.error("Failed to load cloud log:", err);
        alert("Failed to load cloud log: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    loadCloudLog();
  }, [db]);

  const handlePathInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseLocalPathFile(e.target.files[0]);
    }
  };

  const parseLocalPathFile = (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("Empty file data.");

        const root = JSON.parse(text);
        if (!root.waypoints || !Array.isArray(root.waypoints)) {
          throw new Error("Invalid PathPlanner file: missing waypoints array.");
        }

        const parsedWaypoints = root.waypoints.map((wp: any) => {
          const anchor = {
            x: (wp.anchor?.y ?? 0) - 1.8288,
            y: 1.8288 - (wp.anchor?.x ?? 0)
          };
          
          const prevControl = wp.prevControl 
            ? { x: wp.prevControl.y - 1.8288, y: 1.8288 - wp.prevControl.x }
            : anchor;
            
          const nextControl = wp.nextControl
            ? { x: wp.nextControl.y - 1.8288, y: 1.8288 - wp.nextControl.x }
            : anchor;
            
          return { anchor, prevControl, nextControl };
        });

        if (parsedWaypoints.length === 0) {
          throw new Error("No waypoints found in path.");
        }

        const densePoints: { x: number; y: number; heading: number }[] = [];
        
        let initialHeading = 0;
        if (parsedWaypoints.length > 1) {
          const wp1 = parsedWaypoints[0];
          const wp2 = parsedWaypoints[1];
          const p0 = wp1.anchor;
          const p1 = wp1.nextControl;
          const dx = 3 * (p1.x - p0.x);
          const dy = 3 * (p1.y - p0.y);
          initialHeading = Math.atan2(dy, dx);
        }
        
        densePoints.push({
          x: parsedWaypoints[0].anchor.x,
          y: parsedWaypoints[0].anchor.y,
          heading: initialHeading
        });

        const numSamples = 20;
        for (let i = 0; i < parsedWaypoints.length - 1; i++) {
          const wp1 = parsedWaypoints[i];
          const wp2 = parsedWaypoints[i + 1];
          
          const p0 = wp1.anchor;
          const p1 = wp1.nextControl;
          const p2 = wp2.prevControl;
          const p3 = wp2.anchor;

          for (let step = 1; step <= numSamples; step++) {
            const t = step / numSamples;
            const omt = 1 - t;
            const omt2 = omt * omt;
            const omt3 = omt2 * omt;
            const t2 = t * t;
            const t3 = t2 * t;

            const x = omt3 * p0.x + 3 * omt2 * t * p1.x + 3 * omt * t2 * p2.x + t3 * p3.x;
            const y = omt3 * p0.y + 3 * omt2 * t * p1.y + 3 * omt * t2 * p2.y + t3 * p3.y;

            const dx = 3 * omt2 * (p1.x - p0.x) + 6 * omt * t * (p2.x - p1.x) + 3 * t2 * (p3.x - p2.x);
            const dy = 3 * omt2 * (p1.y - p0.y) + 6 * omt * t * (p2.y - p1.y) + 3 * t2 * (p3.y - p2.y);
            const heading = Math.atan2(dy, dx);

            densePoints.push({ x, y, heading });
          }
        }

        setPlannedPath(densePoints);
        console.log(`[Path Parser] Parsed and loaded planned path: ${file.name}`);
      } catch (err: any) {
        alert("Failed to parse PathPlanner file: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8">
      
      {/* Header Deck */}
      <header className="border-b border-white/5 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
            <Cpu size={12} className="animate-pulse" /> Diagnostic Tools
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter font-heading">
            ARES-Scope Replay
          </h1>
          <p className="text-marble/70 text-xs md:text-sm mt-1.5 font-medium max-w-xl">
            High-performance browser-based AdvantageScope clone. Stream live telemetry, analyze motor binding, and review Vertex AI scouting roadmaps.
          </p>
        </div>

        {/* Database & File Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Connection Status Badge */}
          {isStreaming && (
            <div className={`flex items-center gap-2 border px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider ${
              connectionStatus === "connected"
                ? "bg-ares-success/10 text-ares-success border-ares-success/20"
                : connectionStatus === "connecting"
                ? "bg-ares-gold/10 text-ares-gold border-ares-gold/20"
                : "bg-white/5 text-marble/50 border-white/5"
            }`}>
              {connectionStatus === "connected" && (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ares-success opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-ares-success"></span>
                  </span>
                  <span>Connected</span>
                </>
              )}
              {connectionStatus === "connecting" && (
                <>
                  <RefreshCw size={12} className="animate-spin text-ares-gold" />
                  <span>Connecting</span>
                </>
              )}
              {connectionStatus === "disconnected" && (
                <>
                  <WifiOff size={12} className="text-marble/40" />
                  <span>Disconnected</span>
                </>
              )}
            </div>
          )}

          {/* Live Stream Button */}
          {isStreaming ? (
            <button
              onClick={handleDisconnectLive}
              className="px-4 py-2.5 bg-ares-red/15 hover:bg-ares-red/25 text-ares-red-light border border-ares-red/20 hover:border-ares-red/30 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md font-bold focus:ring-2 focus:ring-ares-cyan focus:outline-none"
            >
              <WifiOff size={12} /> Disconnect
            </button>
          ) : (
            <button
              onClick={() => setShowLiveModal(true)}
              className="px-4 py-2.5 bg-ares-gold/10 hover:bg-ares-gold/20 text-ares-gold border border-ares-gold/20 hover:border-ares-gold/30 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md font-bold"
            >
              <Wifi size={12} /> Go Live
            </button>
          )}

          {/* Local Simulator Controls Button */}
          <button
            onClick={() => setShowSimDrawer(true)}
            className={`px-4 py-2.5 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md font-bold focus:ring-2 focus:ring-ares-cyan focus:outline-none ${
              simState !== "idle"
                ? "bg-ares-success/15 text-ares-success border border-ares-success/20 hover:bg-ares-success/25"
                : "bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10"
            }`}
            title="Open local simulator controls"
          >
            <Play size={12} className={simState === "building" ? "animate-pulse text-ares-gold" : simState === "running" ? "text-ares-success" : ""} />
            <span>Local Sim</span>
          </button>

          {/* Field Layout Selector */}
          <div className="flex items-center bg-black/50 border border-white/5 px-3 py-2 rounded-xl text-xs gap-2">
            <Sliders size={14} className="text-ares-gold" />
            <select
              value={selectedFieldConfigId}
              onChange={handleFieldConfigChange}
              className="bg-transparent text-white focus:outline-none font-bold uppercase cursor-pointer"
            >
              {fieldConfigs.length === 0 ? (
                <option value="" className="bg-neutral-900 text-white">No Obstacles</option>
              ) : (
                <>
                  <option value="" className="bg-neutral-900 text-white">Clear Obstacles</option>
                  {fieldConfigs.map((c) => (
                    <option key={c.id} value={c.id} className="bg-neutral-900 text-white">
                      {c.name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* Active Run Selector */}
          <div className="flex items-center bg-black/50 border border-white/5 px-3 py-2 rounded-xl text-xs gap-2">
            <Database size={14} className="text-ares-gold" />
            <select
              value={selectedRunId}
              onChange={(e) => setSelectedRunId(e.target.value)}
              className="bg-transparent text-white focus:outline-none font-bold uppercase cursor-pointer"
            >
              <option value="run_2026_championship_finals" className="bg-neutral-900 text-white">Championship Finals</option>
              <option value="run_2026_qualifiers_3" className="bg-neutral-900 text-white">Qualifier Run #3</option>
              <option value="run_2026_practice_slippage" className="bg-neutral-900 text-white">Practice Slippage Run</option>
            </select>
          </div>

          {/* Local Log Upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md"
          >
            <FolderOpen size={12} /> Local Log
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInput}
            accept=".csv,.txt"
            className="hidden"
          />

          {/* Comparison Log Upload */}
          <button
            onClick={() => comparisonTelemetryData ? setComparisonTelemetryData(null) : comparisonInputRef.current?.click()}
            className={`px-4 py-2.5 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md focus:ring-2 focus:ring-ares-cyan focus:outline-none ${
              comparisonTelemetryData 
                ? "bg-ares-red/15 text-ares-red-light border border-ares-red/25 hover:bg-ares-red/25" 
                : "bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10"
            }`}
            title={comparisonTelemetryData ? "Clear comparison log" : "Upload comparison CSV log"}
          >
            {comparisonTelemetryData ? (
              <>
                <X size={12} /> Comparison Active
              </>
            ) : (
              <>
                <Activity size={12} /> Compare Log
              </>
            )}
          </button>
          <input
            type="file"
            ref={comparisonInputRef}
            onChange={handleComparisonInput}
            accept=".csv,.txt"
            className="hidden"
          />

          {/* Console Log Upload */}
          <button
            onClick={() => consoleLogs ? setConsoleLogs(null) : consoleInputRef.current?.click()}
            className={`px-4 py-2.5 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md ${
              consoleLogs 
                ? "bg-ares-gold/15 text-ares-gold border border-ares-gold/25 hover:bg-ares-gold/25" 
                : "bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10"
            }`}
            title={consoleLogs ? "Clear console log" : "Upload system console text log"}
          >
            {consoleLogs ? (
              <>
                <X size={12} /> Clear Console
              </>
            ) : (
              <>
                <Sliders size={12} /> System Console
              </>
            )}
          </button>
          <input
            type="file"
            ref={consoleInputRef}
            onChange={handleConsoleInput}
            accept=".txt,.log"
            className="hidden"
          />

          {/* Planned Path Upload */}
          <button
            onClick={() => pathInputRef.current?.click()}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md"
          >
            <Compass size={12} /> Planned Path
          </button>
          <input
            type="file"
            ref={pathInputRef}
            onChange={handlePathInput}
            accept=".path,.json"
            className="hidden"
          />

          {/* Match Video Upload */}
          <button
            onClick={() => videoInputRef.current?.click()}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/5 hover:border-white/10 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-2 transition-all duration-300 shadow-md"
          >
            <Eye size={12} /> Match Video
          </button>
          <input
            type="file"
            ref={videoInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                const url = URL.createObjectURL(e.target.files[0]);
                setVideoUrl(url);
              }
            }}
            accept="video/*"
            className="hidden"
          />
        </div>
      </header>

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
          {/* Workspace Customizer & Presets Toolbar */}
          <div className="glass-card p-4 border border-white/10 bg-neutral-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center bg-black/55 border border-white/10 px-3 py-2 rounded-xl text-xs gap-2">
                <Layout size={14} className="text-ares-gold" />
                <span className="text-marble/55 uppercase font-bold text-[10px] tracking-wider">Workspace:</span>
                <select
                  value={activePresetId}
                  onChange={(e) => {
                    if (e.target.value === "default") {
                      handleResetLayout();
                    } else if (e.target.value) {
                      handleLoadPreset(e.target.value);
                    }
                  }}
                  className="bg-transparent text-white focus:outline-none font-bold uppercase cursor-pointer text-xs"
                >
                  <option value="" className="bg-neutral-900 text-marble/40">Select Preset...</option>
                  <option value="default" className="bg-neutral-900 text-white font-bold">Standard Layout</option>
                  
                  {cloudPresets.filter(p => !p.isShared).length > 0 && (
                    <optgroup label="My Presets" className="bg-neutral-900 text-ares-gold font-bold">
                      {cloudPresets.filter(p => !p.isShared).map(p => (
                        <option key={p.id} value={p.id} className="text-white">
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {cloudPresets.filter(p => p.isShared).length > 0 && (
                    <optgroup label="Team Presets" className="bg-neutral-900 text-ares-cyan font-bold">
                      {cloudPresets.filter(p => p.isShared).map(p => (
                        <option key={p.id} value={p.id} className="text-white">
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {activePresetId && activePresetId !== "default" && (
                <button
                  onClick={(e) => {
                    const activePreset = cloudPresets.find(p => p.id === activePresetId);
                    if (activePreset) handleDeletePresetFromCloud(activePreset, e);
                  }}
                  className="p-2 bg-ares-red/10 hover:bg-ares-red/20 text-ares-red border border-ares-red/20 rounded-xl hover:text-ares-red-light transition-all cursor-pointer"
                  title="Delete current preset from cloud"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isEditMode ? (
                <>
                  <button
                    onClick={handleAddChart}
                    className="px-3 py-2 bg-ares-cyan/10 hover:bg-ares-cyan/20 text-ares-cyan border border-ares-cyan/20 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-1.5 transition-all duration-300 font-bold"
                  >
                    <Plus size={12} /> Add Chart
                  </button>

                  <button
                    onClick={handleResetLayout}
                    className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/5 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-1.5 transition-all duration-300 font-bold"
                  >
                    <RotateCcw size={12} /> Reset to Default
                  </button>

                  <button
                    onClick={handleExportLayout}
                    className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/5 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-1.5 transition-all duration-300 font-bold"
                  >
                    <Download size={12} /> Export Layout
                  </button>

                  <button
                    onClick={() => importFileInputRef.current?.click()}
                    className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/5 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-1.5 transition-all duration-300 font-bold"
                  >
                    <Upload size={12} /> Import Layout
                  </button>
                  <input
                    type="file"
                    ref={importFileInputRef}
                    onChange={handleImportLayout}
                    accept=".json"
                    className="hidden"
                  />

                  <button
                    onClick={() => setShowSavePresetModal(true)}
                    className="px-4 py-2 bg-ares-gold text-black hover:bg-ares-gold-soft text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-1.5 transition-all duration-300 font-bold"
                  >
                    <Save size={12} /> Save Preset
                  </button>

                  <button
                    onClick={() => setIsEditMode(false)}
                    className="px-4 py-2 bg-ares-success/15 text-ares-success border border-ares-success/20 hover:bg-ares-success/25 hover:border-ares-success/30 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-1.5 transition-all duration-300 font-bold"
                  >
                    Done
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditMode(true)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/5 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-1.5 transition-all duration-300 font-bold"
                >
                  <Layout size={12} /> Customize Layout
                </button>
              )}
            </div>
          </div>

          {/* Dynamic Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {dashboardLayout
              .filter((item) => item.visible)
              .sort((a, b) => a.order - b.order)
              .map((item) => {
                const heightClass = 
                  item.height === "short" ? "min-h-[220px]" :
                  item.height === "tall" ? "min-h-[580px]" :
                  "min-h-[380px]";
                
                const colSpanClass = 
                  item.colSpan === 1 ? "md:col-span-1" :
                  item.colSpan === 2 ? "md:col-span-2" :
                  "md:col-span-3";

                return (
                  <div
                    key={item.id}
                    id={`workspace-card-${item.id}`}
                    draggable={isEditMode}
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragOver={(e) => handleDragOver(e, item.id)}
                    onDrop={(e) => handleDropCard(e, item.id)}
                    className={`${colSpanClass} ${heightClass} transition-all duration-300 relative flex flex-col group bg-obsidian-light rounded-2xl border ${
                      isEditMode 
                        ? "border-ares-gold/40 border-dashed cursor-move hover:border-ares-gold animate-pulse" 
                        : "border-white/10"
                    }`}
                  >
                    {/* Hover Fullscreen button when NOT in edit mode */}
                    {!isEditMode && (
                      <button
                        onClick={() => handleToggleFullscreen(item.id)}
                        className="absolute top-4 right-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-1.5 rounded-lg bg-black/60 border border-white/10 text-marble/60 hover:text-white cursor-pointer"
                        title="Maximize panel to fullscreen"
                      >
                        <Maximize2 size={12} />
                      </button>
                    )}

                    {/* Card Header inside Edit Mode */}
                    {isEditMode && (
                      <div className="flex items-center justify-between px-4 py-2 bg-black/50 border-b border-white/5 select-none text-[10px] uppercase font-bold text-marble/60 rounded-t-2xl">
                        <div className="flex items-center gap-2">
                          <div className="cursor-move text-ares-gold font-bold text-sm" title="Drag to reorder">
                            ☰
                          </div>
                          {editingCardId === item.id ? (
                            <input
                              type="text"
                              value={editingTitleText}
                              onChange={(e) => setEditingTitleText(e.target.value)}
                              onBlur={() => handleSaveRename(item.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveRename(item.id);
                                if (e.key === "Escape") setEditingCardId(null);
                              }}
                              autoFocus
                              className="bg-black/60 border border-white/20 text-white rounded px-2 py-0.5 text-[10px] font-bold uppercase focus:outline-none focus:border-ares-gold"
                            />
                          ) : (
                            <span 
                              onDoubleClick={() => handleStartRename(item.id, item.title)}
                              className="font-heading text-white cursor-pointer hover:text-ares-gold flex items-center gap-1.5"
                              title="Double click to rename card"
                            >
                              {item.title}
                              <Edit3 size={8} className="text-marble/40" />
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={item.colSpan}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setDashboardLayout(dashboardLayout.map(l => 
                                l.id === item.id ? { ...l, colSpan: val } : l
                              ));
                            }}
                            className="bg-black/65 border border-white/10 rounded px-1 py-0.5 text-[8px] text-white focus:outline-none font-bold cursor-pointer"
                            title="Grid column span"
                          >
                            <option value={1}>1 Col</option>
                            <option value={2}>2 Col</option>
                            <option value={3}>3 Col</option>
                          </select>

                          <select
                            value={item.height}
                            onChange={(e) => {
                              const val = e.target.value as "short" | "medium" | "tall";
                              setDashboardLayout(dashboardLayout.map(l => 
                                l.id === item.id ? { ...l, height: val } : l
                              ));
                            }}
                            className="bg-black/65 border border-white/10 rounded px-1 py-0.5 text-[8px] text-white focus:outline-none font-bold cursor-pointer"
                            title="Card vertical height"
                          >
                            <option value="short">Short</option>
                            <option value="medium">Medium</option>
                            <option value="tall">Tall</option>
                          </select>

                          <button
                            onClick={() => handleToggleFullscreen(item.id)}
                            className="text-marble/45 hover:text-white transition-colors cursor-pointer"
                            title="Fullscreen zoom"
                          >
                            <Maximize2 size={10} />
                          </button>

                          {item.type === "charts" && (
                            <button
                              onClick={() => handleDuplicateChart(item.id)}
                              className="text-marble/45 hover:text-white transition-colors cursor-pointer"
                              title="Duplicate chart"
                            >
                              <Copy size={10} />
                            </button>
                          )}

                          {item.type === "charts" && dashboardLayout.filter(l => l.type === "charts").length > 1 && (
                            <button
                              onClick={() => handleDeleteChart(item.id)}
                              className="text-ares-red hover:text-ares-red-light transition-colors cursor-pointer"
                              title="Delete chart panel"
                            >
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Card Body containing actual component */}
                    <div className="flex-grow overflow-hidden relative rounded-b-2xl">
                      {item.type === "visualizer" && (
                        <div className="flex flex-col gap-4 h-full p-4 overflow-y-auto">
                          <div className="flex-grow">
                            <WebGLReplayCanvas />
                          </div>
                          {videoUrl && (
                            <div className="glass-card p-4 border border-white/10 flex flex-col gap-3 relative shrink-0">
                              <button
                                onClick={() => setVideoUrl(null)}
                                className="absolute top-2 right-2 text-marble/40 hover:text-white cursor-pointer transition-colors"
                                title="Close video player"
                              >
                                <X size={14} />
                              </button>
                              <h3 className="text-[10px] font-black uppercase text-white tracking-widest font-heading border-b border-white/5 pb-2 flex items-center gap-1.5">
                                🎥 Synchronized Match Video
                              </h3>
                              <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-white/5 shadow-inner">
                                <video
                                  ref={videoRef}
                                  src={videoUrl}
                                  className="w-full h-full object-contain"
                                  controls={false}
                                  muted
                                  playsInline
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {item.type === "diagnostics" && <HealthDiagnostics />}
                      
                      {item.type === "inspector" && <StateInspector />}
                      
                      {item.type === "logs" && (
                        <div className="flex flex-col gap-4 h-full p-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                            <h3 className="text-sm font-heading font-black uppercase text-white tracking-widest flex items-center gap-2">
                              <Terminal size={14} className="text-ares-gold" />
                              System Console Logs
                            </h3>
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                placeholder="Filter logs..."
                                value={logFilter}
                                onChange={(e) => setLogFilter(e.target.value)}
                                className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-[10px] text-white focus:outline-none focus:border-ares-gold font-mono placeholder:text-marble/35 focus:ring-2 focus:ring-ares-cyan"
                                aria-label="Filter logs"
                              />
                              <select
                                value={logLevelFilter}
                                onChange={(e) => setLogLevelFilter(e.target.value as any)}
                                className="bg-black/45 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none focus:border-ares-gold font-bold uppercase cursor-pointer focus:ring-2 focus:ring-ares-cyan"
                              >
                                <option value="ALL" className="bg-neutral-900 text-marble/60">ALL LEVELS</option>
                                <option value="INFO" className="bg-neutral-900 text-white">INFO</option>
                                <option value="WARN" className="bg-neutral-900 text-ares-gold">WARN</option>
                                <option value="ERROR" className="bg-neutral-900 text-ares-red-light">ERROR</option>
                              </select>
                              <label className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-marble/55 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={autoScrollLogs}
                                  onChange={(e) => setAutoScrollLogs(e.target.checked)}
                                  className="accent-ares-gold cursor-pointer rounded border-white/10"
                                />
                                Auto-scroll
                              </label>
                            </div>
                          </div>

                          <div 
                            ref={logContainerRef}
                            className="flex-grow overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1 bg-black/30 p-4 rounded-xl border border-white/5 scrollbar-thin scrollbar-thumb-white/5"
                          >
                            {filteredLogs.length === 0 ? (
                              <div className="text-marble/35 text-center py-16 uppercase tracking-widest text-xs font-bold font-heading">
                                {consoleLogs ? "No matching log entries." : "No console logs loaded. Upload a text log above."}
                              </div>
                            ) : (
                              filteredLogs.map((entry, idx) => {
                                let levelColor = "text-marble/70";
                                let levelBg = "bg-transparent";
                                if (entry.level === "WARN") {
                                  levelColor = "text-ares-gold";
                                  levelBg = "bg-ares-gold/5 border border-ares-gold/10";
                                } else if (entry.level === "ERROR") {
                                  levelColor = "text-ares-red-light";
                                  levelBg = "bg-ares-red/5 border border-ares-red/10";
                                }
                                return (
                                  <div key={idx} className={`flex items-start gap-2 p-1.5 rounded hover:bg-white/5 transition-colors ${levelBg}`}>
                                    <span className="text-marble/35 shrink-0 select-none">[{formatTime(entry.timestamp)}]</span>
                                    <span className={`px-1 py-0.5 rounded text-[8px] font-extrabold uppercase shrink-0 tracking-wider ${
                                      entry.level === "ERROR" ? "bg-ares-red/20 text-ares-red-light" :
                                      entry.level === "WARN" ? "bg-ares-gold/20 text-ares-gold" :
                                      "bg-white/10 text-marble/60"
                                    }`}>{entry.level}</span>
                                    <span className={`break-all ${levelColor}`}>{entry.message}</span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                      
                      {item.type === "charts" && (
                        <TelemetryCharts 
                          chartId={item.id}
                          selectedKeys={chartConfigs.find(c => c.id === item.id)?.selectedKeys || []}
                          onToggleKey={(key) => {
                            setChartConfigs(chartConfigs.map(c => {
                              if (c.id === item.id) {
                                const isSelected = c.selectedKeys.includes(key);
                                const nextKeys = isSelected
                                  ? c.selectedKeys.filter(k => k !== key)
                                  : [...c.selectedKeys, key];
                                return { ...c, selectedKeys: nextKeys };
                              }
                              return c;
                            }));
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* ─── MASTER SCRUBBING TIMELINE TIMELINE DECK ─── */}
          {telemetryData && (
            <div className="glass-card p-6 border border-white/10 bg-neutral-950/65 flex flex-col gap-4 sticky bottom-4 z-40 shadow-2xl">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                
                {/* Play controls */}
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => setPlaying(!isPlaying)}
                    className="w-10 h-10 rounded-full bg-ares-gold hover:bg-ares-gold-soft text-black flex items-center justify-center cursor-pointer transition-all duration-300 shadow-md transform hover:scale-105 shrink-0"
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                  </button>

                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-ares-gold tracking-widest leading-none">
                      Timeline playhead
                    </span>
                    <span className="text-xs text-white font-mono font-bold mt-1">
                      {formatTime(currentTimeMs)} / <span className="text-marble/35">{formatTime(telemetryData.maxTimeMs)}</span>
                    </span>
                  </div>
                </div>

                {/* Scrubber slider */}
                <input
                  type="range"
                  min="0"
                  max={telemetryData.maxTimeMs}
                  value={currentTimeMs}
                  onChange={(e) => setCurrentTimeMs(parseInt(e.target.value))}
                  className="flex-grow w-full accent-ares-gold bg-white/5 h-1.5 rounded-lg appearance-none cursor-pointer border border-white/5 outline-none"
                />

                {/* Speed buttons */}
                <div className="flex items-center bg-black/45 border border-white/5 p-1 rounded-xl gap-1 shrink-0">
                  {([0.5, 1.0, 1.5, 2.0] as const).map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`px-3 py-1 rounded-lg text-[9px] font-black tracking-wider uppercase transition-all duration-300 cursor-pointer ${
                        playbackSpeed === speed
                          ? "bg-ares-gold text-black font-extrabold"
                          : "text-marble/45 hover:text-white"
                      }`}
                    >
                      {speed.toFixed(1)}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Drag and Drop Drop-Zone overlay */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`fixed inset-0 z-50 flex items-center justify-center bg-black/85 transition-all duration-300 ${
              dragActive ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
          >
            <div className="glass-card border border-ares-gold/30 bg-ares-gold/5 p-10 max-w-md rounded-3xl text-center flex flex-col items-center gap-4 animate-pulse">
              <FolderOpen size={48} className="text-ares-gold" />
              <h3 className="font-extrabold text-white text-lg tracking-tight uppercase font-heading">
                Drop Telemetry Log Here
              </h3>
              <p className="text-marble/65 text-xs font-medium leading-relaxed">
                Release your robot CSV or TXT log file to instantly parse channels and start playback replay!
              </p>
            </div>
          </div>

        </div>
      )}

      {showLiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md transition-all duration-300">
          <div ref={liveModalRef} tabIndex={-1} className="glass-card border border-white/10 bg-neutral-950 p-6 max-w-sm w-full rounded-2xl flex flex-col gap-5 shadow-2xl relative focus:outline-none">
            <button
              onClick={() => setShowLiveModal(false)}
              className="absolute top-4 right-4 text-marble/40 hover:text-white cursor-pointer transition-colors"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-ares-gold/10 border border-ares-gold/20 flex items-center justify-center text-ares-gold">
                <Wifi size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-md tracking-tight uppercase font-heading">
                  Connect Live Stream
                </h3>
                <p className="text-marble/55 text-[10px] font-bold uppercase tracking-wider">
                  NetworkTables v4 WebSocket
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="robotIpInput" className="text-[10px] uppercase font-black tracking-widest text-ares-gold">
                Robot IP Address / Host
              </label>
              <input
                id="robotIpInput"
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="192.168.43.1"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-ares-gold transition-colors focus:ring-2 focus:ring-ares-cyan"
              />
              <p className="text-[10px] text-marble/40 mt-1 leading-normal">
                Default for FTC Wi-Fi Direct: <code className="text-ares-gold">192.168.43.1</code>. Control Hub / ADB: <code className="text-ares-gold">localhost</code> or <code className="text-ares-gold">192.168.43.1</code>.
              </p>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setShowLiveModal(false)}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/5 text-[10px] uppercase font-black tracking-widest rounded-xl transition-all duration-300 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConnectLive()}
                className="flex-1 py-3 bg-ares-gold text-black hover:bg-ares-gold-soft text-[10px] uppercase font-black tracking-widest rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 font-bold"
              >
                <Wifi size={12} className="stroke-[3]" /> Connect
              </button>
            </div>
          </div>
        </div>
      )}

      {showSavePresetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md transition-all duration-300">
          <div className="glass-card border border-white/10 bg-neutral-950 p-6 max-w-sm w-full rounded-2xl flex flex-col gap-5 shadow-2xl relative focus:outline-none">
            <button
              onClick={() => setShowSavePresetModal(false)}
              className="absolute top-4 right-4 text-marble/40 hover:text-white cursor-pointer transition-colors"
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-ares-gold/10 border border-ares-gold/20 flex items-center justify-center text-ares-gold">
                <Save size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-md tracking-tight uppercase font-heading">
                  Save Layout Preset
                </h3>
                <p className="text-marble/55 text-[10px] font-bold uppercase tracking-wider">
                  Cloud Workspace Sync
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="presetNameInput" className="text-[10px] uppercase font-black tracking-widest text-ares-gold">
                  Preset Name
                </label>
                <input
                  id="presetNameInput"
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="e.g. Swerve Calibrations"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-ares-gold transition-colors focus:ring-2 focus:ring-ares-cyan"
                />
              </div>

              {/* Share Toggle */}
              <div className="flex items-center justify-between bg-black/30 p-3 rounded-xl border border-white/5">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-black tracking-wider text-white">Share with Team</span>
                  <span className="text-[8px] text-marble/40 leading-normal">Save to team collection `/team_layouts`</span>
                </div>
                <input
                  type="checkbox"
                  checked={isSharedToggle}
                  onChange={(e) => setIsSharedToggle(e.target.checked)}
                  className="accent-ares-gold w-4 h-4 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setShowSavePresetModal(false)}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/5 text-[10px] uppercase font-black tracking-widest rounded-xl transition-all duration-300 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreset}
                disabled={savingPreset || !newPresetName.trim()}
                className="flex-1 py-3 bg-ares-gold disabled:opacity-50 text-black hover:bg-ares-gold-soft text-[10px] uppercase font-black tracking-widest rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 font-bold"
              >
                {savingPreset ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save size={12} className="stroke-[3]" /> Save Preset
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Local Simulator Slide-over Drawer */}
      {showSimDrawer && (
        <div className="fixed inset-0 z-modal flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="sim-drawer-title">
          <div className="absolute inset-0" onClick={() => setShowSimDrawer(false)} />
          
          <div
            ref={simDrawerRef}
            tabIndex={-1}
            className="relative w-full max-w-md h-full bg-obsidian border-l border-white/10 shadow-2xl flex flex-col justify-between p-6 overflow-y-auto animate-slide-in focus:outline-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <span className="inline-block bg-ares-red/10 text-ares-red px-2 py-0.5 ares-cut-sm font-black uppercase tracking-widest text-[8px] mb-1.5 border border-ares-red/20">
                  Local Simulation
                </span>
                <h2 id="sim-drawer-title" className="text-xl font-black uppercase tracking-wider text-white font-heading">
                  Simulator Controls
                </h2>
              </div>
              <button
                onClick={() => setShowSimDrawer(false)}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                aria-label="Close simulator panel"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-grow py-6 space-y-6 overflow-y-auto pr-1">
              
              {/* Connection Status Panel */}
              <div className="flex flex-col gap-3">
                <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold flex items-center gap-2">
                  <Wifi size={14} /> Connection Setup
                </h3>
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] uppercase font-black tracking-widest text-marble/40">
                    Daemon WebSocket URL
                  </label>
                  <input
                    type="text"
                    value={daemonUrl}
                    onChange={(e) => setDaemonUrl(e.target.value)}
                    placeholder="ws://localhost:8080"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white font-mono text-xs focus:outline-none focus:border-ares-gold transition-colors focus:ring-2 focus:ring-ares-cyan"
                  />
                </div>
                
                <div className="flex gap-2">
                  {daemonStatus === 'connected' ? (
                    <button
                      onClick={disconnectFromDaemon}
                      className="w-full py-2.5 bg-ares-red/15 hover:bg-ares-red/25 text-ares-red-light border border-ares-red/20 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 font-bold cursor-pointer focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                    >
                      <WifiOff size={12} /> Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={connectToDaemon}
                      disabled={daemonStatus === 'connecting'}
                      className="w-full py-2.5 bg-ares-gold text-black hover:bg-ares-gold-soft disabled:opacity-50 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 font-bold cursor-pointer"
                    >
                      {daemonStatus === 'connecting' ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" /> Connecting...
                        </>
                      ) : (
                        <>
                          <Wifi size={12} /> Connect Daemon
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Launcher Controls */}
              <div className="flex flex-col gap-3">
                <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold flex items-center gap-2">
                  <Sliders size={14} /> Sim Controls
                </h3>
                
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] uppercase font-black tracking-widest text-marble/40">
                    Select Field Layout
                  </label>
                  <select
                    value={selectedFieldConfigId}
                    onChange={handleFieldConfigChange}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white text-xs focus:outline-none focus:border-ares-gold transition-colors cursor-pointer"
                  >
                    {fieldConfigs.map((c) => (
                      <option key={c.id} value={c.id} className="bg-neutral-900 text-white">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={startSimulator}
                    disabled={daemonStatus !== 'connected' || simState !== 'idle'}
                    className="flex-1 py-2.5 bg-ares-red hover:bg-ares-red-dark disabled:opacity-50 text-white rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 font-bold cursor-pointer"
                  >
                    <Play size={12} className={simState === 'building' ? 'animate-pulse text-ares-gold' : simState === 'running' ? 'text-ares-success' : ''} />
                    {simState === 'building' ? 'Building...' : simState === 'running' ? 'Running' : 'Start Simulator'}
                  </button>
                  <button
                    onClick={stopSimulator}
                    disabled={daemonStatus !== 'connected' || simState !== 'running'}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white border border-white/10 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 font-bold cursor-pointer"
                  >
                    <Square size={12} /> Stop
                  </button>
                </div>
              </div>

              {/* EKF Config Overrides */}
              <div className="flex flex-col gap-3">
                <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold flex items-center gap-2">
                  <Sliders size={14} /> EKF Odometry Overrides
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] uppercase font-black tracking-widest text-marble/40">Std Dev X (m)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={visionStdDevX}
                      onChange={(e) => setVisionStdDevX(parseFloat(e.target.value) || 0.05)}
                      className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs text-center font-mono focus:outline-none focus:border-ares-gold"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] uppercase font-black tracking-widest text-marble/40">Std Dev Y (m)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={visionStdDevY}
                      onChange={(e) => setVisionStdDevY(parseFloat(e.target.value) || 0.05)}
                      className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs text-center font-mono focus:outline-none focus:border-ares-gold"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] uppercase font-black tracking-widest text-marble/40">Std Dev Theta (rad)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={visionStdDevTheta}
                      onChange={(e) => setVisionStdDevTheta(parseFloat(e.target.value) || 0.1)}
                      className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs text-center font-mono focus:outline-none focus:border-ares-gold"
                    />
                  </div>
                </div>
              </div>

              {/* Log Terminal Console */}
              <div className="flex flex-col gap-2 flex-1 min-h-[160px]">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] uppercase font-black tracking-widest text-marble/40 flex items-center gap-1.5">
                    <Terminal size={10} /> Compilation & Run Logs
                  </label>
                  <label className="flex items-center gap-1 text-[8px] uppercase font-bold text-marble/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simAutoScrollLogs}
                      onChange={(e) => setSimAutoScrollLogs(e.target.checked)}
                      className="rounded border-white/10 bg-black/40 text-ares-gold focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    />
                    Auto-scroll
                  </label>
                </div>
                <div className="flex-grow bg-black/60 rounded-xl border border-white/5 p-4 font-mono text-[9px] text-marble/85 overflow-y-auto flex flex-col gap-1.5 shadow-inner max-h-[180px]">
                  {daemonLogs.length === 0 ? (
                    <span className="text-marble/30 italic text-left">No logs received. Connect daemon to stream compiler stdout.</span>
                  ) : (
                    daemonLogs.map((log, index) => (
                      <div key={index} className="leading-relaxed break-all text-left font-mono">
                        {log}
                      </div>
                    ))
                  )}
                  <div ref={simTerminalEndRef} />
                </div>
              </div>

              {/* Commands Copy Helper */}
              <div className="flex flex-col gap-3">
                <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold flex items-center gap-2">
                  <Terminal size={14} /> Daemon Startup Commands
                </h3>
                
                {/* OS Tabs */}
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 gap-1">
                  {(['windows', 'mac', 'linux'] as const).map((os) => (
                    <button
                      key={os}
                      onClick={() => setOsTab(os)}
                      className={`flex-1 py-1 text-[8px] uppercase tracking-wider font-black rounded-lg transition-all cursor-pointer ${
                        osTab === os
                          ? 'bg-ares-gold text-black font-black'
                          : 'text-marble/60 hover:text-white hover:bg-white/5 font-semibold'
                      }`}
                    >
                      {os === 'windows' ? 'Windows' : os === 'mac' ? 'macOS' : 'Linux'}
                    </button>
                  ))}
                </div>

                {/* Command Block */}
                <div className="relative bg-black/60 rounded-xl border border-white/5 p-3 font-mono text-[9px] text-ares-cyan flex items-center justify-between group">
                  <span className="truncate pr-8 select-all">
                    {osTab === 'windows' 
                      ? 'cd tools\\sim-launcher-daemon; node daemon.js' 
                      : 'cd tools/sim-launcher-daemon && node daemon.js'}
                  </span>
                  <button
                    onClick={() => {
                      const cmd = osTab === 'windows' 
                        ? 'cd tools\\sim-launcher-daemon; node daemon.js' 
                        : 'cd tools/sim-launcher-daemon && node daemon.js';
                      navigator.clipboard.writeText(cmd);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="absolute right-2 p-1 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex items-center justify-center"
                    title="Copy command"
                  >
                    {copied ? <Check size={10} className="text-ares-success" /> : <Copy size={10} />}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
