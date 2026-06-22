import React from "react";
import { ChevronUp, ChevronDown, Compass, Plus, Trash2 } from "lucide-react";
import { RotationTarget, Waypoint } from "../../types/planner";

interface RotationTargetsAccordionProps {
  rotationTargets: RotationTarget[];
  selectedRotationTargetId: string | null;
  setSelectedRotationTargetId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedWaypointIdx: React.Dispatch<React.SetStateAction<number | null>>;
  setSelectedMarkerId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedConstraintZoneId: React.Dispatch<React.SetStateAction<string | null>>;
  handleAddRotationTarget: () => void;
  handleUpdateRotationTarget: (id: string, updates: Partial<RotationTarget>) => void;
  handleDeleteRotationTarget: (id: string) => void;
  waypoints: Waypoint[];
  unitMode: "inches" | "meters";
  isRotationExpanded: boolean;
  setIsRotationExpanded: (val: boolean) => void;
}

export function RotationTargetsAccordion({
  rotationTargets,
  selectedRotationTargetId,
  setSelectedRotationTargetId,
  setSelectedWaypointIdx,
  setSelectedMarkerId,
  setSelectedConstraintZoneId,
  handleAddRotationTarget,
  handleUpdateRotationTarget,
  handleDeleteRotationTarget,
  waypoints,
  unitMode,
  isRotationExpanded,
  setIsRotationExpanded,
}: RotationTargetsAccordionProps) {
  return (
    <div className="bg-black/20 border border-white/5 rounded-xl overflow-hidden shadow-lg">
      <div
        onClick={() => setIsRotationExpanded(!isRotationExpanded)}
        className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 cursor-pointer border-b border-white/5 transition-all select-none"
      >
        <div className="flex items-center gap-2">
          {isRotationExpanded ? (
            <ChevronUp size={14} className="text-purple-400" />
          ) : (
            <ChevronDown size={14} className="text-marble/40" />
          )}
          <Compass size={14} className="text-purple-400" />
          <span className="text-xs font-black uppercase tracking-wider text-white">
            Rotation Targets
          </span>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <span className="bg-purple-500/15 border border-purple-500/35 text-purple-400 text-[9px] font-mono px-2 py-0.5 rounded-full font-bold">
            {rotationTargets.length}
          </span>
          <button
            onClick={handleAddRotationTarget}
            className="p-1 hover:bg-white/10 rounded text-marble/60 hover:text-white cursor-pointer"
            title="Add rotation target"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {isRotationExpanded && (
        <div className="p-3 flex flex-col gap-2 max-h-[300px] overflow-y-auto bg-black/5">
          {rotationTargets.map((rot) => {
            const isSelected = selectedRotationTargetId === rot.id;
            return (
              <div
                key={rot.id}
                className={`border rounded-lg overflow-hidden transition-all duration-300 ${
                  isSelected
                    ? "bg-purple-500/[0.02] border-purple-500/45"
                    : "bg-obsidian/30 border-white/5 hover:border-white/15"
                }`}
              >
                {/* Target Header */}
                <div
                  onClick={() => {
                    setSelectedRotationTargetId(rot.id);
                    setSelectedWaypointIdx(null);
                    setSelectedMarkerId(null);
                    setSelectedConstraintZoneId(null);
                  }}
                  className="flex items-center justify-between px-3 py-2 cursor-pointer bg-white/[0.01] hover:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-2 flex-grow">
                    <input
                      type="text"
                      value={rot.name}
                      onChange={(e) => handleUpdateRotationTarget(rot.id, { name: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-transparent text-white font-bold text-xs focus:outline-none border-b border-transparent focus:border-purple-400 py-0.5"
                    />
                    <span className="text-[10px] text-marble/30 font-mono">
                      (WP {rot.waypointIndex + 1})
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRotationTarget(rot.id);
                    }}
                    className="p-1 hover:bg-ares-red/10 rounded text-marble/30 hover:text-ares-danger cursor-pointer"
                    title="Delete target"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Target Content */}
                {isSelected && (
                  <div className="p-3 border-t border-white/5 bg-black/20 flex flex-col gap-2.5 text-marble">
                    <div className="grid grid-cols-2 gap-2">
                      {/* Linked Waypoint */}
                      <div className="flex flex-col gap-1 col-span-2">
                        <label htmlFor={`rot-wp-link-${rot.id}`} className="text-[8px] font-mono uppercase text-marble/40 block">
                          Link to Waypoint
                        </label>
                        <select
                          id={`rot-wp-link-${rot.id}`}
                          value={rot.waypointIndex}
                          onChange={(e) =>
                            handleUpdateRotationTarget(rot.id, { waypointIndex: parseInt(e.target.value) })
                          }
                          className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none"
                        >
                          {waypoints.map((_, wIdx) => (
                            <option key={wIdx} value={wIdx} className="bg-neutral-900">
                              {wIdx === 0
                                ? "Start Point"
                                : wIdx === waypoints.length - 1
                                ? "End Point"
                                : `Waypoint ${wIdx + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Target X */}
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`rot-x-${rot.id}`} className="text-[8px] font-mono uppercase text-marble/40 block">
                          Target X ({unitMode === "meters" ? "M" : "In"})
                        </label>
                        <input
                          id={`rot-x-${rot.id}`}
                          type="number"
                          step="0.01"
                          value={parseFloat((unitMode === "meters" ? rot.x * 0.0254 : rot.x).toFixed(2))}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              handleUpdateRotationTarget(rot.id, {
                                x: unitMode === "meters" ? val / 0.0254 : val,
                              });
                            }
                          }}
                          className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-purple-400"
                        />
                      </div>

                      {/* Target Y */}
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`rot-y-${rot.id}`} className="text-[8px] font-mono uppercase text-marble/40 block">
                          Target Y ({unitMode === "meters" ? "M" : "In"})
                        </label>
                        <input
                          id={`rot-y-${rot.id}`}
                          type="number"
                          step="0.01"
                          value={parseFloat((unitMode === "meters" ? rot.y * 0.0254 : rot.y).toFixed(2))}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              handleUpdateRotationTarget(rot.id, {
                                y: unitMode === "meters" ? val / 0.0254 : val,
                              });
                            }
                          }}
                          className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-purple-400"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {rotationTargets.length === 0 && (
            <p className="text-[10px] font-mono text-marble/30 text-center italic py-2">
              No rotation targets defined.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
export default RotationTargetsAccordion;
