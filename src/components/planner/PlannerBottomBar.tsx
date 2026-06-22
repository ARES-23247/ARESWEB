import React from "react";
import { Play, Pause, Upload, Download } from "lucide-react";

interface PlannerBottomBarProps {
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  handleImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleExportJSON: () => void;
}

export function PlannerBottomBar({
  isPlaying,
  setIsPlaying,
  handleImportJSON,
  handleExportJSON,
}: PlannerBottomBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 bg-black/20 p-4 rounded-xl border border-white/5 mt-2">
      <div className="flex items-center gap-2">
        <Play size={14} className="text-ares-gold" />
        <span className="text-[10px] uppercase font-bold text-marble/60 tracking-wider">
          Trajectory Spline Simulator
        </span>
      </div>

      <div className="flex items-center gap-2">
        <label
          htmlFor="import-path-file-input"
          className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 text-xs font-bold rounded transition-all cursor-pointer flex items-center gap-1.5 select-none"
        >
          <Upload size={12} /> Import Path
          <input
            id="import-path-file-input"
            type="file"
            accept=".json"
            onChange={handleImportJSON}
            className="hidden"
          />
        </label>

        <button
          onClick={handleExportJSON}
          className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 text-xs font-bold rounded transition-all cursor-pointer flex items-center gap-1.5"
        >
          <Download size={12} /> Export Path
        </button>

        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`px-5 py-2 text-xs font-bold rounded uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
            isPlaying
              ? "bg-white/10 text-white hover:bg-white/20 border border-white/20"
              : "bg-ares-red hover:bg-ares-red-dark text-white shadow-md transform hover:-translate-y-0.5"
          }`}
        >
          {isPlaying ? (
            <>
              <Pause size={12} /> Stop Sim
            </>
          ) : (
            <>
              <Play size={12} /> Run Follower
            </>
          )}
        </button>
      </div>
    </div>
  );
}
export default PlannerBottomBar;
