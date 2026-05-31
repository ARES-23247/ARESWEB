"use client";

import React, { useState } from "react";
import { useScopeStore } from "../store/scopeStore";
import { Search, ChevronDown, ChevronRight, Activity, TrendingUp } from "lucide-react";

interface InspectorItemProps {
  label: string;
  value: string | number;
  unit?: string;
  signalKey?: string;
  isPlottable?: boolean;
}

function InspectorItem({ label, value, unit = "", signalKey, isPlottable = false }: InspectorItemProps) {
  const { selectedKeys, toggleSelectedKey } = useScopeStore();
  const isSelected = signalKey ? selectedKeys.includes(signalKey) : false;

  return (
    <div className="flex items-center justify-between border-b border-white/5 py-2.5 text-xs">
      <span className="text-marble/70 font-mono font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-white font-mono font-bold tracking-tight">
          {typeof value === "number" ? value.toFixed(2) : value}
          <span className="text-marble/35 ml-0.5 font-medium">{unit}</span>
        </span>
        
        {isPlottable && signalKey && (
          <button
            onClick={() => toggleSelectedKey(signalKey)}
            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all duration-300 cursor-pointer ${
              isSelected
                ? "bg-ares-gold/15 border-ares-gold/30 text-ares-gold"
                : "border-white/5 text-marble/35 hover:border-white/10 hover:text-marble/65"
            }`}
            title="Toggle plot visibility on line charts"
          >
            <TrendingUp size={10} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function StateInspector() {
  const { telemetryData, currentTimeMs, getCurrentFrame } = useScopeStore();
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    odometry: true,
    power: true,
    actuators: true,
    diagnostics: true
  });

  const currentFrame = getCurrentFrame();

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  if (!telemetryData || !currentFrame) {
    return (
      <div className="glass-card p-6 border border-white/10 h-full flex flex-col gap-4">
        <h3 className="text-sm font-black uppercase text-white tracking-widest font-heading border-b border-white/5 pb-3">
          🔎 State Inspector
        </h3>
        <div className="bg-black/45 border border-white/5 flex-grow rounded-xl flex items-center justify-center p-8 text-center text-marble/35 text-xs">
          Load telemetry file or BigQuery run to inspect active state nodes.
        </div>
      </div>
    );
  }

  // Categories helper mapping
  const matchesSearch = (str: string) => str.toLowerCase().includes(search.toLowerCase());

  return (
    <div className="glass-card p-6 border border-white/10 flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="border-b border-white/5 pb-3 flex items-center justify-between">
        <h3 className="text-sm font-black uppercase text-white tracking-widest font-heading">
          🔎 State Inspector
        </h3>
        <span className="bg-white/5 border border-white/10 text-[9px] font-mono px-2 py-0.5 text-marble/55 rounded-md">
          {telemetryData.timestamps.length} frames
        </span>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-marble/30">
          <Search size={12} />
        </span>
        <input
          type="text"
          placeholder="Filter telemetry keys..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-black/50 border border-white/5 focus:border-ares-gold/25 focus:ring-1 focus:ring-ares-gold/25 rounded-xl pl-9.5 pr-4 py-2 text-xs text-white placeholder-marble/30 font-medium font-mono focus:outline-none"
        />
      </div>

      {/* Collapsible States Tree */}
      <div className="flex-grow overflow-y-auto space-y-4 max-h-[360px] pr-1">
        
        {/* Category 1: Odometry */}
        {matchesSearch("odometry x y heading pose coordinate") && (
          <div className="border border-white/5 bg-black/25 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleCategory("odometry")}
              className="w-full bg-white/5 px-4 py-3 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-white border-b border-white/5 cursor-pointer"
            >
              <span className="flex items-center gap-1.5 text-ares-gold">
                <Activity size={10} /> localization.odometry
              </span>
              {expandedCategories.odometry ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            
            {expandedCategories.odometry && (
              <div className="p-4 space-y-0.5 bg-black/10">
                <InspectorItem label="odometry/pose/x" value={currentFrame.x} unit="in" />
                <InspectorItem label="odometry/pose/y" value={currentFrame.y} unit="in" />
                <InspectorItem label="odometry/pose/heading" value={currentFrame.heading} unit="rad" />
                <InspectorItem label="odometry/pose/heading_deg" value={(currentFrame.heading * 180) / Math.PI} unit="deg" />
              </div>
            )}
          </div>
        )}

        {/* Category 2: Power Subsystem */}
        {matchesSearch("power battery motor current voltage amps") && (
          <div className="border border-white/5 bg-black/25 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleCategory("power")}
              className="w-full bg-white/5 px-4 py-3 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-white border-b border-white/5 cursor-pointer"
            >
              <span className="flex items-center gap-1.5 text-ares-gold">
                <Activity size={10} /> power.drivetrain
              </span>
              {expandedCategories.power ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>

            {expandedCategories.power && (
              <div className="p-4 space-y-0.5 bg-black/10">
                <InspectorItem label="power/battery_voltage" value={currentFrame.battery} unit="V" signalKey="battery" isPlottable />
                <InspectorItem label="power/current/motor_lf" value={currentFrame.motors.lf} unit="A" />
                <InspectorItem label="power/current/motor_rf" value={currentFrame.motors.rf} unit="A" />
                <InspectorItem label="power/current/motor_lr" value={currentFrame.motors.lr} unit="A" />
                <InspectorItem label="power/current/motor_rr" value={currentFrame.motors.rr} unit="A" />
              </div>
            )}
          </div>
        )}

        {/* Category 3: Actuators & Mechanisms */}
        {matchesSearch("actuators mechanisms slide height lifter intake height current") && (
          <div className="border border-white/5 bg-black/25 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleCategory("actuators")}
              className="w-full bg-white/5 px-4 py-3 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-white border-b border-white/5 cursor-pointer"
            >
              <span className="flex items-center gap-1.5 text-ares-gold">
                <Activity size={10} /> actuators.mechanisms
              </span>
              {expandedCategories.actuators ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>

            {expandedCategories.actuators && (
              <div className="p-4 space-y-0.5 bg-black/10">
                <InspectorItem label="mechanisms/slide/height" value={currentFrame.slides.height} unit="ticks" />
                <InspectorItem label="mechanisms/slide/current" value={currentFrame.slides.current} unit="A" signalKey="slideCurrent" isPlottable />
                <InspectorItem label="mechanisms/intake/current" value={currentFrame.intake.current} unit="A" signalKey="intakeCurrent" isPlottable />
              </div>
            )}
          </div>
        )}

        {/* Category 4: Loop Diagnostics */}
        {matchesSearch("diagnostics loop clock cycle times ms frequency") && (
          <div className="border border-white/5 bg-black/25 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleCategory("diagnostics")}
              className="w-full bg-white/5 px-4 py-3 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-white border-b border-white/5 cursor-pointer"
            >
              <span className="flex items-center gap-1.5 text-ares-gold">
                <Activity size={10} /> diagnostics.system
              </span>
              {expandedCategories.diagnostics ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>

            {expandedCategories.diagnostics && (
              <div className="p-4 space-y-0.5 bg-black/10">
                <InspectorItem label="diagnostics/loop_time" value={currentFrame.loopTime} unit="ms" signalKey="loopTime" isPlottable />
                <InspectorItem label="diagnostics/loop_hz" value={1000 / currentFrame.loopTime} unit="Hz" />
                <InspectorItem label="diagnostics/elapsed_time" value={currentTimeMs} unit="ms" />
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
