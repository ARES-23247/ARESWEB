import React from "react";
import { ChevronUp, ChevronDown, Settings } from "lucide-react";

interface KinematicsPanelProps {
  maxVelocity: number;
  setMaxVelocity: (val: number) => void;
  maxAcceleration: number;
  setMaxAcceleration: (val: number) => void;
  maxAngularVelocity: number;
  setMaxAngularVelocity: (val: number) => void;
  maxAngularAcceleration: number;
  setMaxAngularAcceleration: (val: number) => void;
  isKinematicsExpanded: boolean;
  setIsKinematicsExpanded: (val: boolean) => void;
}

export function KinematicsPanel({
  maxVelocity,
  setMaxVelocity,
  maxAcceleration,
  setMaxAcceleration,
  maxAngularVelocity,
  setMaxAngularVelocity,
  maxAngularAcceleration,
  setMaxAngularAcceleration,
  isKinematicsExpanded,
  setIsKinematicsExpanded,
}: KinematicsPanelProps) {
  return (
    <div className="bg-black/20 border border-white/5 rounded-xl overflow-hidden shadow-lg">
      <div
        onClick={() => setIsKinematicsExpanded(!isKinematicsExpanded)}
        className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 cursor-pointer border-b border-white/5 transition-all select-none"
      >
        <div className="flex items-center gap-2">
          {isKinematicsExpanded ? (
            <ChevronUp size={14} className="text-ares-cyan" />
          ) : (
            <ChevronDown size={14} className="text-marble/40" />
          )}
          <Settings size={14} className="text-ares-cyan" />
          <span className="text-xs font-black uppercase tracking-wider text-white">
            Robot Kinematics
          </span>
        </div>
        <span className="text-[9px] font-mono text-marble/50 bg-black/30 border border-white/5 px-2 py-0.5 rounded">
          Max: {maxVelocity.toFixed(1)} m/s | {maxAngularVelocity.toFixed(0)}°/s
        </span>
      </div>
      {isKinematicsExpanded && (
        <div className="p-3 flex flex-col gap-2.5 bg-black/10 border-t border-white/5">
          <div className="grid grid-cols-2 gap-2.5">
            {/* Max Velocity */}
            <div className="flex flex-col gap-1">
              <label htmlFor="kinematics-max-vel" className="text-[8px] font-mono uppercase text-marble/40 block">
                Max Velocity (m/s)
              </label>
              <input
                id="kinematics-max-vel"
                type="number"
                step="0.1"
                min="0.1"
                value={maxVelocity}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) setMaxVelocity(val);
                }}
                className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-cyan"
              />
            </div>
            {/* Max Acceleration */}
            <div className="flex flex-col gap-1">
              <label htmlFor="kinematics-max-accel" className="text-[8px] font-mono uppercase text-marble/40 block">
                Max Acceleration (m/s²)
              </label>
              <input
                id="kinematics-max-accel"
                type="number"
                step="0.1"
                min="0.1"
                value={maxAcceleration}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) setMaxAcceleration(val);
                }}
                className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-cyan"
              />
            </div>
            {/* Max Angular Velocity */}
            <div className="flex flex-col gap-1">
              <label htmlFor="kinematics-max-ang-vel" className="text-[8px] font-mono uppercase text-marble/40 block">
                Max Ang. Velocity (°/s)
              </label>
              <input
                id="kinematics-max-ang-vel"
                type="number"
                step="5"
                min="1"
                value={maxAngularVelocity}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) setMaxAngularVelocity(val);
                }}
                className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-cyan"
              />
            </div>
            {/* Max Angular Acceleration */}
            <div className="flex flex-col gap-1">
              <label htmlFor="kinematics-max-ang-accel" className="text-[8px] font-mono uppercase text-marble/40 block">
                Max Ang. Accel. (°/s²)
              </label>
              <input
                id="kinematics-max-ang-accel"
                type="number"
                step="5"
                min="1"
                value={maxAngularAcceleration}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) setMaxAngularAcceleration(val);
                }}
                className="w-full bg-obsidian border border-white/10 rounded px-2 py-1 text-[11px] font-mono text-white focus:outline-none focus:border-ares-cyan"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default KinematicsPanel;
