import React from "react";
import { RotateCcw, Copy, Check, Save } from "lucide-react";
import type { ScoutingScoreBreakdown } from "@/lib/scoutingData";

export interface ScoutingSummaryBreakdownProps {
  breakdown: ScoutingScoreBreakdown;
  copySuccess: boolean;
  onReset: () => void;
  onCopySummary: () => void;
  onSubmit: () => void;
}

export function ScoutingSummaryBreakdown({
  breakdown,
  copySuccess,
  onReset,
  onCopySummary,
  onSubmit,
}: ScoutingSummaryBreakdownProps) {
  const getRatingBadge = (rating: number) => {
    if (rating >= 75) {
      return { label: "Elite Contender", bg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
    }
    if (rating >= 50) {
      return { label: "Strong Performer", bg: "bg-ares-gold/20 text-ares-gold border-ares-gold/30" };
    }
    if (rating >= 30) {
      return { label: "Solid Contributor", bg: "bg-ares-cyan/20 text-ares-cyan border-ares-cyan/30" };
    }
    return { label: "Developing / Novice", bg: "bg-white/10 text-marble/70 border-white/20" };
  };

  const ratingBadge = getRatingBadge(breakdown.matchRating);

  return (
    <section
      aria-labelledby="section-summary-title"
      className="glass-card hero-card p-6 md:p-8 border-2 border-ares-gold/40 bg-gradient-to-b from-black/80 to-ares-red/10 shadow-2xl relative overflow-hidden"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/15 mb-6">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-ares-gold block mb-1">
            Tactical Review
          </span>
          <h2 id="section-summary-title" className="text-2xl md:text-3xl font-black uppercase text-white font-heading">
            Scouted Performance Breakdown
          </h2>
        </div>

        {/* Match Rating Badge */}
        <div className="flex items-center gap-3">
          <div className={`px-4 py-2 rounded-xl border text-center ${ratingBadge.bg}`}>
            <span className="text-[10px] uppercase font-black tracking-wider block">
              {ratingBadge.label}
            </span>
            <span className="text-2xl font-black font-heading block mt-0.5">
              {breakdown.matchRating}
              <span className="text-xs text-marble/60 font-sans">/100</span>
            </span>
          </div>
        </div>
      </div>

      {/* Score Grid Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 text-center">
          <span className="text-[10px] uppercase font-bold text-marble/60 block">Auto</span>
          <span className="text-xl font-black text-ares-gold font-heading mt-1 block">
            +{breakdown.autoPoints}
          </span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 text-center">
          <span className="text-[10px] uppercase font-bold text-marble/60 block">TeleOp</span>
          <span className="text-xl font-black text-ares-cyan font-heading mt-1 block">
            +{breakdown.teleopPoints}
          </span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 text-center">
          <span className="text-[10px] uppercase font-bold text-marble/60 block">Endgame</span>
          <span className="text-xl font-black text-ares-red font-heading mt-1 block">
            +{breakdown.endgamePoints}
          </span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 text-center">
          <span className="text-[10px] uppercase font-bold text-marble/60 block">Penalties</span>
          <span className="text-xl font-black text-red-400 font-heading mt-1 block">
            -{breakdown.penaltyDeduction}
          </span>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-ares-gold/15 border border-ares-gold/40 rounded-xl p-3.5 text-center">
          <span className="text-[10px] uppercase font-black text-ares-gold block">Total Match Pts</span>
          <span className="text-2xl font-black text-white font-heading mt-1 block">
            {breakdown.totalPoints}
          </span>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-marble/70 hover:text-white text-xs font-bold uppercase transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>Reset Sheet</span>
          </button>

          <button
            type="button"
            onClick={onCopySummary}
            className="px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-marble/70 hover:text-white text-xs font-bold uppercase transition-colors inline-flex items-center gap-2 cursor-pointer"
          >
            {copySuccess ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copySuccess ? "Copied!" : "Copy Summary"}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onSubmit}
          className="w-full sm:w-auto clipped-button bg-ares-red hover:bg-ares-bronze text-white font-black uppercase text-xs tracking-widest px-8 py-4 inline-flex items-center justify-center gap-2.5 shadow-xl transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          <Save size={16} aria-hidden="true" />
          <span>Save & Record Match</span>
        </button>
      </div>
    </section>
  );
}
