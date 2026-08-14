import React from "react";
import { Sparkles } from "lucide-react";
import type { MatchScoutingEntry } from "@/lib/scoutingData";
import { ScoutingCounter } from "./ScoutingCounter";

export interface ScoutingTeleopSectionProps {
  teleop: MatchScoutingEntry["teleop"];
  teleopSubtotal: number;
  onUpdateTeleop: (field: keyof MatchScoutingEntry["teleop"], val: unknown) => void;
}

export function ScoutingTeleopSection({
  teleop,
  teleopSubtotal,
  onUpdateTeleop,
}: ScoutingTeleopSectionProps) {
  return (
    <section
      aria-labelledby="section-teleop-title"
      className="glass-card hero-card p-6 border border-white/10 bg-black/40"
    >
      <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-ares-cyan" aria-hidden="true" />
          <h2 id="section-teleop-title" className="text-base md:text-lg font-bold text-white uppercase font-heading">
            3. Driver-Controlled TeleOp (2m)
          </h2>
        </div>
        <span className="text-xs font-black uppercase tracking-widest px-3 py-1 rounded bg-ares-cyan/15 text-ares-cyan border border-ares-cyan/30">
          TeleOp Subtotal: +{teleopSubtotal} pts
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <ScoutingCounter
          id="teleop-high-basket"
          label="High Basket Samples"
          sublabel="Deposited into top high basket"
          value={teleop.highBasket}
          pointsEach="+8 pts"
          onChange={(val) => onUpdateTeleop("highBasket", val)}
          accentColor="cyan"
        />

        <ScoutingCounter
          id="teleop-low-basket"
          label="Low Basket Samples"
          sublabel="Deposited into bottom basket"
          value={teleop.lowBasket}
          pointsEach="+4 pts"
          onChange={(val) => onUpdateTeleop("lowBasket", val)}
          accentColor="cyan"
        />

        <ScoutingCounter
          id="teleop-specimen-transfer"
          label="Specimen Transfers"
          sublabel="Observed clips or zone passes"
          value={teleop.specimenTransfer}
          pointsEach="+6 pts"
          onChange={(val) => onUpdateTeleop("specimenTransfer", val)}
          accentColor="cyan"
        />
      </div>

      {/* Driver Agility Rating */}
      <div className="bg-white/5 border border-white/10 ares-cut p-4">
        <div className="flex justify-between items-center mb-3">
          <label id="driver-agility-label" className="text-xs font-bold text-white uppercase tracking-wider block">
            Driver Agility & Cycle Pace Rating (1 - 5)
          </label>
          <span className="text-xs font-mono font-bold text-ares-cyan">
            {teleop.driverAgility} / 5
          </span>
        </div>

        <div role="radiogroup" aria-labelledby="driver-agility-label" className="grid grid-cols-5 gap-2">
          {[
            { rating: 1, label: "Poor / Struggling" },
            { rating: 2, label: "Fair / Inconsistent" },
            { rating: 3, label: "Good / Solid Flow" },
            { rating: 4, label: "Great / Rapid Flow" },
            { rating: 5, label: "Elite / World Class" },
          ].map((item) => (
            <button
              key={item.rating}
              type="button"
              role="radio"
              aria-checked={teleop.driverAgility === item.rating}
              onClick={() => onUpdateTeleop("driverAgility", item.rating)}
              className={`py-3 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                teleop.driverAgility === item.rating
                  ? "bg-ares-cyan/20 border-ares-cyan text-white shadow-md scale-105"
                  : "bg-black/30 border-white/10 text-marble/55 hover:bg-white/5"
              }`}
            >
              <span className="block text-lg font-black font-heading">{item.rating}</span>
              <span className="text-[9px] uppercase tracking-tighter block mt-0.5 truncate">
                {item.label.split(" ")[0]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
