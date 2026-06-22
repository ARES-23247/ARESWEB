import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc,
  collection,
  getDocs,
  query,
  orderBy,
  setDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { TunableConstant } from "../components/VariablesTuner";

export interface ChartConfig {
  id: string;
  selectedKeys: string[];
}

export interface LayoutItem {
  id: string;
  type: "visualizer" | "inspector" | "diagnostics" | "logs" | "charts" | "tuner" | "group";
  title: string;
  visible: boolean;
  colSpan: number;
  height: "short" | "medium" | "tall";
  order: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  childrenIds?: string[];
  activeTabId?: string;
}

export interface DashboardPreset {
  id: string;
  name: string;
  isShared: boolean;
  createdBy?: string;
  creatorName?: string;
  layout: LayoutItem[];
  chartConfigs: ChartConfig[];
  tuningConstants?: TunableConstant[];
  updatedAt: any;
}

export const DEFAULT_LAYOUT: LayoutItem[] = [
  { id: "visualizer", type: "visualizer", title: "3D Field Visualizer", visible: true, colSpan: 1, height: "tall", order: 1, x: 0, y: 1, w: 8, h: 5 },
  { id: "diagnostics", type: "diagnostics", title: "Health & Diagnostics", visible: true, colSpan: 2, height: "tall", order: 2, x: 8, y: 1, w: 4, h: 5 },
  { id: "charts-1", type: "charts", title: "Telemetry Chart", visible: true, colSpan: 2, height: "medium", order: 3, x: 0, y: 6, w: 8, h: 3 },
  { id: "inspector", type: "inspector", title: "State Inspector", visible: true, colSpan: 1, height: "medium", order: 4, x: 8, y: 6, w: 4, h: 3 },
  { id: "logs", type: "logs", title: "System Console Logs", visible: true, colSpan: 2, height: "medium", order: 5, x: 0, y: 9, w: 8, h: 3 },
  { id: "tuner", type: "tuner", title: "Variables Tuner", visible: true, colSpan: 1, height: "medium", order: 6, x: 8, y: 9, w: 4, h: 3 },
];

export const DEFAULT_CHART_CONFIGS: ChartConfig[] = [
  { id: "charts-1", selectedKeys: ["Robot/BatteryVoltage", "Robot/LoopTime"] }
];

export function migrateLayoutCoordinates(layout: LayoutItem[]): LayoutItem[] {
  let currentY = 1;
  let currentX = 0;

  return layout.map((item) => {
    if (
      item.x !== undefined &&
      item.y !== undefined &&
      item.w !== undefined &&
      item.h !== undefined
    ) {
      return item;
    }

    const w = item.colSpan === 1 ? 4 : item.colSpan === 2 ? 8 : 12;
    const h = item.height === "short" ? 2 : item.height === "medium" ? 3 : 5;

    if (currentX + w > 12) {
      currentX = 0;
      currentY += 4;
    }

    const x = currentX;
    const y = currentY;

    currentX += w;

    return {
      ...item,
      x,
      y,
      w,
      h
    };
  });
}

