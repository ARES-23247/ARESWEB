import React from "react";
import { ChevronUp, ChevronDown, Link } from "lucide-react";
import { Waypoint } from "../../types/planner";

interface StartEndStatePanelProps {
  waypoints: Waypoint[];
  lockedWaypoints: Record<number, boolean>;
  startVelocity: number;
  setStartVelocity: (val: number) => void;
  startHeading: number;
  setStartHeading: (val: number) => void;
  endVelocity: number;
  setEndVelocity: (val: number) => void;
  endHeading: number;
  setEndHeading: (val: number) => void;
  unitMode: "inches" | "meters";
  handleUpdateWaypointAnchor: (idx: number, field: "x" | "y", valStr: string) => void;
  isStartingStateExpanded: boolean;
  setIsStartingStateExpanded: (val: boolean) => void;
  isEndStateExpanded: boolean;
  setIsEndStateExpanded: (val: boolean) => void;
}

export function StartEndStatePanel({
  waypoints,
  lockedWaypoints,
  startVelocity,
  setStartVelocity,
  startHeading,
  setStartHeading,
  endVelocity,
  setEndVelocity,
  endHeading,
  setEndHeading,
  unitMode,
  handleUpdateWaypointAnchor,
  isStartingStateExpanded,
  setIsStartingStateExpanded,
  isEndStateExpanded,
  setIsEndStateExpanded,
}: StartEndStatePanelProps) {
  const startWp = waypoints[0];
  const endWp = waypoints[waypoints.length - 1];

  return (
    <div className="flex flex-col gap-3">
      {/* Starting State Accordion */}
      <div className="bg-black/20 border border-white/5 rounded-xl overflow-hidden shadow-lg">
        <div
          onClick={() => setIsStartingStateExpanded(!isStartingStateExpanded)}
          className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 cursor-pointer border-b border-white/5 transition-all select-none"
        >
          <div className="flex items-center gap-2">
            {isStartingStateExpanded ? (
              <ChevronUp size={14} className="text-marble/60" />
            ) : (
              <ChevronDown size={14} className="text-marble/40" />
            )}
            <Link size={14} className="text-marble/40" />
            <span className="text-xs font-black uppercase tracking-wider text-white">
              Ideal Starting State
            </span>
          </div>
          <span className="text-[9px] font-mono text-marble/50 bg-black/30 border border-white/5 px-2 py-0.5 rounded">
            {startHeading.toFixed(1)}° starting with {startVelocity.toFixed(2)} M/S
          </span>
        </div>
        {isStartingStateExpanded && (
          <div className="p-3 flex flex-col gap-2.5 bg-black/10 border-t border-white/5">
            <div className="grid grid-cols-2 gap-2">
              {/* Start X */}
              <div className="flex flex-col gap-1">
                <label htmlFor="start-x-input" className="text-[8px] font-mono uppercase text-marble/40 block">
                  Start X ({unitMode === "meters" ? "M" : "In"})
                </label>
                <input
                  id="start-x-input"
                  type="number"
                  step="0.001"
                  value={
                    startWp
                      ? parseFloat(
                          (unitMode === "meters" ? startWp.anchor.x * 0.0254 : startWp.anchor.x).toFixed(
                            3
                          )
                        )
                      : 0
                  }
                  onChange={(e) => handleUpdateWaypointAnchor(0, "x", e.target.value)}
                  disabled={lockedWaypoints[0]}
                  className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-gold disabled:opacity-40"
                />
              </div>
              {/* Start Y */}
              <div className="flex flex-col gap-1">
                <label htmlFor="start-y-input" className="text-[8px] font-mono uppercase text-marble/40 block">
                  Start Y ({unitMode === "meters" ? "M" : "In"})
                </label>
                <input
                  id="start-y-input"
                  type="number"
                  step="0.001"
                  value={
                    startWp
                      ? parseFloat(
                          (unitMode === "meters" ? startWp.anchor.y * 0.0254 : startWp.anchor.y).toFixed(
                            3
                          )
                        )
                      : 0
                  }
                  onChange={(e) => handleUpdateWaypointAnchor(0, "y", e.target.value)}
                  disabled={lockedWaypoints[0]}
                  className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-gold disabled:opacity-40"
                />
              </div>
              {/* Start Velocity */}
              <div className="flex flex-col gap-1">
                <label htmlFor="start-vel-input" className="text-[8px] font-mono uppercase text-marble/40 block">
                  Start Velocity (m/s)
                </label>
                <input
                  id="start-vel-input"
                  type="number"
                  step="0.1"
                  min="0"
                  value={startVelocity}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) setStartVelocity(val);
                  }}
                  className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-gold"
                />
              </div>
              {/* Start Heading */}
              <div className="flex flex-col gap-1">
                <label htmlFor="start-heading-input" className="text-[8px] font-mono uppercase text-marble/40 block">
                  Start Heading (Deg)
                </label>
                <input
                  id="start-heading-input"
                  type="number"
                  step="1"
                  value={startHeading}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) setStartHeading(val);
                  }}
                  className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-gold"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Goal End State Accordion */}
      <div className="bg-black/20 border border-white/5 rounded-xl overflow-hidden shadow-lg">
        <div
          onClick={() => setIsEndStateExpanded(!isEndStateExpanded)}
          className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 cursor-pointer border-b border-white/5 transition-all select-none"
        >
          <div className="flex items-center gap-2">
            {isEndStateExpanded ? (
              <ChevronUp size={14} className="text-marble/60" />
            ) : (
              <ChevronDown size={14} className="text-marble/40" />
            )}
            <Link size={14} className="text-marble/40" />
            <span className="text-xs font-black uppercase tracking-wider text-white">
              Goal End State
            </span>
          </div>
          <span className="text-[9px] font-mono text-marble/50 bg-black/30 border border-white/5 px-2 py-0.5 rounded">
            {endHeading.toFixed(1)}° ending with {endVelocity.toFixed(2)} M/S
          </span>
        </div>
        {isEndStateExpanded && (
          <div className="p-3 flex flex-col gap-2.5 bg-black/10 border-t border-white/5">
            <div className="grid grid-cols-2 gap-2">
              {/* End X */}
              <div className="flex flex-col gap-1">
                <label htmlFor="end-x-input" className="text-[8px] font-mono uppercase text-marble/40 block">
                  End X ({unitMode === "meters" ? "M" : "In"})
                </label>
                <input
                  id="end-x-input"
                  type="number"
                  step="0.001"
                  value={
                    endWp
                      ? parseFloat(
                          (unitMode === "meters" ? endWp.anchor.x * 0.0254 : endWp.anchor.x).toFixed(3)
                        )
                      : 0
                  }
                  onChange={(e) => handleUpdateWaypointAnchor(waypoints.length - 1, "x", e.target.value)}
                  disabled={lockedWaypoints[waypoints.length - 1]}
                  className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-gold disabled:opacity-40"
                />
              </div>
              {/* End Y */}
              <div className="flex flex-col gap-1">
                <label htmlFor="end-y-input" className="text-[8px] font-mono uppercase text-marble/40 block">
                  End Y ({unitMode === "meters" ? "M" : "In"})
                </label>
                <input
                  id="end-y-input"
                  type="number"
                  step="0.001"
                  value={
                    endWp
                      ? parseFloat(
                          (unitMode === "meters" ? endWp.anchor.y * 0.0254 : endWp.anchor.y).toFixed(3)
                        )
                      : 0
                  }
                  onChange={(e) => handleUpdateWaypointAnchor(waypoints.length - 1, "y", e.target.value)}
                  disabled={lockedWaypoints[waypoints.length - 1]}
                  className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-gold disabled:opacity-40"
                />
              </div>
              {/* End Velocity */}
              <div className="flex flex-col gap-1">
                <label htmlFor="end-vel-input" className="text-[8px] font-mono uppercase text-marble/40 block">
                  End Velocity (m/s)
                </label>
                <input
                  id="end-vel-input"
                  type="number"
                  step="0.1"
                  min="0"
                  value={endVelocity}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) setEndVelocity(val);
                  }}
                  className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-gold"
                />
              </div>
              {/* End Heading */}
              <div className="flex flex-col gap-1">
                <label htmlFor="end-heading-input" className="text-[8px] font-mono uppercase text-marble/40 block">
                  End Heading (Deg)
                </label>
                <input
                  id="end-heading-input"
                  type="number"
                  step="1"
                  value={endHeading}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) setEndHeading(val);
                  }}
                  className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-gold"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default StartEndStatePanel;
