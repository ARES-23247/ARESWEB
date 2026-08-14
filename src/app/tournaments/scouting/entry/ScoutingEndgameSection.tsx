import React from "react";
import { Trophy } from "lucide-react";
import type { MatchScoutingEntry, AscentLevel } from "@/lib/scoutingData";

export interface ScoutingEndgameSectionProps {
  endgame: MatchScoutingEntry["endgame"];
  endgameSubtotal: number;
  onUpdateEndgame: (field: keyof MatchScoutingEntry["endgame"], val: unknown) => void;
}

export function ScoutingEndgameSection({
  endgame,
  endgameSubtotal,
  onUpdateEndgame,
}: ScoutingEndgameSectionProps) {
  return (
    <section
      aria-labelledby="section-endgame-title"
      className="glass-card hero-card p-6 border border-white/10 bg-black/40"
    >
      <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-ares-red" aria-hidden="true" />
          <h2 id="section-endgame-title" className="text-base md:text-lg font-bold text-white uppercase font-heading">
            4. Endgame Ascent & Penalties (30s)
          </h2>
        </div>
        <span className="text-xs font-black uppercase tracking-widest px-3 py-1 rounded bg-ares-red/15 text-ares-red border border-ares-red/30">
          Endgame Subtotal: +{endgameSubtotal} pts
        </span>
      </div>

      {/* Ascent Level */}
      <div className="mb-6">
        <label id="ascent-level-label" className="text-xs font-bold text-marble/80 uppercase tracking-wider block mb-2">
          Submersible Ascent Hang Level
        </label>
        <div role="radiogroup" aria-labelledby="ascent-level-label" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { id: "none", label: "No Ascent", pts: "0 pts" },
            { id: "level_1", label: "Level 1 (Shallow)", pts: "+3 pts" },
            { id: "level_2", label: "Level 2 (Deep Hang)", pts: "+15 pts" },
            { id: "level_3", label: "Level 3 (High Hang)", pts: "+30 pts" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={endgame.ascentLevel === item.id}
              onClick={() => onUpdateEndgame("ascentLevel", item.id as AscentLevel)}
              className={`p-3.5 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer ${
                endgame.ascentLevel === item.id
                  ? "bg-ares-red/25 border-ares-red text-white shadow-md scale-[1.02]"
                  : "bg-white/5 border-white/10 text-marble/65 hover:bg-white/10"
              }`}
            >
              <span className="text-xs font-bold uppercase">{item.label}</span>
              <span className="text-xs font-black text-ares-gold font-mono mt-1.5">{item.pts}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Penalty Observations */}
      <div className="bg-black/30 border border-white/10 rounded-xl p-4">
        <label className="text-xs font-bold text-white uppercase tracking-wider block mb-3">
          Penalty Observations
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
            <input
              type="checkbox"
              checked={endgame.minorPenalty}
              onChange={(e) => onUpdateEndgame("minorPenalty", e.target.checked)}
              className="w-4 h-4 rounded border-white/20 text-ares-red focus:ring-ares-red"
            />
            <div>
              <span className="text-xs font-bold text-white block">Minor Penalty Observed</span>
              <span className="text-[10px] text-marble/55 block">-5 pts deduction</span>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
            <input
              type="checkbox"
              checked={endgame.majorPenalty}
              onChange={(e) => onUpdateEndgame("majorPenalty", e.target.checked)}
              className="w-4 h-4 rounded border-white/20 text-ares-red focus:ring-ares-red"
            />
            <div>
              <span className="text-xs font-bold text-white block">Major Penalty Observed</span>
              <span className="text-[10px] text-marble/55 block">-15 pts deduction</span>
            </div>
          </label>
        </div>
      </div>
    </section>
  );
}
