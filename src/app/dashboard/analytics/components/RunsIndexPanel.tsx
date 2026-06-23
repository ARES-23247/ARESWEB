"use client";

import React from "react";
import { Clock, ArrowLeftRight } from "lucide-react";
import MockDataBanner from "./MockDataBanner";

interface RunsIndexPanelProps {
  runs: any[];
  selectedRunId1: string;
  selectedRunId2: string;
  onSelectRun: (runId: string) => void;
  onSelectComparison: (runId: string) => void;
  loadingRuns: boolean;
  isMockData: boolean;
}

export default function RunsIndexPanel({
  runs,
  selectedRunId1,
  selectedRunId2,
  onSelectRun,
  onSelectComparison,
  loadingRuns,
  isMockData,
}: RunsIndexPanelProps) {
  return (
    <div className="lg:col-span-4 flex flex-col gap-4">
      <div className="bg-black/25 border border-white/5 rounded-xl p-4 flex flex-col gap-3 backdrop-blur-md">
        <h3 className="text-xs font-black uppercase text-ares-gold tracking-widest font-heading flex items-center gap-1.5">
          <Clock size={14} /> Telemetry Match Logs
        </h3>

        {loadingRuns ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-marble/35">
            <div className="w-6 h-6 border-2 border-ares-red/35 border-t-ares-red rounded-full animate-spin" />
            <span className="text-[10px] font-mono">Fetching runs list...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[480px] overflow-y-auto scrollbar-thin pr-1">
            {runs.map((run) => {
              const isSelected1 = run.runId === selectedRunId1;
              const isSelected2 = run.runId === selectedRunId2;
              const isCompareTarget = !!selectedRunId2 && isSelected2;

              return (
                <div
                  key={run.runId}
                  onClick={() => onSelectRun(run.runId)}
                  className={`p-3 ares-cut-sm border transition-all cursor-pointer flex flex-col gap-2 relative ${
                    isSelected1
                      ? "bg-ares-red/10 border-ares-red/50 shadow-[0_0_12px_rgba(192,0,0,0.1)]"
                      : isCompareTarget
                      ? "bg-ares-cyan/10 border-ares-cyan/50 shadow-[0_0_12px_rgba(0,192,192,0.1)]"
                      : "bg-black/30 border-white/5 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-white truncate font-mono">
                        {run.matchNumber ? `Match ${run.matchNumber}` : "Practice Run"}
                      </span>
                      <span className="text-[9px] text-marble/45 font-mono truncate mt-0.5">
                        ID: {run.runId.substring(0, 18)}...
                      </span>
                    </div>
                    <span
                      className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider ${
                        run.alliance === "RED"
                          ? "bg-ares-red/20 text-ares-red"
                          : "bg-ares-cyan/20 text-ares-cyan"
                      }`}
                    >
                      {run.alliance || "BLUE"}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-[9px] font-mono text-marble/65 border-t border-white/5 pt-2">
                    <div className="flex flex-col">
                      <span className="text-marble/35">Duration</span>
                      <span>{run.durationSeconds}s</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-marble/35">Min Batt</span>
                      <span className={run.minBatteryVoltage < 11.2 ? "text-ares-danger-soft font-bold" : ""}>
                        {run.minBatteryVoltage}V
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-marble/35">Max Drift</span>
                      <span className={run.maxEkfDriftCm > 8.0 ? "text-ares-gold font-bold" : ""}>
                        {run.maxEkfDriftCm}cm
                      </span>
                    </div>
                  </div>

                  {/* Quick compare click target */}
                  {!isSelected1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectComparison(run.runId);
                      }}
                      className="absolute right-2 top-2 p-1 rounded bg-white/5 hover:bg-ares-cyan/20 text-marble hover:text-ares-cyan transition-colors cursor-pointer"
                      title="Select as comparison run"
                    >
                      <ArrowLeftRight size={10} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isMockData && <MockDataBanner />}
    </div>
  );
}
