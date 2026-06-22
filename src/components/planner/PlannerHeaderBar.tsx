import React from "react";
import { Compass, Maximize2, Minimize2 } from "lucide-react";

interface PlannerHeaderBarProps {
  pathName: string;
  setPathName: (name: string) => void;
  originMode: "center" | "corner";
  setOriginMode: (mode: "center" | "corner") => void;
  unitMode: "inches" | "meters";
  setUnitMode: (mode: "inches" | "meters") => void;
  isZenMode: boolean;
  setIsZenMode: (zen: boolean) => void;
}

export function PlannerHeaderBar({
  pathName,
  setPathName,
  originMode,
  setOriginMode,
  unitMode,
  setUnitMode,
  isZenMode,
  setIsZenMode,
}: PlannerHeaderBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
      <div className="flex items-center gap-3">
        <Compass
          className="text-ares-gold w-8 h-8 shrink-0 animate-spin"
          style={{ animationDuration: "15s" }}
        />
        <div>
          <input
            type="text"
            value={pathName}
            onChange={(e) => setPathName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
            className="bg-transparent text-white font-heading font-black text-lg uppercase tracking-wider border-b border-white/10 focus:border-ares-cyan focus:outline-none w-48"
            title="Name of the path file"
          />
          <p className="text-[10px] text-marble/40 font-mono mt-1">FTC Cubic Bezier Spline Editor</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Origin Mode Toggle */}
        <button
          onClick={() => setOriginMode(originMode === "corner" ? "center" : "corner")}
          className="px-2.5 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-white font-bold rounded border border-white/10 cursor-pointer uppercase tracking-wider"
        >
          Origin: {originMode === "corner" ? "Corner (0,0)" : "Center (0,0)"}
        </button>

        {/* Unit Toggle */}
        <button
          onClick={() => setUnitMode(unitMode === "inches" ? "meters" : "inches")}
          className="px-2.5 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-white font-bold rounded border border-white/10 cursor-pointer uppercase tracking-wider"
        >
          Units: {unitMode === "inches" ? "Inches" : "Meters"}
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={() => setIsZenMode(!isZenMode)}
          className="px-2.5 py-1 text-[10px] bg-white/5 hover:bg-white/10 text-white font-bold rounded border border-white/10 cursor-pointer uppercase tracking-wider flex items-center gap-1.5"
        >
          {isZenMode ? (
            <>
              <Minimize2 size={12} /> Standard View
            </>
          ) : (
            <>
              <Maximize2 size={12} /> Fullscreen
            </>
          )}
        </button>
      </div>
    </div>
  );
}
export default PlannerHeaderBar;
