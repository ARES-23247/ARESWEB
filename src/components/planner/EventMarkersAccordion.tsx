import React from "react";
import { ChevronUp, ChevronDown, Settings, Plus, Trash2 } from "lucide-react";
import { EventMarker } from "../../types/planner";

interface EventMarkersAccordionProps {
  markers: EventMarker[];
  selectedMarkerId: string | null;
  setSelectedMarkerId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedWaypointIdx: React.Dispatch<React.SetStateAction<number | null>>;
  setSelectedRotationTargetId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedConstraintZoneId: React.Dispatch<React.SetStateAction<string | null>>;
  handleDeleteMarker: (id: string) => void;
  handleUpdateMarker: (id: string, updates: Partial<EventMarker>) => void;
  handleTriggerAddMarker: () => void;
  isEventsExpanded: boolean;
  setIsEventsExpanded: (val: boolean) => void;
}

export function EventMarkersAccordion({
  markers,
  selectedMarkerId,
  setSelectedMarkerId,
  setSelectedWaypointIdx,
  setSelectedRotationTargetId,
  setSelectedConstraintZoneId,
  handleDeleteMarker,
  handleUpdateMarker,
  handleTriggerAddMarker,
  isEventsExpanded,
  setIsEventsExpanded,
}: EventMarkersAccordionProps) {
  return (
    <div className="bg-black/20 border border-white/5 rounded-xl overflow-hidden shadow-lg">
      <div
        onClick={() => setIsEventsExpanded(!isEventsExpanded)}
        className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 cursor-pointer border-b border-white/5 transition-all select-none"
      >
        <div className="flex items-center gap-2">
          {isEventsExpanded ? (
            <ChevronUp size={14} className="text-ares-gold" />
          ) : (
            <ChevronDown size={14} className="text-marble/40" />
          )}
          <Settings size={14} className="text-ares-gold" />
          <span className="text-xs font-black uppercase tracking-wider text-white">
            Event Markers
          </span>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <span className="bg-ares-gold/15 border border-ares-gold/35 text-ares-gold text-[9px] font-mono px-2 py-0.5 rounded-full font-bold">
            {markers.length}
          </span>
          <button
            onClick={handleTriggerAddMarker}
            className="p-1 hover:bg-white/10 rounded text-marble/60 hover:text-white cursor-pointer"
            title="Add event marker"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      {isEventsExpanded && (
        <div className="p-3 flex flex-col gap-2 max-h-[300px] overflow-y-auto">
          {markers.map((marker) => {
            const isSelected = selectedMarkerId === marker.id;
            return (
              <div
                key={marker.id}
                className={`border rounded-lg overflow-hidden transition-all duration-300 ${
                  isSelected
                    ? "bg-ares-gold/[0.02] border-ares-gold/45"
                    : "bg-obsidian/30 border-white/5 hover:border-white/15"
                }`}
              >
                {/* Event Card Header */}
                <div
                  onClick={() => {
                    setSelectedMarkerId(marker.id);
                    setSelectedWaypointIdx(null);
                    setSelectedRotationTargetId(null);
                    setSelectedConstraintZoneId(null);
                  }}
                  className="flex items-center justify-between px-3 py-2 cursor-pointer bg-white/[0.01] hover:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-2 flex-grow">
                    <input
                      type="text"
                      value={marker.name}
                      onChange={(e) => handleUpdateMarker(marker.id, { name: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-transparent text-white font-bold text-xs focus:outline-none border-b border-transparent focus:border-ares-cyan py-0.5"
                    />
                    <span className="text-[10px] text-marble/30 font-mono">
                      ({Math.round(marker.progress * 100)}%)
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteMarker(marker.id);
                    }}
                    className="p-1 hover:bg-ares-red/10 rounded text-marble/30 hover:text-ares-danger cursor-pointer"
                    title="Delete marker"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Event Card Content */}
                {isSelected && (
                  <div className="p-3 border-t border-white/5 bg-black/20 flex flex-col gap-3 text-xs">
                    {/* Zoned Event Checkbox */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`zoned-${marker.id}`}
                        className="accent-ares-gold h-3.5 w-3.5 border border-white/20 bg-obsidian rounded cursor-pointer"
                      />
                      <label
                        htmlFor={`zoned-${marker.id}`}
                        className="text-[10px] uppercase font-mono text-marble/50 cursor-pointer select-none"
                      >
                        Zoned Event
                      </label>
                    </div>

                    {/* Position slider */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-[9px] uppercase font-mono text-marble/40">
                        <span>Position</span>
                        <span className="font-bold text-white">{marker.progress.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={Math.round(marker.progress * 100)}
                          onChange={(e) =>
                            handleUpdateMarker(marker.id, { progress: parseInt(e.target.value) / 100 })
                          }
                          className="flex-grow accent-ares-gold h-1 rounded-full cursor-ew-resize bg-black/40"
                        />
                        <span className="bg-obsidian border border-white/10 px-2 py-0.5 rounded font-mono text-[10px] text-white">
                          {marker.progress.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Actions Queue */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[8px] font-mono uppercase text-marble/40 block">
                        Actions Queue
                      </label>
                      <div className="flex flex-wrap gap-1 bg-obsidian/45 border border-white/5 p-2 rounded min-h-[40px]">
                        {marker.actions.map((act, aIdx) => (
                          <span
                            key={aIdx}
                            className="bg-ares-gold/10 text-ares-gold text-[9px] font-mono font-bold px-2 py-0.5 rounded border border-ares-gold/20 flex items-center gap-1 select-none"
                          >
                            {act}
                            <span
                              onClick={() =>
                                handleUpdateMarker(marker.id, {
                                  actions: marker.actions.filter((_, idx) => idx !== aIdx),
                                })
                              }
                              className="text-white hover:text-ares-red cursor-pointer font-sans font-black ml-1 text-[8px]"
                            >
                              ×
                            </span>
                          </span>
                        ))}
                        {marker.actions.length === 0 && (
                          <span className="text-[10px] text-marble/35 font-mono italic">
                            No actions.
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          id={`actionInput-${marker.id}`}
                          placeholder="ActionName (e.g. LiftUp)"
                          className="flex-grow bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] text-white focus:outline-none"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const target = e.currentTarget;
                              if (target.value.trim()) {
                                handleUpdateMarker(marker.id, {
                                  actions: [...marker.actions, target.value.trim()],
                                });
                                target.value = "";
                              }
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            const input = document.getElementById(
                              `actionInput-${marker.id}`
                            ) as HTMLInputElement;
                            if (input && input.value.trim()) {
                              handleUpdateMarker(marker.id, {
                                actions: [...marker.actions, input.value.trim()],
                              });
                              input.value = "";
                            }
                          }}
                          className="px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] text-white font-bold cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {markers.length === 0 && (
            <p className="text-[10px] font-mono text-marble/30 text-center italic py-2">
              No event markers configured.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
export default EventMarkersAccordion;
