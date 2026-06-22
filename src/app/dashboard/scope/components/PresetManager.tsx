"use client";

import React from "react";
import { 
  Layout, 
  Trash2, 
  RotateCcw, 
  Download, 
  Upload, 
  Save 
} from "lucide-react";
import { DashboardPreset } from "../hooks/useScopeLayout";

interface PresetManagerProps {
  activePresetId: string;
  cloudPresets: DashboardPreset[];
  isEditMode: boolean;
  handleResetLayout: () => void;
  handleLoadPreset: (presetId: string) => void;
  handleDeletePresetFromCloud: (preset: DashboardPreset, e: React.MouseEvent) => void;
  handleAddWidget: (type: any) => void;
  handleExportLayout: () => void;
  handleImportLayout: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setShowSavePresetModal: (show: boolean) => void;
  setIsEditMode: (edit: boolean) => void;
}

export default function PresetManager({
  activePresetId,
  cloudPresets,
  isEditMode,
  handleResetLayout,
  handleLoadPreset,
  handleDeletePresetFromCloud,
  handleAddWidget,
  handleExportLayout,
  handleImportLayout,
  setShowSavePresetModal,
  setIsEditMode,
}: PresetManagerProps) {
  return (
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
            <div className="flex items-center bg-black/55 border border-white/10 px-3 py-2 rounded-xl text-xs gap-2">
              <span className="text-[10px] uppercase font-black tracking-widest text-marble/55 font-heading">Add Widget:</span>
              <select
                value=""
                onChange={(e) => {
                  const val = e.target.value as any;
                  if (val) {
                    handleAddWidget(val);
                  }
                }}
                className="bg-transparent text-white focus:outline-none font-bold uppercase cursor-pointer text-[10px]"
              >
                <option value="" className="bg-neutral-900 text-marble/40">Choose...</option>
                <option value="visualizer" className="bg-neutral-900 text-white">3D Field Visualizer</option>
                <option value="diagnostics" className="bg-neutral-900 text-white">Health & Diagnostics</option>
                <option value="inspector" className="bg-neutral-900 text-white">State Inspector</option>
                <option value="logs" className="bg-neutral-900 text-white">System Console Logs</option>
                <option value="charts" className="bg-neutral-900 text-white">Telemetry Chart</option>
                <option value="tuner" className="bg-neutral-900 text-white">Variables Tuner</option>
                <option value="group" className="bg-neutral-900 text-white">Widget Tab Group</option>
              </select>
            </div>

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
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".json";
                input.onchange = (e) => handleImportLayout(e as any);
                input.click();
              }}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/5 text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer flex items-center gap-1.5 transition-all duration-300 font-bold"
            >
              <Upload size={12} /> Import Layout
            </button>

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
  );
}
