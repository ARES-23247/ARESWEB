"use client";

import React, { useState } from "react";
import { Cog, Scale, Activity, Sparkles } from "lucide-react";
import GearboxSimulator from "./GearboxSimulator";
import CenterOfMassEstimator from "./CenterOfMassEstimator";
import PidTuningVisualizer from "./PidTuningVisualizer";

export type WidgetTab = "gearbox" | "com" | "pid";

export interface StemWidgetsHubProps {
  initialTab?: WidgetTab;
}

export default function StemWidgetsHub({ initialTab = "gearbox" }: StemWidgetsHubProps) {
  const [activeTab, setActiveTab] = useState<WidgetTab>(initialTab);

  return (
    <div className="w-full space-y-6" data-testid="stem-widgets-hub">
      {/* Subsystem Navigation Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ares-gold mb-1">
            <Sparkles className="h-4 w-4" /> ARES Academy STEM Laboratory
          </div>
          <h1 className="font-heading text-2xl font-black uppercase tracking-wider text-white sm:text-3xl">
            Interactive Physics & Robotics Calculators
          </h1>
          <p className="mt-1 text-sm text-marble/70">
            Mechanical gearing & torque transmission, 2D chassis center of gravity & tipping limits, and PID step-response telemetry.
          </p>
        </div>

        {/* Tab Switcher */}
        <div
          role="tablist"
          aria-label="STEM Interactive Widgets Navigation"
          className="flex flex-wrap items-center rounded-xl border border-white/10 bg-black/50 p-1.5 backdrop-blur-md"
        >
          <button
            role="tab"
            type="button"
            aria-selected={activeTab === "gearbox"}
            aria-controls="gearbox-tab-panel"
            id="gearbox-tab"
            onClick={() => setActiveTab("gearbox")}
            className={"flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer " +
              (activeTab === "gearbox"
                ? "bg-ares-gold text-black shadow-lg shadow-ares-gold/20"
                : "text-marble/80 hover:bg-white/5 hover:text-white")}
          >
            <Cog className="h-4 w-4" />
            Gearbox & Torque
          </button>

          <button
            role="tab"
            type="button"
            aria-selected={activeTab === "com"}
            aria-controls="com-tab-panel"
            id="com-tab"
            onClick={() => setActiveTab("com")}
            className={"flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer " +
              (activeTab === "com"
                ? "bg-ares-cyan text-black shadow-lg shadow-ares-cyan/20"
                : "text-marble/80 hover:bg-white/5 hover:text-white")}
          >
            <Scale className="h-4 w-4" />
            Center of Mass & Tipping
          </button>

          <button
            role="tab"
            type="button"
            aria-selected={activeTab === "pid"}
            aria-controls="pid-tab-panel"
            id="pid-tab"
            onClick={() => setActiveTab("pid")}
            className={"flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer " +
              (activeTab === "pid"
                ? "bg-ares-red text-white shadow-lg shadow-ares-red/20"
                : "text-marble/80 hover:bg-white/5 hover:text-white")}
          >
            <Activity className="h-4 w-4" />
            PID Step-Response
          </button>
        </div>
      </div>

      {/* Active Tab Panel */}
      <div className="w-full">
        {activeTab === "gearbox" && (
          <div role="tabpanel" id="gearbox-tab-panel" aria-labelledby="gearbox-tab">
            <GearboxSimulator />
          </div>
        )}

        {activeTab === "com" && (
          <div role="tabpanel" id="com-tab-panel" aria-labelledby="com-tab">
            <CenterOfMassEstimator />
          </div>
        )}

        {activeTab === "pid" && (
          <div role="tabpanel" id="pid-tab-panel" aria-labelledby="pid-tab">
            <PidTuningVisualizer />
          </div>
        )}
      </div>
    </div>
  );
}
