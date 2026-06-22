import React from "react";
import { ChevronUp, ChevronDown, Compass, Plus, Trash2 } from "lucide-react";
import { ConstraintZone } from "../../types/planner";

interface ConstraintZonesAccordionProps {
  constraintZones: ConstraintZone[];
  selectedConstraintZoneId: string | null;
  setSelectedConstraintZoneId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedWaypointIdx: React.Dispatch<React.SetStateAction<number | null>>;
  setSelectedMarkerId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedRotationTargetId: React.Dispatch<React.SetStateAction<string | null>>;
  handleAddConstraintZone: () => void;
  handleUpdateConstraintZone: (id: string, updates: Partial<ConstraintZone>) => void;
  handleDeleteConstraintZone: (id: string) => void;
  unitMode: "inches" | "meters";
  isPointZonesExpanded: boolean;
  setIsPointZonesExpanded: (val: boolean) => void;
}

export function ConstraintZonesAccordion({
  constraintZones,
  selectedConstraintZoneId,
  setSelectedConstraintZoneId,
  setSelectedWaypointIdx,
  setSelectedMarkerId,
  setSelectedRotationTargetId,
  handleAddConstraintZone,
  handleUpdateConstraintZone,
  handleDeleteConstraintZone,
  unitMode,
  isPointZonesExpanded,
  setIsPointZonesExpanded,
}: ConstraintZonesAccordionProps) {
  return (
    <div className="bg-black/20 border border-white/5 rounded-xl overflow-hidden shadow-lg">
      <div
        onClick={() => setIsPointZonesExpanded(!isPointZonesExpanded)}
        className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 cursor-pointer border-b border-white/5 transition-all select-none"
      >
        <div className="flex items-center gap-2">
          {isPointZonesExpanded ? (
            <ChevronUp size={14} className="text-ares-gold" />
          ) : (
            <ChevronDown size={14} className="text-marble/40" />
          )}
          <Compass size={14} className="text-ares-gold" />
          <span className="text-xs font-black uppercase tracking-wider text-white">
            Constraint Zones
          </span>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <span className="bg-ares-gold/15 border border-ares-gold/35 text-ares-gold text-[9px] font-mono px-2 py-0.5 rounded-full font-bold">
            {constraintZones.length}
          </span>
          <button
            onClick={handleAddConstraintZone}
            className="p-1 hover:bg-white/10 rounded text-marble/60 hover:text-white cursor-pointer"
            title="Add constraint zone"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {isPointZonesExpanded && (
        <div className="p-3 flex flex-col gap-2 max-h-[300px] overflow-y-auto bg-black/5">
          {constraintZones.map((zone) => {
            const isSelected = selectedConstraintZoneId === zone.id;
            return (
              <div
                key={zone.id}
                className={`border rounded-lg overflow-hidden transition-all duration-300 ${
                  isSelected
                    ? "bg-ares-gold/[0.02] border-ares-gold/45"
                    : "bg-obsidian/30 border-white/5 hover:border-white/15"
                }`}
              >
                {/* Zone Header */}
                <div
                  onClick={() => {
                    setSelectedConstraintZoneId(zone.id);
                    setSelectedWaypointIdx(null);
                    setSelectedMarkerId(null);
                    setSelectedRotationTargetId(null);
                  }}
                  className="flex items-center justify-between px-3 py-2 cursor-pointer bg-white/[0.01] hover:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-2 flex-grow">
                    <input
                      type="text"
                      value={zone.name}
                      onChange={(e) => handleUpdateConstraintZone(zone.id, { name: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-transparent text-white font-bold text-xs focus:outline-none border-b border-transparent focus:border-ares-gold py-0.5"
                    />
                    <span className="text-[10px] text-marble/30 font-mono font-bold">
                      ({zone.maxVelocity.toFixed(1)} m/s)
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConstraintZone(zone.id);
                    }}
                    className="p-1 hover:bg-ares-red/10 rounded text-marble/30 hover:text-ares-danger cursor-pointer"
                    title="Delete zone"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Zone Content */}
                {isSelected && (
                  <div className="p-3 border-t border-white/5 bg-black/20 flex flex-col gap-2.5 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      {/* Max Velocity */}
                      <div className="flex flex-col gap-1 col-span-2">
                        <label htmlFor={`zone-speed-${zone.id}`} className="text-[8px] font-mono uppercase text-marble/40 block">
                          Max Speed Limit (m/s)
                        </label>
                        <input
                          id={`zone-speed-${zone.id}`}
                          type="number"
                          step="0.1"
                          value={zone.maxVelocity}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              handleUpdateConstraintZone(zone.id, { maxVelocity: val });
                            }
                          }}
                          className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-gold"
                        />
                      </div>

                      {/* Center X */}
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`zone-x-${zone.id}`} className="text-[8px] font-mono uppercase text-marble/40 block">
                          Center X ({unitMode === "meters" ? "M" : "In"})
                        </label>
                        <input
                          id={`zone-x-${zone.id}`}
                          type="number"
                          step="0.1"
                          value={parseFloat((unitMode === "meters" ? zone.x * 0.0254 : zone.x).toFixed(2))}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              handleUpdateConstraintZone(zone.id, {
                                x: unitMode === "meters" ? val / 0.0254 : val,
                              });
                            }
                          }}
                          className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-gold"
                        />
                      </div>

                      {/* Center Y */}
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`zone-y-${zone.id}`} className="text-[8px] font-mono uppercase text-marble/40 block">
                          Center Y ({unitMode === "meters" ? "M" : "In"})
                        </label>
                        <input
                          id={`zone-y-${zone.id}`}
                          type="number"
                          step="0.1"
                          value={parseFloat((unitMode === "meters" ? zone.y * 0.0254 : zone.y).toFixed(2))}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              handleUpdateConstraintZone(zone.id, {
                                y: unitMode === "meters" ? val / 0.0254 : val,
                              });
                            }
                          }}
                          className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-gold"
                        />
                      </div>

                      {/* Width */}
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`zone-w-${zone.id}`} className="text-[8px] font-mono uppercase text-marble/40 block">
                          Width ({unitMode === "meters" ? "M" : "In"})
                        </label>
                        <input
                          id={`zone-w-${zone.id}`}
                          type="number"
                          step="0.1"
                          value={parseFloat((unitMode === "meters" ? zone.width * 0.0254 : zone.width).toFixed(2))}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              handleUpdateConstraintZone(zone.id, {
                                width: unitMode === "meters" ? val / 0.0254 : val,
                              });
                            }
                          }}
                          className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-gold"
                        />
                      </div>

                      {/* Height */}
                      <div className="flex flex-col gap-1">
                        <label htmlFor={`zone-h-${zone.id}`} className="text-[8px] font-mono uppercase text-marble/40 block">
                          Height ({unitMode === "meters" ? "M" : "In"})
                        </label>
                        <input
                          id={`zone-h-${zone.id}`}
                          type="number"
                          step="0.1"
                          value={parseFloat((unitMode === "meters" ? zone.height * 0.0254 : zone.height).toFixed(2))}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              handleUpdateConstraintZone(zone.id, {
                                height: unitMode === "meters" ? val / 0.0254 : val,
                              });
                            }
                          }}
                          className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-gold"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {constraintZones.length === 0 && (
            <p className="text-[10px] font-mono text-marble/30 text-center italic py-2">
              No constraint zones configured.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
export default ConstraintZonesAccordion;
