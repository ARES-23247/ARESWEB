import React from "react";
import { Sliders } from "lucide-react";

interface TuningSettingsDrawerProps {
  visionStdDevX: number;
  setVisionStdDevX: (val: number) => void;
  visionStdDevY: number;
  setVisionStdDevY: (val: number) => void;
  visionStdDevTheta: number;
  setVisionStdDevTheta: (val: number) => void;
}

export default function TuningSettingsDrawer({
  visionStdDevX,
  setVisionStdDevX,
  visionStdDevY,
  setVisionStdDevY,
  visionStdDevTheta,
  setVisionStdDevTheta
}: TuningSettingsDrawerProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-heading font-black text-xs uppercase tracking-widest text-ares-gold flex items-center gap-2">
        <Sliders size={14} /> EKF Odometry Overrides
      </h3>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[8px] uppercase font-black tracking-widest text-marble/40">
            Std Dev X (m)
          </label>
          <input
            type="number"
            step="0.01"
            value={visionStdDevX}
            onChange={(e) => setVisionStdDevX(parseFloat(e.target.value) || 0.05)}
            className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs text-center font-mono focus:outline-none focus:border-ares-gold"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[8px] uppercase font-black tracking-widest text-marble/40">
            Std Dev Y (m)
          </label>
          <input
            type="number"
            step="0.01"
            value={visionStdDevY}
            onChange={(e) => setVisionStdDevY(parseFloat(e.target.value) || 0.05)}
            className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs text-center font-mono focus:outline-none focus:border-ares-gold"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[8px] uppercase font-black tracking-widest text-marble/40">
            Std Dev Theta (rad)
          </label>
          <input
            type="number"
            step="0.01"
            value={visionStdDevTheta}
            onChange={(e) => setVisionStdDevTheta(parseFloat(e.target.value) || 0.1)}
            className="bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs text-center font-mono focus:outline-none focus:border-ares-gold"
          />
        </div>
      </div>
    </div>
  );
}
