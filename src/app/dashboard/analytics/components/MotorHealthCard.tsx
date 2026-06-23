"use client";

import React from "react";
import { Zap } from "lucide-react";

interface MotorHealthCardProps {
  healthData: any;
  loadingHealth: boolean;
  activeRun: any;
}

export default function MotorHealthCard({ healthData, loadingHealth, activeRun }: MotorHealthCardProps) {
  return (
    <div className="bg-black/25 border border-white/5 rounded-xl p-5 flex flex-col gap-4 backdrop-blur-md">
      <h3 className="text-xs font-black uppercase text-white tracking-widest font-heading flex items-center gap-1.5">
        <Zap size={16} className="text-ares-danger-soft" /> Subsystem Motor Currents
      </h3>

      {loadingHealth ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2 text-marble/35">
          <div className="w-6 h-6 border-2 border-ares-danger/35 border-t-ares-danger rounded-full animate-spin" />
          <span className="text-[10px] font-mono">Loading currents...</span>
        </div>
      ) : healthData && healthData.motors ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {healthData.motors.map((motor: any) => {
              const isHigh = motor.max_current > 18.0;
              return (
                <div
                  key={motor.motor_id}
                  className={`p-3 rounded-lg border flex flex-col gap-2 bg-black/40 ${
                    isHigh ? "border-ares-danger/30" : "border-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white font-mono uppercase">
                      Motor ID: {motor.motor_id || "Unknown"}
                    </span>
                    {isHigh && (
                      <span className="bg-ares-danger/20 text-ares-danger-soft text-[8px] font-black uppercase px-2 py-0.5 rounded-md animate-pulse">
                        STALL DANGER
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 text-[10px] font-mono text-marble/65">
                    <div className="flex justify-between">
                      <span>Average Current:</span>
                      <strong className="text-white">
                        {motor.avg_current ? motor.avg_current.toFixed(2) : "N/A"} A
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Current Draw:</span>
                      <strong className={isHigh ? "text-ares-danger-soft font-bold" : "text-white"}>
                        {motor.max_current ? motor.max_current.toFixed(2) : "N/A"} A
                      </strong>
                    </div>
                  </div>

                  {/* Visual bar */}
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full rounded-full ${isHigh ? "bg-ares-danger" : "bg-ares-cyan"}`}
                      style={{ width: `${Math.min(100, ((motor.max_current || 0) / 25.0) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : activeRun?.avgMotorCurrentAmps ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Fallback to averages in run summary */}
          {Object.entries(activeRun.avgMotorCurrentAmps).map(([axis, val]: [string, any]) => {
            const isHigh = val > 5.0;
            return (
              <div key={axis} className="p-3 rounded-lg border border-white/5 bg-black/40 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white font-mono uppercase">
                    Motor Axle: {axis.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] font-mono text-marble/65">
                  <span>Average Current:</span>
                  <strong className="text-white">{val} A</strong>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full rounded-full bg-ares-cyan"
                    style={{ width: `${Math.min(100, (val / 10.0) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-6 text-center text-xs text-marble/35 font-mono">
          No motor health data available for this run.
        </div>
      )}
    </div>
  );
}
