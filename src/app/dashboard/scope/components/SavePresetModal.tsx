import React from "react";
import { Save, X, RefreshCw } from "lucide-react";

interface SavePresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  newPresetName: string;
  setNewPresetName: (name: string) => void;
  isSharedToggle: boolean;
  setIsSharedToggle: (val: boolean) => void;
  savingPreset: boolean;
  handleSavePreset: () => void;
}

export default function SavePresetModal({
  isOpen,
  onClose,
  newPresetName,
  setNewPresetName,
  isSharedToggle,
  setIsSharedToggle,
  savingPreset,
  handleSavePreset
}: SavePresetModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/70 backdrop-blur-md transition-all duration-300">
      <div className="glass-card border border-white/10 bg-neutral-950 p-6 max-w-sm w-full rounded-2xl flex flex-col gap-5 shadow-2xl relative focus:outline-none">
        <button
          onClick={onClose}
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
            onClick={onClose}
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
  );
}
