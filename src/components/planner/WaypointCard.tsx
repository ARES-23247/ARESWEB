import React from "react";
import { Lock, Unlock, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Waypoint } from "../../types/planner";

interface WaypointCardProps {
  idx: number;
  wp: Waypoint;
  waypointsLength: number;
  isExpanded: boolean;
  isSelected: boolean;
  isLocked: boolean;
  unitMode: "inches" | "meters";
  onSelect: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
  onUpdateAnchor: (field: "x" | "y", valStr: string) => void;
  onUpdateHeading: (valStr: string) => void;
  onUpdateControlLength: (type: "prev" | "next", newLenStr: string) => void;
  headingDegrees: number;
  prevControlLength: number;
  nextControlLength: number;
}

export function WaypointCard({
  idx,
  wp,
  waypointsLength,
  isExpanded,
  isSelected,
  isLocked,
  unitMode,
  onSelect,
  onToggleLock,
  onDelete,
  onUpdateAnchor,
  onUpdateHeading,
  onUpdateControlLength,
  headingDegrees,
  prevControlLength,
  nextControlLength,
}: WaypointCardProps) {
  const label =
    idx === 0 ? "Start Point" : idx === waypointsLength - 1 ? "End Point" : `Waypoint ${idx + 1}`;

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all duration-300 ${
        isSelected
          ? "bg-ares-red/5 border-ares-red/45"
          : "bg-obsidian/30 border-white/5 hover:border-white/15"
      }`}
    >
      {/* Waypoint Card Header */}
      <div
        onClick={onSelect}
        className="flex items-center justify-between px-3 py-2 cursor-pointer bg-white/[0.01] hover:bg-white/[0.04] select-none"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronUp size={11} className="text-marble/60" />
          ) : (
            <ChevronDown size={11} className="text-marble/35" />
          )}
          <span className="text-xs font-bold text-white/90">{label}</span>
        </div>

        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onToggleLock}
            className={`p-1 rounded cursor-pointer transition-colors ${
              isLocked
                ? "text-ares-red bg-ares-red/10 hover:bg-ares-red/20"
                : "text-marble/40 hover:bg-white/5 hover:text-white"
            }`}
            title={isLocked ? "Unlock waypoint" : "Lock waypoint"}
          >
            {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
          </button>
          <button
            onClick={onDelete}
            disabled={waypointsLength <= 2 || isLocked}
            className="p-1 hover:bg-ares-red/10 rounded text-marble/30 hover:text-ares-danger disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="Delete waypoint"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Waypoint Card Content */}
      {isExpanded && (
        <div className="p-3 border-t border-white/5 bg-black/20 flex flex-col gap-2.5">
          <div className="grid grid-cols-3 gap-2">
            {/* X Position */}
            <div className="flex flex-col gap-1">
              <label htmlFor={`wp-x-${idx}`} className="text-[8px] font-mono uppercase text-marble/40 block">
                X Position ({unitMode === "meters" ? "M" : "In"})
              </label>
              <input
                id={`wp-x-${idx}`}
                type="number"
                step="0.001"
                value={parseFloat((unitMode === "meters" ? wp.anchor.x * 0.0254 : wp.anchor.x).toFixed(3))}
                onChange={(e) => onUpdateAnchor("x", e.target.value)}
                className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-red"
              />
            </div>
            {/* Y Position */}
            <div className="flex flex-col gap-1">
              <label htmlFor={`wp-y-${idx}`} className="text-[8px] font-mono uppercase text-marble/40 block">
                Y Position ({unitMode === "meters" ? "M" : "In"})
              </label>
              <input
                id={`wp-y-${idx}`}
                type="number"
                step="0.001"
                value={parseFloat((unitMode === "meters" ? wp.anchor.y * 0.0254 : wp.anchor.y).toFixed(3))}
                onChange={(e) => onUpdateAnchor("y", e.target.value)}
                className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-red"
              />
            </div>
            {/* Tangent Heading */}
            <div className="flex flex-col gap-1">
              <label htmlFor={`wp-heading-${idx}`} className="text-[8px] font-mono uppercase text-marble/40 block">
                Heading (Deg)
              </label>
              <input
                id={`wp-heading-${idx}`}
                type="number"
                step="0.1"
                value={parseFloat(headingDegrees.toFixed(1))}
                onChange={(e) => onUpdateHeading(e.target.value)}
                className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-red"
              />
            </div>
          </div>

          {/* Control Tangent Lengths */}
          {(wp.prevControl || wp.nextControl) && (
            <div className="flex flex-col gap-2 border-t border-white/[0.04] pt-2">
              {wp.prevControl && (
                <div className="flex flex-col gap-1">
                  <label htmlFor={`wp-prev-len-${idx}`} className="text-[8px] font-mono uppercase text-marble/40 block">
                    Prev Control Length ({unitMode === "meters" ? "M" : "In"})
                  </label>
                  <input
                    id={`wp-prev-len-${idx}`}
                    type="number"
                    step="0.001"
                    value={parseFloat(prevControlLength.toFixed(3))}
                    onChange={(e) => onUpdateControlLength("prev", e.target.value)}
                    className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-red"
                  />
                </div>
              )}
              {wp.nextControl && (
                <div className="flex flex-col gap-1">
                  <label htmlFor={`wp-next-len-${idx}`} className="text-[8px] font-mono uppercase text-marble/40 block">
                    Next Control Length ({unitMode === "meters" ? "M" : "In"})
                  </label>
                  <input
                    id={`wp-next-len-${idx}`}
                    type="number"
                    step="0.001"
                    value={parseFloat(nextControlLength.toFixed(3))}
                    onChange={(e) => onUpdateControlLength("next", e.target.value)}
                    className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-red"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default WaypointCard;
