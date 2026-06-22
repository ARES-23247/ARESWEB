import React from "react";
import { Play, Pause } from "lucide-react";
import { useScopeStore } from "../store/scopeStore";

export default function TimelineDeck() {
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

        {/* Scrubber slider */}
        <input
          type="range"
          min="0"
          max={telemetryData.maxTimeMs}
          value={currentTimeMs}
          onChange={(e) => setCurrentTimeMs(parseInt(e.target.value))}
          className="flex-grow w-full accent-ares-gold bg-white/5 h-1.5 rounded-lg appearance-none cursor-pointer border border-white/5 outline-none"
        />

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
