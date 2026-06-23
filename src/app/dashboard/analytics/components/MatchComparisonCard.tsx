"use client";

import React from "react";
import { ArrowLeftRight } from "lucide-react";
import FullscreenCard from "./FullscreenCard";

interface MatchComparisonCardProps {
  selectedRunId1: string;
  selectedRunId2: string;
  comparisonData: any;
  loadingComparison: boolean;
  runs: any[];
}

export default function MatchComparisonCard({
  selectedRunId1,
  selectedRunId2,
  comparisonData,
  loadingComparison,
  runs,
}: MatchComparisonCardProps) {
  const activeRun = runs.find((r) => r.runId === selectedRunId1) || {};
  const compRun = runs.find((r) => r.runId === selectedRunId2) || {};

  /** Safely read motor stats from comparisonData.motors if available, else from run summary */
  const getPrimaryMotorStats = () => {
    if (comparisonData?.motors) {
      const primaryMotors = comparisonData.motors.filter((m: any) => m.run_id === selectedRunId1);
      if (primaryMotors.length > 0) {
        return primaryMotors.reduce((acc: Record<string, number>, m: any) => {
          acc[m.motor_id] = m.avg_current;
          return acc;
        }, {});
      }
    }
    return activeRun.avgMotorCurrentAmps || {};
  };

  const getComparisonMotorStats = () => {
    if (comparisonData?.motors) {
      const compMotors = comparisonData.motors.filter((m: any) => m.run_id === selectedRunId2);
      if (compMotors.length > 0) {
        return compMotors.reduce((acc: Record<string, number>, m: any) => {
          acc[m.motor_id] = m.avg_current;
          return acc;
        }, {});
      }
    }
    return compRun.avgMotorCurrentAmps || {};
  };

  const primaryMotors = getPrimaryMotorStats();
  const compMotors = getComparisonMotorStats();

  const renderChart = (isFullscreen: boolean) => {
    if (!comparisonData?.states || comparisonData.states.length === 0) {
      return (
        <div className="py-12 text-center text-xs text-marble/35">
          No IMU timeseries coordinates fetched for these runs.
        </div>
      );
    }

    const primaryStates = comparisonData.states.filter((r: any) => r.run_id === selectedRunId1);
    const compStates = comparisonData.states.filter((r: any) => r.run_id === selectedRunId2);

    const chartHeight = isFullscreen ? 400 : 220;
    const svgHeight = isFullscreen ? 360 : 200;

    return (
      <div className={`${isFullscreen ? "h-[70vh]" : "h-[220px]"} w-full relative`}>
        <svg viewBox={`0 0 500 ${svgHeight}`} className="w-full h-full text-marble/10">
          {/* Y-axis line */}
          <line x1="40" y1="20" x2="40" y2={svgHeight - 20} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          {/* Zero line */}
          <line x1="40" y1={svgHeight / 2} x2="480" y2={svgHeight / 2} stroke="rgba(255,255,255,0.15)" strokeWidth="0.75" />

          {/* Y-axis labels: -10°, 0°, +10° */}
          <text x="35" y={svgHeight / 2 - 40} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="monospace">
            +10°
          </text>
          <text x="35" y={svgHeight / 2 + 4} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="monospace">
            0°
          </text>
          <text x="35" y={svgHeight / 2 + 44} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="monospace">
            -10°
          </text>

          {/* X-axis label */}
          <text x="260" y={svgHeight - 4} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="10" fontFamily="monospace">
            Time →
          </text>

          {/* Primary EKF Pitch (Red Line) */}
          {primaryStates.length > 0 && (
            <path
              d={
                `M ` +
                primaryStates
                  .map((r: any, idx: number, arr: any[]) => {
                    const x = 40 + (idx / (arr.length || 1)) * 420;
                    const y = svgHeight / 2 - (r.pitch || 0) * 4;
                    return `${x} ${y}`;
                  })
                  .join(" L ")
              }
              fill="none"
              stroke="#c00000"
              strokeWidth="2"
            />
          )}

          {/* Secondary EKF Pitch (Cyan Line) */}
          {compStates.length > 0 && (
            <path
              d={
                `M ` +
                compStates
                  .map((r: any, idx: number, arr: any[]) => {
                    const x = 40 + (idx / (arr.length || 1)) * 420;
                    const y = svgHeight / 2 - (r.pitch || 0) * 4;
                    return `${x} ${y}`;
                  })
                  .join(" L ")
              }
              fill="none"
              stroke="#00c0c0"
              strokeWidth="2"
            />
          )}
        </svg>
        <div className="absolute top-2 right-2 flex items-center gap-4 text-[9px] font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-ares-red inline-block" />
            <span>Primary Pitch</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-ares-cyan inline-block" />
            <span>Compare Pitch</span>
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-black/25 border border-white/5 rounded-xl p-5 flex flex-col gap-6 backdrop-blur-md animate-fade-in">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div>
          <h3 className="text-xs font-black uppercase text-white tracking-widest font-heading flex items-center gap-1.5">
            <ArrowLeftRight size={16} className="text-ares-red" /> Dual Telemetry Match Comparison
          </h3>
          <span className="text-[10px] text-marble/45 font-mono">
            Overlaying battery sags, motor current spikes, and telemetry loop deltas.
          </span>
        </div>
      </div>

      {loadingComparison ? (
        <div className="py-16 flex flex-col items-center justify-center gap-2 text-marble/35">
          <div className="w-8 h-8 border-2 border-ares-red/35 border-t-ares-red rounded-full animate-spin" />
          <span className="text-[10px] font-mono">Querying comparative arrays...</span>
        </div>
      ) : comparisonData ? (
        <div className="flex flex-col gap-6">
          {/* Side by Side stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-ares-red/5 border border-ares-red/20 p-4 rounded-xl flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase text-ares-red font-mono">Primary Run</span>
              <span className="text-xs font-mono text-white truncate">{selectedRunId1}</span>
              <div className="flex flex-col gap-1 text-xs font-mono text-marble/65 border-t border-white/5 pt-2 mt-1">
                <span>
                  Averaged Current LF: <strong>{primaryMotors.lf ?? "N/A"}A</strong>
                </span>
                <span>
                  Averaged Current RF: <strong>{primaryMotors.rf ?? "N/A"}A</strong>
                </span>
                <span>
                  Min Voltage sag: <strong className="text-white">{activeRun.minBatteryVoltage ?? "N/A"}V</strong>
                </span>
              </div>
            </div>

            <div className="bg-ares-cyan/5 border border-ares-cyan/20 p-4 rounded-xl flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase text-ares-cyan font-mono">Comparison Run</span>
              <span className="text-xs font-mono text-white truncate">{selectedRunId2}</span>
              <div className="flex flex-col gap-1 text-xs font-mono text-marble/65 border-t border-white/5 pt-2 mt-1">
                <span>
                  Averaged Current LF: <strong>{compMotors.lf ?? "N/A"}A</strong>
                </span>
                <span>
                  Averaged Current RF: <strong>{compMotors.rf ?? "N/A"}A</strong>
                </span>
                <span>
                  Min Voltage sag: <strong className="text-white">{compRun.minBatteryVoltage ?? "N/A"}V</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Chart */}
          <FullscreenCard title="IMU Gyro Pitch/Roll Angle Comparison">
            {(isFullscreen) => (
              <div className="bg-black/45 border border-white/10 p-4 rounded-xl flex flex-col gap-3">
                <span className="text-[10px] font-black uppercase text-white font-mono">
                  IMU Gyro Pitch/Roll Angle Comparison
                </span>
                {renderChart(isFullscreen)}
              </div>
            )}
          </FullscreenCard>
        </div>
      ) : (
        <div className="py-12 text-center text-xs text-marble/35">
          Select a second run to query and render match comparisons.
        </div>
      )}
    </div>
  );
}
