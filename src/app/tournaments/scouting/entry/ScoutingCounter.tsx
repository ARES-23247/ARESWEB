import React from "react";
import { Plus, Minus } from "lucide-react";

export interface CounterProps {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  pointsEach?: string;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  accentColor?: "red" | "gold" | "cyan";
}

export function ScoutingCounter({
  id,
  label,
  sublabel,
  value,
  pointsEach,
  min = 0,
  max = 99,
  onChange,
  accentColor = "gold",
}: CounterProps) {
  const handleDecrement = () => {
    if (value > min) onChange(value - 1);
  };

  const handleIncrement = () => {
    if (value < max) onChange(value + 1);
  };

  const colorClasses = {
    gold: "focus-within:border-ares-gold/60 text-ares-gold",
    red: "focus-within:border-ares-red/60 text-ares-red",
    cyan: "focus-within:border-ares-cyan/60 text-ares-cyan",
  }[accentColor];

  return (
    <div className={`bg-white/5 border border-white/10 ares-cut p-4 flex flex-col justify-between transition-all ${colorClasses}`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <label htmlFor={id} className="text-xs font-bold text-white uppercase tracking-wider block">
            {label}
          </label>
          {sublabel && <span className="text-[10px] text-marble/55 block mt-0.5">{sublabel}</span>}
        </div>
        {pointsEach && (
          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-white/5 border border-white/10 text-ares-gold font-mono">
            {pointsEach}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mt-auto">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          className="w-11 h-11 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer"
        >
          <Minus size={18} aria-hidden="true" />
        </button>

        <input
          id={id}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => {
            const parsed = parseInt(e.target.value, 10);
            if (!isNaN(parsed)) {
              onChange(Math.max(min, Math.min(max, parsed)));
            } else if (e.target.value === "") {
              onChange(min);
            }
          }}
          aria-label={label}
          className="w-16 text-center bg-black/40 border border-white/10 rounded-lg py-2 text-xl font-black text-white focus:outline-none focus:border-ares-gold font-heading"
        />

        <button
          type="button"
          onClick={handleIncrement}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
          className="w-11 h-11 rounded-lg bg-ares-red/40 hover:bg-ares-red/70 border border-ares-red/50 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-md"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
