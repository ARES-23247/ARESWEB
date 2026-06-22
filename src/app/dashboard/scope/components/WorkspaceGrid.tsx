"use client";

import React from "react";
import { 
  X, 
  Maximize2, 
  Copy, 
  Trash2, 
  Edit3 
} from "lucide-react";
import WebGLReplayCanvas from "./WebGLReplayCanvas";
import TelemetryCharts from "./TelemetryCharts";
import StateInspector from "./StateInspector";
import HealthDiagnostics from "./HealthDiagnostics";
import VariablesTuner, { TunableConstant } from "./VariablesTuner";
import ConsoleLogsWidget from "./ConsoleLogsWidget";
import { LayoutItem, ChartConfig } from "../hooks/useScopeLayout";

interface WorkspaceGridProps {
  dashboardLayout: LayoutItem[];
  isEditMode: boolean;
  isMobile: boolean;
  gridContainerRef: React.RefObject<HTMLDivElement | null>;
  editingCardId: string | null;
  editingTitleText: string;
  chartConfigs: ChartConfig[];
  tuningConstants: TunableConstant[];
  videoUrl: string | null;
  isStreaming: boolean;
  consoleLogs: any;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  setVideoUrl: (url: string | null) => void;
  setEditingTitleText: (text: string) => void;
  setEditingCardId: (id: string | null) => void;
  setDashboardLayout: React.Dispatch<React.SetStateAction<LayoutItem[]>>;
  setChartConfigs: React.Dispatch<React.SetStateAction<ChartConfig[]>>;
  setTuningConstants: React.Dispatch<React.SetStateAction<TunableConstant[]>>;
  handlePointerDown: (e: React.PointerEvent, id: string, type: "move" | "resize") => void;
  handlePointerMove: (e: React.PointerEvent) => void;
  handlePointerUp: (e: React.PointerEvent) => void;
  handleToggleFullscreen: (id: string) => void;
  handleSaveRename: (id: string) => void;
  handleStartRename: (id: string, title: string) => void;
  handleDuplicateChart: (id: string) => void;
  handleDeleteWidget: (id: string) => void;
  handleRemoveFromGroup: (groupId: string, childId: string) => void;
  handleAddToGroup: (groupId: string, childId: string) => void;
  handlePublishValue: (key: string, value: any, type: string) => void;
}

