"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Code2, Wrench, Sparkles } from "lucide-react";
import SEO from "@/components/SEO";
import SimulationPlayground from "@/components/SimulationPlayground";
import StemWidgetsHub, { type WidgetTab } from "@/app/academy/widgets/StemWidgetsHub";

export default function AcademyPlaygroundPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const modeParam = searchParams.get("mode");
  const toolParam = searchParams.get("tool");

  // Mode: "sandbox" (code simulator) vs "stem" (physics & robotics widgets)
  const [activeMode, setActiveMode] = useState<"stem" | "sandbox">(
    modeParam === "sandbox" ? "sandbox" : "stem"
  );

  useEffect(() => {
    if (modeParam === "sandbox" && activeMode !== "sandbox") {
      setActiveMode("sandbox");
    } else if (modeParam === "stem" && activeMode !== "stem") {
      setActiveMode("stem");
    }
  }, [modeParam, activeMode]);

  const handleModeChange = (mode: "stem" | "sandbox") => {
    setActiveMode(mode);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("mode", mode);
      return next;
    });
  };

  const initialWidgetTab: WidgetTab =
    toolParam === "com" || toolParam === "tipping"
      ? "com"
      : toolParam === "pid" || toolParam === "control"
      ? "pid"
      : "gearbox";

  return (
    <div className="min-h-screen bg-obsidian px-4 pb-12 pt-24 text-white" data-testid="academy-playground-page">
      <SEO
        title="Simulation Playground & STEM Interactive Tools — ARES Academy"
        description="Run robotics simulations in the browser, compute gear ratios and torque multiplication, estimate 2D center of mass and tipping angles, and tune PID step responses."
      />

      <div className="mx-auto mb-6 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ares-gold mb-1">
              <Sparkles className="h-4 w-4" /> ARES Academy Lab
            </div>
            <h1 className="font-heading text-3xl font-black uppercase tracking-wider text-white">
              Simulation & STEM Lab
            </h1>
            <p className="mt-1 text-sm text-marble/70">
              Interactive physics calculators and live WebGL robotics sandbox.
            </p>
          </div>

          {/* Mode Switcher */}
          <div
            role="tablist"
            aria-label="Playground Workspace Modes"
            className="flex items-center rounded-xl border border-white/10 bg-black/60 p-1.5 backdrop-blur-md self-start sm:self-auto"
          >
            <button
              role="tab"
              type="button"
              aria-selected={activeMode === "stem"}
              onClick={() => handleModeChange("stem")}
              className={"flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer " +
                (activeMode === "stem"
                  ? "bg-ares-gold text-black shadow-lg shadow-ares-gold/20"
                  : "text-marble/80 hover:bg-white/5 hover:text-white")}
            >
              <Wrench className="h-4 w-4" />
              STEM Widgets
            </button>

            <button
              role="tab"
              type="button"
              aria-selected={activeMode === "sandbox"}
              onClick={() => handleModeChange("sandbox")}
              className={"flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer " +
                (activeMode === "sandbox"
                  ? "bg-ares-cyan text-black shadow-lg shadow-ares-cyan/20"
                  : "text-marble/80 hover:bg-white/5 hover:text-white")}
            >
              <Code2 className="h-4 w-4" />
              Code Sandbox
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Canvas */}
      <div className="mx-auto max-w-7xl">
        {activeMode === "stem" ? (
          <div className="space-y-6">
            <StemWidgetsHub initialTab={initialWidgetTab} />
          </div>
        ) : (
          <div className="h-[82vh] overflow-hidden border border-white/10 bg-black/10 rounded-xl shadow-2xl">
            <SimulationPlayground />
          </div>
        )}
      </div>
    </div>
  );
}
