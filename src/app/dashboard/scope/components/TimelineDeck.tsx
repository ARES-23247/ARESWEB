import React from "react";
import { Play, Pause } from "lucide-react";
import { useScopeStore } from "../store/scopeStore";

export default function TimelineDeck({
  actions = [],
  visionEvents = []
}: {
  actions?: any[];
  visionEvents?: any[];
}) {
  const {
    isPlaying,
    currentTimeMs,
    playbackSpeed,
    telemetryData,
    setPlaying,
    setCurrentTimeMs,
    setPlaybackSpeed
  } = useScopeStore();

  const formatTime = (ms: number) => {
    const totalSecs = ms / 1000;
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toFixed(1).padStart(4, "0")}`;
  };

  if (!telemetryData) return null;

  return (
    <div className="glass-card p-6 border border-white/10 bg-neutral-950/65 flex flex-col gap-4 sticky bottom-4 z-40 shadow-2xl">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Play controls */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setPlaying(!isPlaying)}
            className="w-10 h-10 rounded-full bg-ares-gold hover:bg-ares-gold-soft text-black flex items-center justify-center cursor-pointer transition-all duration-300 shadow-md transform hover:scale-105 shrink-0"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>

          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-ares-gold tracking-widest leading-none">
              Timeline playhead
            </span>
            <span className="text-xs text-white font-mono font-bold mt-1">
              {formatTime(currentTimeMs)} / <span className="text-marble/35">{formatTime(telemetryData.maxTimeMs)}</span>
            </span>
          </div>
        </div>

        {/* Scrubber slider wrapped with markers */}
        <div className="flex-grow w-full relative flex items-center">
          {/* Render action markers above scrubber */}
          {actions.map((act, i) => {
            const actMs = act.timestampUs / 1000;
            const pct = Math.min(100, Math.max(0, (actMs / telemetryData.maxTimeMs) * 100));
            return (
              <div
                key={`act-${i}`}
                className="absolute w-1.5 h-1.5 rotate-45 bg-ares-cyan border border-black shadow-[0_0_4px_rgba(0,192,192,0.6)] -translate-x-1/2 group cursor-pointer z-30"
                style={{ left: `${pct}%`, top: "-10px" }}
              >
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-black/90 text-white text-[8px] px-1.5 py-0.5 rounded border border-ares-cyan/35 pointer-events-none whitespace-nowrap font-mono z-50">
                  Action: {act.type}
                </div>
              </div>
            );
          })}

          {/* Render vision reject markers below scrubber */}
          {visionEvents.filter(v => !v.accepted).map((v, i) => {
            const pct = Math.min(100, Math.max(0, (v.timestampMs / telemetryData.maxTimeMs) * 100));
            return (
              <div
                key={`vis-${i}`}
                className="absolute w-1.5 h-1.5 rounded-full bg-ares-red border border-black shadow-[0_0_4px_rgba(192,0,0,0.6)] -translate-x-1/2 group cursor-pointer z-30"
                style={{ left: `${pct}%`, bottom: "-10px" }}
              >
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 hidden group-hover:block bg-black/90 text-white text-[8px] px-1.5 py-0.5 rounded border border-ares-red/35 pointer-events-none whitespace-nowrap font-mono z-50">
                  Reject: {v.rejectionReason || "gate_failed"}
                </div>
              </div>
            );
          })}

          <input
            type="range"
            min="0"
            max={telemetryData.maxTimeMs}
            value={currentTimeMs}
            onChange={(e) => setCurrentTimeMs(parseInt(e.target.value))}
            className="w-full accent-ares-gold bg-white/5 h-1.5 rounded-lg appearance-none cursor-pointer border border-white/5 outline-none relative z-20"
          />
        </div>

        {/* Speed buttons */}
        <div className="flex items-center bg-black/45 border border-white/5 p-1 rounded-xl gap-1 shrink-0">
          {([0.5, 1.0, 1.5, 2.0] as const).map((speed) => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              className={`px-3 py-1 rounded-lg text-[9px] font-black tracking-wider uppercase transition-all duration-300 cursor-pointer ${
                playbackSpeed === speed
                  ? "bg-ares-gold text-black font-extrabold"
                  : "text-marble/45 hover:text-white"
              }`}
            >
              {speed.toFixed(1)}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