export default function WorkspaceGrid({
  dashboardLayout,
  isEditMode,
  isMobile,
  gridContainerRef,
  editingCardId,
  editingTitleText,
  chartConfigs,
  tuningConstants,
  videoUrl,
  isStreaming,
  consoleLogs,
  videoRef,
  setVideoUrl,
  setEditingTitleText,
  setEditingCardId,
  setDashboardLayout,
  setChartConfigs,
  setTuningConstants,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handleToggleFullscreen,
  handleSaveRename,
  handleStartRename,
  handleDuplicateChart,
  handleDeleteWidget,
  handleRemoveFromGroup,
  handleAddToGroup,
  handlePublishValue,
}: WorkspaceGridProps) {
  return (
    <div 
      ref={gridContainerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`transition-all duration-300 relative ${
        isMobile 
          ? "flex flex-col gap-6" 
          : "grid grid-cols-12 auto-rows-[110px] gap-6"
      } ${
        isEditMode && !isMobile
          ? "bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:calc(100%/12)_110px] rounded-2xl border border-white/5 p-4 min-h-[700px]"
          : ""
      }`}
    >
      {dashboardLayout
        .filter((item) => item.visible && !dashboardLayout.some(other => other.type === "group" && other.childrenIds?.includes(item.id)))
        .map((item) => {
          const cardStyle = isMobile
            ? {}
            : {
                gridColumnStart: (item.x ?? 0) + 1,
                gridColumnEnd: (item.x ?? 0) + 1 + (item.w ?? 4),
                gridRowStart: item.y ?? 1,
                gridRowEnd: (item.y ?? 1) + (item.h ?? 3),
              };

          return (
            <div
              key={item.id}
              id={`workspace-card-${item.id}`}
              style={cardStyle}
              className={`transition-all duration-300 relative flex flex-col group bg-obsidian-light rounded-2xl border overflow-hidden ${
                isEditMode 
                  ? "border-ares-gold/40 border-dashed hover:border-ares-gold" 
                  : "border-white/10"
              } ${isMobile ? "min-h-[350px]" : ""}`}
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
                <div className="flex items-center justify-between px-4 py-2 bg-black/55 border-b border-white/5 select-none text-[10px] uppercase font-bold text-marble/60 font-sans z-10 shrink-0">
                  <div className="flex items-center gap-2">
                    <div 
                      onPointerDown={(e) => handlePointerDown(e, item.id, "move")}
                      className="cursor-move text-ares-gold font-bold text-sm select-none" 
                      title="Drag to move panel"
                    >
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
                        className="bg-black/60 border border-white/20 text-white rounded px-2 py-0.5 text-[10px] font-bold uppercase focus:outline-none focus:border-ares-gold font-mono"
                      />
                    ) : (
                      <span 
                        onDoubleClick={() => handleStartRename(item.id, item.title)}
                        className="font-heading text-white cursor-pointer hover:text-ares-gold flex items-center gap-1.5 font-bold"
                        title="Double click to rename card"
                      >
                        {item.title}
                        <Edit3 size={8} className="text-marble/40" />
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
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

                    <button
                      onClick={() => handleDeleteWidget(item.id)}
                      className="text-ares-red hover:text-ares-red-light transition-colors cursor-pointer"
                      title="Delete panel"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              )}

              {/* Resize Handle for Edit Mode */}
              {isEditMode && !isMobile && (
                <div
                  onPointerDown={(e) => handlePointerDown(e, item.id, "resize")}
                  className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end text-marble/35 hover:text-ares-gold transition-colors select-none z-30 font-sans"
                  title="Drag to resize panel"
                >
                  ◢
                </div>
              )}

              {/* Card Body containing actual component */}
              <div className="flex-grow overflow-hidden relative">
                {item.type === "visualizer" && (
                  <div className={`flex flex-col gap-4 h-full ${videoUrl ? "overflow-y-auto" : "overflow-hidden"}`}>
                    <div className="flex-grow h-full w-full min-h-[200px]">
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
                
                {item.type === "logs" && <ConsoleLogsWidget showTitle={true} />}
                
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

                {item.type === "tuner" && (
                  <VariablesTuner
                    isStreaming={isStreaming}
                    onPublishValue={handlePublishValue}
                    savedConstants={tuningConstants}
                    onConstantsChange={(consts) => setTuningConstants(consts)}
                  />
                )}

                {item.type === "group" && (
                  <div className="flex flex-col h-full bg-obsidian-light p-4">
                    {/* Tabs list inside group */}
                    <div className="flex flex-wrap items-center gap-1.5 border-b border-white/5 pb-2 mb-2.5 shrink-0">
                      {(item.childrenIds || []).map(childId => {
                        const child = dashboardLayout.find(l => l.id === childId);
                        if (!child) return null;
                        const isActive = item.activeTabId === childId;
                        return (
                          <div 
                            key={childId}
                            className={`flex items-center gap-1 px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-lg transition-all border cursor-pointer font-heading ${
                              isActive
                                ? "bg-ares-gold/15 border-ares-gold/25 text-ares-gold"
                                : "bg-transparent border-transparent text-marble/55 hover:text-white"
                            }`}
                            onClick={() => {
                              setDashboardLayout(prev => prev.map(l => 
                                l.id === item.id ? { ...l, activeTabId: childId } : l
                              ));
                            }}
                          >
                            <span>{child.title}</span>
                            {isEditMode && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveFromGroup(item.id, childId);
                                }}
                                className="text-marble/35 hover:text-ares-red ml-1.5 transition-colors cursor-pointer"
                                title="Remove from group"
                              >
                                <X size={8} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                      
                      {/* Group editing: Add child dropdown */}
                      {isEditMode && (
                        <select
                          value=""
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                              handleAddToGroup(item.id, val);
                            }
                          }}
                          className="bg-black/60 border border-white/10 rounded px-1.5 py-0.5 text-[8px] text-marble/70 focus:outline-none font-bold cursor-pointer ml-auto font-heading"
                        >
                          <option value="">+ Add to Group</option>
                          {dashboardLayout
                            .filter(l => l.id !== item.id && l.visible && !dashboardLayout.some(other => other.type === "group" && other.childrenIds?.includes(l.id)))
                            .map(l => (
                              <option key={l.id} value={l.id} className="bg-neutral-900 text-white">{l.title}</option>
                            ))
                          }
                        </select>
                      )}
                    </div>

                    {/* Group tab content viewer */}
                    <div className="flex-grow overflow-hidden relative">
                      {(() => {
                        const activeChild = dashboardLayout.find(l => l.id === item.activeTabId);
                        if (!activeChild) {
                            return (
                              <div className="flex items-center justify-center h-full text-marble/30 text-[10px] font-heading uppercase tracking-widest text-center">
                                No widgets in group. Add one above.
                              </div>
                            );
                        }
                        
                        return (
                          <div className="h-full w-full overflow-hidden">
                            {activeChild.type === "visualizer" && (
                              <div className={`flex flex-col gap-4 h-full ${videoUrl ? "overflow-y-auto" : "overflow-hidden"}`}>
                                <div className="flex-grow h-full w-full min-h-[200px]">
                                  <WebGLReplayCanvas />
                                </div>
                                {videoUrl && (
                                  <div className="glass-card p-4 border border-white/10 flex flex-col gap-3 relative shrink-0">
                                    <button
                                      onClick={() => setVideoUrl(null)}
                                      className="absolute top-2 right-2 text-marble/40 hover:text-white cursor-pointer transition-colors"
                                    >
                                      <X size={14} />
                                    </button>
                                    <h3 className="text-[10px] font-black uppercase text-white tracking-widest font-heading border-b border-white/5 pb-2">
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
                            
                            {activeChild.type === "diagnostics" && <HealthDiagnostics />}
                            
                            {activeChild.type === "inspector" && <StateInspector />}
                            
                            {activeChild.type === "logs" && <ConsoleLogsWidget showTitle={false} />}
                            
                            {activeChild.type === "charts" && (
                              <TelemetryCharts 
                                chartId={activeChild.id}
                                selectedKeys={chartConfigs.find(c => c.id === activeChild.id)?.selectedKeys || []}
                                onToggleKey={(key) => {
                                  setChartConfigs(chartConfigs.map(c => {
                                    if (c.id === activeChild.id) {
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

                            {activeChild.type === "tuner" && (
                              <VariablesTuner
                                isStreaming={isStreaming}
                                onPublishValue={handlePublishValue}
                                savedConstants={tuningConstants}
                                onConstantsChange={(consts) => setTuningConstants(consts)}
                              />
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
