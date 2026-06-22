import React from "react";
import { ChevronUp, ChevronDown, Compass, Plus } from "lucide-react";
import { Waypoint } from "../../types/planner";
import WaypointCard from "./WaypointCard";

interface WaypointsAccordionProps {
  waypoints: Waypoint[];
  expandedWaypoints: Record<number, boolean>;
  setExpandedWaypoints: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  selectedWaypointIdx: number | null;
  setSelectedWaypointIdx: React.Dispatch<React.SetStateAction<number | null>>;
  setSelectedMarkerId: React.Dispatch<React.SetStateAction<string | null>>;
  lockedWaypoints: Record<number, boolean>;
  toggleLockWaypoint: (idx: number) => void;
  handleDeleteWaypoint: (idx: number) => void;
  handleAddWaypoint: () => void;
  unitMode: "inches" | "meters";
  handleUpdateWaypointAnchor: (idx: number, field: "x" | "y", valStr: string) => void;
  handleUpdateWaypointHeading: (idx: number, valStr: string) => void;
  handleUpdateControlLength: (idx: number, type: "prev" | "next", newLenStr: string) => void;
  getWaypointHeadingDegrees: (idx: number) => number;
  getControlLength: (idx: number, type: "prev" | "next") => number;
  isWaypointsExpanded: boolean;
  setIsWaypointsExpanded: (val: boolean) => void;
}

export function WaypointsAccordion({
  waypoints,
  expandedWaypoints,
  setExpandedWaypoints,
  selectedWaypointIdx,
  setSelectedWaypointIdx,
  setSelectedMarkerId,
  lockedWaypoints,
  toggleLockWaypoint,
  handleDeleteWaypoint,
  handleAddWaypoint,
  unitMode,
  handleUpdateWaypointAnchor,
  handleUpdateWaypointHeading,
  handleUpdateControlLength,
  getWaypointHeadingDegrees,
  getControlLength,
  isWaypointsExpanded,
  setIsWaypointsExpanded,
}: WaypointsAccordionProps) {
  return (
    <div className="bg-black/20 border border-white/5 rounded-xl overflow-hidden shadow-lg">
      <div
        onClick={() => setIsWaypointsExpanded(!isWaypointsExpanded)}
        className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 cursor-pointer border-b border-white/5 transition-all select-none"
      >
        <div className="flex items-center gap-2">
          {isWaypointsExpanded ? (
            <ChevronUp size={14} className="text-ares-cyan" />
          ) : (
            <ChevronDown size={14} className="text-marble/40" />
          )}
          <Compass size={14} className="text-ares-cyan" />
          <span className="text-xs font-black uppercase tracking-wider text-white">Waypoints</span>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <span className="bg-ares-cyan/15 border border-ares-cyan/35 text-ares-cyan text-[9px] font-mono px-2 py-0.5 rounded-full font-bold">
            {waypoints.length}
          </span>
          <button
            onClick={handleAddWaypoint}
            className="p-1 hover:bg-white/10 rounded text-marble/60 hover:text-white cursor-pointer"
            title="Add waypoint"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {isWaypointsExpanded && (
        <div className="p-3 flex flex-col gap-2 max-h-[360px] overflow-y-auto">
          {waypoints.map((wp, idx) => {
            const isExpanded = !!expandedWaypoints[idx];
            const isSelected = selectedWaypointIdx === idx;

            return (
              <WaypointCard
                key={idx}
                idx={idx}
                wp={wp}
                waypointsLength={waypoints.length}
                isExpanded={isExpanded}
                isSelected={isSelected}
                isLocked={!!lockedWaypoints[idx]}
                unitMode={unitMode}
                onSelect={() => {
                  setSelectedWaypointIdx(idx);
                  setSelectedMarkerId(null);
                  setExpandedWaypoints((prev) => ({ ...prev, [idx]: !prev[idx] }));
                }}
                onToggleLock={() => toggleLockWaypoint(idx)}
                onDelete={() => handleDeleteWaypoint(idx)}
                onUpdateAnchor={(field, valStr) => handleUpdateWaypointAnchor(idx, field, valStr)}
                onUpdateHeading={(valStr) => handleUpdateWaypointHeading(idx, valStr)}
                onUpdateControlLength={(type, newLenStr) =>
                  handleUpdateControlLength(idx, type, newLenStr)
                }
                headingDegrees={getWaypointHeadingDegrees(idx)}
                prevControlLength={getControlLength(idx, "prev")}
                nextControlLength={getControlLength(idx, "next")}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
export default WaypointsAccordion;
