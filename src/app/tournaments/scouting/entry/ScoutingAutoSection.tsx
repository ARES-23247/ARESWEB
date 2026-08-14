import React from "react";
import { Zap } from "lucide-react";
import type { MatchScoutingEntry, ParkingZone } from "@/lib/scoutingData";
import { ScoutingCounter } from "./ScoutingCounter";

export interface ScoutingAutoSectionProps {
  auto: MatchScoutingEntry["auto"];
  autoSubtotal: number;
  onUpdateAuto: (field: keyof MatchScoutingEntry["auto"], val: unknown) => void;
}

export function ScoutingAutoSection({
  auto,
  autoSubtotal,
  onUpdateAuto,
}: ScoutingAutoSectionProps) {
  return (
    <section
      aria-labelledby="section-auto-title"
      className="glass-card hero-card p-6 border border-white/10 bg-black/40"
    >
      <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-ares-gold" aria-hidden="true" />
          <h2 id="section-auto-title" className="text-base md:text-lg font-bold text-white uppercase font-heading">
            2. Autonomous Phase (30s)
          </h2>
        </div>
        <span className="text-xs font-black uppercase tracking-widest px-3 py-1 rounded bg-ares-gold/15 text-ares-gold border border-ares-gold/30">
          Auto Subtotal: +{autoSubtotal} pts
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <ScoutingCounter
          id="auto-specimen-high"
          label="High Chamber Specimen"
          sublabel="Clipped on top submersible rung"
          value={auto.specimenHigh}
          pointsEach="+10 pts"
          onChange={(val) => onUpdateAuto("specimenHigh", val)}
          accentColor="gold"
        />

        <ScoutingCounter
          id="auto-specimen-low"
          label="Low Chamber Specimen"
          sublabel="Clipped on lower rung"
          value={auto.specimenLow}
          pointsEach="+6 pts"
          onChange={(val) => onUpdateAuto("specimenLow", val)}
          accentColor="gold"
        />

        <ScoutingCounter
          id="auto-sample-submerged"
          label="Submersible Samples"
          sublabel="Scored into Net / Submersible zone"
          value={auto.sampleSubmerged}
          pointsEach="+4 pts"
          onChange={(val) => onUpdateAuto("sampleSubmerged", val)}
          accentColor="gold"
        />
      </div>

      {/* Autonomous Parking Zone */}
      <div>
        <label id="auto-park-label" className="text-xs font-bold text-marble/80 uppercase tracking-wider block mb-2">
          Autonomous Parking Zone (+3 pts)
        </label>
        <div role="radiogroup" aria-labelledby="auto-park-label" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: "none", label: "None / Not Parked", pts: "0 pts" },
            { id: "observation_zone", label: "Observation Zone", pts: "+3 pts" },
            { id: "submersible", label: "Submersible Zone", pts: "+3 pts" },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={auto.parkingZone === option.id}
              onClick={() => onUpdateAuto("parkingZone", option.id as ParkingZone)}
              className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer ${
                auto.parkingZone === option.id
                  ? "bg-ares-gold/20 border-ares-gold text-white shadow-md"
                  : "bg-white/5 border-white/10 text-marble/65 hover:bg-white/10"
              }`}
            >
              <span className="text-xs font-bold uppercase">{option.label}</span>
              <span className="text-[10px] text-ares-gold font-mono mt-1">{option.pts}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