export function useScopeLayout() {
  const { user } = useAuth();
  const [isEditMode, setIsEditMode] = useState(false);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  const [dashboardLayout, setDashboardLayout] = useState<LayoutItem[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ares_scope_layout");
      if (stored) {
        try {
          return migrateLayoutCoordinates(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse stored layout:", e);
        }
      }
    }
    return migrateLayoutCoordinates(DEFAULT_LAYOUT);
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

  const [tuningConstants, setTuningConstants] = useState<TunableConstant[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ares_scope_tuning_constants");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.error("Failed to parse stored tuning constants:", e);
        }
      }
    }
    return [];
  });

  // persisting layout changes
  useEffect(() => {
    localStorage.setItem("ares_scope_layout", JSON.stringify(dashboardLayout));
  }, [dashboardLayout]);

  useEffect(() => {
    localStorage.setItem("ares_scope_chart_configs", JSON.stringify(chartConfigs));
  }, [chartConfigs]);

  useEffect(() => {
    localStorage.setItem("ares_scope_tuning_constants", JSON.stringify(tuningConstants));
  }, [tuningConstants]);

  // presets and cloud variables
  const [cloudPresets, setCloudPresets] = useState<DashboardPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string>("");
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [isSharedToggle, setIsSharedToggle] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);

  // pointer-based layout engine states
  const [activeDrag, setActiveDrag] = useState<{
    id: string;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    startGridX: number;
    startGridY: number;
    startGridW: number;
    startGridH: number;
  } | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  // Layout Operations
  const handleAddWidget = (type: LayoutItem["type"]) => {
    const newId = `${type}-${Date.now()}`;
    const nextOrder = dashboardLayout.length > 0
      ? Math.max(...dashboardLayout.map(item => item.order)) + 1
      : 1;

    const w = type === "charts" || type === "diagnostics" || type === "logs" ? 8 : 4;
    const h = type === "visualizer" || type === "diagnostics" ? 5 : 3;

    const maxY = dashboardLayout.length > 0
      ? Math.max(...dashboardLayout.map(item => (item.y ?? 1) + (item.h ?? 3)))
      : 1;

    const newLayoutItem: LayoutItem = {
      id: newId,
      type,
      title: 
        type === "visualizer" ? "3D Field Visualizer" :
        type === "inspector" ? "State Inspector" :
        type === "diagnostics" ? "Health & Diagnostics" :
        type === "logs" ? "System Console Logs" :
        type === "charts" ? "Telemetry Chart" :
        type === "tuner" ? "Variables Tuner" : "Widget Tab Group",
      visible: true,
      colSpan: 1,
      height: "medium",
      order: nextOrder,
      x: 0,
      y: maxY,
      w,
      h,
      childrenIds: type === "group" ? [] : undefined
    };

    if (type === "charts") {
      const newChartConfig: ChartConfig = {
        id: newId,
        selectedKeys: ["Robot/BatteryVoltage"]
      };
      setChartConfigs(prev => [...prev, newChartConfig]);
    }

    setDashboardLayout(prev => [...prev, newLayoutItem]);
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
      order: nextOrder,
      x: 0,
      y: (sourceLayout.y ?? 1) + (sourceLayout.h ?? 3),
    };

    const newChartConfig: ChartConfig = {
      id: newId,
      selectedKeys: sourceConfig ? [...sourceConfig.selectedKeys] : ["Robot/BatteryVoltage"]
    };

    setDashboardLayout(prev => [...prev, newLayoutItem]);
    setChartConfigs(prev => [...prev, newChartConfig]);
  };

  const handleDeleteWidget = (cardId: string) => {
    setDashboardLayout(prev => prev.filter(item => item.id !== cardId));
    setChartConfigs(prev => prev.filter(config => config.id !== cardId));
  };

  const handleAddToGroup = (groupId: string, childId: string) => {
    setDashboardLayout(prev => prev.map(item => {
      if (item.id === groupId) {
        const nextChildren = [...(item.childrenIds || []), childId];
        return { ...item, childrenIds: nextChildren, activeTabId: childId };
      }
      return item;
    }));
  };

  const handleRemoveFromGroup = (groupId: string, childId: string) => {
    setDashboardLayout(prev => prev.map(item => {
      if (item.id === groupId) {
        const nextChildren = (item.childrenIds || []).filter(cid => cid !== childId);
        const nextActive = item.activeTabId === childId ? nextChildren[0] || "" : item.activeTabId;
        return { ...item, childrenIds: nextChildren, activeTabId: nextActive };
      }
      if (item.id === childId) {
        const group = prev.find(g => g.id === groupId);
        return {
          ...item,
          x: group ? (group.x ?? 0) : 0,
          y: group ? ((group.y ?? 1) + (group.h ?? 3)) : 10,
          w: 4,
          h: 3
        };
      }
      return item;
    }));
  };

  const handleStartRename = (cardId: string, currentTitle: string) => {
    setEditingCardId(cardId);
    setEditingTitleText(currentTitle);
  };

  const handleSaveRename = (cardId: string) => {
    if (editingTitleText.trim() === "") return;
    setDashboardLayout(prev => prev.map(item => 
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

  const handleImportLayout = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const payload = JSON.parse(event.target?.result as string);
          if (payload && Array.isArray(payload.layout) && Array.isArray(payload.chartConfigs)) {
            setDashboardLayout(migrateLayoutCoordinates(payload.layout));
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
    setDashboardLayout(migrateLayoutCoordinates(DEFAULT_LAYOUT));
    setChartConfigs(DEFAULT_CHART_CONFIGS);
    setActivePresetId("");
  };

  // Pointer dragging and resizing handlers
  const handlePointerDown = (
    e: React.PointerEvent,
    itemId: string,
    mode: "move" | "resize"
  ) => {
    if (!isEditMode) return;
    const item = dashboardLayout.find((l) => l.id === itemId);
    if (!item) return;

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    setActiveDrag({
      id: itemId,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startGridX: item.x ?? 0,
      startGridY: item.y ?? 1,
      startGridW: item.w ?? 4,
      startGridH: item.h ?? 3,
    });

    e.preventDefault();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeDrag || !gridContainerRef.current) return;

    const containerRect = gridContainerRef.current.getBoundingClientRect();
    const colWidth = containerRect.width / 12;
    const rowHeight = 110;

    const dx = e.clientX - activeDrag.startX;
    const dy = e.clientY - activeDrag.startY;

    const colDelta = Math.round(dx / colWidth);
    const rowDelta = Math.round(dy / rowHeight);

    setDashboardLayout((prev) =>
      prev.map((item) => {
        if (item.id !== activeDrag.id) return item;

        if (activeDrag.mode === "move") {
          const newX = Math.max(0, Math.min(12 - (item.w ?? 4), activeDrag.startGridX + colDelta));
          const newY = Math.max(1, activeDrag.startGridY + rowDelta);
          return { ...item, x: newX, y: newY };
        } else {
          const newW = Math.max(1, Math.min(12 - (item.x ?? 0), activeDrag.startGridW + colDelta));
          const newH = Math.max(1, activeDrag.startGridH + rowDelta);
          return { ...item, w: newW, h: newH };
        }
      })
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!activeDrag) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setActiveDrag(null);
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
      tuningConstants: tuningConstants,
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
      setDashboardLayout(migrateLayoutCoordinates(preset.layout));
      setChartConfigs(preset.chartConfigs);
      if (preset.tuningConstants) {
        setTuningConstants(preset.tuningConstants);
      }
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

  return {
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
  };
}
